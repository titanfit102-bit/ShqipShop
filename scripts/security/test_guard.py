"""Deterministic self-tests for high-confidence, non-disclosing scanner rules."""
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from guard import scan_bytes, INDICATORS, release_failures

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

if __name__ == "__main__":
    unittest.main()
