"""Process a single call URL and output analysis."""
import sys
import os
import json
import tempfile
import requests
from dotenv import load_dotenv

load_dotenv()
sys.stdout.reconfigure(encoding='utf-8')

def process_call(audio_url: str, store_in_db: bool = True):
    """Process a call URL through the full pipeline."""

    # Download audio
    print('Downloading audio...')
    response = requests.get(audio_url, timeout=60)
    print(f'Downloaded: {len(response.content)} bytes')

    # Save to temp file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
    temp_file.write(response.content)
    temp_file.close()
    print(f'Saved to: {temp_file.name}')

    # Import Google GenAI
    import google.generativeai as genai
    genai.configure(api_key=os.environ.get('GOOGLE_API_KEY'))

    # Read audio data
    print('Preparing audio for Gemini...')
    with open(temp_file.name, 'rb') as f:
        audio_data = f.read()

    # Process with pipeline prompt
    print('Processing with full pipeline...')

    model = genai.GenerativeModel('gemini-2.0-flash-001')

    pipeline_prompt = '''You are processing a customer service call audio for IndiaMART. Listen to this audio carefully and provide complete analysis.

IMPORTANT: This is an AUDIO file. Listen to it and transcribe what you hear.

## STEP 1: TRANSCRIBE IN ROMAN SCRIPT (HINGLISH)

**CRITICAL: Use ONLY English alphabet (Roman script) for transcription.**

Hindi Examples:
- CORRECT: "Namaste sir, mera naam Vikram hai, aapka buylead kaisa chal raha hai?"
- WRONG: "नमस्ते सर, मेरा नाम विक्रम है" (NO Devanagari!)

Tamil Examples:
- CORRECT: "Vanakkam sir, eppadi irukkeenga? Leads varalai sir."
- CORRECT: "Sari sir, naan check pannuren. Ungal account-la problem irukku."
- WRONG: "வணக்கம் சார், எப்படி இருக்கீங்க?" (NO Tamil script!)

Telugu Examples:
- CORRECT: "Namaskaram sir, meeru ela unnaru? Leads ravatledu sir."
- WRONG: "నమస్కారం సార్" (NO Telugu script!)

Code-switching (mix of regional + English) - transcribe as spoken:
- Hindi-English: "Haan sir, mujhe genuine leads nahi mil rahe, I am very disappointed"
- Tamil-English: "Sir leads varalai, quality romba worst-aa irukku, I am not satisfied"
- Telugu-English: "Payment chesa sir, but refund raaledu, please check cheyandi"

Format:
<<TRANSCRIPT_START>>
Executive: [text in Roman script]
Customer: [text in Roman script]
...
<<TRANSCRIPT_END>>

## STEP 2: TRANSLATE
Translate to English line by line:
<<TRANSLATE_START>>
Executive: [English]
Customer: [English]
...
<<TRANSLATE_END>>

## STEP 3: ANALYZE
Provide JSON analysis (output ONLY valid JSON, no markdown):
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
    "main_complaint": "quote",
    "customer_ask": "quote",
    "resolution_offered": "quote",
    "notable_statement": "quote or null"
  },
  "call_outcome": {
    "primary_purpose": "complaint|query|request|feedback",
    "was_purpose_fulfilled": true,
    "customer_satisfied": true,
    "requires_escalation": false
  }
}

Now listen to the audio and provide the complete output:'''

    # Send audio with prompt
    response = model.generate_content([
        {
            "mime_type": "audio/mpeg",
            "data": audio_data
        },
        pipeline_prompt
    ])

    print('\n' + '='*70)
    print('ANALYSIS OUTPUT')
    print('='*70)
    print(response.text)

    # Cleanup temp file
    os.unlink(temp_file.name)

    # Parse and store in database
    result_text = response.text

    # Extract transcript (handle various formats)
    transcript = ''
    if '<<TRANSCRIPT_START>>' in result_text:
        # Try with proper end marker first
        if '<<TRANSCRIPT_END>>' in result_text:
            transcript = result_text.split('<<TRANSCRIPT_START>>')[1].split('<<TRANSCRIPT_END>>')[0].strip()
        # Fallback: end at TRANSLATE_START
        elif '<<TRANSLATE_START>>' in result_text:
            transcript = result_text.split('<<TRANSCRIPT_START>>')[1].split('<<TRANSLATE_START>>')[0].strip()
        # Fallback: end at first ```json or { after transcript
        else:
            transcript = result_text.split('<<TRANSCRIPT_START>>')[1].split('```')[0].strip()
    # Remove any leading ``` if present
    if transcript.startswith('```'):
        transcript = transcript.split('\n', 1)[1] if '\n' in transcript else transcript
    print(f'Transcript extracted: {len(transcript)} chars')

    # Extract translation (handle various formats)
    translation = ''
    if '<<TRANSLATE_START>>' in result_text:
        # Try with proper end marker first
        if '<<TRANSLATE_END>>' in result_text:
            translation = result_text.split('<<TRANSLATE_START>>')[1].split('<<TRANSLATE_END>>')[0].strip()
        # Fallback: end at ANALYSIS_START or ```json
        elif '<<ANALYSIS_START>>' in result_text:
            translation = result_text.split('<<TRANSLATE_START>>')[1].split('<<ANALYSIS_START>>')[0].strip()
        elif '```json' in result_text.split('<<TRANSLATE_START>>')[1]:
            translation = result_text.split('<<TRANSLATE_START>>')[1].split('```json')[0].strip()
        else:
            translation = result_text.split('<<TRANSLATE_START>>')[1].split('```')[0].strip()
    # Remove any leading ``` if present
    if translation.startswith('```'):
        translation = translation.split('\n', 1)[1] if '\n' in translation else translation
    print(f'Translation extracted: {len(translation)} chars')

    # Extract JSON analysis - find the last JSON block with "issues"
    analysis = {}
    import re

    # Find all JSON blocks
    json_blocks = re.findall(r'```json\s*([\s\S]*?)```', result_text)

    # Look for the one containing "issues" (the analysis block)
    for block in json_blocks:
        if '"issues"' in block and '"risk_signals"' in block:
            try:
                # Clean the block - remove any transcript/translation markers if accidentally included
                clean_block = block.strip()
                if clean_block.startswith('{'):
                    analysis = json.loads(clean_block)
                    print(f'Analysis JSON parsed successfully')
                    break
            except json.JSONDecodeError as e:
                print(f'Warning: Could not parse JSON block: {e}')
                continue

    # Fallback: try to find raw JSON with issues
    if not analysis:
        json_match = re.search(r'\{\s*"issues"\s*:\s*\[[\s\S]*?"call_outcome"\s*:\s*\{[^}]+\}\s*\}', result_text)
        if json_match:
            try:
                analysis = json.loads(json_match.group())
                print(f'Analysis JSON parsed from raw text')
            except:
                print('Warning: Could not parse analysis JSON')

    # Store in Supabase
    if store_in_db and analysis:
        print('\n' + '='*70)
        print('STORING IN DATABASE')
        print('='*70)

        from database.supabase_client import (
            SupabaseClient, CallRecord, TranscriptRecord,
            parse_summary_to_insight
        )

        try:
            client = SupabaseClient()

            # Extract UCID from URL
            ucid = audio_url.split('callid=')[1].split('&')[0] if 'callid=' in audio_url else audio_url[-36:]

            # 1. Insert call
            call = CallRecord(
                ucid=ucid,
                call_recording_url=audio_url,
                call_type='inbound',
                module='servicing'
            )
            call_result = client.upsert_call(call)
            call_id = call_result.get('id')
            print(f'Call stored: {call_id}')

            # 2. Insert transcript
            transcript_rec = TranscriptRecord(
                call_id=call_id,
                transcript=transcript or '[No transcript captured]',
                translation=translation or '[No translation captured]',
                transcript_language='hi',
                languages_detected=['hindi', 'english'],
                speaker_count=2
            )
            transcript_result = client.insert_transcript(transcript_rec)
            transcript_id = transcript_result.get('id')
            print(f'Transcript stored: {transcript_id}')

            # 3. Insert insights
            insight = parse_summary_to_insight(call_id, analysis, transcript_id)
            insight_result = client.insert_insight(insight)
            insight_id = insight_result.get('id')
            print(f'Insights stored: {insight_id}')

            # 4. Insert issues
            issues = analysis.get('issues', [])
            if issues and insight_id:
                issues_result = client.insert_issues(call_id, insight_id, issues)
                print(f'Issues stored: {len(issues_result)}')

            print('\nAll data stored successfully!')

        except Exception as e:
            print(f'Error storing in database: {e}')

    return response.text


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Process a call URL through the analysis pipeline')
    parser.add_argument('url', nargs='?', default='https://sr.knowlarity.com/vr/fetchsound/?callid=48bdfa3f-2d1b-4ef4-a686-369d4862f106',
                        help='Audio URL to process')
    parser.add_argument('--no-store', action='store_true', help='Do not store results in database')

    args = parser.parse_args()
    process_call(args.url, store_in_db=not args.no_store)
