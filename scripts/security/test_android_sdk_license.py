import unittest

from check_android_sdk_license import enterprise_sdk_modules


class AndroidSdkLicenseTest(unittest.TestCase):
    def test_reports_sdk_modules_in_an_indexed_map(self):
        source_map = {"version": 3, "sections": [{"map": {"version": 3, "sources": [
            "/workspace/native/node_modules/@medusajs/js-sdk/dist/esm/admin/rbac-role.js",
            "node_modules\\@medusajs\\js-sdk\\dist\\admin\\rbac-policy.js",
        ]}}]}
        self.assertEqual(enterprise_sdk_modules(source_map), ["rbac-policy", "rbac-role"])

    def test_accepts_a_map_with_only_store_and_auth_sources(self):
        source_map = {"version": 3, "sources": [
            "node_modules/@medusajs/js-sdk/dist/esm/auth/index.js",
            "node_modules/@medusajs/js-sdk/dist/esm/store/index.js",
        ]}
        self.assertEqual(enterprise_sdk_modules(source_map), [])

    def test_requires_an_inline_nonempty_source_map(self):
        for source_map in (
            {"version": 3, "sources": []},
            {"version": 3, "sections": [{"url": "external.map"}]},
        ):
            with self.subTest(source_map=source_map):
                with self.assertRaises((ValueError, KeyError)):
                    enterprise_sdk_modules(source_map)
