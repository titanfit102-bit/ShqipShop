#!/usr/bin/env python3
"""Lightweight high-confidence credential checks; NOT full secret scanning/SAST."""
from __future__ import annotations
import argparse
from pathlib import Path
import re
import subprocess
import sys

from medusa_query_preflight import CANDIDATE, inspect as inspect_medusa_query

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


# Narrow, reviewable source-contract gate: checks that critical financial
# regression diagnostics and their failing assertions stay wired into CI.
# Presence checks are not behavioral tests, SAST, or proof of monetary safety.
FINANCIAL_REGRESSIONS = {
    "medusa-backend-poc/apps/backend/src/scripts/f08-refund-admin-boundary-ci.ts": (
        "SHQIPSHOP_F08_STAGE11P_AUTH_ADMIN_UNCAPTURED_REFUND_PERSISTED",
        "CRITICAL: authenticated Admin refund of uncaptured payment must fail",
        "SHQIPSHOP_F08_STAGE11O_SINGULAR_ONE_ALL_REFUND_PERSISTED",
        "CRITICAL: singular workflow accepted 1 ALL over fully refunded capture",
    ),
    "medusa-backend-poc/apps/backend/src/scripts/f08-refund-workflow-ci.ts": (
        "SHQIPSHOP_F08_STAGE11J_ZERO_DECIMAL_ONE_ALL_REFUND_PERSISTED",
        "CRITICAL: 1 ALL extra request cannot change the persisted refund IDs",
    ),
    "medusa-backend-poc/apps/backend/src/scripts/f08-psp-contract-ci.ts": (
        "SHQIPSHOP_F08_STAGE11I_DIRECT_MODULE_OVER_REFUND_PERSISTED",
        "CRITICAL: invalid new-key over-refund must not persist a second refund",
    ),
    ".github/workflows/medusa-backend-smoke.yml": (
        "stage11p_admin_rc=$?",
        "workflow_rc=$?",
        "singular_rc=$?",
        "module_rc=$?",
        'if [ "$exact_rc" -ne 0 ]',
        '[ "$stage11p_admin_rc" -ne 0 ]',
        "exit 1",
    ),
}

def financial_regression_failures(root: Path) -> list[str]:
    failures = []
    for relative_path, tokens in FINANCIAL_REGRESSIONS.items():
        file = root / relative_path
        try:
            body = file.read_text("utf-8")
        except OSError:
            failures.append(f"FIN-REGRESSION-SOURCE-MISSING:{relative_path}")
            continue
        for idx, token in enumerate(tokens):
            if token not in body:
                failures.append(f"FIN-REGRESSION-CONTRACT-MISSING:{relative_path}:{idx + 1}")
    return failures


def financial_release_gate_failures(root: Path) -> list[str]:
    """Fail closed on RG-03 unless the canonical release gate says PASS.

    This is a static governance prerequisite only, never PSP certification.
    """
    path = root / "docs/security/SECURITY_RELEASE_GATES.md"
    try:
        lines = path.read_text("utf-8").splitlines()
    except OSError:
        return ["FIN-RELEASE-RG03-UNKNOWN"]
    for line in lines:
        columns = [cell.strip().replace("*", "")
                   for cell in line.strip().strip("|").split("|")]
        if len(columns) >= 3 and columns[0] == "RG-03 cart/order/payment":
            if columns[2] == "PASS":
                return []
            return ["FIN-RELEASE-RG03-NOT-APPROVED"]
    return ["FIN-RELEASE-RG03-UNKNOWN"]

def medusa_query_release_failures(root: Path) -> list[str]:
    """Static dependency prerequisite; never a runtime query-security certificate.

    Fail closed when the current install is still the affected 2.22.0 train,
    the future patched train is mixed, or the pnpm lock cannot be verified.
    A clean result only proves candidate version/lock coherence. Other
    financial, identity and release gates continue to apply independently.
    """
    if inspect_medusa_query(root, CANDIDATE):
        return ["SEC-MEDUSA-QUERY-PATCHED-TRAIN-UNVERIFIED"]
    return []


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
    parser.add_argument("--finance-contract", action="store_true")
    args = parser.parse_args()
    if not (args.scan or args.release or args.finance_contract):
        parser.error("specify --scan, --finance-contract or --release")
    status = secret_scan(ROOT) if args.scan else 0
    if args.finance_contract or args.release:
        failures = financial_regression_failures(ROOT)
        for issue in failures:
            print(f"::error::{issue}")
            status = 1
        if not failures:
            print("SHQIPSHOP_FINANCIAL_SENTINEL_SOURCE_CONTRACT_PASSED_NOT_MONETARY_SAFETY")
    if args.release:
        for issue in medusa_query_release_failures(ROOT):
            print(f"::error::{issue}")
            status = 1
        for issue in financial_release_gate_failures(ROOT):
            print(f"::error::{issue}")
            status = 1
        for issue in release_failures(ROOT):
            print(f"::error::{issue}")
            status = 1
        if status == 0:
            print("SHQIPSHOP_STATIC_RELEASE_CONFIG_PASSED_NOT_A_RELEASE_AUTHORIZATION")
    return status

if __name__ == "__main__":
    sys.exit(main())
