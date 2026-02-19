# Copyright 2025 IndiaMART
# Call Insights Engine - Batch Processor with Supabase Integration

"""
Batch processor for processing call recordings and storing results in Supabase.

Usage:
    # Process from CSV
    python batch_processor.py --csv calls.csv --workers 4

    # Process single call
    python batch_processor.py --url "https://..." --ucid "12345"

    # Resume from queue
    python batch_processor.py --resume-queue --limit 100
"""

import os
import sys
import json
import argparse
import logging
import csv
from datetime import datetime
from typing import Dict, Any, Optional, List
from concurrent.futures import ThreadPoolExecutor, as_completed

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Environment setup
from dotenv import load_dotenv
load_dotenv()

# Local imports
from main import CallInput, ProcessingResult, run_pipeline_with_gemini, parse_json_response
from audio_utils import process_audio_for_api_with_preprocessing, cleanup_temp_files
from database.supabase_client import (
    SupabaseClient,
    CallRecord,
    TranscriptRecord,
    InsightRecord,
    parse_summary_to_insight,
    init_supabase
)

# RAG integration for SOP enrichment
try:
    from rag.rag_tool import rag_tool, enrich_call_summary
    RAG_AVAILABLE = rag_tool.is_available
    if RAG_AVAILABLE:
        logger.info("RAG integration enabled - summaries will be enriched with SOP context")
except ImportError:
    RAG_AVAILABLE = False
    enrich_call_summary = lambda x: x
    logger.info("RAG not available - running without SOP enrichment")


class BatchProcessor:
    """
    Batch processor for call recordings with Supabase integration.
    """

    def __init__(
        self,
        supabase_client: Optional[SupabaseClient] = None,
        max_workers: int = 4,
        save_local: bool = False,
        output_dir: str = "./output"
    ):
        """
        Initialize batch processor.

        Args:
            supabase_client: Supabase client instance (or creates new one)
            max_workers: Number of parallel workers
            save_local: Also save results to local files
            output_dir: Directory for local file output
        """
        self.supabase = supabase_client or init_supabase()
        self.max_workers = max_workers
        self.save_local = save_local
        self.output_dir = output_dir

        if save_local:
            os.makedirs(output_dir, exist_ok=True)

    def process_single_call(
        self,
        ucid: str,
        audio_url: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process a single call and store results in Supabase.

        Args:
            ucid: Unique Call ID
            audio_url: URL to audio file
            metadata: Additional call metadata

        Returns:
            Processing result dictionary
        """
        start_time = datetime.now()
        metadata = metadata or {}

        logger.info(f"Processing call: {ucid}")

        try:
            # Step 1: Create or get call record
            call_record = CallRecord(
                ucid=ucid,
                call_recording_url=audio_url,
                call_duration_seconds=metadata.get("call_duration_seconds"),
                call_start_time=metadata.get("call_start_time"),
                employee_id=metadata.get("employee_id"),
                employee_name=metadata.get("employee_name"),
                employee_mobile=metadata.get("employee_mobile"),
                customer_mobile=metadata.get("customer_mobile"),
                company_id=metadata.get("company_id"),
                company_name=metadata.get("company_name"),
                module=metadata.get("module"),
                vertical_id=metadata.get("vertical_id"),
                call_direction=metadata.get("call_direction"),
                call_type=metadata.get("call_type"),
                external_call_id=metadata.get("external_call_id")
            )

            # Upsert call record
            call_data = self.supabase.upsert_call(call_record)
            call_id = call_data.get("id")

            if not call_id:
                raise Exception("Failed to create call record")

            logger.info(f"Call record created/updated: {call_id}")

            # Step 2: Download and preprocess audio
            logger.info(f"Downloading audio from: {audio_url}")
            processed_audio, processing_info, error = process_audio_for_api_with_preprocessing(
                url=audio_url,
                call_id=ucid
            )

            if error:
                raise Exception(f"Audio processing failed: {error}")

            logger.info(f"Audio processed: {processed_audio.metadata.file_size_bytes} bytes")

            # Step 3: Run the pipeline
            logger.info("Running multi-agent pipeline...")
            pipeline_output = run_pipeline_with_gemini(
                audio_base64=processed_audio.base64_content,
                mime_type=processed_audio.mime_type,
                call_id=ucid
            )

            final_output = pipeline_output.get("final_output", {})
            audio_analysis = pipeline_output.get("audio_analysis", {})

            # Step 4: Store transcript
            transcript_text = final_output.get("transcript", "")
            translation_text = final_output.get("translation", "")

            transcript_record = TranscriptRecord(
                call_id=call_id,
                transcript=transcript_text,
                translation=translation_text,
                transcript_language=audio_analysis.get("primary_language", "hi"),
                languages_detected=audio_analysis.get("languages_detected"),
                audio_quality=audio_analysis.get("audio_quality"),
                speaker_count=audio_analysis.get("speaker_count", 2),
                model_used="gemini-2.0-flash-001",
                confidence_score=audio_analysis.get("confidence_score")
            )

            transcript_data = self.supabase.insert_transcript(transcript_record)
            transcript_id = transcript_data.get("id")

            logger.info(f"Transcript stored: {transcript_id}")

            # Step 5: Enrich summary with RAG/SOP context
            summary = final_output.get("summary", {})

            if RAG_AVAILABLE and summary:
                logger.info("Enriching summary with SOP context...")
                summary = enrich_call_summary(summary)
                logger.info(f"Summary enriched with {len(summary.get('sop_recommendations', []))} SOP recommendations")

            # Step 6: Store insights
            insight_record = parse_summary_to_insight(
                call_id=call_id,
                summary=summary,
                transcript_id=transcript_id
            )

            insight_data = self.supabase.insert_insight(insight_record)
            insight_id = insight_data.get("id")

            logger.info(f"Insights stored: {insight_id}")

            # Step 7: Store individual issues
            issues = summary.get("issues", [])
            if issues and insight_id:
                self.supabase.insert_issues(call_id, insight_id, issues)
                logger.info(f"Stored {len(issues)} issues")

            # Step 8: Cleanup temp files
            cleanup_temp_files(ucid)

            processing_time = (datetime.now() - start_time).total_seconds()

            result = {
                "success": True,
                "ucid": ucid,
                "call_id": call_id,
                "transcript_id": transcript_id,
                "insight_id": insight_id,
                "processing_time_seconds": processing_time,
                "summary": summary
            }

            # Save locally if requested
            if self.save_local:
                self._save_local_result(ucid, result, pipeline_output)

            logger.info(f"Call {ucid} processed successfully in {processing_time:.2f}s")
            return result

        except Exception as e:
            processing_time = (datetime.now() - start_time).total_seconds()
            logger.error(f"Error processing call {ucid}: {str(e)}")

            return {
                "success": False,
                "ucid": ucid,
                "error": str(e),
                "processing_time_seconds": processing_time
            }

    def process_batch_from_csv(
        self,
        csv_path: str,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Process multiple calls from a CSV file.

        Args:
            csv_path: Path to CSV file
            limit: Maximum number of calls to process

        Returns:
            Batch processing summary
        """
        calls = self._load_calls_from_csv(csv_path)

        if limit:
            calls = calls[:limit]

        logger.info(f"Processing {len(calls)} calls from {csv_path}")

        return self._process_batch(calls)

    def process_batch_from_queue(self, limit: int = 100) -> Dict[str, Any]:
        """
        Process calls from the Supabase processing queue.

        Args:
            limit: Maximum number of calls to process

        Returns:
            Batch processing summary
        """
        # Get pending items from queue
        pending = self.supabase.get_next_pending(limit=limit)

        if not pending:
            logger.info("No pending items in queue")
            return {"total": 0, "processed": 0, "failed": 0}

        logger.info(f"Processing {len(pending)} items from queue")

        results = []
        for item in pending:
            queue_id = item["id"]
            ucid = item["ucid"]
            audio_url = item["audio_url"]

            # Update queue status to processing
            self.supabase.update_queue_status(queue_id, "processing")

            try:
                result = self.process_single_call(ucid, audio_url)

                if result["success"]:
                    self.supabase.update_queue_status(
                        queue_id,
                        "completed",
                        call_id=result["call_id"]
                    )
                else:
                    self.supabase.update_queue_status(
                        queue_id,
                        "failed",
                        error_message=result.get("error")
                    )

                results.append(result)

            except Exception as e:
                logger.error(f"Queue item {queue_id} failed: {str(e)}")
                self.supabase.update_queue_status(
                    queue_id,
                    "failed",
                    error_message=str(e)
                )
                results.append({
                    "success": False,
                    "ucid": ucid,
                    "error": str(e)
                })

        return self._compile_summary(results)

    def add_to_queue(
        self,
        calls: List[Dict[str, str]],
        priority: int = 100
    ) -> int:
        """
        Add calls to the processing queue.

        Args:
            calls: List of dicts with 'ucid' and 'audio_url' keys
            priority: Priority level (lower = higher priority)

        Returns:
            Number of items added
        """
        count = 0
        for call in calls:
            try:
                self.supabase.add_to_queue(
                    ucid=call["ucid"],
                    audio_url=call["audio_url"],
                    priority=priority
                )
                count += 1
            except Exception as e:
                logger.error(f"Failed to queue {call['ucid']}: {str(e)}")

        logger.info(f"Added {count} calls to queue")
        return count

    def _process_batch(self, calls: List[Dict]) -> Dict[str, Any]:
        """
        Process a batch of calls with parallel workers.

        Args:
            calls: List of call dictionaries

        Returns:
            Batch summary
        """
        results = []

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_call = {
                executor.submit(
                    self.process_single_call,
                    call["ucid"],
                    call["audio_url"],
                    call.get("metadata", {})
                ): call
                for call in calls
            }

            for future in as_completed(future_to_call):
                call = future_to_call[future]
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    logger.error(f"Worker failed for {call['ucid']}: {str(e)}")
                    results.append({
                        "success": False,
                        "ucid": call["ucid"],
                        "error": str(e)
                    })

        return self._compile_summary(results)

    def _load_calls_from_csv(self, csv_path: str) -> List[Dict]:
        """Load calls from CSV file."""
        calls = []

        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Map common column name variations
                ucid = (
                    row.get('ucid') or
                    row.get('UCID') or
                    row.get('call_id') or
                    row.get('id', '')
                )
                audio_url = (
                    row.get('audio_url') or
                    row.get('call_recording_url') or
                    row.get('url') or
                    row.get('Call URLs', '')
                )

                if not ucid or not audio_url:
                    continue

                metadata = {
                    "call_duration_seconds": int(row.get("call_duration_seconds", 0) or 0),
                    "call_start_time": row.get("call_start_time") or row.get("CALL_START_TIME"),
                    "employee_id": row.get("employee_id") or row.get("EMPLOYEE_ID"),
                    "employee_name": row.get("employee_name") or row.get("EMPLOYEE_NAME"),
                    "employee_mobile": row.get("employee_mobile") or row.get("EMPLOYEE_MOBILE"),
                    "customer_mobile": row.get("customer_mobile") or row.get("CUSTOMER_MOBILE"),
                    "company_id": row.get("company_id") or row.get("COMPANY_ID"),
                    "company_name": row.get("company_name") or row.get("COMPANY_NAME"),
                    "module": row.get("module") or row.get("MODULE"),
                    "vertical_id": row.get("vertical_id") or row.get("VERTICAL_ID"),
                    "call_direction": row.get("call_direction") or row.get("CALL_DIRECTION"),
                    "call_type": row.get("call_type") or row.get("CALL_TYPE"),
                    "external_call_id": row.get("external_call_id") or row.get("EXTERNAL_CALL_ID")
                }

                # Remove None values
                metadata = {k: v for k, v in metadata.items() if v}

                calls.append({
                    "ucid": ucid,
                    "audio_url": audio_url,
                    "metadata": metadata
                })

        logger.info(f"Loaded {len(calls)} calls from {csv_path}")
        return calls

    def _compile_summary(self, results: List[Dict]) -> Dict[str, Any]:
        """Compile batch processing summary."""
        successful = [r for r in results if r.get("success")]
        failed = [r for r in results if not r.get("success")]

        avg_time = (
            sum(r.get("processing_time_seconds", 0) for r in successful) / len(successful)
            if successful else 0
        )

        summary = {
            "total": len(results),
            "successful": len(successful),
            "failed": len(failed),
            "average_processing_time_seconds": round(avg_time, 2),
            "failed_calls": [{"ucid": r["ucid"], "error": r.get("error")} for r in failed]
        }

        # Save summary locally
        if self.save_local:
            summary_file = os.path.join(self.output_dir, "batch_summary.json")
            with open(summary_file, 'w') as f:
                json.dump(summary, f, indent=2)

        return summary

    def _save_local_result(
        self,
        ucid: str,
        result: Dict,
        pipeline_output: Dict
    ):
        """Save result to local file."""
        output_file = os.path.join(self.output_dir, f"{ucid}_result.json")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({
                **result,
                "pipeline_output": pipeline_output
            }, f, indent=2, ensure_ascii=False)


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Batch processor for call recordings with Supabase integration"
    )

    parser.add_argument(
        '--csv',
        type=str,
        help='Path to CSV file with calls to process'
    )
    parser.add_argument(
        '--url',
        type=str,
        help='URL of single audio file to process'
    )
    parser.add_argument(
        '--ucid',
        type=str,
        help='UCID for single file processing'
    )
    parser.add_argument(
        '--resume-queue',
        action='store_true',
        help='Process pending items from Supabase queue'
    )
    parser.add_argument(
        '--add-to-queue',
        type=str,
        help='Add calls from CSV to processing queue'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=100,
        help='Maximum number of calls to process'
    )
    parser.add_argument(
        '--workers',
        type=int,
        default=4,
        help='Number of parallel workers'
    )
    parser.add_argument(
        '--save-local',
        action='store_true',
        help='Also save results to local files'
    )
    parser.add_argument(
        '--output',
        type=str,
        default='./output',
        help='Output directory for local files'
    )

    args = parser.parse_args()

    try:
        processor = BatchProcessor(
            max_workers=args.workers,
            save_local=args.save_local,
            output_dir=args.output
        )

        if args.url and args.ucid:
            # Single file processing
            result = processor.process_single_call(args.ucid, args.url)
            print(json.dumps(result, indent=2))

        elif args.csv:
            # Batch processing from CSV
            summary = processor.process_batch_from_csv(args.csv, limit=args.limit)
            print(f"\n{'='*50}")
            print("Batch Processing Complete")
            print(f"{'='*50}")
            print(f"Total: {summary['total']}")
            print(f"Successful: {summary['successful']}")
            print(f"Failed: {summary['failed']}")
            print(f"Avg Time: {summary['average_processing_time_seconds']:.2f}s")

            if summary['failed_calls']:
                print("\nFailed calls:")
                for fail in summary['failed_calls'][:10]:
                    print(f"  - {fail['ucid']}: {fail['error'][:50]}...")

        elif args.resume_queue:
            # Process from queue
            summary = processor.process_batch_from_queue(limit=args.limit)
            print(f"\nQueue Processing Complete")
            print(f"Processed: {summary['successful']}/{summary['total']}")

        elif args.add_to_queue:
            # Add to queue from CSV
            calls = processor._load_calls_from_csv(args.add_to_queue)
            queue_calls = [{"ucid": c["ucid"], "audio_url": c["audio_url"]} for c in calls]
            count = processor.add_to_queue(queue_calls[:args.limit])
            print(f"Added {count} calls to queue")

        else:
            parser.print_help()

    except Exception as e:
        logger.error(f"Error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
