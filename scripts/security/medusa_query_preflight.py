#!/usr/bin/env python3
"""Stage 12C: read-only Medusa dependency-coherence preflight, not a vulnerability fix.

No downloads, npm/pnpm commands, credential reads, or repository mutation. A
baseline verdict means that a known-outdated version is STILL BLOCKED.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys

BASELINE = "2.22.0"
CANDIDATE = "2.22.6"
MANIFESTS = (
    "medusa-backend-poc/package.json",
    "medusa-backend-poc/apps/backend/package.json",
    "medusa-backend-poc/apps/storefront/package.json",
)
LOCKFILE = "medusa-backend-poc/pnpm-lock.yaml"


def _tracked_medusa(name: str, version: str) -> bool:
    """All direct Medusa release-train packages except independently versioned UI."""
    return name.startswith("@medusajs/") and name != "@medusajs/ui"


def _read_json(path: Path) -> dict:
    doc = json.loads(path.read_text("utf-8"))
    if not isinstance(doc, dict):
        raise ValueError("Expected JSON object")
    return doc


def _lock_importers(text: str) -> dict[str, dict[str, tuple[str, str]]]:
    """Minimal strict reader for pnpm lockfile v9's importers, not a general YAML parser."""
    importers: dict[str, dict[str, tuple[str, str]]] = {}
    importer: str | None = None
    dep: str | None = None
    spec: str | None = None
    resolved: str | None = None
    in_importers = False
    if len(re.findall(r"(?m)^importers:", text)) != 1:
        raise ValueError("Missing or duplicate pnpm importer section")
    def save() -> None:
        if importer is not None and dep is not None:
            if spec is None or resolved is None:
                raise ValueError("Incomplete lock entry")
            if dep in importers[importer]:
                raise ValueError("Duplicate pnpm importer dependency")
            importers[importer][dep] = (spec, resolved)
    for line in text.splitlines():
        if line == "importers:":
            in_importers = True
            continue
        if not in_importers:
            continue
        if line and not line.startswith(" "):
            save()
            break
        if re.fullmatch(r"  ([^ ].*):", line):
            save()
            importer = line.strip()[:-1]
            if importer in importers:
                raise ValueError("Duplicate pnpm importer")
            dep, spec, resolved = None, None, None
            importers[importer] = {}
            continue
        if re.fullmatch(r"      '[^']+':", line) or re.fullmatch(r"      [A-Za-z0-9@/_.+-]+:", line):
            save()
            dep = line.strip().rstrip(":").strip("'")
            spec, resolved = None, None
            continue
        if dep is None:
            continue
        match = re.match(r"        (specifier|version):\s+(.+?)\s*$", line)
        if match:
            value = match.group(2).strip("'\"")
            if match.group(1) == "specifier":
                if spec is not None:
                    raise ValueError("Duplicate pnpm specifier")
                spec = value
            else:
                if resolved is not None:
                    raise ValueError("Duplicate pnpm resolved version")
                resolved = value
    else:
        save()
    return importers



def _lock_package_records(text: str) -> dict[str, set[tuple[str, str]]]:
    """Read only actual pnpm v9 package/snapshot keys, never free-text peers.

    Narrow structural scanner, NOT a complete YAML parser or lockfile signature.
    Comments, importer values and peer references in unrelated package keys
    must not manufacture installed Medusa packages.
    """
    records: dict[str, set[tuple[str, str]]] = {
        "packages": set(),
        "snapshots": set(),
    }
    section: str | None = None
    seen_sections: set[str] = set()
    for line in text.splitlines():
        if line and not line.startswith(" "):
            section = line[:-1] if line in ("packages:", "snapshots:") else None
            if section is not None:
                if section in seen_sections:
                    raise ValueError("Duplicate pnpm package/snapshot section")
                seen_sections.add(section)
            continue
        if section not in records:
            continue
        match = re.match(
            r"^  '@medusajs/([A-Za-z0-9_.-]+)@([0-9]+\.[0-9]+\.[0-9]+)(?:\([^\r\n]*\))?':(?:\s|$)",
            line,
        )
        if line.startswith("  '@medusajs/") and not match:
            # A malformed or prerelease Medusa record is not evidence of a
            # clean pinned train. Reject it rather than silently skipping it.
            raise ValueError("Unrecognized Medusa package/snapshot key")
        if match:
            records[section].add((match.group(1), match.group(2)))
    if seen_sections != set(records):
        raise ValueError("Missing pnpm package/snapshot section")
    return records

def inspect(root: Path, version: str) -> list[str]:
    """Return NON-SECRET error identifiers; never print installed paths/lock content."""
    errors: list[str] = []
    if version not in (BASELINE, CANDIDATE):
        return ["MEDUSA-QUERY-CANDIDATE-UNAPPROVED-VERSION"]
    try:
        lock_text = (root / LOCKFILE).read_text("utf-8")
        headers = re.findall(r"(?m)^lockfileVersion:[^\r\n]*$", lock_text)
        if len(headers) != 1 or not re.fullmatch(
            r"lockfileVersion: ['\"]?9\.0['\"]?", headers[0]
        ):
            raise ValueError("Missing, duplicate or unsupported pnpm lock version")
        lock = _lock_importers(lock_text)
        # This is an integrity preflight, so transitive/pnpm snapshot packages
        # must not retain an older Medusa release even when importers look clean.
        # pnpm legitimately carries an older @medusajs/icons release as a
        # transitive UI asset (2.21.2 alongside 2.22.0 in the pinned lock).
        # That is NOT a second copy of the query-security-bearing runtime.
        # Keep critical utils/query/framework/medusa strictly version-pinned,
        # and require the other NON-UI Medusa packages to match as well.
        records = _lock_package_records(lock_text)
        installed = records["packages"] | records["snapshots"]
        critical = {"utils", "query", "framework", "medusa"}
        for name in critical:
            # A genuine package AND snapshot record must each identify the
            # approved runtime version; neither can substitute for the other.
            for section in ("packages", "snapshots"):
                found = {v for package, v in records[section] if package == name}
                if found != {version}:
                    errors.append("MEDUSA-QUERY-TRANSITIVE-VERSION-MISMATCH")
        for name, resolved in installed:
            if name in {"ui", "icons"}:
                continue  # Independently versioned UI assets, not query runtime
            if resolved != version:
                errors.append("MEDUSA-QUERY-TRANSITIVE-VERSION-MISMATCH")
    except (OSError, ValueError):
        return ["MEDUSA-QUERY-LOCK-UNREADABLE"]
    for manifest_rel in MANIFESTS:
        try:
            doc = _read_json(root / manifest_rel)
        except (OSError, ValueError, json.JSONDecodeError):
            errors.append("MEDUSA-QUERY-MANIFEST-UNREADABLE")
            continue
        importer = {
            MANIFESTS[0]: ".",
            MANIFESTS[1]: "apps/backend",
            MANIFESTS[2]: "apps/storefront",
        }[manifest_rel]
        imp = lock.get(importer)
        if imp is None:
            errors.append("MEDUSA-QUERY-LOCK-IMPORTER-MISSING")
            continue
        required = {
            ".": ("@medusajs/eslint-plugin",),
            "apps/backend": ("@medusajs/framework", "@medusajs/medusa"),
            "apps/storefront": ("@medusajs/js-sdk",),
        }[importer]
        direct = {**doc.get("dependencies", {}), **doc.get("devDependencies", {})}
        for name in required:
            if name not in direct:
                errors.append("MEDUSA-QUERY-REQUIRED-PACKAGE-MISSING")
        for scope in ("dependencies", "devDependencies"):
            table = doc.get(scope, {})
            if not isinstance(table, dict):
                errors.append("MEDUSA-QUERY-MANIFEST-INVALID")
                continue
            for name, specifier in table.items():
                if not isinstance(specifier, str):
                    errors.append("MEDUSA-QUERY-UNEXPECTED-SPECIFIER")
                    continue
                if not _tracked_medusa(name, specifier):
                    continue
                if specifier != version:
                    errors.append("MEDUSA-QUERY-MIXED-RELEASE-TRAIN")
                entry = imp.get(name)
                if entry is None:
                    errors.append("MEDUSA-QUERY-LOCK-ENTRY-MISSING")
                    continue
                declared, resolved = entry
                if declared != specifier or not re.match(re.escape(version) + r"(?:$|\()", resolved):
                    errors.append("MEDUSA-QUERY-LOCK-VERSION-MISMATCH")
    if not (root / MANIFESTS[1]).is_file():
        errors.append("MEDUSA-QUERY-NO-BACKEND-MANIFEST")
    return sorted(set(errors))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", action="store_true", help="Require all pinned Medusa train packages and pnpm importers to be 2.22.6")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    version = CANDIDATE if args.candidate else BASELINE
    errors = inspect(args.root, version)
    if errors:
        for item in errors:
            print(f"::error::{item}")
        return 1
    if args.candidate:
        print("SHQIPSHOP_STAGE12C_CANDIDATE_MANIFEST_LOCK_COHERENCE_PASSED_NOT_RUNTIME_SECURITY")
    else:
        print("SHQIPSHOP_STAGE12C_PINNED_2_22_0_CONFIRMED_KNOWN_QUERY_SECURITY_GAP_RELEASE_BLOCKED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
