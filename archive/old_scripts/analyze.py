# Copyright 2025 IndiaMART
# Call Insights Engine - Analyze Pre-transcribed Data
# Input: Transcript + Translation → Output: Analysis + RAG + Supabase

"""
Usage:
    # From file
    python analyze.py --file transcript.txt --ucid "call-123"

    # From JSON input
    python analyze.py --json '{"transcript": "...", "translation": "..."}'

    # Interactive mode
    python analyze.py --interactive
"""

import sys
import os
import json
import argparse
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
sys.stdout.reconfigure(encoding='utf-8')


ANALYSIS_PROMPT = '''You are an expert customer service analyst for IndiaMART (B2B e-commerce platform).

Analyze the following call transcript and translation to extract structured insights.

## TRANSCRIPT (Roman script):
{transcript}

## TRANSLATION (English):
{translation}

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


def analyze_data(transcript: str, translation: str, ucid: str, store_in_db: bool = True, audio_url: str = None):
    """
    Analyze transcript + translation and store in Supabase.

    Args:
        transcript: Call transcript in Roman script
        translation: English translation
        ucid: Unique Call ID
        store_in_db: Whether to store in Supabase
        audio_url: Optional audio URL for reference
    """

    print("\n" + "="*70)
    print("CALL INSIGHTS ENGINE - ANALYSIS MODE")
    print("="*70)

    print(f"\n[INPUT]")
    print(f"  UCID: {ucid}")
    print(f"  Transcript: {len(transcript):,} chars")
    print(f"  Translation: {len(translation):,} chars")

    # =========================================================================
    # STEP 1: ANALYZE WITH GEMINI
    # =========================================================================
    print("\n[STEP 1/3] Analyzing with Gemini...")

    import google.generativeai as genai
    genai.configure(api_key=os.environ.get('GOOGLE_API_KEY'))
    model = genai.GenerativeModel('gemini-2.0-flash-001')

    response = model.generate_content([
        ANALYSIS_PROMPT.format(transcript=transcript, translation=translation)
    ])

    result_text = response.text
    print(f"  Response: {len(result_text):,} chars")

    # Parse JSON
    import re
    analysis = {}

    # Find JSON in response
    json_match = re.search(r'```json\s*([\s\S]*?)```', result_text)
    if json_match:
        try:
            analysis = json.loads(json_match.group(1).strip())
            print(f"  Analysis parsed: {len(analysis.get('issues', []))} issues")
        except json.JSONDecodeError as e:
            print(f"  JSON parse error: {e}")

    # Fallback: try raw JSON
    if not analysis and '{' in result_text:
        try:
            # Find the JSON object
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
            print(f"  Analysis parsed (fallback): {len(analysis.get('issues', []))} issues")
        except:
            print("  WARNING: Could not parse analysis JSON")

    if analysis:
        print(f"  Churn Risk: {analysis.get('risk_signals', {}).get('churn_risk_score', 'N/A')}")
        print(f"  Sentiment: {analysis.get('sentiment', {}).get('customer_start', 'N/A')} → {analysis.get('sentiment', {}).get('customer_end', 'N/A')}")

    # =========================================================================
    # STEP 2: RAG ENRICHMENT
    # =========================================================================
    print("\n[STEP 2/3] Enriching with RAG (SOP recommendations)...")

    sop_recommendations = []
    try:
        from rag.rag_tool import rag_tool, enrich_call_summary

        if rag_tool.is_available and analysis:
            enriched = enrich_call_summary(analysis)
            sop_recommendations = enriched.get('sop_recommendations', [])

            if 'sop_alert' in enriched:
                analysis['sop_alert'] = enriched['sop_alert']

            print(f"  RAG enrichment: {len(sop_recommendations)} SOP recommendations added")
        else:
            print("  RAG not available or no analysis to enrich")
    except ImportError:
        print("  RAG module not available")
    except Exception as e:
        print(f"  RAG error: {e}")

    analysis['sop_recommendations'] = sop_recommendations

    # =========================================================================
    # STEP 3: STORE IN SUPABASE
    # =========================================================================
    if store_in_db and analysis:
        print("\n[STEP 3/3] Storing in Supabase...")

        try:
            from database.supabase_client import (
                SupabaseClient, CallRecord, TranscriptRecord,
                parse_summary_to_insight
            )

            client = SupabaseClient()

            # 1. Insert call
            call = CallRecord(
                ucid=ucid,
                call_recording_url=audio_url or f"analyzed://{ucid}",
                call_type='inbound',
                module='servicing'
            )
            call_result = client.upsert_call(call)
            call_id = call_result.get('id')
            print(f"  Call stored: {call_id}")

            # 2. Insert transcript
            transcript_rec = TranscriptRecord(
                call_id=call_id,
                transcript=transcript,
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
    else:
        print("\n[STEP 3/3] Skipping database storage")

    # =========================================================================
    # OUTPUT SUMMARY
    # =========================================================================
    print("\n" + "="*70)
    print("ANALYSIS COMPLETE")
    print("="*70)

    print(f"\n📊 ANALYSIS RESULTS:")
    print(f"  Issues: {len(analysis.get('issues', []))}")
    for i, issue in enumerate(analysis.get('issues', [])[:5], 1):
        print(f"    {i}. [{issue.get('severity', 'N/A').upper()}] {issue.get('category', 'N/A')}: {issue.get('description', 'N/A')[:50]}")

    print(f"\n  Churn Risk: {analysis.get('risk_signals', {}).get('churn_risk_score', 'N/A')}")
    print(f"  Sentiment: {analysis.get('sentiment', {}).get('customer_start', 'N/A')} → {analysis.get('sentiment', {}).get('customer_end', 'N/A')}")
    print(f"  Resolution: {analysis.get('resolution', {}).get('status', 'N/A')}")
    print(f"  SOP Recommendations: {len(sop_recommendations)}")

    if analysis.get('sop_alert'):
        print(f"\n⚠️  SOP ALERT: {analysis['sop_alert'].get('message', '')}")

    return analysis


def main():
    parser = argparse.ArgumentParser(description='Analyze pre-transcribed call data')
    parser.add_argument('--file', type=str, help='Path to file containing transcript (first half) and translation (second half)')
    parser.add_argument('--transcript-file', type=str, help='Path to transcript file')
    parser.add_argument('--translation-file', type=str, help='Path to translation file')
    parser.add_argument('--json', type=str, help='JSON string with transcript and translation')
    parser.add_argument('--ucid', type=str, help='Unique Call ID')
    parser.add_argument('--audio-url', type=str, help='Optional audio URL for reference')
    parser.add_argument('--no-store', action='store_true', help='Do not store in database')
    parser.add_argument('--interactive', action='store_true', help='Interactive mode')

    args = parser.parse_args()

    transcript = ''
    translation = ''
    ucid = args.ucid or f"analyze_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    if args.interactive:
        print("\n=== INTERACTIVE MODE ===")
        print("Paste transcript (end with 'END' on new line):")
        lines = []
        while True:
            line = input()
            if line.strip() == 'END':
                break
            lines.append(line)
        transcript = '\n'.join(lines)

        print("\nPaste translation (end with 'END' on new line):")
        lines = []
        while True:
            line = input()
            if line.strip() == 'END':
                break
            lines.append(line)
        translation = '\n'.join(lines)

        ucid = input("\nEnter UCID (or press Enter for auto): ").strip() or ucid

    elif args.json:
        data = json.loads(args.json)
        transcript = data.get('transcript', '')
        translation = data.get('translation', '')

    elif args.transcript_file and args.translation_file:
        with open(args.transcript_file, 'r', encoding='utf-8') as f:
            transcript = f.read()
        with open(args.translation_file, 'r', encoding='utf-8') as f:
            translation = f.read()

    elif args.file:
        with open(args.file, 'r', encoding='utf-8') as f:
            content = f.read()
        # Split by common separators
        if '---TRANSLATION---' in content:
            parts = content.split('---TRANSLATION---')
            transcript = parts[0].strip()
            translation = parts[1].strip()
        elif '<<TRANSLATE_START>>' in content:
            transcript = content.split('<<TRANSLATE_START>>')[0].strip()
            translation = content.split('<<TRANSLATE_START>>')[1].strip()
        else:
            # Assume first half is transcript, second half is translation
            lines = content.strip().split('\n')
            mid = len(lines) // 2
            transcript = '\n'.join(lines[:mid])
            translation = '\n'.join(lines[mid:])
    else:
        parser.print_help()
        print("\nExamples:")
        print('  python analyze.py --interactive')
        print('  python analyze.py --transcript-file t.txt --translation-file tr.txt --ucid "call-123"')
        print('  python analyze.py --json \'{"transcript": "...", "translation": "..."}\'')
        sys.exit(1)

    if not transcript or not translation:
        print("Error: Both transcript and translation are required")
        sys.exit(1)

    analyze_data(
        transcript=transcript,
        translation=translation,
        ucid=ucid,
        store_in_db=not args.no_store,
        audio_url=args.audio_url
    )


if __name__ == "__main__":
    main()
