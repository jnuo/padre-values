#!/usr/bin/env python3
"""
Migrate data from Supabase to Neon.
Uses Supabase client for export and psycopg2 for Neon import.
"""

import os
import json
from dotenv import load_dotenv
from supabase import create_client
import psycopg2
from psycopg2.extras import execute_values

# Load environment variables
load_dotenv()
load_dotenv('.env.neon')

# Supabase connection
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SECRET_KEY')

# Neon connection
NEON_URL = os.getenv('NEON_DATABASE_URL')

TABLES = [
    'profiles',
    'user_access',
    'reports',
    'metrics',
    'metric_definitions',
    'profile_allowed_emails',
    'metric_aliases',
    'processed_files'
]

def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def get_neon_connection():
    return psycopg2.connect(NEON_URL)

def export_table(supabase, table_name):
    """Export all rows from a Supabase table."""
    print(f"  Exporting {table_name}...")
    response = supabase.table(table_name).select('*').execute()
    print(f"    Got {len(response.data)} rows")
    return response.data

def get_table_columns(conn, table_name):
    """Get column names for a table."""
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position
        """, (table_name,))
        return [row[0] for row in cur.fetchall()]

def import_table(conn, table_name, data, columns=None):
    """Import data into Neon table."""
    if not data:
        print(f"  {table_name}: No data to import")
        return

    # Get valid columns from the Neon table
    with conn.cursor() as cur:
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
        """, (table_name,))
        valid_columns = {row[0] for row in cur.fetchall()}

    # Use columns from first row, filtered to valid columns
    if columns is None:
        columns = [c for c in data[0].keys() if c in valid_columns]
    else:
        columns = [c for c in columns if c in valid_columns]

    print(f"  Importing {len(data)} rows into {table_name} (columns: {len(columns)})...")

    # Build INSERT statement
    cols = ', '.join([f'"{c}"' for c in columns])
    placeholders = ', '.join(['%s'] * len(columns))
    sql = f'INSERT INTO "{table_name}" ({cols}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'

    success = 0
    errors = 0

    with conn.cursor() as cur:
        for row in data:
            values = tuple(row.get(c) for c in columns)
            try:
                cur.execute(sql, values)
                success += 1
            except Exception as e:
                errors += 1
                if errors <= 3:  # Only show first 3 errors
                    print(f"    Error: {e}")
                conn.rollback()

        conn.commit()

    print(f"    Imported {success} rows ({errors} errors)")

def create_schema(conn):
    """Create tables in Neon if they don't exist."""
    schema_sql = '''
    -- Enable UUID extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Profiles table
    CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        display_name TEXT NOT NULL,
        owner_user_id UUID,
        owner_email TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- User access table
    CREATE TABLE IF NOT EXISTS user_access (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL,
        profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        access_level TEXT NOT NULL DEFAULT 'viewer',
        granted_at TIMESTAMPTZ DEFAULT NOW(),
        granted_by UUID
    );

    -- Reports table
    CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        sample_date DATE NOT NULL,
        file_name TEXT,
        source TEXT DEFAULT 'pdf',
        content_hash TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(profile_id, sample_date)
    );

    -- Metrics table
    CREATE TABLE IF NOT EXISTS metrics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        value NUMERIC NOT NULL,
        unit TEXT,
        ref_low NUMERIC,
        ref_high NUMERIC,
        flag TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(report_id, name)
    );

    -- Metric definitions table
    CREATE TABLE IF NOT EXISTS metric_definitions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        unit TEXT,
        ref_low NUMERIC,
        ref_high NUMERIC,
        display_order INT DEFAULT 0,
        is_favorite BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(profile_id, name)
    );

    -- Profile allowed emails table
    CREATE TABLE IF NOT EXISTS profile_allowed_emails (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(email)
    );

    -- Metric aliases table
    CREATE TABLE IF NOT EXISTS metric_aliases (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        metric_id UUID REFERENCES metric_definitions(id) ON DELETE CASCADE,
        alias TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Processed files table
    CREATE TABLE IF NOT EXISTS processed_files (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        content_hash TEXT NOT NULL,
        file_name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(profile_id, content_hash)
    );
    '''

    with conn.cursor() as cur:
        cur.execute(schema_sql)
        conn.commit()
    print("Schema created/verified")

def main():
    print("=" * 60)
    print("SUPABASE TO NEON MIGRATION")
    print("=" * 60)

    # Connect to both databases
    print("\nConnecting to Supabase...")
    supabase = get_supabase_client()

    print("Connecting to Neon...")
    neon_conn = get_neon_connection()

    # Schema already applied via neon_schema.sql
    print("\nSchema assumed to be already created...")

    # Export and import each table
    print("\nMigrating data...")

    # Order matters due to foreign keys
    ordered_tables = [
        'profiles',
        'user_access',
        'reports',
        'metrics',
        'metric_definitions',
        'profile_allowed_emails',
        'metric_aliases',
        'processed_files'
    ]

    row_counts = {}

    for table in ordered_tables:
        try:
            data = export_table(supabase, table)
            row_counts[table] = {'supabase': len(data)}
            import_table(neon_conn, table, data)
        except Exception as e:
            print(f"  Error with {table}: {e}")
            row_counts[table] = {'error': str(e)}

    # Verify counts
    print("\nVerifying row counts...")
    with neon_conn.cursor() as cur:
        for table in ordered_tables:
            cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            count = cur.fetchone()[0]
            if table in row_counts and 'supabase' in row_counts[table]:
                row_counts[table]['neon'] = count
                match = '✓' if row_counts[table]['supabase'] == count else '✗'
                print(f"  {table}: Supabase={row_counts[table]['supabase']}, Neon={count} {match}")
            else:
                print(f"  {table}: Neon={count}")

    # Save row counts
    with open('supabase/export/row_counts.json', 'w') as f:
        json.dump(row_counts, f, indent=2)

    neon_conn.close()

    print("\n" + "=" * 60)
    print("MIGRATION COMPLETE")
    print("=" * 60)

if __name__ == '__main__':
    main()
