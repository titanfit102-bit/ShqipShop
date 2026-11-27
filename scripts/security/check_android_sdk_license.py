#!/usr/bin/env python3
"""Check the Android Metro map for SDK modules listed as Enterprise in v2.21.2."""

import argparse
import json
import re
from pathlib import Path

ENTERPRISE_SDK_MODULE = re.compile(
    r"(?:^|/)@medusajs/js-sdk/(?:dist/(?:esm/)?|src/)"
    r"admin/(rbac-policy|rbac-role)\.[jt]s$"
)


def source_paths(source_map):
    if source_map.get("version") != 3:
        raise ValueError("Expected a version 3 source map")
    sources = source_map.get("sources")
    sections = source_map.get("sections")
    if isinstance(sources, list) and sections is None:
        if not all(isinstance(path, str) and path for path in sources):
            raise ValueError("Invalid source entry")
        yield from sources
        return
    if isinstance(sections, list) and sources is None:
        for section in sections:
            yield from source_paths(section["map"])
        return
    raise ValueError("Expected inline source paths or indexed map sections")


def enterprise_sdk_modules(source_map):
    paths = list(source_paths(source_map))
    if not paths:
        raise ValueError("The source map has no source paths")
    return sorted({
        match[1]
        for path in paths
        if (match := ENTERPRISE_SDK_MODULE.search(path.replace("\\", "/")))
    })


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_map", type=Path)
    args = parser.parse_args()
    try:
        hits = enterprise_sdk_modules(json.loads(args.source_map.read_text(encoding="utf-8")))
    except (OSError, ValueError, TypeError, KeyError, AttributeError, RecursionError):
        parser.exit(1, "Android SDK license scope requires a readable, complete Metro source map.\n")
    if hits:
        parser.exit(1, "Android APK upload requires license review for Medusa SDK modules: "
                    + ", ".join(hits) + "\n")
    print("No v2.21.2 Medusa Enterprise SDK module paths found in this Metro map.")


if __name__ == "__main__":
    main()
