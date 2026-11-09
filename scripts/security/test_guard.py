"""Deterministic self-tests for high-confidence, non-disclosing scanner rules."""
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from guard import scan_bytes, INDICATORS, release_failures, financial_regression_failures, financial_release_gate_failures, FINANCIAL_REGRESSIONS

class SecretGuardTest(unittest.TestCase):
    def test_token_detection_without_secret_output(self):
        secret = b"gh" + b"p_" + b"a" * 36
        names = scan_bytes(b"password = " + secret)
        self.assertEqual(names, ["github-classic-token"])
        self.assertNotIn(secret.decode(), str(names))

    def test_pem_private_key_marker(self):
        marker = b"-----BEGIN " + b"PRIVATE KEY-----"
        self.assertIn("private-key-pem", scan_bytes(marker + b"\nplaceholder"))

    def test_synthetic_ci_values_are_not_real_secrets(self):
        self.assertEqual(scan_bytes(b"CI=true\nsk_test_mock\n"
                                    b"DATABASE_URL=postgres://localhost/demo\n"), [])

    def test_distinct_identifiers(self):
        names = [name for name, _ in INDICATORS]
        self.assertEqual(len(names), len(set(names)))

    def test_release_gate_detects_debug_signing_and_insecure_token_store(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            gradle = root / "native-medusa/android/app/build.gradle"
            token = root / "native-medusa/app/api/auth-token-storage.ts"
            gradle.parent.mkdir(parents=True)
            token.parent.mkdir(parents=True)
            gradle.write_text("release {\n"
                              " signingConfig signingConfigs.debug\n"
                              " } } }\n")
            token.write_text("import AsyncStorage from 'storage'\n")
            self.assertEqual(release_failures(root), [
                "SEC-05-ANDROID-RELEASE-DEBUG-SIGNING",
                "SEC-04-NATIVE-JWT-ASYNCSTORAGE",
            ])
            gradle.write_text("release {\n"
                              " signingConfig signingConfigs.release\n"
                              " } } }\n")
            token.write_text("import SecureStore from 'trusted_store'\n")
            self.assertEqual(release_failures(root), [])


    def test_financial_sentinels_are_required_and_mutation_is_detected(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            for path, required in FINANCIAL_REGRESSIONS.items():
                file = root / path
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text("\\n".join(required), encoding="utf-8")
            self.assertEqual(financial_regression_failures(root), [])
            first = next(iter(FINANCIAL_REGRESSIONS))
            file = root / first
            body = file.read_text("utf-8")
            file.write_text(body.replace(FINANCIAL_REGRESSIONS[first][0], ""), encoding="utf-8")
            failures = financial_regression_failures(root)
            self.assertEqual(len(failures), 1)
            self.assertIn("FIN-REGRESSION-CONTRACT-MISSING", failures[0])


    def test_financial_release_gate_blocks_p0_and_unknown(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            self.assertEqual(financial_release_gate_failures(root),
                             ["FIN-RELEASE-RG03-UNKNOWN"])
            gate = root / "docs/security/SECURITY_RELEASE_GATES.md"
            gate.parent.mkdir(parents=True)
            gate.write_text("| RG-03 cart/order/payment | proof | **BLOCKED (P0)** |\\n")
            self.assertEqual(financial_release_gate_failures(root),
                             ["FIN-RELEASE-RG03-NOT-APPROVED"])
            gate.write_text("| RG-03 cart/order/payment | proof | PASS |\\n")
            self.assertEqual(financial_release_gate_failures(root), [])

    def test_financial_release_gate_rejects_approval_placed_before_blocked(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            gate = root / "docs/security/SECURITY_RELEASE_GATES.md"
            gate.parent.mkdir(parents=True)
            gate.write_text("| RG-03 cart/order/payment | forged | PASS |\n"
                            "| RG-03 cart/order/payment | actual | BLOCKED (P0) |\n",
                            encoding="utf-8")
            self.assertEqual(financial_release_gate_failures(root),
                             ["FIN-RELEASE-RG03-AMBIGUOUS"])

    def test_financial_release_gate_rejects_blocked_followed_by_approval(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            gate = root / "docs/security/SECURITY_RELEASE_GATES.md"
            gate.parent.mkdir(parents=True)
            gate.write_text("| RG-03 cart/order/payment | actual | BLOCKED (P0) |\n"
                            "| RG-03 cart/order/payment | forged | PASS |\n",
                            encoding="utf-8")
            self.assertEqual(financial_release_gate_failures(root),
                             ["FIN-RELEASE-RG03-AMBIGUOUS"])

    def test_financial_release_gate_rejects_duplicate_pass_rows(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            gate = root / "docs/security/SECURITY_RELEASE_GATES.md"
            gate.parent.mkdir(parents=True)
            gate.write_text("| RG-03 cart/order/payment | evidence | PASS |\n"
                            "| RG-03 cart/order/payment | evidence | PASS |\n",
                            encoding="utf-8")
            self.assertEqual(financial_release_gate_failures(root),
                             ["FIN-RELEASE-RG03-AMBIGUOUS"])

    def test_financial_release_gate_free_text_cannot_approve(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            gate = root / "docs/security/SECURITY_RELEASE_GATES.md"
            gate.parent.mkdir(parents=True)
            gate.write_text("RG-03 cart/order/payment | evidence | PASS\n",
                            encoding="utf-8")
            self.assertEqual(financial_release_gate_failures(root),
                             ["FIN-RELEASE-RG03-UNKNOWN"])

    def test_financial_release_gate_incomplete_row_is_unknown(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            gate = root / "docs/security/SECURITY_RELEASE_GATES.md"
            gate.parent.mkdir(parents=True)
            gate.write_text("| RG-03 cart/order/payment | PASS |\n",
                            encoding="utf-8")
            self.assertEqual(financial_release_gate_failures(root),
                             ["FIN-RELEASE-RG03-UNKNOWN"])

if __name__ == "__main__":
    unittest.main()
