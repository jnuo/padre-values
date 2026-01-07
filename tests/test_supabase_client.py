"""
Tests for Supabase client wrapper.
Smoke tests to verify the module loads and functions exist.
"""

import os
import sys
import pytest

# Add the project root to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestModuleImports:
    """Test that modules can be imported."""

    def test_supabase_config_imports(self):
        """Verify supabase_config module can be imported."""
        from src import supabase_config
        assert hasattr(supabase_config, "get_supabase_config")
        assert hasattr(supabase_config, "SupabaseConfig")

    def test_supabase_client_imports(self):
        """Verify supabase_client module can be imported."""
        from src import supabase_client
        assert hasattr(supabase_client, "get_supabase_client")
        assert hasattr(supabase_client, "reset_client")

    def test_supabase_updater_imports(self):
        """Verify supabase_updater module can be imported."""
        from src import supabase_updater
        assert hasattr(supabase_updater, "save_report")
        assert hasattr(supabase_updater, "get_profile_metrics")
        assert hasattr(supabase_updater, "get_all_metrics_for_dashboard")


class TestSupabaseConfigValidation:
    """Test configuration validation."""

    def test_config_requires_url(self, monkeypatch):
        """Should raise error when SUPABASE_URL is missing."""
        # Clear environment variables
        monkeypatch.delenv("SUPABASE_URL", raising=False)
        monkeypatch.delenv("SUPABASE_PUBLISHABLE_KEY", raising=False)
        monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)

        from src.supabase_config import get_supabase_config

        with pytest.raises(ValueError) as exc_info:
            get_supabase_config()

        assert "SUPABASE_URL" in str(exc_info.value)

    def test_config_loads_with_valid_env(self, monkeypatch):
        """Should load config when environment variables are set."""
        monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
        monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "test-anon-key")
        monkeypatch.setenv("SUPABASE_SECRET_KEY", "test-service-key")

        from src.supabase_config import get_supabase_config

        config = get_supabase_config()

        assert config.url == "https://test.supabase.co"
        assert config.publishable_key == "test-anon-key"
        assert config.secret_key == "test-service-key"


class TestClientFunctions:
    """Test client functions exist and have expected signatures."""

    def test_get_supabase_client_has_use_service_key_param(self):
        """Verify get_supabase_client accepts use_service_key parameter."""
        from src.supabase_client import get_supabase_client
        import inspect

        sig = inspect.signature(get_supabase_client)
        params = list(sig.parameters.keys())

        assert "use_service_key" in params

    def test_reset_client_callable(self):
        """Verify reset_client is callable."""
        from src.supabase_client import reset_client

        assert callable(reset_client)


class TestUpdaterFunctions:
    """Test updater functions exist and have expected signatures."""

    def test_save_report_signature(self):
        """Verify save_report has expected parameters."""
        from src.supabase_updater import save_report
        import inspect

        sig = inspect.signature(save_report)
        params = list(sig.parameters.keys())

        assert "profile_id" in params
        assert "sample_date" in params
        assert "tests_dict" in params

    def test_get_profile_metrics_signature(self):
        """Verify get_profile_metrics has expected parameters."""
        from src.supabase_updater import get_profile_metrics
        import inspect

        sig = inspect.signature(get_profile_metrics)
        params = list(sig.parameters.keys())

        assert "profile_id" in params

    def test_get_all_metrics_for_dashboard_signature(self):
        """Verify get_all_metrics_for_dashboard has expected parameters."""
        from src.supabase_updater import get_all_metrics_for_dashboard
        import inspect

        sig = inspect.signature(get_all_metrics_for_dashboard)
        params = list(sig.parameters.keys())

        assert "profile_name" in params
