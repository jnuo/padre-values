# ViziAI Database Schema

## Overview

This document describes the Supabase database schema for ViziAI, a blood test tracking application.

## Entity Relationship Diagram

```
┌─────────────────┐         ┌─────────────────┐
│   auth.users    │         │    profiles     │
│  (Supabase)     │         │                 │
├─────────────────┤         ├─────────────────┤
│ id (UUID) PK    │◄───────►│ id (UUID) PK    │
│ email           │         │ display_name    │
│ ...             │         │ owner_user_id FK│──┐
└────────┬────────┘         │ created_at      │  │
         │                  │ updated_at      │  │
         │                  └────────┬────────┘  │
         │                           │           │
         │  ┌────────────────────────┘           │
         │  │                                    │
         ▼  ▼                                    │
┌─────────────────┐                              │
│   user_access   │◄─────────────────────────────┘
├─────────────────┤
│ id (UUID) PK    │
│ user_id FK      │───► auth.users
│ profile_id FK   │───► profiles
│ access_level    │
│ granted_at      │
│ granted_by FK   │
└─────────────────┘

         │
         ▼ (via profile_id)

┌─────────────────┐         ┌─────────────────┐
│     reports     │         │     metrics     │
├─────────────────┤         ├─────────────────┤
│ id (UUID) PK    │◄────────│ id (UUID) PK    │
│ profile_id FK   │         │ report_id FK    │
│ sample_date     │         │ name            │
│ file_name       │         │ value           │
│ source          │         │ unit            │
│ notes           │         │ ref_low         │
│ created_at      │         │ ref_high        │
│ updated_at      │         │ flag            │
└─────────────────┘         │ created_at      │
                            └─────────────────┘
```

## Tables

### profiles

Represents a patient whose blood tests are being tracked.

| Column          | Type        | Description                              |
| --------------- | ----------- | ---------------------------------------- |
| `id`            | UUID        | Primary key                              |
| `display_name`  | TEXT        | Patient's display name                   |
| `owner_user_id` | UUID        | FK to auth.users - who owns this profile |
| `created_at`    | TIMESTAMPTZ | When the profile was created             |
| `updated_at`    | TIMESTAMPTZ | Last update timestamp                    |

### user_access

Many-to-many relationship between users and profiles. Enables family members to share access to the same patient's data.

| Column         | Type        | Description                           |
| -------------- | ----------- | ------------------------------------- |
| `id`           | UUID        | Primary key                           |
| `user_id`      | UUID        | FK to auth.users - who has access     |
| `profile_id`   | UUID        | FK to profiles - which profile        |
| `access_level` | TEXT        | 'viewer', 'editor', or 'owner'        |
| `granted_at`   | TIMESTAMPTZ | When access was granted               |
| `granted_by`   | UUID        | FK to auth.users - who granted access |

**Constraint:** Unique on (user_id, profile_id)

### reports

One report per PDF/blood test date. Belongs to a profile.

| Column        | Type        | Description                         |
| ------------- | ----------- | ----------------------------------- |
| `id`          | UUID        | Primary key                         |
| `profile_id`  | UUID        | FK to profiles                      |
| `sample_date` | DATE        | When blood was drawn                |
| `file_name`   | TEXT        | Source PDF filename (if applicable) |
| `source`      | TEXT        | 'pdf', 'manual', or 'migrated'      |
| `notes`       | TEXT        | Optional notes                      |
| `created_at`  | TIMESTAMPTZ | When the report was created         |
| `updated_at`  | TIMESTAMPTZ | Last update timestamp               |

**Constraint:** Unique on (profile_id, sample_date)

### metrics

Individual test values with reference ranges. Belongs to a report.

| Column       | Type        | Description                                  |
| ------------ | ----------- | -------------------------------------------- |
| `id`         | UUID        | Primary key                                  |
| `report_id`  | UUID        | FK to reports                                |
| `name`       | TEXT        | Metric name (e.g., "Hemoglobin")             |
| `value`      | NUMERIC     | Measured value                               |
| `unit`       | TEXT        | Unit of measurement (e.g., "g/dL")           |
| `ref_low`    | NUMERIC     | Reference range low                          |
| `ref_high`   | NUMERIC     | Reference range high                         |
| `flag`       | TEXT        | 'H' (high), 'L' (low), 'N' (normal), or NULL |
| `created_at` | TIMESTAMPTZ | When the metric was created                  |

**Constraint:** Unique on (report_id, name)

## Indexes

- `idx_profiles_owner` - profiles(owner_user_id)
- `idx_user_access_user` - user_access(user_id)
- `idx_user_access_profile` - user_access(profile_id)
- `idx_reports_profile` - reports(profile_id)
- `idx_reports_sample_date` - reports(sample_date)
- `idx_reports_profile_date` - reports(profile_id, sample_date DESC)
- `idx_metrics_report` - metrics(report_id)
- `idx_metrics_name` - metrics(name)
- `idx_metrics_report_name` - metrics(report_id, name)

## Row Level Security (RLS)

All tables have RLS enabled with the following policies:

### profiles

- **View:** Users can view profiles they have access to (via user_access) or own
- **Update:** Only owners can update profiles
- **Insert:** Authenticated users can create profiles
- **Service role:** Full access for server-side operations

### user_access

- **View:** Users can view their own access entries
- **All operations:** Profile owners can manage access
- **Service role:** Full access for server-side operations

### reports

- **View:** Users can view reports for accessible profiles
- **All operations:** Editors and owners can manage reports
- **Service role:** Full access for server-side operations

### metrics

- **View:** Users can view metrics for accessible reports
- **All operations:** Editors and owners can manage metrics
- **Service role:** Full access for server-side operations

## Data Flow

1. **PDF Upload:** Python backend extracts lab values using OpenAI Vision
2. **Data Storage:** Backend uses service role key to insert reports and metrics
3. **Dashboard:** Frontend uses anon key with user's JWT to query accessible data
4. **Access Control:** RLS policies ensure users only see their own data

## Migration from Google Sheets

When migrating existing data:

1. Create a profile for the patient
2. Create a user_access entry linking the owner
3. For each date column in the sheet, create a report
4. For each metric value, create a metrics row with its reference range
