# Copyright 2025 IndiaMART
# Call Insights Engine - Main Entry Point

"""
Main entry point for the Call Insights Engine.
Provides CLI and programmatic interfaces for processing call recordings.

Usage:
    # Process single call
    python main.py --url "https://example.com/call.mp3" --call-id "12345"

    # Process from CSV file
    python main.py --csv "calls.csv" --output "results/"

    # Interactive mode
    python main.py --interactive
"""

import os
import sys
import json
import argparse
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Environment setup
from dotenv import load_dotenv
load_dotenv()

# Vertex AI setup (optional - only needed for ADK mode)
try:
    import vertexai
    from google.auth import default
    VERTEXAI_AVAILABLE = True
except ImportError:
    VERTEXAI_AVAILABLE = False
    logger.info("Vertex AI not installed - using direct Gemini API mode")


@dataclass
class CallInput:
    """Input data for a call to be processed."""
    call_id: str
    audio_url: str
    customer_id: Optional[str] = None
    customer_type: Optional[str] = None
    customer_city: Optional[str] = None
    customer_vintage_months: Optional[int] = None
    call_type: Optional[str] = None  # incoming/outgoing
    executive_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class ProcessingResult:
    """Result from processing a call."""
    call_id: str
    success: bool
    processing_time_seconds: float
    confidence_score: float
    quality_score: int
    transcript: Optional[str]
    translation: Optional[str]
    summary: Optional[Dict[str, Any]]
    error_message: Optional[str] = None
    raw_pipeline_output: Optional[Dict[str, Any]] = None


def initialize_vertex_ai():
    """Initialize Vertex AI with project credentials."""
    if not VERTEXAI_AVAILABLE:
        logger.info("Vertex AI not available - skipping initialization")
        return

    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")

    if not project_id:
        raise ValueError(
            "GOOGLE_CLOUD_PROJECT environment variable not set. "
            "Please set it in your .env file or environment."
        )

    credentials, _ = default()
    vertexai.init(
        project=project_id,
        location=location,
        credentials=credentials
    )
    logger.info(f"Initialized Vertex AI: project={project_id}, location={location}")


def process_single_call(
    call_input: CallInput,
    save_intermediate: bool = False,
    output_dir: Optional[str] = None
) -> ProcessingResult:
    """
    Process a single call through the multi-agent pipeline.

    Args:
        call_input: Input data for the call
        save_intermediate: Whether to save intermediate agent outputs
        output_dir: Directory to save outputs

    Returns:
        ProcessingResult with all extracted data
    """
    from audio_utils import process_audio_for_api, cleanup_temp_files
    from agent import get_pipeline

    start_time = datetime.now()
    logger.info(f"Processing call: {call_input.call_id}")

    try:
        # Step 1: Download and process audio
        logger.info(f"Downloading audio from: {call_input.audio_url}")
        processed_audio, error = process_audio_for_api(
            url=call_input.audio_url,
            call_id=call_input.call_id
        )

        if error:
            return ProcessingResult(
                call_id=call_input.call_id,
                success=False,
                processing_time_seconds=(datetime.now() - start_time).total_seconds(),
                confidence_score=0.0,
                quality_score=0,
                transcript=None,
                translation=None,
                summary=None,
                error_message=f"Audio processing failed: {error}"
            )

        logger.info(f"Audio processed: {processed_audio.metadata.file_size_bytes} bytes")

        # Step 2: Prepare input for pipeline
        pipeline_input = {
            "audio_content": processed_audio.base64_content,
            "audio_mime_type": processed_audio.mime_type,
            "call_id": call_input.call_id,
            "metadata": {
                "customer_id": call_input.customer_id,
                "customer_type": call_input.customer_type,
                "customer_city": call_input.customer_city,
                "customer_vintage_months": call_input.customer_vintage_months,
                "call_type": call_input.call_type,
                "executive_id": call_input.executive_id,
                **(call_input.metadata or {})
            }
        }

        # Step 3: Run the pipeline
        logger.info("Running multi-agent pipeline...")
        pipeline = get_pipeline()

        # Note: Actual ADK pipeline execution would be:
        # result = pipeline.run(pipeline_input)
        # For now, we'll create a placeholder for the integration

        # Placeholder - replace with actual ADK execution
        pipeline_output = run_pipeline_with_gemini(
            audio_base64=processed_audio.base64_content,
            mime_type=processed_audio.mime_type,
            call_id=call_input.call_id
        )

        # Step 4: Parse pipeline output
        processing_time = (datetime.now() - start_time).total_seconds()

        # Extract results from pipeline output
        final_output = pipeline_output.get("final_output", {})
        scores = pipeline_output.get("scores", {})

        result = ProcessingResult(
            call_id=call_input.call_id,
            success=True,
            processing_time_seconds=processing_time,
            confidence_score=pipeline_output.get("confidence_level", 0.0),
            quality_score=scores.get("total", 0),
            transcript=final_output.get("transcript"),
            translation=final_output.get("translation"),
            summary=final_output.get("summary"),
            raw_pipeline_output=pipeline_output if save_intermediate else None
        )

        # Step 5: Cleanup temp files
        cleanup_temp_files(call_input.call_id)

        logger.info(f"Call {call_input.call_id} processed successfully in {processing_time:.2f}s")
        return result

    except Exception as e:
        logger.error(f"Error processing call {call_input.call_id}: {str(e)}")
        return ProcessingResult(
            call_id=call_input.call_id,
            success=False,
            processing_time_seconds=(datetime.now() - start_time).total_seconds(),
            confidence_score=0.0,
            quality_score=0,
            transcript=None,
            translation=None,
            summary=None,
            error_message=str(e)
        )


def run_pipeline_with_gemini(
    audio_base64: str,
    mime_type: str,
    call_id: str
) -> Dict[str, Any]:
    """
    Run the pipeline using direct Gemini API calls.
    This is a fallback/alternative to ADK SequentialAgent.

    Args:
        audio_base64: Base64 encoded audio content
        mime_type: MIME type of the audio
        call_id: Unique identifier for the call

    Returns:
        Pipeline output dictionary
    """
    import google.generativeai as genai
    from prompts import get_agent_prompt

    # Configure Gemini
    genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))

    model = genai.GenerativeModel('gemini-2.0-flash-001')

    # Prepare audio content
    audio_part = {
        "inline_data": {
            "mime_type": mime_type,
            "data": audio_base64
        }
    }

    results = {}

    # Agent 1: Audio Analyzer
    logger.info("Running Agent 1: Audio Analyzer")
    response1 = model.generate_content([
        get_agent_prompt("audio_analyzer_agent"),
        audio_part
    ])
    results["audio_analysis"] = parse_json_response(response1.text)

    # Check if we should proceed
    if not results["audio_analysis"].get("proceed_with_transcription", True):
        return {
            "final_output": {
                "transcript": "[No conversation detected]",
                "translation": "[No translation available]",
                "summary": {"error": "No conversation in audio"}
            },
            "confidence_level": 0.0,
            "scores": {"total": 0}
        }

    # Agent 2: Transcript Generator
    logger.info("Running Agent 2: Transcript Generator")
    response2 = model.generate_content([
        get_agent_prompt("transcript_generator_agent"),
        audio_part
    ])
    results["transcript"] = response2.text

    # Agent 3: Translator
    logger.info("Running Agent 3: Translator")
    response3 = model.generate_content([
        get_agent_prompt("translator_agent"),
        f"Transcript to translate:\n{results['transcript']}"
    ])
    results["translation"] = response3.text

    # Agent 4: Summarizer
    logger.info("Running Agent 4: Summarizer")
    response4 = model.generate_content([
        get_agent_prompt("summarizer_agent"),
        f"Transcript:\n{results['transcript']}\n\nTranslation:\n{results['translation']}"
    ])
    results["summary"] = parse_json_response(response4.text)

    # Agent 5: Validator
    logger.info("Running Agent 5: Validator")
    validation_input = json.dumps({
        "transcript": results["transcript"],
        "translation": results["translation"],
        "summary": results["summary"]
    }, indent=2)

    response5 = model.generate_content([
        get_agent_prompt("validator_scorer_agent"),
        f"Outputs to validate:\n{validation_input}"
    ])
    validation_result = parse_json_response(response5.text)

    # Compile final output
    return {
        "audio_analysis": results["audio_analysis"],
        "final_output": {
            "transcript": results["transcript"],
            "translation": results["translation"],
            "summary": results["summary"]
        },
        "validation": validation_result.get("validation", {}),
        "scores": validation_result.get("scores", {}),
        "confidence_level": validation_result.get("confidence_level", "medium"),
        "recommendations": validation_result.get("recommendations", {})
    }


def parse_json_response(text: str) -> Dict[str, Any]:
    """
    Parse JSON from LLM response, handling markdown code blocks.

    Args:
        text: Raw response text

    Returns:
        Parsed JSON as dictionary
    """
    # Remove markdown code blocks if present
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]

    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        return {"raw_text": text, "parse_error": True}


def process_batch(
    calls: List[CallInput],
    output_dir: str,
    max_workers: int = 4,
    save_intermediate: bool = False
) -> List[ProcessingResult]:
    """
    Process multiple calls in parallel.

    Args:
        calls: List of CallInput objects
        output_dir: Directory to save results
        max_workers: Maximum parallel workers
        save_intermediate: Whether to save intermediate outputs

    Returns:
        List of ProcessingResult objects
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    os.makedirs(output_dir, exist_ok=True)
    results = []

    logger.info(f"Processing {len(calls)} calls with {max_workers} workers")

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_call = {
            executor.submit(
                process_single_call,
                call,
                save_intermediate,
                output_dir
            ): call
            for call in calls
        }

        for future in as_completed(future_to_call):
            call = future_to_call[future]
            try:
                result = future.result()
                results.append(result)

                # Save individual result
                result_file = os.path.join(output_dir, f"{call.call_id}_result.json")
                with open(result_file, 'w', encoding='utf-8') as f:
                    json.dump(asdict(result), f, indent=2, ensure_ascii=False)

                logger.info(f"Completed: {call.call_id} - Success: {result.success}")

            except Exception as e:
                logger.error(f"Failed to process {call.call_id}: {str(e)}")
                results.append(ProcessingResult(
                    call_id=call.call_id,
                    success=False,
                    processing_time_seconds=0,
                    confidence_score=0,
                    quality_score=0,
                    transcript=None,
                    translation=None,
                    summary=None,
                    error_message=str(e)
                ))

    # Save summary report
    summary_file = os.path.join(output_dir, "batch_summary.json")
    summary = {
        "total_calls": len(calls),
        "successful": sum(1 for r in results if r.success),
        "failed": sum(1 for r in results if not r.success),
        "average_processing_time": sum(r.processing_time_seconds for r in results) / len(results) if results else 0,
        "average_quality_score": sum(r.quality_score for r in results if r.success) / sum(1 for r in results if r.success) if any(r.success for r in results) else 0
    }
    with open(summary_file, 'w') as f:
        json.dump(summary, f, indent=2)

    logger.info(f"Batch complete: {summary['successful']}/{summary['total_calls']} successful")
    return results


def load_calls_from_csv(csv_path: str) -> List[CallInput]:
    """
    Load call data from CSV file.

    Expected columns:
    - call_id (required)
    - audio_url (required)
    - customer_id, customer_type, customer_city, etc. (optional)

    Args:
        csv_path: Path to CSV file

    Returns:
        List of CallInput objects
    """
    import csv

    calls = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            call = CallInput(
                call_id=row.get('call_id', row.get('id', '')),
                audio_url=row.get('audio_url', row.get('url', row.get('Call URLs', ''))),
                customer_id=row.get('customer_id', row.get('Gluser Id', '')),
                customer_type=row.get('customer_type', row.get('Customer Type ( CusType)', '')),
                customer_city=row.get('customer_city', row.get('Customer City', '')),
                customer_vintage_months=int(row.get('customer_vintage_months', row.get('Customer Vintage in Month', 0)) or 0),
                call_type=row.get('call_type', row.get('Call Type', '')),
                metadata={k: v for k, v in row.items() if k not in [
                    'call_id', 'id', 'audio_url', 'url', 'Call URLs',
                    'customer_id', 'Gluser Id', 'customer_type', 'Customer Type ( CusType)',
                    'customer_city', 'Customer City', 'customer_vintage_months',
                    'Customer Vintage in Month', 'call_type', 'Call Type'
                ]}
            )
            calls.append(call)

    logger.info(f"Loaded {len(calls)} calls from {csv_path}")
    return calls


def main():
    """Main entry point for CLI usage."""
    parser = argparse.ArgumentParser(
        description="Call Insights Engine - Process call recordings for insights"
    )

    parser.add_argument(
        '--url',
        type=str,
        help='URL of single audio file to process'
    )
    parser.add_argument(
        '--call-id',
        type=str,
        help='Call ID for single file processing'
    )
    parser.add_argument(
        '--csv',
        type=str,
        help='Path to CSV file with multiple calls'
    )
    parser.add_argument(
        '--output',
        type=str,
        default='./output',
        help='Output directory for results'
    )
    parser.add_argument(
        '--workers',
        type=int,
        default=4,
        help='Number of parallel workers for batch processing'
    )
    parser.add_argument(
        '--save-intermediate',
        action='store_true',
        help='Save intermediate agent outputs'
    )
    parser.add_argument(
        '--interactive',
        action='store_true',
        help='Run in interactive mode'
    )

    args = parser.parse_args()

    # Initialize Vertex AI
    try:
        initialize_vertex_ai()
    except Exception as e:
        logger.error(f"Failed to initialize Vertex AI: {e}")
        logger.info("Falling back to direct Gemini API mode")

    if args.interactive:
        # Interactive mode
        print("\n=== Call Insights Engine - Interactive Mode ===\n")
        while True:
            url = input("Enter audio URL (or 'quit' to exit): ").strip()
            if url.lower() == 'quit':
                break

            call_id = input("Enter call ID: ").strip() or f"call_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

            call_input = CallInput(call_id=call_id, audio_url=url)
            result = process_single_call(call_input, save_intermediate=True)

            print(f"\n{'='*50}")
            print(f"Call ID: {result.call_id}")
            print(f"Success: {result.success}")
            print(f"Quality Score: {result.quality_score}/100")
            print(f"Processing Time: {result.processing_time_seconds:.2f}s")

            if result.success:
                print(f"\n--- Transcript ---\n{result.transcript[:500]}...")
                print(f"\n--- Summary ---\n{json.dumps(result.summary, indent=2)[:500]}...")
            else:
                print(f"\nError: {result.error_message}")

            print(f"{'='*50}\n")

    elif args.url:
        # Single file processing
        if not args.call_id:
            args.call_id = f"call_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        call_input = CallInput(call_id=args.call_id, audio_url=args.url)
        result = process_single_call(
            call_input,
            save_intermediate=args.save_intermediate,
            output_dir=args.output
        )

        # Save result
        os.makedirs(args.output, exist_ok=True)
        output_file = os.path.join(args.output, f"{args.call_id}_result.json")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(asdict(result), f, indent=2, ensure_ascii=False)

        print(f"\nResult saved to: {output_file}")
        print(f"Success: {result.success}")
        print(f"Quality Score: {result.quality_score}/100")

    elif args.csv:
        # Batch processing
        calls = load_calls_from_csv(args.csv)
        results = process_batch(
            calls,
            output_dir=args.output,
            max_workers=args.workers,
            save_intermediate=args.save_intermediate
        )

        print(f"\nBatch processing complete!")
        print(f"Results saved to: {args.output}")
        print(f"Successful: {sum(1 for r in results if r.success)}/{len(results)}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
