"""
Supabase configuration loader.
Loads Supabase credentials from environment variables.
"""

import os
from typing import Optional


class SupabaseConfig:
    """Configuration for Supabase connection."""

    def __init__(self):
        self.url: Optional[str] = os.getenv("SUPABASE_URL")
        self.publishable_key: Optional[str] = os.getenv("SUPABASE_PUBLISHABLE_KEY")
        self.secret_key: Optional[str] = os.getenv("SUPABASE_SECRET_KEY")

    def validate(self) -> bool:
        """Check if all required credentials are present."""
        return all([self.url, self.publishable_key, self.secret_key])

    def get_missing_vars(self) -> list[str]:
        """Return list of missing environment variables."""
        missing = []
        if not self.url:
            missing.append("SUPABASE_URL")
        if not self.publishable_key:
            missing.append("SUPABASE_PUBLISHABLE_KEY")
        if not self.secret_key:
            missing.append("SUPABASE_SECRET_KEY")
        return missing


def get_supabase_config() -> SupabaseConfig:
    """
    Load and validate Supabase configuration from environment variables.

    Returns:
        SupabaseConfig: Configuration object with Supabase credentials.

    Raises:
        ValueError: If required environment variables are missing.
    """
    config = SupabaseConfig()

    if not config.validate():
        missing = config.get_missing_vars()
        raise ValueError(
            f"Missing required Supabase environment variables: {', '.join(missing)}. "
            f"Please set these in your .env file. See .env.example for reference."
        )

    return config
