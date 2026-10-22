#!/usr/bin/env python3
"""ADB UI hierarchy actions for disposable Android E2E CI.

Read-only app text is inspected locally; the XML tree is never uploaded.
No UI coordinates are hard-coded for press targets: nodes supply bounds.
"""
import argparse
import re
import subprocess
import time
import xml.etree.ElementTree as ET


def adb(*args: str, timeout: int = 35) -> str:
    return subprocess.run(
        ["adb", *args], check=True, text=True, capture_output=True, timeout=timeout
    ).stdout


def hierarchy() -> ET.Element:
    adb("shell", "uiautomator", "dump", "/sdcard/shqipshop-ui.xml", timeout=35)
    return ET.fromstring(adb("exec-out", "cat", "/sdcard/shqipshop-ui.xml"))


def matching_bounds(root: ET.Element, needle: str, exact: bool) -> tuple[int, int] | None:
    for node in root.iter("node"):
        attrs = node.attrib
        if attrs.get("enabled") == "false":
            continue
        values = [attrs.get("text", ""), attrs.get("content-desc", "")]
        found = any(v == needle if exact else needle in v for v in values)
        if not found:
            continue
        bounds = re.fullmatch(
            r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", attrs.get("bounds", "")
        )
        if bounds:
            x1, y1, x2, y2 = map(int, bounds.groups())
            if x2 > x1 and y2 > y1:
                return (x1 + x2) // 2, (y1 + y2) // 2
    return None


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("action", choices=("tap", "wait"))
    p.add_argument("text")
    p.add_argument("--exact", action="store_true")
    p.add_argument("--timeout", type=int, default=65)
    p.add_argument("--scroll", type=int, default=0)
    args = p.parse_args()
    expires = time.monotonic() + args.timeout
    attempts = 0
    remaining_scrolls = args.scroll
    last_error = ""
    while time.monotonic() < expires:
        attempts += 1
        try:
            found = matching_bounds(hierarchy(), args.text, args.exact)
        except (ET.ParseError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as err:
            last_error = type(err).__name__
            found = None
        if found is not None:
            if args.action == "tap":
                adb("shell", "input", "tap", str(found[0]), str(found[1]))
            print(f"SHQIPSHOP_ANDROID_UI_{args.action.upper()}_OK target={args.text!r} tries={attempts}")
            return
        if remaining_scrolls and attempts % 3 == 0:
            # Android UI test-only scroll to reveal native product variants/CTA.
            adb("shell", "input", "swipe", "650", "1800", "650", "900", "380")
            remaining_scrolls -= 1
        time.sleep(2)
    raise SystemExit(
        f"UI target {args.text!r} not found/enabled after {attempts} attempts; last_error={last_error}"
    )


if __name__ == "__main__":
    main()
