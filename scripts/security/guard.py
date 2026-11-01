#!/usr/bin/env python3
"""Lightweight high-confidence credential checks; NOT full secret scanning/SAST."""
from __future__ import annotations
import argparse
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
# Build signatures in parts to avoid embedding token-like specimens.
INDICATORS = (
    ("private-key-pem", re.compile(rb"-{5}BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-{5}")),
    ("github-classic-token", re.compile(rb"gh" + rb"p_[A-Za-z0-9]{36}")),
    ("github-fine-grained-token", re.compile(rb"github_" + rb"pat_[A-Za-z0-9_]{70,}")),
    ("aws-access-key-id", re.compile(rb"AK" + rb"IA[0-9A-Z]{16}")),
    ("stripe-live-secret", re.compile(rb"sk_" + rb"live_[A-Za-z0-9]{16,}")),
    ("slack-bot-token", re.compile(rb"xox" + rb"b-[0-9]+-[0-9]+-[A-Za-z0-9]+")),
)
MAX_BYTES = 20 * 1024 * 1024

def scan_bytes(value: bytes) -> list[str]:
    """Return rule IDs, never the secret substrings."""
    return [rule for rule, pattern in INDICATORS if pattern.search(value)]

def tracked_files(root: Path) -> list[Path]:
    out = subprocess.check_output(["git", "-C", str(root), "ls-files", "-z"])
    return [root / name.decode("utf-8", errors="surrogateescape")
            for name in out.split(b"\0") if name]

def secret_scan(root: Path) -> int:
    hits, inspected = 0, 0
    for path in tracked_files(root):
        if not path.is_file() or path.is_symlink():
            continue
        try:
            if path.stat().st_size > MAX_BYTES:
                print(f"::error file={path.relative_to(root)}::SEC-SCAN-FILE-TOO-LARGE")
                hits += 1
                continue
            body = path.read_bytes()
        except OSError:
            print(f"::error file={path.relative_to(root)}::SEC-SCAN-UNREADABLE")
            hits += 1
            continue
        # Plaintext scan only; binary and history need specialized tools.
        if b"\0" in body[:4096]:
            continue
        inspected += 1
        for rule in scan_bytes(body):
            print(f"::error file={path.relative_to(root)}::SEC-SCAN-{rule}")
            hits += 1
    print(f"SECURITY_BASELINE_TRACKED_TEXT_FILES_CHECKED={inspected}")
    if hits:
        print(f"SECURITY_BASELINE_HIGH_CONFIDENCE_FINDINGS={hits}")
        return 1
    print("SHQIPSHOP_SECURITY_BASELINE_SECRET_PATTERNS_PASSED")
    return 0

def release_failures(root: Path) -> list[str]:
    problems = []
    gradle = (root / "native-medusa/android/app/build.gradle").read_text("utf-8")
    release = re.search(r"(?m)^\s*release\s*\{(?P<body>.*?)^\s*\}", gradle, re.S | re.M)
    if not release or re.search(r"signingConfig\s+signingConfigs\.debug\b", release.group("body")):
        problems.append("SEC-05-ANDROID-RELEASE-DEBUG-SIGNING")
    token_storage = (root / "native-medusa/app/api/auth-token-storage.ts").read_text("utf-8")
    if "AsyncStorage" in token_storage:
        problems.append("SEC-04-NATIVE-JWT-ASYNCSTORAGE")
    return problems

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scan", action="store_true")
    parser.add_argument("--release", action="store_true")
    args = parser.parse_args()
    if not (args.scan or args.release):
        parser.error("specify --scan or --release")
    status = secret_scan(ROOT) if args.scan else 0
    if args.release:
        for issue in release_failures(ROOT):
            print(f"::error::{issue}")
            status = 1
        if status == 0:
            print("SHQIPSHOP_STATIC_RELEASE_CONFIG_PASSED_NOT_A_RELEASE_AUTHORIZATION")
    return status

if __name__ == "__main__":
    sys.exit(main())
