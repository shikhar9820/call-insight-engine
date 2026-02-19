"""
Setup MCAT (Industry/Product Category) Mapping in Supabase
Maps GLID (company_id) to their product categories
"""

import os
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

def setup_mcat_mapping():
    """Load GLID-MCAT mapping from Excel and insert into Supabase."""

    # Initialize Supabase
    supabase = create_client(
        os.environ.get('SUPABASE_URL'),
        os.environ.get('SUPABASE_KEY')
    )

    # Load Excel file
    excel_path = os.path.join(
        os.path.dirname(__file__),
        'archive/temp_files/glid _-_ mcat.xlsx'
    )

    print(f"Loading MCAT data from: {excel_path}")
    df = pd.read_excel(excel_path)
    print(f"Loaded {len(df)} rows")
    print(f"Columns: {df.columns.tolist()}")
    print(f"Sample data:\n{df.head()}")

    # Get unique GLIDs with their primary MCAT (first category)
    # Group by GLID and get first MCAT as primary, count total categories
    glid_summary = df.groupby('glid').agg({
        'glcat_mcat_name': ['first', 'count', lambda x: '|'.join(x.unique()[:5])]
    }).reset_index()

    glid_summary.columns = ['glid', 'primary_mcat', 'category_count', 'all_mcats']

    print(f"\nUnique GLIDs: {len(glid_summary)}")
    print(f"Sample:\n{glid_summary.head(10)}")

    # Check which GLIDs exist in our calls table
    print("\nChecking GLIDs in calls table...")
    calls_result = supabase.table('calls').select('company_id').not_.is_('company_id', 'null').execute()
    calls_glids = set([str(r['company_id']) for r in calls_result.data if r['company_id']])
    print(f"Unique GLIDs in calls: {len(calls_glids)}")

    # Find matching GLIDs
    glid_summary['glid_str'] = glid_summary['glid'].astype(str)
    matching = glid_summary[glid_summary['glid_str'].isin(calls_glids)]
    print(f"Matching GLIDs: {len(matching)}")

    # Create the mapping table data
    print("\nPreparing data for Supabase...")

    # First, try to create/update the table by inserting data
    # We'll use upsert to handle existing records

    records = []
    for _, row in glid_summary.iterrows():
        records.append({
            'glid': str(row['glid']),
            'primary_mcat': row['primary_mcat'],
            'category_count': int(row['category_count']),
            'all_mcats': row['all_mcats'][:500]  # Limit length
        })

    print(f"Total records to insert: {len(records)}")

    # Insert in batches
    batch_size = 500
    inserted = 0
    errors = []

    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        try:
            result = supabase.table('glid_mcat_mapping').upsert(
                batch,
                on_conflict='glid'
            ).execute()
            inserted += len(batch)
            print(f"Inserted batch {i//batch_size + 1}: {len(batch)} records")
        except Exception as e:
            error_msg = str(e)
            if 'relation "glid_mcat_mapping" does not exist' in error_msg:
                print("\nTable doesn't exist. Please create it first with this SQL:")
                print("""
CREATE TABLE glid_mcat_mapping (
    id SERIAL PRIMARY KEY,
    glid TEXT UNIQUE NOT NULL,
    primary_mcat TEXT NOT NULL,
    category_count INTEGER DEFAULT 1,
    all_mcats TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_glid_mcat_glid ON glid_mcat_mapping(glid);
CREATE INDEX idx_glid_mcat_primary ON glid_mcat_mapping(primary_mcat);
                """)
                return False
            else:
                errors.append(f"Batch {i//batch_size + 1}: {e}")
                print(f"Error in batch {i//batch_size + 1}: {e}")

    print(f"\nCompleted! Inserted {inserted} records")
    if errors:
        print(f"Errors: {len(errors)}")

    # Verify
    print("\nVerifying data...")
    count_result = supabase.table('glid_mcat_mapping').select('glid', count='exact').execute()
    print(f"Total records in table: {count_result.count}")

    # Show top MCATs
    print("\nTop MCATs by frequency:")
    mcat_counts = df['glcat_mcat_name'].value_counts().head(20)
    for mcat, count in mcat_counts.items():
        print(f"  {mcat}: {count}")

    return True


def analyze_mcat_coverage():
    """Analyze how many of our calls have MCAT mapping."""

    supabase = create_client(
        os.environ.get('SUPABASE_URL'),
        os.environ.get('SUPABASE_KEY')
    )

    # Get calls with company_id
    calls = supabase.table('calls').select('company_id, company_name, city').not_.is_('company_id', 'null').execute()

    # Get MCAT mappings
    try:
        mappings = supabase.table('glid_mcat_mapping').select('glid, primary_mcat').execute()
        mapping_dict = {m['glid']: m['primary_mcat'] for m in mappings.data}
    except:
        print("MCAT mapping table not found")
        return

    # Check coverage
    matched = 0
    unmatched_glids = []

    for call in calls.data:
        glid = str(call['company_id'])
        if glid in mapping_dict:
            matched += 1
        else:
            unmatched_glids.append(glid)

    print(f"\nMCAT Coverage Analysis:")
    print(f"  Total calls with GLID: {len(calls.data)}")
    print(f"  Matched with MCAT: {matched}")
    print(f"  Unmatched: {len(unmatched_glids)}")
    print(f"  Coverage: {matched/len(calls.data)*100:.1f}%")

    if unmatched_glids[:10]:
        print(f"\nSample unmatched GLIDs: {unmatched_glids[:10]}")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "analyze":
        analyze_mcat_coverage()
    else:
        setup_mcat_mapping()
