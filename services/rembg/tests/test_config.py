import os
import unittest
from unittest.mock import patch

from app.config import Settings


class SettingsTests(unittest.TestCase):
    def test_rejects_wildcard_origin(self):
        environment = {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_PUBLISHABLE_KEY": "public-key",
            "ALLOWED_ORIGINS": "*",
        }
        with patch.dict(os.environ, environment, clear=True):
            with self.assertRaisesRegex(RuntimeError, "explicit origins"):
                Settings.from_environment()

    def test_reads_secure_defaults(self):
        environment = {
            "SUPABASE_URL": "https://example.supabase.co/",
            "SUPABASE_PUBLISHABLE_KEY": "public-key",
            "ALLOWED_ORIGINS": "https://photos.example.com,http://localhost:3000",
        }
        with patch.dict(os.environ, environment, clear=True):
            settings = Settings.from_environment()
        self.assertEqual(settings.supabase_url, "https://example.supabase.co")
        self.assertEqual(settings.model_name, "isnet-general-use")
        self.assertEqual(settings.max_upload_bytes, 20 * 1024 * 1024)
        self.assertEqual(settings.max_queued_jobs, 2)
        self.assertEqual(settings.rate_limit_jobs, 10)
        self.assertEqual(settings.global_rate_limit_jobs, 30)
        self.assertEqual(settings.rate_limit_window_seconds, 600)
        self.assertEqual(len(settings.allowed_origins), 2)


if __name__ == "__main__":
    unittest.main()
