#!/usr/bin/env python3
"""
Bulk metric name normalization script for ViziAI.

Usage:
    python scripts/metric-normalization/normalize.py --group ALT --apply
    python scripts/metric-normalization/normalize.py --group ALT          # dry-run (default)
    python scripts/metric-normalization/normalize.py --list               # show all groups

Reads NEON_DATABASE_URL from web/.env.local
"""

import os
import sys
import argparse
from pathlib import Path

try:
    import psycopg2
except ImportError:
    print("psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

# ── Merge groups ──────────────────────────────────────────────────────────────
# (canonical_name, unit, ref_low, ref_high, [variants])

MERGE_GROUPS = {
    "ALT (Alanin Aminotransferaz)": {
        "unit": "U/L",
        "ref_low": 5,
        "ref_high": 55,
        "variants": [
            "ALT",
            "Alanin aminotransferaz",
            "Alanin aminotransferaz - [Alt / Sgpt]",
            "Alanine aminotransferaz (ALT)",
            "Alt (Alanin Aminotransferaz)",
            "Alt (Alanine Aminotransferaz)",
        ],
    },
    "AST (Aspartat Transaminaz)": {
        "unit": "U/L",
        "ref_low": 5,
        "ref_high": 40,
        "variants": [
            "AST",
            "Aspartat transaminaz",
            "Aspartat transaminaz (AST)",
            "Aspartat transaminaz [Ast / Sgot]",
            "Ast (Aspartat Transaminaz)",
        ],
    },
    "Albümin": {
        "unit": "g/L",
        "ref_low": None,
        "ref_high": None,
        "variants": [
            "Albumin",
            "Albümin (Serum/Plazma)",
            "Albümün",
        ],
    },
    "ALP (Alkalen Fosfataz)": {
        "unit": "U/L",
        "ref_low": 30,
        "ref_high": 150,
        "variants": [
            "ALP",
            "Alkalen Fosfataz",
            "Alkalen fosfataz",
            "Alkalen fosfataz (Serum/Plazma)",
            "Alkalin fosfataz",
            "Alp (Alkalen Fosfataz)",
        ],
    },
    "GGT (Gamma Glutamil Transferaz)": {
        "unit": "U/L",
        "ref_low": 5,
        "ref_high": 55,
        "variants": [
            "GGT",
            "GGT - Gamma glutamil transferaz",
            "Gama glutamil transferaz (GGT)",
            "Ggt (Gamma Glutamil Transferaz)",
        ],
    },
    "LDH (Laktik Dehidrogenaz)": {
        "unit": "U/L",
        "ref_low": 120,
        "ref_high": 246,
        "variants": [
            "LDH",
            "LDH - Laktik Dehidrogenaz",
            "Laktik Dehidrogenaz (LDH)",
            "Ldh (Laktik Dehidrogenaz)",
        ],
    },
    "CRP (C-Reaktif Protein)": {
        "unit": "mg/L",
        "ref_low": 0,
        "ref_high": 5,
        "variants": [
            "CRP",
            "C-reaktif Protein",
            "C Reaktif Protein",
            "Crp (Turbidimetrik)",
        ],
    },
    "Kalsiyum": {
        "unit": "mg/dL",
        "ref_low": 8.5,
        "ref_high": 10.5,
        "variants": [
            "Kalsiyum (Ca)",
            "Kalsiyum (Serum/Plazma)",
        ],
    },
    "Sodyum": {
        "unit": "mmol/L",
        "ref_low": 136,
        "ref_high": 145,
        "variants": [
            "Sodyum (Na)",
            "Sodyum (Na)(Serum/Plazma)",
            "Sodyum [Na]",
        ],
    },
    "Demir": {
        "unit": "µg/dL",
        "ref_low": 31,
        "ref_high": 144,
        "variants": [
            "Demir [Serum]",
        ],
    },
    "Ürik Asit": {
        "unit": "mg/dL",
        "ref_low": 2.6,
        "ref_high": 6,
        "variants": [
            "Ürik asit",
            "Ürik Asit (Serum/Plazma)",
        ],
    },
    "eGFR (Glomerüler Filtrasyon Hızı)": {
        "unit": "mL/dk/1.73m²",
        "ref_low": 60,
        "ref_high": 120,
        "variants": [
            "eGFR",
            "E-GFR",
            "Gfr - Tahmini Glomerüler Filtrasyon Hızı",
            "Glomerüler Filtrasyon Hızı CKD",
            "tGFR",
        ],
    },
    "Ferritin": {
        "unit": "ng/mL",
        "ref_low": 12,
        "ref_high": 300,
        "variants": [
            "Ferritin(Serum/Plazma)",
        ],
    },
    "Hemoglobin": {
        "unit": "g/dL",
        "ref_low": 13,
        "ref_high": 17.5,
        "variants": [
            "HGB",
            "Hgb",
        ],
    },
    "Hematokrit": {
        "unit": "%",
        "ref_low": 36,
        "ref_high": 51,
        "variants": [
            "HCT",
            "Hct",
        ],
    },
    "MPV (Ortalama Trombosit Hacmi)": {
        "unit": "fL",
        "ref_low": 7,
        "ref_high": 12.4,
        "variants": [
            "MPV",
            "Ortalama Trombosit Hacmi",
        ],
    },
    "Sedimantasyon": {
        "unit": "mm/h",
        "ref_low": 0,
        "ref_high": 20,
        "variants": [
            "Sedimentasyon",
            "SEDIMENTASYON",
        ],
    },
    "Vitamin B12": {
        "unit": "pg/mL",
        "ref_low": 190,
        "ref_high": 880,
        "variants": [
            "B12 Vitamini",
        ],
    },
    "Total Bilirubin": {
        "unit": "mg/dL",
        "ref_low": 0.2,
        "ref_high": 1.2,
        "variants": [
            "Bilirubin (Total)",
            "Bilirubin Total",
            "Bilirubin",
        ],
    },
    "Direkt Bilirubin": {
        "unit": "mg/dL",
        "ref_low": 0,
        "ref_high": 0.3,
        "variants": [
            "Bilirubin Direkt",
            "Bilirubin (Direkt)",
            "Bilirubin (direk)",
            "Bilirubin - [Direkt]",
        ],
    },
    "APTT (Parsiyel Tromboplastin Zamanı)": {
        "unit": "sn",
        "ref_low": 21,
        "ref_high": 35,
        "variants": [
            "APTT",
            "Aktive Parsiyel Tromboplastin Zamanı",
        ],
    },
    "Trigliserid": {
        "unit": "mg/dL",
        "ref_low": 0,
        "ref_high": 150,
        "variants": [
            "Trigliserit",
        ],
    },
    "Potasyum": {
        "unit": "mmol/L",
        "ref_low": 3.5,
        "ref_high": 5.1,
        "variants": [
            "Potasuyum (K)",
        ],
    },
    "Kan Üre Azotu": {
        "unit": "mg/dL",
        "ref_low": 6,
        "ref_high": 23,
        "variants": [
            "Kan Üre Azotu (BUN)",
            "Kan üre azotu (BUN)",
        ],
    },
    "Nötrofil#": {
        "unit": "10^3/µL",
        "ref_low": 1.5,
        "ref_high": 7.7,
        "variants": [
            "Nötrofil",
            "NEU#",
        ],
    },
    "Monosit#": {
        "unit": "10^3/µL",
        "ref_low": 0.1,
        "ref_high": 1.0,
        "variants": [
            "Monosit",
            "MO#",
            "MON#",
        ],
    },
    "Lenfosit#": {
        "unit": "10^3/µL",
        "ref_low": 1,
        "ref_high": 4.8,
        "variants": [
            "Lenfosit",
            "LY#",
            "LYM#",
        ],
    },
    "Eozinofil#": {
        "unit": "10^3/µL",
        "ref_low": 0,
        "ref_high": 0.5,
        "variants": [
            "Eozinofil",
            "EOS#",
        ],
    },
    "Bazofil#": {
        "unit": "10^3/µL",
        "ref_low": 0,
        "ref_high": 0.1,
        "variants": [
            "Bazofil",
            "BASO#",
        ],
    },
}


def get_database_url():
    env_path = Path(__file__).parent.parent.parent / "web" / ".env.local"
    if not env_path.exists():
        print(f"Error: {env_path} not found")
        sys.exit(1)
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line.startswith("NEON_DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    print("Error: NEON_DATABASE_URL not found in web/.env.local")
    sys.exit(1)


def run_group(conn, canonical, config, apply=False):
    cur = conn.cursor()
    variants = config["variants"]
    unit = config["unit"]
    ref_low = config["ref_low"]
    ref_high = config["ref_high"]

    all_names = [canonical] + variants
    placeholders = ",".join(["%s"] * len(all_names))

    cur.execute(
        f"SELECT name, unit, value, ref_low, ref_high FROM metrics WHERE name IN ({placeholders}) ORDER BY value",
        all_names,
    )
    rows = cur.fetchall()
    if not rows:
        print(f"  No rows found for {canonical}")
        return

    print(f"\n  {canonical}: {len(rows)} rows")

    if not apply:
        # Dry run — show what would change
        name_changes = sum(1 for r in rows if r[0] != canonical)
        unit_changes = sum(1 for r in rows if r[1] != unit)
        ref_changes = 0
        if ref_low is not None and ref_high is not None:
            ref_changes = sum(1 for r in rows if r[3] != ref_low or r[4] != ref_high)
        print(f"    Name changes: {name_changes}")
        print(f"    Unit changes: {unit_changes}")
        print(f"    Ref range changes: {ref_changes} → ({ref_low}–{ref_high})")
        print(f"    Aliases to insert: {len(variants)}")
        cur.close()
        return

    # Delete intra-group duplicates (keep one per report)
    placeholders_v = ",".join(["%s"] * len(all_names))
    cur.execute(
        f"""DELETE FROM metrics
        WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY report_id ORDER BY
                    CASE WHEN name = %s THEN 0 ELSE 1 END, created_at
                ) as rn
                FROM metrics
                WHERE name IN ({placeholders_v})
            ) ranked
            WHERE rn > 1
        )""",
        [canonical] + all_names,
    )
    dupes_deleted = cur.rowcount
    if dupes_deleted:
        print(f"    Deleted {dupes_deleted} duplicate rows (same report, same test)")

    placeholders_var = ",".join(["%s"] * len(variants))
    cur.execute(
        f"UPDATE metrics SET name = %s WHERE name IN ({placeholders_var})",
        [canonical] + variants,
    )
    renamed = cur.rowcount
    print(f"    Renamed {renamed} rows → {canonical}")

    cur.execute(
        f"UPDATE metrics SET unit = %s WHERE name = %s AND (unit IS NULL OR unit = '' OR unit != %s)",
        [unit, canonical, unit],
    )
    unit_fixed = cur.rowcount
    if unit_fixed:
        print(f"    Fixed unit on {unit_fixed} rows → {unit}")

    if ref_low is not None and ref_high is not None:
        cur.execute(
            "UPDATE metrics SET ref_low = %s, ref_high = %s WHERE name = %s",
            [ref_low, ref_high, canonical],
        )
        ref_updated = cur.rowcount
        print(f"    Set ref range on {ref_updated} rows → {ref_low}–{ref_high}")

    alias_count = 0
    for variant in variants:
        cur.execute(
            "INSERT INTO metric_aliases (alias, canonical_name) VALUES (%s, %s) "
            "ON CONFLICT (alias) DO NOTHING",
            (variant, canonical),
        )
        if cur.rowcount > 0:
            alias_count += 1
    print(f"    Inserted {alias_count} aliases")

    conn.commit()
    print(f"    ✓ Done")
    cur.close()


def main():
    parser = argparse.ArgumentParser(description="Normalize metric names in ViziAI")
    parser.add_argument("--group", type=str, help="Canonical name of group to process (e.g. ALT)")
    parser.add_argument("--apply", action="store_true", help="Execute changes (default: dry-run)")
    parser.add_argument("--list", action="store_true", help="List all groups")
    parser.add_argument("--url", type=str, help="Database URL (overrides .env.local)")
    args = parser.parse_args()

    if args.list:
        for name, config in MERGE_GROUPS.items():
            ref = f"{config['ref_low']}–{config['ref_high']}" if config['ref_low'] else "not set"
            print(f"  {name}: {len(config['variants'])} variants, unit={config['unit']}, ref={ref}")
        return

    if not args.group:
        print("Error: --group required (e.g. --group ALT). Use --list to see all groups.")
        sys.exit(1)

    if args.group not in MERGE_GROUPS:
        print(f"Error: unknown group '{args.group}'. Use --list to see all groups.")
        sys.exit(1)

    db_url = args.url or os.environ.get("NEON_DATABASE_URL") or get_database_url()
    print(f"Connecting to: {db_url[:40]}...")
    conn = psycopg2.connect(db_url)

    mode = "APPLYING" if args.apply else "DRY RUN"
    print(f"\n  [{mode}] Group: {args.group}")
    run_group(conn, args.group, MERGE_GROUPS[args.group], apply=args.apply)
    conn.close()


if __name__ == "__main__":
    main()
