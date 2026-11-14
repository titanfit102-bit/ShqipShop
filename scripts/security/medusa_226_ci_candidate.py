#!/usr/bin/env python3
"""Prepare Medusa 2.22.6 only in RUNNER_TEMP; never mutate the Git checkout."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import shutil
import sys

BASELINE = "2.22.0"
CANDIDATE = "2.22.6"
MANIFESTS = ("package.json", "apps/backend/package.json", "apps/storefront/package.json")
REQUIRED = {
    "package.json": ("@medusajs/eslint-plugin",),
    "apps/backend/package.json": ("@medusajs/framework", "@medusajs/medusa"),
    "apps/storefront/package.json": ("@medusajs/js-sdk",),
}

def candidate_manifest(doc: dict, filename: str) -> tuple[dict, int]:
    if not isinstance(doc, dict):
        raise ValueError("Invalid manifest")
    copy = json.loads(json.dumps(doc))
    changed = 0
    for scope in ("dependencies", "devDependencies", "optionalDependencies"):
        dependencies = copy.get(scope, {})
        if not isinstance(dependencies, dict):
            raise ValueError("Invalid dependency scope")
        for name, version in dependencies.items():
            if not name.startswith("@medusajs/") or name == "@medusajs/ui":
                continue
            if version != BASELINE:
                raise ValueError("Unexpected Medusa source version")
            dependencies[name] = CANDIDATE
            changed += 1
    scope = "devDependencies" if filename == "package.json" else "dependencies"
    for name in REQUIRED[filename]:
        if copy.get(scope, {}).get(name) != CANDIDATE:
            raise ValueError("Missing mandatory Medusa package")
    if not changed:
        raise ValueError("No Medusa candidate packages found")
    return copy, changed

def prepare(source: Path, destination: Path, runner_temp: Path) -> int:
    if os.environ.get("CI") != "true" or os.environ.get("SHQIPSHOP_MEDUSA_CANDIDATE_CI") != "true":
        raise ValueError("CI-only candidate flag required")
    source = source.resolve(strict=True)
    runner_temp = runner_temp.resolve(strict=True)
    destination = destination.resolve()
    if source == destination or not destination.is_relative_to(runner_temp) or destination.exists():
        raise ValueError("Must use a new RUNNER_TEMP destination")
    if not (source / "pnpm-lock.yaml").is_file():
        raise ValueError("Missing original pnpm lockfile")
    revisions = {}
    count = 0
    for filename in MANIFESTS:
        doc = json.loads((source / filename).read_text(encoding="utf-8"))
        revisions[filename], n = candidate_manifest(doc, filename)
        count += n
    shutil.copytree(
        source, destination,
        ignore=shutil.ignore_patterns("node_modules", ".medusa", ".next", "dist", "coverage"),
    )
    for filename, doc in revisions.items():
        (destination / filename).write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    # Test utility only; this extra direct dependency exists only in the CI copy.
    root = destination / "package.json"
    doc = json.loads(root.read_text(encoding="utf-8"))
    doc["devDependencies"]["@medusajs/utils"] = CANDIDATE
    root.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    print("SHQIPSHOP_MEDUSA_226_DISPOSABLE_MANIFESTS_PREPARED")
    print("SHQIPSHOP_MEDUSA_226_DIRECT_PACKAGES_STAGED=" + str(count))
    return count

def verify_original(source: Path) -> bool:
    for filename in MANIFESTS:
        doc = json.loads((source / filename).read_text(encoding="utf-8"))
        candidate_manifest(doc, filename)
    print("SHQIPSHOP_MEDUSA_220_SOURCE_MANIFESTS_UNCHANGED")
    return True

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("prepare", "verify-original"))
    parser.add_argument("--source", type=Path, default=Path(__file__).resolve().parents[2] / "medusa-backend-poc")
    parser.add_argument("--destination", type=Path)
    args = parser.parse_args()
    try:
        if args.action == "verify-original":
            verify_original(args.source)
        else:
            if args.destination is None or not os.environ.get("RUNNER_TEMP"):
                raise ValueError("Missing ephemeral destination")
            prepare(args.source, args.destination, Path(os.environ["RUNNER_TEMP"]))
        return 0
    except (ValueError, OSError, json.JSONDecodeError):
        print("::error::SHQIPSHOP_MEDUSA_226_CANDIDATE_PREPARATION_REJECTED", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
