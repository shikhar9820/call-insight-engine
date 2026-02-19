# Copyright 2025 IndiaMART
# Reprocess existing records with Dual RAG System
# Updates call_insights and call_issues with improved classification

"""
Usage:
    # Reprocess all records
    python reprocess_with_dual_rag.py

    # Reprocess with limit
    python reprocess_with_dual_rag.py --limit 50

    # Dry run (don't update database)
    python reprocess_with_dual_rag.py --limit 10 --dry-run
"""

import sys
import os
import json
import argparse
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
sys.stdout.reconfigure(encoding='utf-8')

# Rate limiting
REQUESTS_PER_MINUTE = 15
DELAY_BETWEEN_REQUESTS = 60 / REQUESTS_PER_MINUTE


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


def parse_json_response(text):
    """Parse JSON from LLM response."""
    import re

    json_match = re.search(r'```json\s*([\s\S]*?)```', text)
    if json_match:
        try:
            return json.loads(json_match.group(1).strip())
        except:
            pass

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


def reprocess_records(limit=None, dry_run=False):
    """
    Reprocess existing records with dual RAG system.

    Args:
        limit: Max records to process (None = all)
        dry_run: If True, don't update database
    """
    print("\n" + "="*70)
    print("REPROCESSING WITH DUAL RAG SYSTEM")
    print("="*70)

    # Initialize Supabase
    print("\nConnecting to Supabase...")
    from database.supabase_client import SupabaseClient
    db = SupabaseClient()
    print("Connected!")

    # Initialize Gemini
    print("Initializing Gemini...")
    import google.generativeai as genai
    genai.configure(api_key=os.environ.get('GOOGLE_API_KEY'))
    model = genai.GenerativeModel('gemini-2.0-flash-001')

    # Initialize Dual RAG
    print("Initializing Dual RAG...")
    from rag.dual_rag import dual_rag, get_classification_context, get_sop_recommendations
    print(f"  Classification RAG: {dual_rag.classification_collection.count()} docs")
    print(f"  Suggestion RAG: {dual_rag.suggestion_collection.count()} docs")

    # Fetch existing transcripts with call info
    print("\nFetching existing records...")

    query = db.client.table("call_transcripts").select(
        "id, call_id, transcript, translation"
    ).order("created_at", desc=True)

    if limit:
        query = query.limit(limit)

    result = query.execute()
    transcripts = result.data or []

    print(f"Found {len(transcripts)} transcripts to reprocess")

    if not transcripts:
        print("No transcripts found!")
        return

    # Process each transcript
    stats = {
        "processed": 0,
        "updated": 0,
        "skipped": 0,
        "errors": []
    }

    start_time = datetime.now()

    for idx, record in enumerate(transcripts):
        print(f"\n[{idx+1}/{len(transcripts)}] Processing call_id: {record['call_id'][:8]}...")

        transcript = record.get('transcript') or record.get('translation') or ''

        if len(transcript) < 50:
            print("  Skipping - transcript too short")
            stats["skipped"] += 1
            continue

        try:
            # Step 1: Get Classification RAG context
            print("  Fetching Classification RAG context...")
            rag_context = get_classification_context(transcript[:500])
            print(f"  Classification context: {len(rag_context)} chars")

            time.sleep(DELAY_BETWEEN_REQUESTS)

            # Step 2: Re-analyze with RAG context
            print("  Re-analyzing with Gemini...")
            analysis_response = model.generate_content([
                ANALYSIS_PROMPT.format(rag_context=rag_context, transcript=transcript[:8000])
            ])
            analysis = parse_json_response(analysis_response.text)

            if not analysis:
                print("  WARNING: Could not parse analysis JSON")
                stats["errors"].append(f"{record['call_id']}: JSON parse error")
                continue

            issues = analysis.get('issues', [])
            print(f"  Analysis: {len(issues)} issues, churn_risk: {analysis.get('risk_signals', {}).get('churn_risk_score', 'N/A')}")

            time.sleep(DELAY_BETWEEN_REQUESTS)

            # Step 3: Get Suggestion RAG recommendations
            print("  Fetching Suggestion RAG recommendations...")
            sop_recommendations = get_sop_recommendations(issues)
            print(f"  SOP recommendations: {len(sop_recommendations)}")

            # Add SOP alert for high-risk
            risk_signals = analysis.get('risk_signals', {})
            if risk_signals.get('deactivation_intent') or risk_signals.get('churn_risk_score', 0) > 0.7:
                analysis['sop_alert'] = {
                    "level": "high",
                    "message": "High churn risk detected. Follow Deactivation SOP - attempt retention before processing.",
                    "reference": "Ticket SOP - Deactivation"
                }

            analysis['sop_recommendations'] = sop_recommendations

            if dry_run:
                print("  [DRY RUN] Would update database")
                stats["processed"] += 1
                continue

            # Step 4: Update call_insights
            print("  Updating call_insights...")

            from database.supabase_client import parse_summary_to_insight

            # Get existing insight
            existing_insight = db.get_insight_by_call_id(record['call_id'])

            if existing_insight:
                insight_id = existing_insight['id']

                # Prepare update data
                risk = analysis.get("risk_signals", {})
                sentiment = analysis.get("sentiment", {})
                outcome = analysis.get("call_outcome", {})
                resolution = analysis.get("resolution", {})

                update_data = {
                    "churn_risk_score": risk.get("churn_risk_score"),
                    "deactivation_intent": risk.get("deactivation_intent", False),
                    "deactivation_confirmed": risk.get("deactivation_confirmed", False),
                    "refund_requested": risk.get("refund_requested", False),
                    "escalation_threatened": risk.get("escalation_threatened", False),
                    "legal_threat": risk.get("legal_threat", False),
                    "payment_dispute": risk.get("payment_dispute", False),
                    "competitor_mentioned": risk.get("competitor_mentioned"),
                    "sentiment_start": sentiment.get("customer_start"),
                    "sentiment_end": sentiment.get("customer_end"),
                    "sentiment_trajectory": sentiment.get("sentiment_trajectory"),
                    "executive_tone": sentiment.get("executive_tone"),
                    "call_purpose": outcome.get("primary_purpose"),
                    "purpose_fulfilled": outcome.get("was_purpose_fulfilled"),
                    "resolution_status": resolution.get("status"),
                    "follow_up_required": resolution.get("follow_up_required", False),
                    "follow_up_owner": resolution.get("follow_up_owner"),
                    "issues": json.dumps(analysis.get("issues", [])),
                    "actions_taken": json.dumps(resolution.get("actions_taken", [])),
                    "promises_made": json.dumps(resolution.get("promises_made", [])),
                    "key_quotes": json.dumps(analysis.get("key_quotes", {})),
                    "topics": json.dumps(analysis.get("topics", [])),
                    "raw_summary": json.dumps(analysis)
                }

                # Filter out None values
                update_data = {k: v for k, v in update_data.items() if v is not None}

                db.client.table("call_insights").update(update_data).eq("id", insight_id).execute()
                print(f"  Updated insight: {insight_id[:8]}...")

                # Step 5: Update call_issues
                print("  Updating call_issues...")

                # Delete existing issues for this call
                db.client.table("call_issues").delete().eq("call_id", record['call_id']).execute()

                # Insert new issues
                if issues:
                    db.insert_issues(record['call_id'], insight_id, issues)
                    print(f"  Inserted {len(issues)} issues")

                stats["updated"] += 1
            else:
                print("  No existing insight found, skipping update")
                stats["skipped"] += 1

            stats["processed"] += 1

            # Progress update
            if (idx + 1) % 10 == 0:
                elapsed = (datetime.now() - start_time).total_seconds()
                rate = (idx + 1) / elapsed * 60
                remaining = (len(transcripts) - idx - 1) / rate if rate > 0 else 0
                print(f"\n  Progress: {idx+1}/{len(transcripts)} ({stats['updated']} updated)")
                print(f"  Rate: {rate:.1f} records/min, ETA: {remaining:.1f} min")

        except Exception as e:
            print(f"  ERROR: {e}")
            stats["errors"].append(f"{record['call_id']}: {str(e)}")
            import traceback
            traceback.print_exc()

    # Summary
    elapsed = (datetime.now() - start_time).total_seconds()

    print(f"\n{'='*70}")
    print("REPROCESSING COMPLETE")
    print(f"{'='*70}")
    print(f"\nResults:")
    print(f"  Processed: {stats['processed']}")
    print(f"  Updated: {stats['updated']}")
    print(f"  Skipped: {stats['skipped']}")
    print(f"  Errors: {len(stats['errors'])}")
    print(f"  Time: {elapsed:.1f} seconds ({elapsed/60:.1f} minutes)")

    if stats['errors']:
        print(f"\nErrors:")
        for err in stats['errors'][:10]:
            print(f"  - {err}")


def main():
    parser = argparse.ArgumentParser(description='Reprocess records with Dual RAG')
    parser.add_argument('--limit', type=int, help='Max records to process')
    parser.add_argument('--dry-run', action='store_true', help='Do not update database')

    args = parser.parse_args()

    reprocess_records(
        limit=args.limit,
        dry_run=args.dry_run
    )


if __name__ == "__main__":
    main()
