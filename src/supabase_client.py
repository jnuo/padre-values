"""
Supabase client wrapper.
Provides an authenticated Supabase client for server-side operations.
"""

import os
from typing import Optional

from supabase import create_client, Client

from src.supabase_config import get_supabase_config, SupabaseConfig


_client: Optional[Client] = None


def get_supabase_client(use_service_key: bool = True) -> Client:
    """
    Get an authenticated Supabase client.

    The client is created once and reused for subsequent calls (singleton pattern).

    Args:
        use_service_key: If True (default), use the service role key for full access.
                         If False, use the publishable (anon) key with RLS enforcement.

    Returns:
        Client: An authenticated Supabase client.

    Raises:
        ValueError: If required environment variables are missing.

    Example:
        >>> client = get_supabase_client()
        >>> data = client.table("profiles").select("*").execute()
    """
    global _client

    # Return cached client if available (only for service key mode)
    if _client is not None and use_service_key:
        return _client

    # Load and validate configuration
    config = get_supabase_config()

    # Choose the appropriate key
    key = config.secret_key if use_service_key else config.publishable_key

    if not key:
        key_type = "SUPABASE_SECRET_KEY" if use_service_key else "SUPABASE_PUBLISHABLE_KEY"
        raise ValueError(
            f"Missing {key_type}. Please set this environment variable. "
            f"See .env.example for reference."
        )

    # Create the client
    client = create_client(config.url, key)

    # Cache the client for service key mode
    if use_service_key:
        _client = client

    return client


def reset_client() -> None:
    """
    Reset the cached client.

    Useful for testing or when credentials change.
    """
    global _client
    _client = None
