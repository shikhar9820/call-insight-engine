# Copyright 2025 IndiaMART
# Call Insights Engine - Unified Pipeline Runner
# Single entry point that ensures ALL steps are executed

"""
COMPLETE PIPELINE:
1. Download Audio
2. Transcribe (Roman script - Hinglish/Tanglish/Tenglish)
3. Diarization Correction (Fix Executive/Customer labels)
4. Translate (→ English)
5. Analyze (30+ data points)
6. RAG Enrich (SOP recommendations)
7. Store in Supabase (4 tables)

Usage:
    python run.py "https://sr.knowlarity.com/vr/fetchsound/?callid=XXX"
    python run.py "https://..." --no-store  # Skip database storage
"""

import sys
import os
import json
import tempfile
import argparse
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
sys.stdout.reconfigure(encoding='utf-8')


# =============================================================================
# STEP 1: TRANSCRIPTION PROMPT (Proven quality from process_single_call.py)
# =============================================================================
TRANSCRIPTION_PROMPT = '''You are processing a customer service call audio for IndiaMART.

IMPORTANT: Listen to the AUDIO file and provide output in EXACTLY this format:

===================
PART 1: TRANSCRIPT (Roman script only - NO Devanagari/Tamil/Telugu scripts)
===================

<<TRANSCRIPT_START>>
Executive: [text in Roman script]
Customer: [text in Roman script]
...
<<TRANSCRIPT_END>>

Examples of CORRECT Roman script:
- Hindi: "Namaste sir, mera naam Vikram hai" (NOT नमस्ते)
- Tamil: "Vanakkam sir, eppadi irukkeenga" (NOT வணக்கம்)
- Telugu: "Namaskaram sir, meeru ela unnaru" (NOT నమస్కారం)

Domain terms: buylead (not "by lead"), TrustSeal, IndiaMART

===================
PART 2: TRANSLATION (English)
===================

<<TRANSLATE_START>>
Executive: [English translation]
Customer: [English translation]
...
<<TRANSLATE_END>>

===================
PART 3: ANALYSIS (JSON)
===================

<<ANALYSIS_START>>
```json
{
  "issues": [
    {
      "category": "buylead_accessibility|buylead_availability|buylead_relevance|buylead_roi|payment|subscription|pns|catalog|enquiry|technical|employee|deactivation|other",
      "subcategory": "specific_issue",
      "description": "brief description",
      "severity": "critical|high|medium|low",
      "mentioned_by": "customer|executive",
      "timestamp_location": "start|middle|end"
    }
  ],
  "resolution": {
    "status": "resolved|partial|unresolved",
    "actions_taken": ["action1", "action2"],
    "promises_made": ["promise1"],
    "follow_up_required": true,
    "follow_up_owner": "executive|customer|none",
    "follow_up_timeline": "timeline or null"
  },
  "risk_signals": {
    "churn_risk_score": 0.5,
    "deactivation_intent": false,
    "deactivation_confirmed": false,
    "refund_requested": false,
    "escalation_threatened": false,
    "legal_threat": false,
    "competitor_mentioned": null,
    "payment_dispute": false
  },
  "sentiment": {
    "customer_start": "happy|satisfied|neutral|confused|frustrated|angry|anxious|disappointed",
    "customer_end": "same options",
    "sentiment_trajectory": "positive|negative|neutral|improving|worsening",
    "executive_tone": "professional|empathetic|defensive|rushed"
  },
  "topics": ["topic1", "topic2"],
  "key_quotes": {
    "main_complaint": "quote from transcript",
    "customer_ask": "quote from transcript",
    "resolution_offered": "quote from transcript",
    "notable_statement": "quote or null"
  },
  "call_outcome": {
    "primary_purpose": "complaint|query|request|feedback",
    "was_purpose_fulfilled": true,
    "customer_satisfied": true,
    "requires_escalation": false
  }
}
```
<<ANALYSIS_END>>

NOW PROCESS THE AUDIO:'''


# =============================================================================
# STEP 2: DIARIZATION CORRECTION PROMPT
# =============================================================================
DIARIZATION_PROMPT = '''You are an expert at fixing speaker diarization errors in call transcripts.

This is a customer service call between:
- **Executive**: IndiaMART account manager (asks questions, explains features, provides solutions)
- **Customer**: Business owner/seller (has complaints, asks for help, confirms understanding)

## COMMON ERRORS TO FIX:

1. **Consecutive same-speaker lines** - Check if they should alternate:
   WRONG:
   Executive: Sir ye dekho
   Executive: Haan

   CORRECT:
   Executive: Sir ye dekho
   Customer: Haan

2. **Acknowledgments belong to LISTENER**:
   - Hindi: "Haan", "Ji", "Hmm", "Achha", "Theek hai"
   - Tamil: "Aamaa", "Sari", "Hmm", "OK sir"
   - Telugu: "Avunu", "Sare", "Hmm"

3. **Questions need answers from OTHER speaker**

## INPUT TRANSCRIPT:
{transcript}

## TASK:
Fix speaker labels. Output ONLY the corrected transcript:
<<TRANSCRIPT_START>>
Executive: [line 1]
Customer: [line 2]
...
<<TRANSCRIPT_END>>

Do NOT change any words. Only fix speaker labels.'''


def run_pipeline(audio_url: str, store_in_db: bool = True):
    """
    Run the complete pipeline for a single call.

    Steps:
    1. Download audio
    2. Transcribe + Translate + Analyze (single Gemini call - proven quality)
    3. Fix diarization (second Gemini call)
    4. RAG enrich with SOP recommendations
    5. Store in Supabase
    """

    print("\n" + "="*70)
    print("CALL INSIGHTS ENGINE - COMPLETE PIPELINE")
    print("="*70)

    # =========================================================================
    # STEP 1: DOWNLOAD AUDIO
    # =========================================================================
    print("\n[STEP 1/7] Downloading audio...")
    response = requests.get(audio_url, timeout=60)
    print(f"  Downloaded: {len(response.content):,} bytes")

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
    temp_file.write(response.content)
    temp_file.close()

    # =========================================================================
    # STEP 2: TRANSCRIBE + TRANSLATE + ANALYZE (Single call - proven quality)
    # =========================================================================
    print("\n[STEP 2/7] Processing with Gemini (Transcribe + Translate + Analyze)...")

    import google.generativeai as genai
    genai.configure(api_key=os.environ.get('GOOGLE_API_KEY'))
    model = genai.GenerativeModel('gemini-2.0-flash-001')

    with open(temp_file.name, 'rb') as f:
        audio_data = f.read()

    response = model.generate_content([
        {"mime_type": "audio/mpeg", "data": audio_data},
        TRANSCRIPTION_PROMPT
    ])

    result_text = response.text
    print(f"  Response received: {len(result_text):,} chars")

    # Always save raw output for debugging
    debug_file = f"debug_output_{datetime.now().strftime('%H%M%S')}.txt"
    with open(debug_file, 'w', encoding='utf-8') as f:
        f.write(result_text)
    print(f"  Raw output saved: {debug_file}")

    # =========================================================================
    # STEP 3: PARSE OUTPUTS
    # =========================================================================
    print("\n[STEP 3/7] Parsing outputs...")

    # Extract transcript
    transcript = ''
    # Method 1: Look for <<TRANSCRIPT_START>> marker
    if '<<TRANSCRIPT_START>>' in result_text:
        if '<<TRANSCRIPT_END>>' in result_text:
            transcript = result_text.split('<<TRANSCRIPT_START>>')[1].split('<<TRANSCRIPT_END>>')[0].strip()
        elif '<<TRANSLATE_START>>' in result_text:
            transcript = result_text.split('<<TRANSCRIPT_START>>')[1].split('<<TRANSLATE_START>>')[0].strip()
        else:
            transcript = result_text.split('<<TRANSCRIPT_START>>')[1].split('```')[0].strip()
    # Method 2: Look for "PART 1: TRANSCRIPT" header
    elif 'PART 1: TRANSCRIPT' in result_text:
        parts = result_text.split('PART 1: TRANSCRIPT')
        if len(parts) > 1:
            transcript_section = parts[1]
            # End at PART 2 or <<TRANSLATE
            if 'PART 2:' in transcript_section:
                transcript = transcript_section.split('PART 2:')[0]
            elif '<<TRANSLATE' in transcript_section:
                transcript = transcript_section.split('<<TRANSLATE')[0]
            else:
                transcript = transcript_section

            # Clean up header lines
            lines = transcript.strip().split('\n')
            clean_lines = []
            for line in lines:
                line = line.strip()
                if line.startswith('=') or not line:
                    continue
                if line.startswith('Executive:') or line.startswith('Customer:'):
                    clean_lines.append(line)
            transcript = '\n'.join(clean_lines)
    print(f"  Transcript: {len(transcript):,} chars")

    # Extract translation
    translation = ''
    # Method 1: Look for <<TRANSLATE_START>> marker
    if '<<TRANSLATE_START>>' in result_text:
        if '<<TRANSLATE_END>>' in result_text:
            translation = result_text.split('<<TRANSLATE_START>>')[1].split('<<TRANSLATE_END>>')[0].strip()
        elif '<<ANALYSIS' in result_text.split('<<TRANSLATE_START>>')[1]:
            translation = result_text.split('<<TRANSLATE_START>>')[1].split('<<ANALYSIS')[0].strip()
        elif '```json' in result_text.split('<<TRANSLATE_START>>')[1]:
            translation = result_text.split('<<TRANSLATE_START>>')[1].split('```json')[0].strip()
        else:
            translation = result_text.split('<<TRANSLATE_START>>')[1].split('```')[0].strip()
    # Method 2: Look for "PART 2: TRANSLATION" header
    elif 'PART 2: TRANSLATION' in result_text:
        parts = result_text.split('PART 2: TRANSLATION')
        if len(parts) > 1:
            translation_section = parts[1]
            # End at PART 3 or <<ANALYSIS or ```json
            if 'PART 3:' in translation_section:
                translation = translation_section.split('PART 3:')[0]
            elif '<<ANALYSIS' in translation_section:
                translation = translation_section.split('<<ANALYSIS')[0]
            elif '```json' in translation_section:
                translation = translation_section.split('```json')[0]
            else:
                translation = translation_section

            # Clean up header lines
            lines = translation.strip().split('\n')
            clean_lines = []
            for line in lines:
                line = line.strip()
                if line.startswith('=') or not line:
                    continue
                if line.startswith('Executive:') or line.startswith('Customer:'):
                    clean_lines.append(line)
            translation = '\n'.join(clean_lines)
    print(f"  Translation: {len(translation):,} chars")

    # Extract JSON analysis
    import re
    analysis = {}

    # Method 1: Find <<ANALYSIS_START>> block
    if '<<ANALYSIS_START>>' in result_text:
        analysis_section = result_text.split('<<ANALYSIS_START>>')[1]
        if '<<ANALYSIS_END>>' in analysis_section:
            analysis_section = analysis_section.split('<<ANALYSIS_END>>')[0]

        # Find JSON in the analysis section
        json_match = re.search(r'```json\s*([\s\S]*?)```', analysis_section)
        if json_match:
            try:
                analysis = json.loads(json_match.group(1).strip())
                print(f"  Analysis parsed from <<ANALYSIS_START>> block")
            except json.JSONDecodeError as e:
                print(f"  JSON parse error in ANALYSIS block: {e}")

    # Method 2: Find ```json blocks with "issues"
    if not analysis:
        json_blocks = re.findall(r'```json\s*([\s\S]*?)```', result_text)
        for block in json_blocks:
            if '"issues"' in block and '"risk_signals"' in block:
                try:
                    analysis = json.loads(block.strip())
                    print(f"  Analysis parsed from ```json block")
                    break
                except json.JSONDecodeError as e:
                    print(f"  JSON parse error in block: {e}")
                    continue

    # Method 3: Find the JSON object containing "issues" using brace matching
    if not analysis and '"issues"' in result_text:
        # Find the opening brace before "issues"
        issues_pos = result_text.find('"issues"')
        start_pos = result_text.rfind('{', 0, issues_pos)
        if start_pos != -1:
            brace_count = 0
            end_pos = start_pos
            for i, char in enumerate(result_text[start_pos:], start_pos):
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_pos = i + 1
                        break

            try:
                json_str = result_text[start_pos:end_pos]
                analysis = json.loads(json_str)
                print(f"  Analysis parsed using brace matching")
            except json.JSONDecodeError as e:
                print(f"  Brace matching parse error: {e}")

    if not analysis:
        print(f"  WARNING: Could not parse analysis JSON!")
        debug_file = f"debug_output_{datetime.now().strftime('%H%M%S')}.txt"
        with open(debug_file, 'w', encoding='utf-8') as f:
            f.write(result_text)
        print(f"  Raw output saved to: {debug_file}")
    else:
        print(f"  Analysis: {len(analysis.get('issues', []))} issues, churn_risk: {analysis.get('risk_signals', {}).get('churn_risk_score', 'N/A')}")

    # =========================================================================
    # STEP 4: DIARIZATION CORRECTION (DISABLED - Gemini already does good diarization)
    # =========================================================================
    print("\n[STEP 4/7] Diarization step skipped (using Gemini's native diarization)")

    # =========================================================================
    # STEP 5: RAG ENRICHMENT (SOP Recommendations)
    # =========================================================================
    print("\n[STEP 5/7] Enriching with RAG (SOP recommendations)...")

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
    # STEP 6: STORE IN SUPABASE
    # =========================================================================
    if store_in_db and analysis:
        print("\n[STEP 6/7] Storing in Supabase...")

        try:
            from database.supabase_client import (
                SupabaseClient, CallRecord, TranscriptRecord,
                parse_summary_to_insight
            )

            client = SupabaseClient()

            # Extract UCID from URL
            ucid = audio_url.split('callid=')[1].split('&')[0] if 'callid=' in audio_url else f"call_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

            # 1. Insert call
            call = CallRecord(
                ucid=ucid,
                call_recording_url=audio_url,
                call_type='inbound',
                module='servicing'
            )
            call_result = client.upsert_call(call)
            call_id = call_result.get('id')
            print(f"  Call stored: {call_id}")

            # 2. Insert transcript
            transcript_rec = TranscriptRecord(
                call_id=call_id,
                transcript=transcript or '[No transcript]',
                translation=translation or '[No translation]',
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
        print("\n[STEP 6/7] Skipping database storage (--no-store flag)")

    # =========================================================================
    # STEP 7: CLEANUP & SUMMARY
    # =========================================================================
    print("\n[STEP 7/7] Cleanup...")
    os.unlink(temp_file.name)
    print("  Temp files cleaned")

    # =========================================================================
    # FINAL OUTPUT
    # =========================================================================
    print("\n" + "="*70)
    print("PIPELINE COMPLETE")
    print("="*70)

    print(f"\n📝 TRANSCRIPT ({len(transcript):,} chars):")
    print("-"*40)
    print(transcript[:500] + "..." if len(transcript) > 500 else transcript)

    print(f"\n🔄 TRANSLATION ({len(translation):,} chars):")
    print("-"*40)
    print(translation[:500] + "..." if len(translation) > 500 else translation)

    print(f"\n📊 ANALYSIS:")
    print("-"*40)
    print(f"  Issues: {len(analysis.get('issues', []))}")
    print(f"  Churn Risk: {analysis.get('risk_signals', {}).get('churn_risk_score', 'N/A')}")
    print(f"  Sentiment: {analysis.get('sentiment', {}).get('customer_start', 'N/A')} → {analysis.get('sentiment', {}).get('customer_end', 'N/A')}")
    print(f"  Resolution: {analysis.get('resolution', {}).get('status', 'N/A')}")
    print(f"  SOP Recommendations: {len(analysis.get('sop_recommendations', []))}")

    if analysis.get('sop_alert'):
        print(f"\n⚠️  SOP ALERT: {analysis['sop_alert'].get('message', '')}")

    return {
        'transcript': transcript,
        'translation': translation,
        'analysis': analysis,
        'sop_recommendations': sop_recommendations
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Call Insights Engine - Complete Pipeline')
    parser.add_argument('url', nargs='?', help='Audio URL to process')
    parser.add_argument('--no-store', action='store_true', help='Do not store results in database')

    args = parser.parse_args()

    if not args.url:
        print("Usage: python run.py <audio_url> [--no-store]")
        print("\nExample:")
        print('  python run.py "https://sr.knowlarity.com/vr/fetchsound/?callid=XXX"')
        sys.exit(1)

    run_pipeline(args.url, store_in_db=not args.no_store)
