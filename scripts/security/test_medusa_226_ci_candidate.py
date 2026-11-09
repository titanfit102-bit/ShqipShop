"""Offline positive/negative tests for the disposable 2.22.6 preparation."""
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from medusa_226_ci_candidate import BASELINE, CANDIDATE, MANIFESTS, REQUIRED, candidate_manifest, prepare, verify_original

class CandidatePreparationTest(unittest.TestCase):
    def manifest(self, filename):
        scope = "devDependencies" if filename == "package.json" else "dependencies"
        return {scope: {name: BASELINE for name in REQUIRED[filename]}, "name": "fixture"}

    def fixture(self, source):
        source.mkdir()
        (source / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n")
        for filename in MANIFESTS:
            p = source / filename
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(json.dumps(self.manifest(filename)))

    def test_positive_candidate_isolated_source_unchanged(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            source = root / "src"
            self.fixture(source)
            dest = root / "temp" / "candidate"
            dest.parent.mkdir()
            with patch.dict(os.environ, {"CI": "true", "SHQIPSHOP_MEDUSA_CANDIDATE_CI": "true"}):
                count = prepare(source, dest, dest.parent)
            self.assertGreaterEqual(count, 4)
            self.assertTrue(verify_original(source))
            staged = json.loads((dest / "package.json").read_text())
            self.assertEqual(staged["devDependencies"]["@medusajs/utils"], CANDIDATE)
            self.assertEqual(json.loads((source / "package.json").read_text()), self.manifest("package.json"))

    def test_unknown_source_version_rejected(self):
        doc = self.manifest("apps/backend/package.json")
        doc["dependencies"]["@medusajs/medusa"] = "2.22.5"
        with self.assertRaises(ValueError):
            candidate_manifest(doc, "apps/backend/package.json")

    def test_required_runtime_moved_to_dev_rejected(self):
        doc = self.manifest("apps/backend/package.json")
        doc["devDependencies"] = {"@medusajs/medusa": doc["dependencies"].pop("@medusajs/medusa")}
        with self.assertRaises(ValueError):
            candidate_manifest(doc, "apps/backend/package.json")

    def test_independent_ui_4x_preserved(self):
        doc = self.manifest("apps/backend/package.json")
        doc["dependencies"]["@medusajs/ui"] = "4.2.6"
        candidate, _ = candidate_manifest(doc, "apps/backend/package.json")
        self.assertEqual(candidate["dependencies"]["@medusajs/ui"], "4.2.6")

    def test_non_ci_or_outside_temp_denied(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            src = root / "src"
            self.fixture(src)
            temp = root / "tmp"
            temp.mkdir()
            with patch.dict(os.environ, {"CI": "false", "SHQIPSHOP_MEDUSA_CANDIDATE_CI": "true"}):
                with self.assertRaises(ValueError):
                    prepare(src, temp / "candidate", temp)
            with patch.dict(os.environ, {"CI": "true", "SHQIPSHOP_MEDUSA_CANDIDATE_CI": "true"}):
                with self.assertRaises(ValueError):
                    prepare(src, src, temp)
                with self.assertRaises(ValueError):
                    prepare(src, root / "outside", temp)

    def test_existing_destination_not_overwritten(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            src = root / "src"
            self.fixture(src)
            dest = root / "temp" / "existing"
            dest.mkdir(parents=True)
            (dest / "keep").write_text("untouched")
            with patch.dict(os.environ, {"CI": "true", "SHQIPSHOP_MEDUSA_CANDIDATE_CI": "true"}):
                with self.assertRaises(ValueError):
                    prepare(src, dest, dest.parent)
            self.assertEqual((dest / "keep").read_text(), "untouched")
