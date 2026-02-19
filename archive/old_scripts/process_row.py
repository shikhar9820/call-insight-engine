# Copyright 2025 IndiaMART
# Call Insights Engine - Process Tab-Separated Row Data
# Input: Tab-separated row with transcript → Output: Analysis + Supabase

"""
Expected Format (tab-separated):
company_id | customer_id | ? | ? | module | city | call_type | ? | ? | ? | transcript | existing_analysis | date | direction | status | duration | audio_url | ucid

Usage:
    # From file (one row per line)
    python process_row.py --file data.tsv

    # Single row from clipboard/input
    python process_row.py --row "675023082\t85693117\t..."

    # Interactive mode
    python process_row.py --interactive
"""

import sys
import os
import json
import argparse
import re
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
sys.stdout.reconfigure(encoding='utf-8')


ANALYSIS_PROMPT = '''You are an expert customer service analyst for IndiaMART (B2B e-commerce platform).

Analyze the following call transcript to extract structured insights.

## TRANSCRIPT:
{transcript}

## EXTRACT THE FOLLOWING (Output valid JSON only):

```json
{{
  "issues": [
    {{
      "category": "buylead_accessibility|buylead_availability|buylead_relevance|buylead_roi|payment|subscription|pns|catalog|enquiry|technical|employee|deactivation|other",
      "subcategory": "specific_issue",
      "description": "brief description",
      "severity": "critical|high|medium|low",
      "mentioned_by": "customer|executive",
      "timestamp_location": "start|middle|end"
    }}
  ],
  "resolution": {{
    "status": "resolved|partial|unresolved",
    "actions_taken": ["action1", "action2"],
    "promises_made": ["promise1"],
    "follow_up_required": true|false,
    "follow_up_owner": "executive|customer|none",
    "follow_up_timeline": "timeline or null"
  }},
  "risk_signals": {{
    "churn_risk_score": 0.0-1.0,
    "deactivation_intent": false,
    "deactivation_confirmed": false,
    "refund_requested": false,
    "escalation_threatened": false,
    "legal_threat": false,
    "competitor_mentioned": null,
    "payment_dispute": false
  }},
  "sentiment": {{
    "customer_start": "happy|satisfied|neutral|confused|frustrated|angry|anxious|disappointed",
    "customer_end": "same options",
    "sentiment_trajectory": "positive|negative|neutral|improving|worsening",
    "executive_tone": "professional|empathetic|defensive|rushed"
  }},
  "topics": ["topic1", "topic2"],
  "key_quotes": {{
    "main_complaint": "quote from transcript",
    "customer_ask": "quote from transcript",
    "resolution_offered": "quote from transcript",
    "notable_statement": "quote or null"
  }},
  "call_outcome": {{
    "primary_purpose": "complaint|query|request|feedback",
    "was_purpose_fulfilled": true|false,
    "customer_satisfied": true|false,
    "requires_escalation": false
  }}
}}
```

Analyze carefully and output ONLY the JSON.'''


TRANSLATION_PROMPT = '''Translate the following Hindi/Hinglish customer service call transcript to English.
Keep the speaker labels (Executive:, Customer:) intact.
Translate line by line.

## TRANSCRIPT:
{transcript}

## OUTPUT (English translation, keep speaker labels):'''


def parse_row(row_data: str) -> dict:
    """
    Parse a tab-separated row into structured data.

    Returns dict with:
    - company_id, customer_id, module, city, call_type
    - transcript, existing_analysis
    - date, direction, status, duration
    - audio_url, ucid
    """
    # Split by tab
    fields = row_data.strip().split('\t')

    # Clean up fields - remove extra whitespace
    fields = [f.strip() for f in fields]

    result = {
        'company_id': fields[0] if len(fields) > 0 else None,
        'customer_id': fields[1] if len(fields) > 1 else None,
        'field_2': fields[2] if len(fields) > 2 else None,
        'field_3': fields[3] if len(fields) > 3 else None,
        'module': fields[4] if len(fields) > 4 else None,
        'city': fields[5] if len(fields) > 5 else None,
        'call_type': fields[6] if len(fields) > 6 else None,
        'field_7': fields[7] if len(fields) > 7 else None,
        'field_8': fields[8] if len(fields) > 8 else None,
        'field_9': fields[9] if len(fields) > 9 else None,
        'transcript_raw': fields[10] if len(fields) > 10 else None,
        'date': None,
        'direction': None,
        'status': None,
        'duration': None,
        'audio_url': None,
        'ucid': None
    }

    # Find audio URL and UCID (look for knowlarity URL)
    for i, field in enumerate(fields):
        if 'knowlarity.com' in str(field):
            result['audio_url'] = field
            # UCID is usually the next field or extract from URL
            if len(fields) > i + 1:
                result['ucid'] = fields[i + 1]
            elif 'callid=' in field:
                result['ucid'] = field.split('callid=')[1].split('&')[0]
            break

    # Find date (MM/DD/YYYY format)
    for field in fields:
        if re.match(r'\d{1,2}/\d{1,2}/\d{4}', str(field)):
            result['date'] = field
            break

    # Find direction and status
    for field in fields:
        if field in ['Outgoing', 'Incoming', 'Inbound', 'Outbound']:
            result['direction'] = field
        if field in ['Answered', 'Missed', 'Busy', 'No Answer']:
            result['status'] = field

    # Find duration (numeric value near the end)
    for field in reversed(fields[-10:]):
        if field.isdigit() and int(field) > 10:  # Duration likely > 10 seconds
            result['duration'] = int(field)
            break

    # Clean transcript - convert \n literals to actual newlines
    if result['transcript_raw']:
        transcript = result['transcript_raw']
        # Replace literal \n with actual newlines
        transcript = transcript.replace('\\n', '\n')
        # Clean up extra spaces
        transcript = re.sub(r'\n\s*\n', '\n', transcript)
        result['transcript'] = transcript.strip()
    else:
        result['transcript'] = ''

    return result


def process_row(row_data: str, store_in_db: bool = True):
    """
    Process a single row of data.

    Steps:
    1. Parse row to extract fields
    2. Translate transcript to English
    3. Analyze with Gemini
    4. Enrich with RAG
    5. Store in Supabase
    """

    print("\n" + "="*70)
    print("CALL INSIGHTS ENGINE - ROW PROCESSING")
    print("="*70)

    # =========================================================================
    # STEP 1: PARSE ROW
    # =========================================================================
    print("\n[STEP 1/5] Parsing row data...")

    data = parse_row(row_data)

    print(f"  Company ID: {data['company_id']}")
    print(f"  Customer ID: {data['customer_id']}")
    print(f"  Module: {data['module']}")
    print(f"  City: {data['city']}")
    print(f"  Call Type: {data['call_type']}")
    print(f"  Direction: {data['direction']}")
    print(f"  Duration: {data['duration']} sec")
    print(f"  UCID: {data['ucid']}")
    print(f"  Transcript: {len(data['transcript']):,} chars")

    if not data['transcript']:
        print("  ERROR: No transcript found!")
        return None

    # =========================================================================
    # STEP 2: TRANSLATE TO ENGLISH
    # =========================================================================
    print("\n[STEP 2/5] Translating to English...")

    import google.generativeai as genai
    genai.configure(api_key=os.environ.get('GOOGLE_API_KEY'))
    model = genai.GenerativeModel('gemini-2.0-flash-001')

    translation_response = model.generate_content([
        TRANSLATION_PROMPT.format(transcript=data['transcript'])
    ])
    translation = translation_response.text.strip()
    print(f"  Translation: {len(translation):,} chars")

    # =========================================================================
    # STEP 3: ANALYZE WITH GEMINI
    # =========================================================================
    print("\n[STEP 3/5] Analyzing with Gemini...")

    analysis_response = model.generate_content([
        ANALYSIS_PROMPT.format(transcript=data['transcript'])
    ])

    result_text = analysis_response.text

    # Parse JSON
    analysis = {}
    json_match = re.search(r'```json\s*([\s\S]*?)```', result_text)
    if json_match:
        try:
            analysis = json.loads(json_match.group(1).strip())
            print(f"  Analysis: {len(analysis.get('issues', []))} issues found")
        except json.JSONDecodeError as e:
            print(f"  JSON parse error: {e}")

    # Fallback: try raw JSON
    if not analysis and '{' in result_text:
        try:
            start = result_text.find('{')
            brace_count = 0
            end = start
            for i, char in enumerate(result_text[start:], start):
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end = i + 1
                        break
            analysis = json.loads(result_text[start:end])
            print(f"  Analysis (fallback): {len(analysis.get('issues', []))} issues")
        except:
            print("  WARNING: Could not parse analysis JSON")

    if analysis:
        print(f"  Churn Risk: {analysis.get('risk_signals', {}).get('churn_risk_score', 'N/A')}")
        print(f"  Sentiment: {analysis.get('sentiment', {}).get('customer_start', 'N/A')} → {analysis.get('sentiment', {}).get('customer_end', 'N/A')}")

    # =========================================================================
    # STEP 4: RAG ENRICHMENT
    # =========================================================================
    print("\n[STEP 4/5] Enriching with RAG...")

    sop_recommendations = []
    try:
        from rag.rag_tool import rag_tool, enrich_call_summary

        if rag_tool.is_available and analysis:
            enriched = enrich_call_summary(analysis)
            sop_recommendations = enriched.get('sop_recommendations', [])

            if 'sop_alert' in enriched:
                analysis['sop_alert'] = enriched['sop_alert']

            print(f"  RAG enrichment: {len(sop_recommendations)} SOP recommendations")
        else:
            print("  RAG not available")
    except Exception as e:
        print(f"  RAG error: {e}")

    analysis['sop_recommendations'] = sop_recommendations

    # =========================================================================
    # STEP 5: STORE IN SUPABASE
    # =========================================================================
    if store_in_db and analysis:
        print("\n[STEP 5/5] Storing in Supabase...")

        try:
            from database.supabase_client import (
                SupabaseClient, CallRecord, TranscriptRecord,
                parse_summary_to_insight
            )

            client = SupabaseClient()

            ucid = data['ucid'] or f"row_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

            # 1. Insert call
            call = CallRecord(
                ucid=ucid,
                call_recording_url=data['audio_url'] or f"processed://{ucid}",
                call_type=data['direction'] or 'inbound',
                module=data['module'] or 'servicing',
                call_duration_seconds=data['duration'],
                company_id=data['company_id'],
                customer_mobile=data['customer_id']
            )
            call_result = client.upsert_call(call)
            call_id = call_result.get('id')
            print(f"  Call stored: {call_id}")

            # 2. Insert transcript
            transcript_rec = TranscriptRecord(
                call_id=call_id,
                transcript=data['transcript'],
                translation=translation,
                transcript_language='hi',
                languages_detected=['hindi', 'english'],
                speaker_count=2
            )
            transcript_result = client.insert_transcript(transcript_rec)
            transcript_id = transcript_result.get('id')
            print(f"  Transcript stored: {transcript_id}")

            # 3. Insert insights
            insight = parse_summary_to_insight(call_id, analysis, transcript_id)
            insight_result = client.insert_insight(insight)
            insight_id = insight_result.get('id')
            print(f"  Insights stored: {insight_id}")

            # 4. Insert issues
            issues = analysis.get('issues', [])
            if issues and insight_id:
                issues_result = client.insert_issues(call_id, insight_id, issues)
                print(f"  Issues stored: {len(issues_result)}")

        except Exception as e:
            print(f"  Database error: {e}")
            import traceback
            traceback.print_exc()
    else:
        print("\n[STEP 5/5] Skipping database storage")

    # =========================================================================
    # OUTPUT SUMMARY
    # =========================================================================
    print("\n" + "="*70)
    print("PROCESSING COMPLETE")
    print("="*70)

    print(f"\n📊 ANALYSIS RESULTS:")
    print(f"  Issues: {len(analysis.get('issues', []))}")
    for i, issue in enumerate(analysis.get('issues', [])[:5], 1):
        print(f"    {i}. [{issue.get('severity', 'N/A').upper()}] {issue.get('category', 'N/A')}: {issue.get('description', 'N/A')[:50]}")

    print(f"\n  Churn Risk: {analysis.get('risk_signals', {}).get('churn_risk_score', 'N/A')}")
    print(f"  Sentiment: {analysis.get('sentiment', {}).get('customer_start', 'N/A')} → {analysis.get('sentiment', {}).get('customer_end', 'N/A')}")
    print(f"  Resolution: {analysis.get('resolution', {}).get('status', 'N/A')}")
    print(f"  SOP Recommendations: {len(sop_recommendations)}")

    return {
        'data': data,
        'translation': translation,
        'analysis': analysis
    }


def process_file(file_path: str, store_in_db: bool = True, limit: int = None):
    """Process multiple rows from a file."""
    results = []

    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Skip header if present
    if lines and ('company_id' in lines[0].lower() or 'ucid' in lines[0].lower()):
        lines = lines[1:]

    if limit:
        lines = lines[:limit]

    print(f"\nProcessing {len(lines)} rows from {file_path}")

    for i, line in enumerate(lines, 1):
        if not line.strip():
            continue

        print(f"\n{'='*70}")
        print(f"ROW {i}/{len(lines)}")
        print(f"{'='*70}")

        try:
            result = process_row(line, store_in_db=store_in_db)
            if result:
                results.append(result)
        except Exception as e:
            print(f"ERROR processing row {i}: {e}")
            import traceback
            traceback.print_exc()

    print(f"\n\n{'='*70}")
    print(f"BATCH COMPLETE: {len(results)}/{len(lines)} rows processed")
    print(f"{'='*70}")

    return results


def main():
    parser = argparse.ArgumentParser(description='Process tab-separated row data')
    parser.add_argument('--file', type=str, help='Path to TSV file with rows')
    parser.add_argument('--row', type=str, help='Single row data (tab-separated)')
    parser.add_argument('--interactive', action='store_true', help='Interactive mode')
    parser.add_argument('--no-store', action='store_true', help='Do not store in database')
    parser.add_argument('--limit', type=int, help='Limit number of rows to process')

    args = parser.parse_args()

    if args.interactive:
        print("\n=== INTERACTIVE MODE ===")
        print("Paste the tab-separated row data (press Enter twice when done):")
        lines = []
        empty_count = 0
        while empty_count < 2:
            line = input()
            if not line:
                empty_count += 1
            else:
                empty_count = 0
                lines.append(line)

        row_data = '\n'.join(lines)
        process_row(row_data, store_in_db=not args.no_store)

    elif args.row:
        process_row(args.row, store_in_db=not args.no_store)

    elif args.file:
        process_file(args.file, store_in_db=not args.no_store, limit=args.limit)

    else:
        parser.print_help()
        print("\nExamples:")
        print('  python process_row.py --interactive')
        print('  python process_row.py --file data.tsv --limit 10')
        print('  python process_row.py --row "675023082\\t85693117\\t..."')


if __name__ == "__main__":
    main()
