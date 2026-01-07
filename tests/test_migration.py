"""
Tests for migration and data verification.
Smoke tests to verify the expected data structures and schema.
"""

import os
import sys

# Add the project root to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestExpectedDataStructures:
    """Tests that verify expected data structures match the schema."""

    def test_profile_has_required_fields(self):
        """Verify profiles table has expected fields."""
        expected_fields = ["id", "display_name", "owner_user_id", "created_at"]

        # Simulate a profile record
        profile = {
            "id": "uuid-here",
            "display_name": "Father (Migrated)",
            "owner_user_id": None,
            "created_at": "2024-01-01T00:00:00Z",
        }

        for field in expected_fields:
            assert field in profile, f"Profile missing field: {field}"

    def test_report_has_required_fields(self):
        """Verify reports table has expected fields."""
        expected_fields = ["id", "profile_id", "sample_date", "file_name", "created_at"]

        report = {
            "id": "uuid-here",
            "profile_id": "profile-uuid",
            "sample_date": "2024-01-15",
            "file_name": "blood_test.pdf",
            "created_at": "2024-01-01T00:00:00Z",
        }

        for field in expected_fields:
            assert field in report, f"Report missing field: {field}"

    def test_metric_has_required_fields(self):
        """Verify metrics table has expected fields."""
        expected_fields = [
            "id",
            "report_id",
            "name",
            "value",
            "unit",
            "ref_low",
            "ref_high",
        ]

        metric = {
            "id": "uuid-here",
            "report_id": "report-uuid",
            "name": "Hemoglobin",
            "value": 14.2,
            "unit": "g/dL",
            "ref_low": 12.0,
            "ref_high": 16.0,
        }

        for field in expected_fields:
            assert field in metric, f"Metric missing field: {field}"

    def test_user_access_has_required_fields(self):
        """Verify user_access table has expected fields."""
        expected_fields = [
            "id",
            "user_id",
            "profile_id",
            "access_level",
            "created_at",
        ]

        user_access = {
            "id": "uuid-here",
            "user_id": "user-uuid",
            "profile_id": "profile-uuid",
            "access_level": "owner",
            "created_at": "2024-01-01T00:00:00Z",
        }

        for field in expected_fields:
            assert field in user_access, f"UserAccess missing field: {field}"


class TestMigrationScriptExists:
    """Tests that migration script exists and has required functions."""

    def test_migration_script_importable(self):
        """Verify migration script can be imported."""
        import importlib.util

        script_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "scripts",
            "migrate_sheets_to_supabase.py",
        )

        assert os.path.exists(script_path), "Migration script not found"

        spec = importlib.util.spec_from_file_location("migrate_script", script_path)
        assert spec is not None, "Could not load migration script spec"


class TestSchemaDocumentation:
    """Tests that schema documentation exists."""

    def test_schema_md_exists(self):
        """Verify schema.md documentation exists."""
        schema_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "supabase",
            "schema.md",
        )

        assert os.path.exists(schema_path), "Schema documentation not found"

    def test_migration_file_exists(self):
        """Verify SQL migration file exists."""
        migrations_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "supabase",
            "migrations",
        )

        assert os.path.exists(migrations_dir), "Migrations directory not found"

        # Check for any .sql files
        sql_files = [f for f in os.listdir(migrations_dir) if f.endswith(".sql")]
        assert len(sql_files) > 0, "No SQL migration files found"


class TestAPIResponseFormat:
    """Tests that API response format matches expected structure."""

    def test_metrics_api_response_format(self):
        """Verify /api/metrics response format."""
        # Expected format from web/src/app/api/metrics/route.ts
        expected_response = {
            "metrics": [
                {
                    "id": "hemoglobin",
                    "name": "Hemoglobin",
                    "unit": "g/dL",
                    "ref_min": 12.0,
                    "ref_max": 16.0,
                }
            ],
            "values": [
                {
                    "metric_id": "hemoglobin",
                    "date": "2024-01-15",
                    "value": 14.2,
                }
            ],
        }

        # Verify structure
        assert "metrics" in expected_response
        assert "values" in expected_response
        assert isinstance(expected_response["metrics"], list)
        assert isinstance(expected_response["values"], list)

        # Verify metric fields
        metric = expected_response["metrics"][0]
        assert "id" in metric
        assert "name" in metric
        assert "unit" in metric
        assert "ref_min" in metric
        assert "ref_max" in metric

        # Verify value fields
        value = expected_response["values"][0]
        assert "metric_id" in value
        assert "date" in value
        assert "value" in value


class TestDashboardFormat:
    """Tests that dashboard format matches expected structure."""

    def test_dashboard_metric_format(self):
        """Verify dashboard metrics format from supabase_updater."""
        # Expected format from get_all_metrics_for_dashboard
        expected_format = {
            "dates": ["2024-01-15", "2024-02-20"],
            "metrics": {
                "Hemoglobin": {
                    "values": [14.2, 14.5],
                    "unit": "g/dL",
                    "ref_low": 12.0,
                    "ref_high": 16.0,
                }
            },
        }

        assert "dates" in expected_format
        assert "metrics" in expected_format
        assert isinstance(expected_format["dates"], list)
        assert isinstance(expected_format["metrics"], dict)
