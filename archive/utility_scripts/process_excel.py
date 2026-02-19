# Copyright 2025 IndiaMART
# Call Insights Engine - Process Excel Data
# Reads Excel file, analyzes each row, stores in Supabase

"""
Usage:
    # Process all rows
    python process_excel.py --file "call data.xlsx"

    # Process with limit
    python process_excel.py --file "call data.xlsx" --limit 10

    # Skip first N rows (resume from where you left off)
    python process_excel.py --file "call data.xlsx" --skip 100 --limit 50

    # Dry run (no database storage)
    python process_excel.py --file "call data.xlsx" --limit 5 --no-store
"""

import sys
import os
import json
import argparse
import time
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
sys.stdout.reconfigure(encoding='utf-8')

# Rate limiting settings
REQUESTS_PER_MINUTE = 15  # Gemini API limit
DELAY_BETWEEN_REQUESTS = 60 / REQUESTS_PER_MINUTE  # ~4 seconds


ANALYSIS_PROMPT = '''You are an expert customer service analyst for IndiaMART (B2B e-commerce platform).

Analyze the following call transcript to extract structured insights.

{rag_context}

## TRANSCRIPT:
{transcript}

## OUTPUT (valid JSON only, no explanation):

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
    "follow_up_required": true,
    "follow_up_owner": "executive|customer|none",
    "follow_up_timeline": "timeline or null"
  }},
  "risk_signals": {{
    "churn_risk_score": 0.5,
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
    "was_purpose_fulfilled": true,
    "customer_satisfied": true,
    "requires_escalation": false
  }}
}}
```'''


TRANSLATION_PROMPT = '''Translate this Hindi/Hinglish transcript to English. Keep speaker labels (Executive:, Customer:).

{transcript}

Output English translation only:'''


def clean_transcript(text):
    """Clean transcript - convert \\n literals to actual newlines."""
    if pd.isna(text) or not text:
        return ''
    text = str(text)
    text = text.replace('\\n', '\n')
    text = text.replace('\r\n', '\n')
    return text.strip()


def validate_churn_score(analysis):
    """
    Validate Gemini's churn score. If invalid or inconsistent with signals,
    fallback to rule-based calculation.

    Args:
        analysis: dict with risk_signals and sentiment from Gemini

    Returns:
        dict with validated score and metadata
    """
    signals = analysis.get('risk_signals', {})
    sentiment = analysis.get('sentiment', {})
    gemini_score = signals.get('churn_risk_score')

    # Calculate rule-based score from signals
    rule_score = 0.1  # baseline

    if signals.get('deactivation_intent'):
        rule_score += 0.35
    if signals.get('deactivation_confirmed'):
        rule_score += 0.25
    if signals.get('legal_threat'):
        rule_score += 0.2
    if signals.get('refund_requested'):
        rule_score += 0.15
    if signals.get('payment_dispute'):
        rule_score += 0.15
    if signals.get('escalation_threatened'):
        rule_score += 0.1
    if signals.get('competitor_mentioned'):
        rule_score += 0.1

    # Sentiment adjustment
    customer_end = sentiment.get('customer_end', '')
    if customer_end in ['angry', 'frustrated']:
        rule_score += 0.1
    elif customer_end in ['satisfied', 'happy']:
        rule_score -= 0.05

    rule_score = min(1.0, max(0.0, rule_score))

    # Validation checks
    use_fallback = False
    reason = None

    # Case 1: Gemini score missing or invalid
    if gemini_score is None:
        use_fallback = True
        reason = "score_missing"
    elif not isinstance(gemini_score, (int, float)):
        use_fallback = True
        reason = "score_not_numeric"
    elif not (0 <= gemini_score <= 1):
        use_fallback = True
        reason = "score_out_of_range"

    # Case 2: Deactivation intent but low score (clear mismatch)
    elif signals.get('deactivation_intent') and gemini_score < 0.5:
        use_fallback = True
        reason = "deactivation_intent_mismatch"

    # Case 3: Deactivation confirmed but low score
    elif signals.get('deactivation_confirmed') and gemini_score < 0.6:
        use_fallback = True
        reason = "deactivation_confirmed_mismatch"

    # Case 4: Legal threat but low score
    elif signals.get('legal_threat') and gemini_score < 0.6:
        use_fallback = True
        reason = "legal_threat_mismatch"

    if use_fallback:
        return {
            'final_score': round(rule_score, 2),
            'source': 'rule_based',
            'reason': reason,
            'gemini_original': gemini_score,
            'rule_calculated': round(rule_score, 2)
        }
    else:
        return {
            'final_score': gemini_score,
            'source': 'gemini',
            'reason': None,
            'gemini_original': gemini_score,
            'rule_calculated': round(rule_score, 2)
        }


def parse_json_response(text):
    """Parse JSON from LLM response."""
    import re

    # Try to find JSON in ```json blocks
    json_match = re.search(r'```json\s*([\s\S]*?)```', text)
    if json_match:
        try:
            return json.loads(json_match.group(1).strip())
        except:
            pass

    # Try to find raw JSON
    if '{' in text:
        try:
            start = text.find('{')
            brace_count = 0
            end = start
            for i, char in enumerate(text[start:], start):
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end = i + 1
                        break
            return json.loads(text[start:end])
        except:
            pass

    return {}


def process_single_row(row, model, store_in_db=True, supabase_client=None):
    """
    Process a single row from the Excel file.

    Args:
        row: pandas Series with row data
        model: Gemini model instance
        store_in_db: Whether to store in Supabase
        supabase_client: SupabaseClient instance

    Returns:
        dict with results or None on failure
    """

    # Extract fields from row
    ucid = str(row.get('ucid', ''))
    transcript_raw = row.get('transcript', '')
    audio_url = row.get('call_recording_url', '')

    # Metadata
    company_id = str(row.get('glid', '')) if pd.notna(row.get('glid')) else None
    customer_type = str(row.get('customer_type', '')) if pd.notna(row.get('customer_type')) else None
    city = str(row.get('city_name', '')) if pd.notna(row.get('city_name')) else None
    call_duration = int(row.get('call_duration', 0)) if pd.notna(row.get('call_duration')) else None
    call_direction = str(row.get('FLAG_IN_OUT', '')) if pd.notna(row.get('FLAG_IN_OUT')) else None
    call_status = str(row.get('call_status', '')) if pd.notna(row.get('call_status')) else None
    vertical = str(row.get('iil_vertical_name', '')) if pd.notna(row.get('iil_vertical_name')) else None

    # Call date - parse call_entered_on
    call_start_time = None
    if pd.notna(row.get('call_entered_on')):
        try:
            call_date_raw = row.get('call_entered_on')
            if isinstance(call_date_raw, str):
                call_start_time = pd.to_datetime(call_date_raw).isoformat()
            else:
                call_start_time = pd.to_datetime(call_date_raw).isoformat()
        except Exception as e:
            print(f"    Warning: Could not parse call_entered_on: {e}")

    # Clean transcript
    transcript = clean_transcript(transcript_raw)

    if not transcript or len(transcript) < 50:
        print(f"    Skipping - transcript too short ({len(transcript)} chars)")
        return None

    if not ucid:
        ucid = f"excel_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"

    print(f"    UCID: {ucid}")
    print(f"    City: {city}, Type: {customer_type}")
    print(f"    Transcript: {len(transcript):,} chars")

    try:
        # Step 1: Translate
        print("    Translating...")
        translation_response = model.generate_content([
            TRANSLATION_PROMPT.format(transcript=transcript[:8000])  # Limit to 8K chars
        ])
        translation = translation_response.text.strip()
        print(f"    Translation: {len(translation):,} chars")

        time.sleep(DELAY_BETWEEN_REQUESTS)  # Rate limiting

        # Step 2: Get Classification RAG context for better issue mapping
        rag_context = ""
        try:
            from rag.dual_rag import get_classification_context
            print("    Fetching Classification RAG context...")
            # Extract first 500 chars as keywords for RAG search
            rag_context = get_classification_context(transcript[:500])
            if rag_context:
                print(f"    Classification RAG: {len(rag_context)} chars")
        except Exception as e:
            print(f"    Classification RAG skipped: {e}")

        # Step 3: Analyze with RAG context
        print("    Analyzing...")
        analysis_response = model.generate_content([
            ANALYSIS_PROMPT.format(rag_context=rag_context, transcript=transcript[:8000])
        ])
        analysis = parse_json_response(analysis_response.text)

        if not analysis:
            print("    WARNING: Could not parse analysis JSON")
            analysis = {}
        else:
            print(f"    Analysis: {len(analysis.get('issues', []))} issues, churn_risk: {analysis.get('risk_signals', {}).get('churn_risk_score', 'N/A')}")

        # Step 3.5: Validate churn score (fallback to rule-based if Gemini fails)
        churn_validation = validate_churn_score(analysis)
        original_score = churn_validation['gemini_original']
        final_score = churn_validation['final_score']

        # Update analysis with validated score
        if 'risk_signals' not in analysis:
            analysis['risk_signals'] = {}
        analysis['risk_signals']['churn_risk_score'] = final_score
        analysis['risk_signals']['churn_score_source'] = churn_validation['source']
        analysis['risk_signals']['churn_score_rule_calculated'] = churn_validation['rule_calculated']

        if churn_validation['source'] == 'rule_based':
            print(f"    Churn score OVERRIDE: {original_score} -> {final_score} (reason: {churn_validation['reason']})")
        else:
            print(f"    Churn score validated: {final_score} (rule-check: {churn_validation['rule_calculated']})")

        time.sleep(DELAY_BETWEEN_REQUESTS)  # Rate limiting

        # Step 4: Suggestion RAG - Get SOP recommendations for classified issues
        sop_recommendations = []
        try:
            from rag.dual_rag import get_sop_recommendations, dual_rag

            if dual_rag.is_available and analysis:
                issues = analysis.get('issues', [])
                sop_recommendations = get_sop_recommendations(issues)

                # Add SOP alert for high-risk calls
                risk_signals = analysis.get('risk_signals', {})
                if risk_signals.get('deactivation_intent') or risk_signals.get('churn_risk_score', 0) > 0.7:
                    analysis['sop_alert'] = {
                        "level": "high",
                        "message": "High churn risk detected. Follow Deactivation SOP - attempt retention before processing.",
                        "reference": "Ticket SOP - Deactivation"
                    }

                print(f"    Suggestion RAG: {len(sop_recommendations)} SOP recommendations")
        except Exception as e:
            print(f"    Suggestion RAG skipped: {e}")

        analysis['sop_recommendations'] = sop_recommendations

        # Step 5: Store in Supabase
        if store_in_db and supabase_client:
            print("    Storing in Supabase...")

            from database.supabase_client import (
                CallRecord, TranscriptRecord, parse_summary_to_insight
            )

            # 1. Insert call
            call = CallRecord(
                ucid=ucid,
                call_recording_url=audio_url or f"excel://{ucid}",
                call_type=call_direction or 'inbound',
                module=vertical or 'servicing',
                call_duration_seconds=call_duration,
                call_start_time=call_start_time,
                company_id=company_id,
                city=city,
                customer_type=customer_type,
                vertical_name=vertical
            )
            call_result = supabase_client.upsert_call(call)
            call_id = call_result.get('id')

            # 2. Insert transcript
            transcript_rec = TranscriptRecord(
                call_id=call_id,
                transcript=transcript,
                translation=translation,
                transcript_language='hi',
                languages_detected=['hindi', 'english'],
                speaker_count=2
            )
            transcript_result = supabase_client.insert_transcript(transcript_rec)
            transcript_id = transcript_result.get('id')

            # 3. Insert insights
            insight = parse_summary_to_insight(call_id, analysis, transcript_id)
            insight_result = supabase_client.insert_insight(insight)
            insight_id = insight_result.get('id')

            # 4. Insert issues
            issues = analysis.get('issues', [])
            if issues and insight_id:
                supabase_client.insert_issues(call_id, insight_id, issues)

            print(f"    Stored: call={call_id[:8]}..., issues={len(issues)}")

        return {
            'ucid': ucid,
            'transcript_length': len(transcript),
            'translation_length': len(translation),
            'issues_count': len(analysis.get('issues', [])),
            'churn_risk': analysis.get('risk_signals', {}).get('churn_risk_score'),
            'churn_score_source': analysis.get('risk_signals', {}).get('churn_score_source', 'unknown'),
            'churn_score_rule_calculated': analysis.get('risk_signals', {}).get('churn_score_rule_calculated'),
            'sentiment': f"{analysis.get('sentiment', {}).get('customer_start', 'N/A')} -> {analysis.get('sentiment', {}).get('customer_end', 'N/A')}",
            'sop_recommendations': len(sop_recommendations),
            'success': True
        }

    except Exception as e:
        print(f"    ERROR: {e}")
        import traceback
        traceback.print_exc()
        return {
            'ucid': ucid,
            'success': False,
            'error': str(e)
        }


def process_excel(file_path, store_in_db=True, limit=None, skip=0, output_file=None):
    """
    Process all rows from Excel file.

    Args:
        file_path: Path to Excel file
        store_in_db: Whether to store in Supabase
        limit: Max rows to process
        skip: Number of rows to skip
        output_file: Path to save results JSON
    """

    print("\n" + "="*70)
    print("CALL INSIGHTS ENGINE - EXCEL BATCH PROCESSING")
    print("="*70)

    # Load Excel
    print(f"\nLoading: {file_path}")
    df = pd.read_excel(file_path)
    total_rows = len(df)
    print(f"Total rows: {total_rows}")
    print(f"Columns: {list(df.columns)}")

    # Apply skip and limit
    if skip > 0:
        df = df.iloc[skip:]
        print(f"Skipping first {skip} rows")

    if limit:
        df = df.head(limit)
        print(f"Processing {len(df)} rows (limit={limit})")
    else:
        print(f"Processing {len(df)} rows")

    # Initialize Gemini
    print("\nInitializing Gemini...")
    import google.generativeai as genai
    genai.configure(api_key=os.environ.get('GOOGLE_API_KEY'))
    model = genai.GenerativeModel('gemini-2.0-flash-001')

    # Initialize Supabase
    supabase_client = None
    if store_in_db:
        print("Initializing Supabase...")
        try:
            from database.supabase_client import SupabaseClient
            supabase_client = SupabaseClient()
            print("Supabase connected!")
        except Exception as e:
            print(f"Supabase error: {e}")
            print("Continuing without database storage...")
            store_in_db = False

    # Process rows
    results = []
    success_count = 0
    fail_count = 0
    start_time = datetime.now()

    print(f"\n{'='*70}")
    print("PROCESSING ROWS")
    print(f"{'='*70}")

    for idx, (i, row) in enumerate(df.iterrows()):
        row_num = skip + idx + 1
        print(f"\n[{idx+1}/{len(df)}] Row {row_num}")

        result = process_single_row(
            row=row,
            model=model,
            store_in_db=store_in_db,
            supabase_client=supabase_client
        )

        if result:
            results.append(result)
            if result.get('success'):
                success_count += 1
            else:
                fail_count += 1
        else:
            fail_count += 1

        # Progress update every 10 rows
        if (idx + 1) % 10 == 0:
            elapsed = (datetime.now() - start_time).total_seconds()
            rate = (idx + 1) / elapsed * 60  # rows per minute
            remaining = (len(df) - idx - 1) / rate if rate > 0 else 0
            print(f"\n    Progress: {idx+1}/{len(df)} ({success_count} success, {fail_count} failed)")
            print(f"    Rate: {rate:.1f} rows/min, ETA: {remaining:.1f} min")

    # Summary
    elapsed = (datetime.now() - start_time).total_seconds()

    print(f"\n{'='*70}")
    print("BATCH PROCESSING COMPLETE")
    print(f"{'='*70}")
    print(f"\nResults:")
    print(f"  Total processed: {len(results)}")
    print(f"  Success: {success_count}")
    print(f"  Failed: {fail_count}")
    print(f"  Time: {elapsed:.1f} seconds ({elapsed/60:.1f} minutes)")
    print(f"  Rate: {len(results)/elapsed*60:.1f} rows/minute")

    # Save results
    if output_file:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"\nResults saved to: {output_file}")

    return results


def main():
    parser = argparse.ArgumentParser(description='Process Excel file and store in Supabase')
    parser.add_argument('--file', type=str, default='call data.xlsx', help='Path to Excel file')
    parser.add_argument('--limit', type=int, help='Max rows to process')
    parser.add_argument('--skip', type=int, default=0, help='Skip first N rows')
    parser.add_argument('--no-store', action='store_true', help='Do not store in database')
    parser.add_argument('--output', type=str, help='Output JSON file for results')

    args = parser.parse_args()

    # Default output file
    if not args.output:
        args.output = f"results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    process_excel(
        file_path=args.file,
        store_in_db=not args.no_store,
        limit=args.limit,
        skip=args.skip,
        output_file=args.output
    )


if __name__ == "__main__":
    main()
