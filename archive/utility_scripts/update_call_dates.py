# Copyright 2025 IndiaMART
# Quick script to update call_start_time from Excel without re-processing

"""
Updates only the call_start_time field from call_entered_on column.
No Gemini calls, no transcript processing - just date updates.

Usage:
    python update_call_dates.py --file "call data.xlsx"
    python update_call_dates.py --file "call data.xlsx" --dry-run
"""

import sys
import argparse
import pandas as pd
from dotenv import load_dotenv

load_dotenv()
sys.stdout.reconfigure(encoding='utf-8')


def update_call_dates(file_path, dry_run=False):
    """Update call_start_time for existing records."""

    print("\n" + "="*60)
    print("UPDATE CALL DATES FROM EXCEL")
    print("="*60)

    # Load Excel
    print(f"\nLoading: {file_path}")
    df = pd.read_excel(file_path)
    print(f"Total rows: {len(df)}")

    # Check required columns
    if 'ucid' not in df.columns:
        print("ERROR: 'ucid' column not found!")
        return

    if 'call_entered_on' not in df.columns:
        print("ERROR: 'call_entered_on' column not found!")
        print(f"Available columns: {list(df.columns)}")
        return

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

    # Process rows
    updated = 0
    skipped = 0
    errors = 0

    print(f"\nProcessing {len(df)} rows...")
    print("-" * 60)

    for idx, row in df.iterrows():
        ucid = str(row.get('ucid', ''))
        call_date_raw = row.get('call_entered_on')

        if not ucid or pd.isna(row.get('ucid')):
            skipped += 1
            continue

        if pd.isna(call_date_raw):
            skipped += 1
            continue

        # Parse date
        try:
            call_start_time = pd.to_datetime(call_date_raw).isoformat()
        except Exception as e:
            print(f"  [{idx+1}] SKIP - Could not parse date for UCID {ucid}: {e}")
            skipped += 1
            continue

        if dry_run:
            print(f"  [{idx+1}] DRY RUN - Would update UCID {ucid}: {call_start_time}")
            updated += 1
        else:
            try:
                # Update only call_start_time
                result = client.client.table('calls').update({
                    'call_start_time': call_start_time
                }).eq('ucid', ucid).execute()

                if result.data:
                    updated += 1
                    if (idx + 1) % 50 == 0:
                        print(f"  Progress: {idx+1}/{len(df)} ({updated} updated)")
                else:
                    # UCID not found in database
                    skipped += 1

            except Exception as e:
                print(f"  [{idx+1}] ERROR updating UCID {ucid}: {e}")
                errors += 1

    # Summary
    print("\n" + "="*60)
    print("COMPLETE")
    print("="*60)
    print(f"  Updated: {updated}")
    print(f"  Skipped: {skipped}")
    print(f"  Errors:  {errors}")

    if dry_run:
        print("\n  (This was a dry run - no actual changes made)")
        print("  Run without --dry-run to apply changes")


def main():
    parser = argparse.ArgumentParser(description='Update call_start_time from Excel')
    parser.add_argument('--file', type=str, default='call data.xlsx', help='Path to Excel file')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without updating')

    args = parser.parse_args()

    update_call_dates(
        file_path=args.file,
        dry_run=args.dry_run
    )


if __name__ == "__main__":
    main()
