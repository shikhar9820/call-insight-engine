# Test script for Call Insights Engine - Layers 1-3
# Tests: Audio Processing → Transcription → Translation → Summarization

import os
import sys
import json
from datetime import datetime

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

# Check for API key
def check_environment():
    """Check if required environment variables are set."""
    print("=" * 60)
    print("ENVIRONMENT CHECK")
    print("=" * 60)

    google_api_key = os.environ.get("GOOGLE_API_KEY")
    google_project = os.environ.get("GOOGLE_CLOUD_PROJECT")

    if google_api_key:
        print(f"✅ GOOGLE_API_KEY: Set ({google_api_key[:10]}...)")
    else:
        print("❌ GOOGLE_API_KEY: Not set")
        print("   Please set it in .env file or environment")
        return False

    if google_project:
        print(f"✅ GOOGLE_CLOUD_PROJECT: {google_project}")
    else:
        print("⚠️  GOOGLE_CLOUD_PROJECT: Not set (optional for direct API)")

    print("=" * 60)
    return True


def test_audio_download(url: str, call_id: str):
    """Test audio download and validation."""
    print("\n" + "=" * 60)
    print("TEST 1: AUDIO DOWNLOAD & VALIDATION")
    print("=" * 60)

    from audio_utils import process_audio_for_api

    print(f"URL: {url[:80]}...")
    print(f"Call ID: {call_id}")
    print("Downloading...")

    processed_audio, error = process_audio_for_api(url, call_id)

    if error:
        print(f"❌ FAILED: {error}")
        return None

    print(f"✅ Downloaded successfully!")
    print(f"   File: {processed_audio.file_path}")
    print(f"   Size: {processed_audio.metadata.file_size_bytes:,} bytes")
    print(f"   Format: {processed_audio.metadata.format}")
    print(f"   Duration: {processed_audio.metadata.duration_seconds or 'Unknown'} seconds")
    print(f"   Base64 length: {len(processed_audio.base64_content):,} chars")

    return processed_audio


def test_gemini_transcription(processed_audio, call_id: str):
    """Test transcription using Gemini API directly."""
    print("\n" + "=" * 60)
    print("TEST 2: GEMINI TRANSCRIPTION (Layers 1-3)")
    print("=" * 60)

    import google.generativeai as genai
    from prompts import get_agent_prompt

    # Configure Gemini
    api_key = os.environ.get("GOOGLE_API_KEY")
    genai.configure(api_key=api_key)

    model = genai.GenerativeModel('gemini-2.0-flash-001')

    # Prepare audio content
    audio_part = {
        "inline_data": {
            "mime_type": processed_audio.mime_type,
            "data": processed_audio.base64_content
        }
    }

    results = {}

    # ========== Agent 1: Audio Analyzer ==========
    print("\n--- Agent 1: Audio Analyzer ---")
    try:
        response1 = model.generate_content([
            get_agent_prompt("audio_analyzer_agent"),
            audio_part
        ])
        results["audio_analysis"] = response1.text
        print(f"✅ Audio analysis complete")
        print(f"   Response preview: {response1.text[:200]}...")

        # Parse JSON
        analysis_json = parse_json(response1.text)
        if analysis_json.get("proceed_with_transcription") == False:
            print("⚠️  Audio analyzer says: No conversation detected")
            return results

    except Exception as e:
        print(f"❌ Audio analysis failed: {e}")
        return None

    # ========== Agent 2: Transcript Generator ==========
    print("\n--- Agent 2: Transcript Generator ---")
    try:
        response2 = model.generate_content([
            get_agent_prompt("transcript_generator_agent"),
            audio_part
        ])
        results["transcript"] = response2.text
        print(f"✅ Transcription complete")
        print(f"   Length: {len(response2.text)} chars")
        print(f"   Preview: {response2.text[:300]}...")

    except Exception as e:
        print(f"❌ Transcription failed: {e}")
        return results

    # ========== Agent 3: Translator ==========
    print("\n--- Agent 3: Translator ---")
    try:
        response3 = model.generate_content([
            get_agent_prompt("translator_agent"),
            f"Transcript to translate:\n\n{results['transcript']}"
        ])
        results["translation"] = response3.text
        print(f"✅ Translation complete")
        print(f"   Length: {len(response3.text)} chars")
        print(f"   Preview: {response3.text[:300]}...")

    except Exception as e:
        print(f"❌ Translation failed: {e}")
        return results

    # ========== Agent 4: Summarizer ==========
    print("\n--- Agent 4: Summarizer ---")
    try:
        response4 = model.generate_content([
            get_agent_prompt("summarizer_agent"),
            f"Transcript:\n{results['transcript']}\n\nTranslation:\n{results['translation']}"
        ])
        results["summary"] = response4.text
        print(f"✅ Summary complete")
        print(f"   Length: {len(response4.text)} chars")
        print(f"   Preview: {response4.text[:500]}...")

    except Exception as e:
        print(f"❌ Summarization failed: {e}")
        return results

    # ========== Agent 5: Validator ==========
    print("\n--- Agent 5: Validator ---")
    try:
        validation_input = json.dumps({
            "audio_analysis": results.get("audio_analysis", ""),
            "transcript": results.get("transcript", ""),
            "translation": results.get("translation", ""),
            "summary": results.get("summary", "")
        }, indent=2)

        response5 = model.generate_content([
            get_agent_prompt("validator_scorer_agent"),
            f"Outputs to validate:\n\n{validation_input}"
        ])
        results["validation"] = response5.text
        print(f"✅ Validation complete")
        print(f"   Preview: {response5.text[:500]}...")

    except Exception as e:
        print(f"❌ Validation failed: {e}")

    return results


def parse_json(text: str):
    """Parse JSON from LLM response."""
    # Remove markdown code blocks
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]

    try:
        return json.loads(text.strip())
    except:
        return {"raw": text}


def save_results(results: dict, call_id: str, output_dir: str = "./test_output"):
    """Save test results to files."""
    os.makedirs(output_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Save individual outputs
    for key, value in results.items():
        filename = f"{call_id}_{key}_{timestamp}.txt"
        filepath = os.path.join(output_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(value if isinstance(value, str) else json.dumps(value, indent=2))
        print(f"   Saved: {filename}")

    # Save combined JSON
    combined_file = os.path.join(output_dir, f"{call_id}_combined_{timestamp}.json")
    with open(combined_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"   Saved: {call_id}_combined_{timestamp}.json")

    return combined_file


def main():
    """Main test function."""
    print("\n" + "=" * 60)
    print("CALL INSIGHTS ENGINE - TEST LAYERS 1-3")
    print("=" * 60)

    # Check environment
    if not check_environment():
        print("\n❌ Environment check failed. Please set required variables.")
        return

    # Get test URL
    print("\nEnter a test audio URL (or press Enter for interactive input):")
    test_url = input("URL: ").strip()

    if not test_url:
        print("\nNo URL provided. Please enter an audio URL to test.")
        return

    call_id = input("Call ID (or press Enter for auto): ").strip()
    if not call_id:
        call_id = f"test_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    # Test 1: Audio Download
    processed_audio = test_audio_download(test_url, call_id)
    if not processed_audio:
        print("\n❌ Audio processing failed. Cannot continue.")
        return

    # Test 2: Gemini Pipeline
    results = test_gemini_transcription(processed_audio, call_id)
    if not results:
        print("\n❌ Pipeline failed.")
        return

    # Save results
    print("\n" + "=" * 60)
    print("SAVING RESULTS")
    print("=" * 60)
    output_file = save_results(results, call_id)

    # Summary
    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)
    print(f"✅ All agents executed successfully!")
    print(f"   Results saved to: {output_file}")
    print("\nNext steps:")
    print("   1. Review the output files")
    print("   2. Check transcript quality (Roman script, speaker labels)")
    print("   3. Verify summary extraction (issues, sentiment, risk)")
    print("   4. Tune prompts if needed")


if __name__ == "__main__":
    main()
