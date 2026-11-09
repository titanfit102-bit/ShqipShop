"""Stage12C positive/negative checks for the read-only Medusa candidate preflight."""
import json
from contextlib import redirect_stdout
from io import StringIO
from unittest.mock import patch
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from medusa_query_preflight import BASELINE, CANDIDATE, inspect, _lock_importers
from guard import medusa_query_release_failures, main as release_guard_main


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
  '@medusajs/framework@{version}': {{}}
  '@medusajs/utils@{version}': {{}}
  '@medusajs/query@{version}': {{}}

snapshots:
  '@medusajs/medusa@{version}': {{}}
  '@medusajs/framework@{version}(peer@1.0.0)': {{}}
  '@medusajs/utils@{version}': {{}}
  '@medusajs/query@{version}': {{}}
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
                         "\n  '@medusajs/query@2.22.0': {}\n", encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-TRANSITIVE-VERSION-MISMATCH", inspect(root, CANDIDATE))

    def test_incomplete_or_missing_lock_entry_fails_closed(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            p = root / "medusa-backend-poc/pnpm-lock.yaml"
            p.write_text("lockfileVersion: '9.0'\nimporters:\n  .:\n", encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-LOCK-UNREADABLE", inspect(root, CANDIDATE))

    def test_release_blocks_current_affected_baseline(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, BASELINE)
            self.assertEqual(medusa_query_release_failures(root),
                             ["SEC-MEDUSA-QUERY-PATCHED-TRAIN-UNVERIFIED"])

    def test_release_static_prerequisite_accepts_only_full_candidate(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            self.assertEqual(medusa_query_release_failures(root), [])

    def test_release_missing_lock_fails_closed(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            (root / "medusa-backend-poc/pnpm-lock.yaml").unlink()
            self.assertEqual(medusa_query_release_failures(root),
                             ["SEC-MEDUSA-QUERY-PATCHED-TRAIN-UNVERIFIED"])

    def test_future_mixed_transitive_release_fails_closed(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            p = root / "medusa-backend-poc/pnpm-lock.yaml"
            p.write_text(p.read_text("utf-8") +
                         "\n  '@medusajs/query@2.23.0': {}\n",
                         encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-TRANSITIVE-VERSION-MISMATCH",
                          inspect(root, CANDIDATE))

    def test_release_requires_package_versions_in_lock_snapshots(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            p = root / "medusa-backend-poc/pnpm-lock.yaml"
            body = p.read_text("utf-8")
            body = body.replace(f"  '@medusajs/medusa@{CANDIDATE}': {{}}", "")
            body = body.replace(f"(@medusajs/cli@{CANDIDATE})", "(cli@7.0)")
            p.write_text(body, encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-TRANSITIVE-VERSION-MISMATCH",
                          inspect(root, CANDIDATE))

    def test_cli_release_flag_blocks_affected_train_even_with_other_gates_mock_green(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, BASELINE)
            with (patch("guard.ROOT", root),
                  patch("guard.financial_regression_failures", return_value=[]),
                  patch("guard.financial_release_gate_failures", return_value=[]),
                  patch("guard.release_failures", return_value=[]),
                  patch("sys.argv", ["guard.py", "--release"]),
                  redirect_stdout(StringIO()) as output):
                self.assertEqual(release_guard_main(), 1)
            self.assertIn("SEC-MEDUSA-QUERY-PATCHED-TRAIN-UNVERIFIED",
                          output.getvalue())

    def test_cli_release_flag_static_candidate_prerequisite_passes_but_not_production_certification(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            with (patch("guard.ROOT", root),
                  patch("guard.financial_regression_failures", return_value=[]),
                  patch("guard.financial_release_gate_failures", return_value=[]),
                  patch("guard.release_failures", return_value=[]),
                  patch("sys.argv", ["guard.py", "--release"]),
                  redirect_stdout(StringIO()) as output):
                self.assertEqual(release_guard_main(), 0)
            self.assertNotIn("SEC-MEDUSA-QUERY-PATCHED-TRAIN-UNVERIFIED",
                             output.getvalue())
            # This is a mocked release config fixture, not real release approval.

    def test_legacy_transitive_ui_icons_do_not_mask_query_security_runtime(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, BASELINE)
            p = root / "medusa-backend-poc/pnpm-lock.yaml"
            p.write_text(p.read_text("utf-8") +
                         "\n  '@medusajs/icons@2.21.2': {}\n", encoding="utf-8")
            self.assertEqual(inspect(root, BASELINE), [])

    def test_mixed_non_ui_transitive_package_still_fails_closed(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            p = root / "medusa-backend-poc/pnpm-lock.yaml"
            p.write_text(p.read_text("utf-8") +
                         "\n  '@medusajs/auth@2.21.2': {}\n", encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-TRANSITIVE-VERSION-MISMATCH",
                          inspect(root, CANDIDATE))

    def test_missing_critical_query_module_version_fails_closed(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            p = root / "medusa-backend-poc/pnpm-lock.yaml"
            text = p.read_text("utf-8")
            p.write_text(text.replace(
                f"  '@medusajs/utils@{CANDIDATE}': {{}}", ""),
                encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-TRANSITIVE-VERSION-MISMATCH",
                          inspect(root, CANDIDATE))


    def test_lock_comment_cannot_forge_a_missing_critical_package(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            p = root / "medusa-backend-poc/pnpm-lock.yaml"
            body = p.read_text("utf-8").replace(
                f"  '@medusajs/query@{CANDIDATE}': {{}}",
                f"  # removed '@medusajs/query@{CANDIDATE}': {{}}")
            body += f"\n# fake reference @medusajs/query@{CANDIDATE}\n"
            p.write_text(body, encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-TRANSITIVE-VERSION-MISMATCH",
                          inspect(root, CANDIDATE))

    def test_nested_peer_reference_does_not_count_as_installed_module(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            p = root / "medusa-backend-poc/pnpm-lock.yaml"
            body = p.read_text("utf-8")
            body += f"\n  'unrelated@1.0.0(@medusajs/auth@{BASELINE})': {{}}\n"
            p.write_text(body, encoding="utf-8")
            self.assertEqual(inspect(root, CANDIDATE), [])

    def test_real_stale_snapshot_with_peer_suffix_is_denied(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            p = root / "medusa-backend-poc/pnpm-lock.yaml"
            body = p.read_text("utf-8")
            body += f"\n  '@medusajs/query@{BASELINE}(@medusajs/framework@{CANDIDATE})': {{}}\n"
            p.write_text(body, encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-TRANSITIVE-VERSION-MISMATCH",
                          inspect(root, CANDIDATE))

    def test_missing_packages_section_is_denied_even_if_importers_exist(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            p = root / "medusa-backend-poc/pnpm-lock.yaml"
            p.write_text(p.read_text("utf-8").replace(
                "\npackages:\n", "\nunknown:\n"), encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-LOCK-UNREADABLE",
                          inspect(root, CANDIDATE))

    def test_missing_critical_snapshot_fails_even_with_package(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            p = root / "medusa-backend-poc/pnpm-lock.yaml"
            pkg, snapshots = p.read_text("utf-8").split("\nsnapshots:\n", 1)
            snapshots = snapshots.replace(f"  '@medusajs/utils@{CANDIDATE}': {{}}", "", 1)
            p.write_text(pkg + "\nsnapshots:\n" + snapshots, encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-TRANSITIVE-VERSION-MISMATCH",
                          inspect(root, CANDIDATE))

    def test_missing_critical_package_fails_even_with_snapshot(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            p = root / "medusa-backend-poc/pnpm-lock.yaml"
            pkg, snapshots = p.read_text("utf-8").split("\nsnapshots:\n", 1)
            pkg = pkg.replace(f"  '@medusajs/framework@{CANDIDATE}': {{}}", "", 1)
            p.write_text(pkg + "\nsnapshots:\n" + snapshots, encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-TRANSITIVE-VERSION-MISMATCH",
                          inspect(root, CANDIDATE))

    def test_duplicate_top_level_snapshots_are_rejected(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            p = root / "medusa-backend-poc/pnpm-lock.yaml"
            p.write_text(p.read_text("utf-8") + "\nsnapshots:\n", encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-LOCK-UNREADABLE", inspect(root, CANDIDATE))

    def test_duplicate_top_level_packages_are_rejected(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            p = root / "medusa-backend-poc/pnpm-lock.yaml"
            p.write_text(p.read_text("utf-8") + "\npackages:\n", encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-LOCK-UNREADABLE", inspect(root, CANDIDATE))

    def test_duplicate_lockfile_version_header_is_rejected(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            path = root / "medusa-backend-poc/pnpm-lock.yaml"
            path.write_text(path.read_text("utf-8") +
                            "\nlockfileVersion: '8.0'\n", encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-LOCK-UNREADABLE", inspect(root, CANDIDATE))

    def test_duplicate_importers_section_is_rejected(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            path = root / "medusa-backend-poc/pnpm-lock.yaml"
            path.write_text(path.read_text("utf-8") +
                            "\nimporters:\n", encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-LOCK-UNREADABLE", inspect(root, CANDIDATE))

    def test_duplicate_backend_importer_is_rejected(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            path = root / "medusa-backend-poc/pnpm-lock.yaml"
            body = path.read_text("utf-8").replace(
                "\npackages:\n",
                "\n  apps/backend:\n    dependencies:\n\npackages:\n")
            path.write_text(body, encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-LOCK-UNREADABLE", inspect(root, CANDIDATE))

    def test_duplicate_medusa_importer_dependency_is_rejected(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            path = root / "medusa-backend-poc/pnpm-lock.yaml"
            body = path.read_text("utf-8").replace(
                "      '@medusajs/framework':\n",
                f"      '@medusajs/medusa':\n"
                f"        specifier: {CANDIDATE}\n"
                f"        version: {CANDIDATE}\n"
                "      '@medusajs/framework':\n", 1)
            path.write_text(body, encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-LOCK-UNREADABLE", inspect(root, CANDIDATE))

    def test_duplicate_importer_version_scalar_is_rejected(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            path = root / "medusa-backend-poc/pnpm-lock.yaml"
            body = path.read_text("utf-8").replace(
                f"        version: {CANDIDATE}(eslint@9.0.0)",
                f"        version: {CANDIDATE}(eslint@9.0.0)\n"
                f"        version: {CANDIDATE}(eslint@9.0.0)", 1)
            path.write_text(body, encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-LOCK-UNREADABLE", inspect(root, CANDIDATE))

    def test_valid_unquoted_dotted_pnpm_dependency_is_accepted(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            path = root / "medusa-backend-poc/pnpm-lock.yaml"
            body = path.read_text("utf-8").replace(
                "      '@medusajs/framework':\n",
                "      instantsearch.js:\n"
                "        specifier: 4.113.0\n"
                "        version: 4.113.0\n"
                "      '@medusajs/framework':\n", 1)
            path.write_text(body, encoding="utf-8")
            self.assertEqual(inspect(root, CANDIDATE), [])

    def test_duplicate_unquoted_dotted_dependency_is_still_rejected(self):
        with TemporaryDirectory() as td:
            root = Path(td)
            self.fixture(root, CANDIDATE)
            path = root / "medusa-backend-poc/pnpm-lock.yaml"
            body = path.read_text("utf-8").replace(
                "      '@medusajs/framework':\n",
                "      instantsearch.js:\n"
                "        specifier: 4.113.0\n"
                "        version: 4.113.0\n"
                "      instantsearch.js:\n"
                "        specifier: 4.113.0\n"
                "        version: 4.113.0\n"
                "      '@medusajs/framework':\n", 1)
            path.write_text(body, encoding="utf-8")
            self.assertIn("MEDUSA-QUERY-LOCK-UNREADABLE", inspect(root, CANDIDATE))

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
