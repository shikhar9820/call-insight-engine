# Copyright 2025 IndiaMART
# Import seller behavioral data from Excel into Supabase

"""
Imports seller profile and behavioral data from the Voice Hackathon Master Excel file.
Creates tables: seller_profiles, seller_monthly_metrics, seller_categories

Usage:
    python import_seller_data.py
    python import_seller_data.py --dry-run
"""

import sys
import argparse
import pandas as pd
from dotenv import load_dotenv

load_dotenv()
sys.stdout.reconfigure(encoding='utf-8')


def clean_value(val):
    """Clean a value for database insertion."""
    if pd.isna(val):
        return None
    if isinstance(val, str):
        val = val.strip()
        # Handle Excel error values
        if val in ['#DIV/0!', '#N/A', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#NULL!', '']:
            return None
        return val if val else None
    return val


def import_seller_data(file_path, dry_run=False):
    """Import seller data from Excel into Supabase."""

    print("\n" + "="*60)
    print("IMPORT SELLER BEHAVIORAL DATA")
    print("="*60)

    # Load Excel
    print(f"\nLoading: {file_path}")
    xlsx = pd.ExcelFile(file_path)
    print(f"Sheets found: {xlsx.sheet_names}")

    # Initialize Supabase
    if not dry_run:
        print("\nConnecting to Supabase...")
        try:
            from database.supabase_client import SupabaseClient
            client = SupabaseClient()
            print("Connected!")
        except Exception as e:
            print(f"ERROR: Could not connect to Supabase: {e}")
            return

    # =========================================
    # 1. CUSTOMER PROFILE (Master)
    # =========================================
    print("\n" + "-"*60)
    print("1. IMPORTING CUSTOMER PROFILE (Master)")
    print("-"*60)

    df_profile = pd.read_excel(xlsx, sheet_name='Customer Profile', header=1)
    print(f"Rows: {len(df_profile)}")
    print(f"Columns: {list(df_profile.columns)}")

    # Clean column names
    df_profile.columns = [str(c).strip().lower().replace(' ', '_') for c in df_profile.columns]
    print(f"Cleaned columns: {list(df_profile.columns)}")

    # Use dict to deduplicate by GLID (keep first occurrence)
    profiles_dict = {}
    for idx, row in df_profile.iterrows():
        glid = clean_value(row.get('complainant_glusr_id'))
        if not glid:
            continue

        glid_str = str(int(glid)) if isinstance(glid, float) else str(glid)

        # Skip if we already have this GLID
        if glid_str in profiles_dict:
            continue

        profile = {
            'glid': glid_str,
            'ticket_id': clean_value(row.get('customer_ticket_id')),
            'vintage_months': clean_value(row.get('vintage_months')),
            'highest_service': clean_value(row.get('highest_service')),
            'bl_active_days': clean_value(row.get('bl_active_days')),
            'pns_calls_received': clean_value(row.get('pns_calls_recd')),
            'pns_calls_answered': clean_value(row.get('pns_calls_ans')),
            'location_preference': clean_value(row.get('location_preference')),
            'pns_response_rate': clean_value(row.get('pns_responce_rate')),
            'category_rank': clean_value(row.get('a_rank_mcats_close')),
            'category_count': clean_value(row.get('category_count_close')),
            'repeat_30d': clean_value(row.get('repeat30d')),
            'repeat_60d': clean_value(row.get('repeat60d'))
        }
        profiles_dict[glid_str] = profile

    profiles_to_insert = list(profiles_dict.values())

    print(f"Profiles to insert: {len(profiles_to_insert)}")

    if dry_run:
        print("DRY RUN - Sample profile:")
        print(profiles_to_insert[0] if profiles_to_insert else "None")
    else:
        # Create table if not exists and upsert data
        print("Upserting profiles...")
        batch_size = 100
        for i in range(0, len(profiles_to_insert), batch_size):
            batch = profiles_to_insert[i:i+batch_size]
            try:
                result = client.client.table('seller_profiles').upsert(
                    batch,
                    on_conflict='glid'
                ).execute()
                print(f"  Batch {i//batch_size + 1}: {len(batch)} records")
            except Exception as e:
                print(f"  ERROR in batch {i//batch_size + 1}: {e}")

    # =========================================
    # 2. MONTHLY METRICS
    # =========================================
    print("\n" + "-"*60)
    print("2. IMPORTING MONTHLY METRICS (Oct & Nov)")
    print("-"*60)

    df_monthly = pd.read_excel(xlsx, sheet_name='Oct & Nov 25 Customer Profile (')
    print(f"Rows: {len(df_monthly)}")

    metrics_to_insert = []
    for idx, row in df_monthly.iterrows():
        glid = clean_value(row.get('fk_glusr_usr_id'))
        if not glid:
            continue

        metric = {
            'glid': str(int(glid)) if isinstance(glid, float) else str(glid),
            'data_month': clean_value(row.get('data_month')),
            'pns_defaulter_count': clean_value(row.get('pns_defaulter_count')),
            'fresh_lead_consumption': clean_value(row.get('cons_0_4_hrs')),
            'bl_not_identified_spec': clean_value(row.get('blni_spec')),
            'wrong_product_count': clean_value(row.get('blni_wrng_product')),
            'assisted_buy_enquiry': clean_value(row.get('ast_buy_enq')),
            'cqs_score': clean_value(row.get('cqs')),
            'ba_rank': clean_value(row.get('ba_rank_mcats')),
            'cc_rank': clean_value(row.get('cc_rank_mcats')),
            'super_pmcats_primary': clean_value(row.get('super_pmcats_primary')),
            'negative_cities_count': clean_value(row.get('cnt_neg_cities')),
            'pref_district': clean_value(row.get('pref_district')),
            'pref_city': clean_value(row.get('pref_city')),
            'pref_state': clean_value(row.get('pref_state')),
            'pref_country': clean_value(row.get('pref_country'))
        }
        metrics_to_insert.append(metric)

    print(f"Monthly metrics to insert: {len(metrics_to_insert)}")

    if dry_run:
        print("DRY RUN - Sample metric:")
        print(metrics_to_insert[0] if metrics_to_insert else "None")
    else:
        print("Upserting monthly metrics...")
        batch_size = 100
        for i in range(0, len(metrics_to_insert), batch_size):
            batch = metrics_to_insert[i:i+batch_size]
            try:
                result = client.client.table('seller_monthly_metrics').upsert(
                    batch,
                    on_conflict='glid,data_month'
                ).execute()
                print(f"  Batch {i//batch_size + 1}: {len(batch)} records")
            except Exception as e:
                print(f"  ERROR in batch {i//batch_size + 1}: {e}")

    # =========================================
    # 3. TOP CATEGORIES (MCATs)
    # =========================================
    print("\n" + "-"*60)
    print("3. IMPORTING TOP CATEGORIES (MCATs)")
    print("-"*60)

    df_mcats = pd.read_excel(xlsx, sheet_name='Top 5 MCATs')
    print(f"Rows: {len(df_mcats)}")

    categories_to_insert = []
    for idx, row in df_mcats.iterrows():
        glid = clean_value(row.get('glid'))
        if not glid:
            continue

        category = {
            'glid': str(int(glid)) if isinstance(glid, float) else str(glid),
            'mcat_id': clean_value(row.get('fk_eto_mcat_id')),
            'mcat_name': clean_value(row.get('glcat_mcat_name'))
        }
        categories_to_insert.append(category)

    print(f"Categories to insert: {len(categories_to_insert)}")

    if dry_run:
        print("DRY RUN - Sample category:")
        print(categories_to_insert[0] if categories_to_insert else "None")
    else:
        print("Upserting categories...")
        batch_size = 100
        for i in range(0, len(categories_to_insert), batch_size):
            batch = categories_to_insert[i:i+batch_size]
            try:
                result = client.client.table('seller_categories').upsert(
                    batch,
                    on_conflict='glid,mcat_id'
                ).execute()
                print(f"  Batch {i//batch_size + 1}: {len(batch)} records")
            except Exception as e:
                print(f"  ERROR in batch {i//batch_size + 1}: {e}")

    # =========================================
    # SUMMARY
    # =========================================
    print("\n" + "="*60)
    print("IMPORT COMPLETE")
    print("="*60)
    print(f"  Seller Profiles: {len(profiles_to_insert)}")
    print(f"  Monthly Metrics: {len(metrics_to_insert)}")
    print(f"  Categories: {len(categories_to_insert)}")

    if dry_run:
        print("\n  (This was a dry run - no actual changes made)")
        print("  Run without --dry-run to apply changes")


def main():
    parser = argparse.ArgumentParser(description='Import seller behavioral data')
    parser.add_argument('--file', type=str,
                        default='New Data Voice Hackathon_Master (1).xlsx',
                        help='Path to Excel file')
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview changes without inserting')

    args = parser.parse_args()

    import_seller_data(
        file_path=args.file,
        dry_run=args.dry_run
    )


if __name__ == "__main__":
    main()
