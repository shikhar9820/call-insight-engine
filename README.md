# Call Insights Engine

Multi-agent pipeline for extracting insights from IndiaMART customer service calls.

## Architecture

```
Audio Input → Agent 1 → Agent 2 → Agent 3 → Agent 4 → Agent 5 → Final Output
              (Analyze)  (Transcribe) (Translate) (Summarize) (Validate)
```

### Agents

1. **Audio Analyzer** - Language detection, quality assessment, speaker identification
2. **Transcript Generator** - Speech to Roman script text with code-switching support
3. **Translator** - Line-by-line Hindi/Regional to English translation
4. **Summarizer** - Structured extraction (issues, risks, sentiment, topics)
5. **Validator** - Quality scoring and final output assembly

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Google Cloud credentials
```

### 3. Set up Google Cloud

```bash
# Authenticate
gcloud auth login
gcloud auth application-default login

# Set project
gcloud config set project your-project-id
```

## Usage

### Single Call Processing

```bash
python main.py --url "https://example.com/call.mp3" --call-id "12345"
```

### Batch Processing

```bash
python main.py --csv "calls.csv" --output "./results" --workers 4
```

### Interactive Mode

```bash
python main.py --interactive
```

### Programmatic Usage

```python
from call_insights_engine import process_single_call, CallInput

call = CallInput(
    call_id="12345",
    audio_url="https://example.com/call.mp3",
    customer_city="Delhi",
    customer_type="Paid"
)

result = process_single_call(call)

print(f"Quality Score: {result.quality_score}/100")
print(f"Transcript: {result.transcript}")
print(f"Summary: {result.summary}")
```

## Output Schema

```json
{
  "call_id": "12345",
  "success": true,
  "quality_score": 87,
  "confidence_score": 0.87,
  "transcript": "<<TRANSCRIPT_START>>...",
  "translation": "<<TRANSLATE_START>>...",
  "summary": {
    "issues": [...],
    "resolution": {...},
    "risk_signals": {...},
    "sentiment": {...},
    "topics": [...],
    "key_quotes": {...}
  }
}
```

## Issue Taxonomy

| Category | Subcategories |
|----------|---------------|
| buylead_quality | spam_leads, irrelevant_leads, fake_leads, wrong_region |
| payment | failed_payment, refund_request, billing_dispute |
| subscription | deactivation_request, renewal_issue, upgrade_query |
| spam | unwanted_calls, promotional_messages |
| profile | catalog_update, verification_pending |
| technical | app_issue, login_problem |
| onboarding | new_user_help, feature_education |

## Cost Estimate

| Component | Cost |
|-----------|------|
| Gemini 2.0 Flash | ~$0.02/call |
| Google Speech-to-Text | $0.016/min (optional) |

For 5,600 calls: ~$112-150

## License

Copyright 2025 IndiaMART. All rights reserved.
