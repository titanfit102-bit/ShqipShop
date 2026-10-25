"""Deterministic self-tests for high-confidence, non-disclosing scanner rules."""
import unittest
from guard import scan_bytes, INDICATORS

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

if __name__ == "__main__":
    unittest.main()
