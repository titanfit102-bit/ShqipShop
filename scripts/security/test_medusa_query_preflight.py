"""Stage12C positive/negative checks for the read-only Medusa candidate preflight."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from medusa_query_preflight import BASELINE, CANDIDATE, inspect, _lock_importers


class MedusaQueryPreflightTest(unittest.TestCase):
    def fixture(self, root: Path, version: str) -> None:
        pkg = root / "medusa-backend-poc"
        backend = pkg / "apps/backend"
        backend.mkdir(parents=True)
        (pkg / "package.json").write_text(json.dumps({"devDependencies": {
            "@medusajs/eslint-plugin": version}}), encoding="utf-8")
        (backend / "package.json").write_text(json.dumps({"dependencies": {
            "@medusajs/medusa": version,
            "@medusajs/framework": version,
            "@medusajs/ui": "4.2.6"}}), encoding="utf-8")
        (pkg / "pnpm-lock.yaml").write_text(f"""lockfileVersion: '9.0'
importers:

  .:
    devDependencies:
      '@medusajs/eslint-plugin':
        specifier: {version}
        version: {version}(eslint@9.0.0)

  apps/backend:
    dependencies:
      '@medusajs/medusa':
        specifier: {version}
        version: {version}
      '@medusajs/framework':
        specifier: {version}
        version: {version}(@medusajs/cli@{version})
      '@medusajs/ui':
        specifier: 4.2.6
        version: 4.2.6

packages:
  '@medusajs/medusa@{version}': {{}}
""", encoding="utf-8")

    def test_baseline_identifies_known_outdated_pin_without_claiming_fix(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, BASELINE)
            self.assertEqual(inspect(root, BASELINE), [])
            self.assertIn("MEDUSA-QUERY-MIXED-RELEASE-TRAIN", inspect(root, CANDIDATE))

    def test_complete_candidate_can_pass_static_coherence(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            self.assertEqual(inspect(root, CANDIDATE), [])

    def test_mixed_backend_version_is_rejected(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            path = root / "medusa-backend-poc/apps/backend/package.json"
            pkg = json.loads(path.read_text("utf-8"))
            pkg["dependencies"]["@medusajs/framework"] = BASELINE
            path.write_text(json.dumps(pkg), encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-MIXED-RELEASE-TRAIN", inspect(root, CANDIDATE))

    def test_mismatched_resolved_lockfile_version_is_rejected(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            p = root / "medusa-backend-poc/pnpm-lock.yaml"
            c = p.read_text("utf-8").replace(
                f"version: {CANDIDATE}(@medusajs/cli@{CANDIDATE})",
                f"version: {BASELINE}(@medusajs/cli@{BASELINE})")
            p.write_text(c, encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-LOCK-VERSION-MISMATCH", inspect(root, CANDIDATE))

    def test_unknown_newer_medusa_version_is_not_silently_exempt(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            p = root / "medusa-backend-poc/apps/backend/package.json"
            doc = json.loads(p.read_text("utf-8"))
            doc["dependencies"]["@medusajs/medusa"] = "2.23.0"
            p.write_text(json.dumps(doc), encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-MIXED-RELEASE-TRAIN", inspect(root, CANDIDATE))

    def test_required_runtime_dependency_must_remain(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            p = root / "medusa-backend-poc/apps/backend/package.json"
            doc = json.loads(p.read_text("utf-8"))
            del doc["dependencies"]["@medusajs/framework"]
            p.write_text(json.dumps(doc), encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-REQUIRED-PACKAGE-MISSING", inspect(root, CANDIDATE))

    def test_old_transitive_medusa_snapshot_is_rejected(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            p = root / "medusa-backend-poc/pnpm-lock.yaml"
            p.write_text(p.read_text("utf-8") +
                         "\nsnapshots:\n  '@medusajs/query@2.22.0': {}\n", encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-TRANSITIVE-VERSION-MISMATCH", inspect(root, CANDIDATE))

    def test_incomplete_or_missing_lock_entry_fails_closed(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            p = root / "medusa-backend-poc/pnpm-lock.yaml"
            p.write_text("lockfileVersion: '9.0'\nimporters:\n  .:\n", encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-LOCK-IMPORTER-MISSING", inspect(root, CANDIDATE))

    def test_lock_parser_does_not_treat_packages_as_importers(self):
        text = """importers:
  apps/backend:
    dependencies:
      '@medusajs/framework':
        specifier: 2.22.6
        version: 2.22.6(a@1.0)
packages:
  '@medusajs/framework@2.22.0': {}
"""
        o = _lock_importers(text)
        self.assertEqual(o, {"apps/backend": {"@medusajs/framework": ("2.22.6", "2.22.6(a@1.0)")}})


if __name__ == "__main__":
    unittest.main()
