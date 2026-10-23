#!/usr/bin/env python3
"""Prove actual Android UI receipt label/value alignment.

Checks each row on-screen together. Simply finding '1.500 lekë' elsewhere
(e.g. a product card) does not satisfy the subtotal assertion.
Synthetic CI only; UI XML stays on emulator/runner, never uploaded.
"""
import re
import subprocess
import time
import xml.etree.ElementTree as ET

ROWS = [
    ("Nëntotali", "1.500 lekë"),
    ("Transporti", "10 lekë"),
    ("Gjithsej", "1.510 lekë"),
]


def adb(*args: str) -> str:
    return subprocess.run(
        ["adb", *args], text=True, check=True, capture_output=True, timeout=40
    ).stdout


def visible_nodes():
    adb("shell", "uiautomator", "dump", "/sdcard/receipt-tree.xml")
    root = ET.fromstring(adb("exec-out", "cat", "/sdcard/receipt-tree.xml"))
    out = []
    for item in root.iter("node"):
        a = item.attrib
        m = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", a.get("bounds", ""))
        if not m:
            continue
        x1, y1, x2, y2 = map(int, m.groups())
        if x2 <= x1 or y2 <= y1:
            continue
        for value in (a.get("text", ""), a.get("content-desc", "")):
            if value:
                out.append((value, (x1 + x2) / 2, (y1 + y2) / 2))
    return out


def row_present(nodes, label, amount):
    label_nodes = [(x, y) for t, x, y in nodes if t == label]
    amount_nodes = [(x, y) for t, x, y in nodes if t == amount]
    return any(
        ax > lx and abs(ay - ly) <= 36
        for lx, ly in label_nodes for ax, ay in amount_nodes
    )


def main():
    remaining = dict(ROWS)
    for attempt in range(13):
        nodes = visible_nodes()
        for label, amount in list(remaining.items()):
            if row_present(nodes, label, amount):
                print(f"SHQIPSHOP_ANDROID_RECEIPT_ROW_PASSED label={label!r} value={amount!r}")
                del remaining[label]
        if not remaining:
            print("SHQIPSHOP_ANDROID_RECEIPT_ALL_ROWS_PASSED")
            return
        if attempt < 12:
            adb("shell", "input", "swipe", "650", "1710", "650", "1080", "420")
            time.sleep(1.4)
    raise SystemExit(f"Receipt row alignment missing: {list(remaining)}")


if __name__ == "__main__":
    main()
