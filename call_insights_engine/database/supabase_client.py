# Copyright 2025 IndiaMART
# Call Insights Engine - Supabase Client

"""
Supabase client for Call Insights Engine.
Handles all database operations for storing and retrieving call data.
"""

import os
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict
from dotenv import load_dotenv

load_dotenv()

# Supabase client
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    print("Warning: supabase-py not installed. Run: pip install supabase")


@dataclass
class CallRecord:
    """Call record data structure."""
    ucid: str
    call_recording_url: str
    call_duration_seconds: Optional[int] = None
    call_start_time: Optional[str] = None
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
    employee_mobile: Optional[str] = None
    customer_mobile: Optional[str] = None
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    module: Optional[str] = None
    vertical_id: Optional[str] = None
    vertical_name: Optional[str] = None
    call_direction: Optional[str] = None
    call_type: Optional[str] = None
    external_call_id: Optional[str] = None
    city: Optional[str] = None
    customer_type: Optional[str] = None


@dataclass
class TranscriptRecord:
    """Transcript record data structure."""
    call_id: str
    transcript: str
    translation: Optional[str] = None
    transcript_language: Optional[str] = "hi"
    languages_detected: Optional[List[str]] = None
    audio_quality: Optional[str] = None
    speaker_count: int = 2
    model_used: str = "gemini-2.0-flash-001"
    confidence_score: Optional[float] = None


@dataclass
class InsightRecord:
    """Insight record data structure."""
    call_id: str
    transcript_id: Optional[str] = None

    # Risk signals
    churn_risk_score: Optional[float] = None
    deactivation_intent: bool = False
    deactivation_confirmed: bool = False
    refund_requested: bool = False
    escalation_threatened: bool = False
    legal_threat: bool = False
    payment_dispute: bool = False
    competitor_mentioned: Optional[str] = None

    # Sentiment
    sentiment_start: Optional[str] = None
    sentiment_end: Optional[str] = None
    sentiment_trajectory: Optional[str] = None
    executive_tone: Optional[str] = None

    # Call outcome
    call_purpose: Optional[str] = None
    purpose_fulfilled: Optional[bool] = None
    customer_satisfied: Optional[str] = None
    requires_escalation: bool = False

    # Resolution
    resolution_status: Optional[str] = None
    follow_up_required: bool = False
    follow_up_owner: Optional[str] = None
    follow_up_timeline: Optional[str] = None

    # JSON fields
    issues: Optional[List[Dict]] = None
    actions_taken: Optional[List[str]] = None
    promises_made: Optional[List[str]] = None
    key_quotes: Optional[Dict] = None
    topics: Optional[List[str]] = None
    raw_summary: Optional[Dict] = None

    model_used: str = "gemini-2.0-flash-001"


class SupabaseClient:
    """Client for Supabase database operations."""

    def __init__(self, url: Optional[str] = None, key: Optional[str] = None):
        """
        Initialize Supabase client.

        Args:
            url: Supabase project URL (or set SUPABASE_URL env var)
            key: Supabase anon/service key (or set SUPABASE_KEY env var)
        """
        if not SUPABASE_AVAILABLE:
            raise ImportError("supabase-py not installed. Run: pip install supabase")

        self.url = url or os.environ.get("SUPABASE_URL")
        self.key = key or os.environ.get("SUPABASE_KEY")

        if not self.url or not self.key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")

        self.client: Client = create_client(self.url, self.key)

    # =========================================================================
    # CALLS TABLE
    # =========================================================================

    def insert_call(self, call: CallRecord) -> Dict[str, Any]:
        """Insert a new call record."""
        data = {k: v for k, v in asdict(call).items() if v is not None}
        result = self.client.table("calls").insert(data).execute()
        return result.data[0] if result.data else {}

    def get_call_by_ucid(self, ucid: str) -> Optional[Dict[str, Any]]:
        """Get call by UCID."""
        result = self.client.table("calls").select("*").eq("ucid", ucid).execute()
        return result.data[0] if result.data else None

    def get_call_by_id(self, call_id: str) -> Optional[Dict[str, Any]]:
        """Get call by ID."""
        result = self.client.table("calls").select("*").eq("id", call_id).execute()
        return result.data[0] if result.data else None

    def upsert_call(self, call: CallRecord) -> Dict[str, Any]:
        """Insert or update call record."""
        data = {k: v for k, v in asdict(call).items() if v is not None}
        result = self.client.table("calls").upsert(data, on_conflict="ucid").execute()
        return result.data[0] if result.data else {}

    # =========================================================================
    # TRANSCRIPTS TABLE
    # =========================================================================

    def insert_transcript(self, transcript: TranscriptRecord) -> Dict[str, Any]:
        """Insert a new transcript record."""
        data = {k: v for k, v in asdict(transcript).items() if v is not None}
        # Convert list to JSON for languages_detected
        if data.get("languages_detected"):
            data["languages_detected"] = json.dumps(data["languages_detected"])
        result = self.client.table("call_transcripts").insert(data).execute()
        return result.data[0] if result.data else {}

    def get_transcript_by_call_id(self, call_id: str) -> Optional[Dict[str, Any]]:
        """Get transcript by call ID."""
        result = self.client.table("call_transcripts").select("*").eq("call_id", call_id).execute()
        return result.data[0] if result.data else None

    # =========================================================================
    # INSIGHTS TABLE
    # =========================================================================

    def insert_insight(self, insight: InsightRecord) -> Dict[str, Any]:
        """Insert a new insight record."""
        # Fields with varchar(50) limit in database
        VARCHAR_50_FIELDS = {
            'sentiment_start', 'sentiment_end', 'sentiment_trajectory',
            'executive_tone', 'call_purpose', 'resolution_status',
            'follow_up_owner', 'customer_satisfied', 'competitor_mentioned'
        }

        data = {}
        for k, v in asdict(insight).items():
            if v is not None:
                # Convert complex types to JSON
                if isinstance(v, (list, dict)):
                    data[k] = json.dumps(v) if not isinstance(v, str) else v
                elif isinstance(v, str) and k in VARCHAR_50_FIELDS:
                    # Truncate string fields to fit varchar(50)
                    data[k] = v[:50] if len(v) > 50 else v
                else:
                    data[k] = v

        result = self.client.table("call_insights").insert(data).execute()
        return result.data[0] if result.data else {}

    def get_insight_by_call_id(self, call_id: str) -> Optional[Dict[str, Any]]:
        """Get insight by call ID."""
        result = self.client.table("call_insights").select("*").eq("call_id", call_id).execute()
        return result.data[0] if result.data else None

    # =========================================================================
    # ISSUES TABLE
    # =========================================================================

    def insert_issues(self, call_id: str, insight_id: str, issues: List[Dict]) -> List[Dict]:
        """Insert multiple issues for a call."""
        if not issues:
            return []

        data = []
        for issue in issues:
            # Truncate fields to fit database constraints
            category = issue.get("category", "")[:50] if issue.get("category") else None
            subcategory = issue.get("subcategory", "")[:100] if issue.get("subcategory") else None
            description = issue.get("description", "")[:500] if issue.get("description") else None
            severity = issue.get("severity", "")[:20] if issue.get("severity") else None
            mentioned_by = issue.get("mentioned_by", "")[:50] if issue.get("mentioned_by") else None
            timestamp_loc = issue.get("timestamp_location", "")[:50] if issue.get("timestamp_location") else None

            data.append({
                "call_id": call_id,
                "insight_id": insight_id,
                "category": category,
                "subcategory": subcategory,
                "description": description,
                "severity": severity,
                "mentioned_by": mentioned_by,
                "timestamp_location": timestamp_loc,
            })

        result = self.client.table("call_issues").insert(data).execute()
        return result.data if result.data else []

    # =========================================================================
    # PROCESSING QUEUE
    # =========================================================================

    def add_to_queue(self, ucid: str, audio_url: str, priority: int = 100) -> Dict[str, Any]:
        """Add a call to the processing queue."""
        data = {
            "ucid": ucid,
            "audio_url": audio_url,
            "status": "pending",
            "priority": priority
        }
        result = self.client.table("processing_queue").insert(data).execute()
        return result.data[0] if result.data else {}

    def get_next_pending(self, limit: int = 10) -> List[Dict]:
        """Get next pending items from queue."""
        result = (
            self.client.table("processing_queue")
            .select("*")
            .eq("status", "pending")
            .order("priority")
            .order("queued_at")
            .limit(limit)
            .execute()
        )
        return result.data if result.data else []

    def update_queue_status(
        self,
        queue_id: str,
        status: str,
        call_id: Optional[str] = None,
        error_message: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update queue item status."""
        data = {"status": status}

        if call_id:
            data["call_id"] = call_id
        if status == "processing":
            data["started_at"] = datetime.utcnow().isoformat()
        if status == "completed":
            data["completed_at"] = datetime.utcnow().isoformat()
        if status == "failed":
            data["error_message"] = error_message
            data["last_error_at"] = datetime.utcnow().isoformat()

        result = (
            self.client.table("processing_queue")
            .update(data)
            .eq("id", queue_id)
            .execute()
        )
        return result.data[0] if result.data else {}

    # =========================================================================
    # ANALYTICS QUERIES
    # =========================================================================

    def get_high_risk_calls(self, limit: int = 50) -> List[Dict]:
        """Get high risk calls for alerts."""
        result = (
            self.client.table("call_insights")
            .select("*, calls(*)")
            .or_("churn_risk_score.gte.0.7,deactivation_intent.eq.true,escalation_threatened.eq.true")
            .order("churn_risk_score", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data if result.data else []

    def get_issue_summary(self) -> List[Dict]:
        """Get issue counts by category."""
        result = (
            self.client.table("call_issues")
            .select("category, subcategory")
            .execute()
        )

        if not result.data:
            return []

        # Aggregate in Python (Supabase doesn't support GROUP BY in select)
        from collections import Counter
        category_counts = Counter(item["category"] for item in result.data)
        return [{"category": k, "count": v} for k, v in category_counts.most_common()]

    def get_daily_stats(self, days: int = 30) -> List[Dict]:
        """Get daily analytics."""
        result = (
            self.client.table("analytics_daily")
            .select("*")
            .order("date", desc=True)
            .limit(days)
            .execute()
        )
        return result.data if result.data else []

    def get_overview_stats(self) -> Dict[str, Any]:
        """Get overview statistics for dashboard."""
        # Total calls
        calls_result = self.client.table("calls").select("id", count="exact").execute()
        total_calls = calls_result.count or 0

        # Insights stats
        insights_result = (
            self.client.table("call_insights")
            .select("churn_risk_score, deactivation_intent, resolution_status")
            .execute()
        )

        insights = insights_result.data or []

        high_risk = sum(1 for i in insights if i.get("churn_risk_score", 0) >= 0.7)
        deactivations = sum(1 for i in insights if i.get("deactivation_intent"))
        resolved = sum(1 for i in insights if i.get("resolution_status") == "resolved")
        avg_churn = (
            sum(i.get("churn_risk_score", 0) for i in insights) / len(insights)
            if insights else 0
        )

        return {
            "total_calls": total_calls,
            "processed_calls": len(insights),
            "high_risk_calls": high_risk,
            "deactivation_intents": deactivations,
            "resolved_calls": resolved,
            "resolution_rate": (resolved / len(insights) * 100) if insights else 0,
            "avg_churn_risk": round(avg_churn, 2)
        }


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def parse_summary_to_insight(call_id: str, summary: Dict, transcript_id: Optional[str] = None) -> InsightRecord:
    """
    Parse the JSON summary from summarizer agent into an InsightRecord.

    Args:
        call_id: UUID of the call
        summary: Raw JSON summary from the summarizer
        transcript_id: Optional UUID of the transcript

    Returns:
        InsightRecord ready for insertion
    """
    risk = summary.get("risk_signals", {})
    sentiment = summary.get("sentiment", {})
    outcome = summary.get("call_outcome", {})
    resolution = summary.get("resolution", {})

    return InsightRecord(
        call_id=call_id,
        transcript_id=transcript_id,

        # Risk signals
        churn_risk_score=risk.get("churn_risk_score"),
        deactivation_intent=risk.get("deactivation_intent", False),
        deactivation_confirmed=risk.get("deactivation_confirmed", False),
        refund_requested=risk.get("refund_requested", False),
        escalation_threatened=risk.get("escalation_threatened", False),
        legal_threat=risk.get("legal_threat", False),
        payment_dispute=risk.get("payment_dispute", False),
        competitor_mentioned=risk.get("competitor_mentioned"),

        # Sentiment
        sentiment_start=sentiment.get("customer_start"),
        sentiment_end=sentiment.get("customer_end"),
        sentiment_trajectory=sentiment.get("sentiment_trajectory"),
        executive_tone=sentiment.get("executive_tone"),

        # Call outcome
        call_purpose=outcome.get("primary_purpose"),
        purpose_fulfilled=outcome.get("was_purpose_fulfilled"),
        customer_satisfied=str(outcome.get("customer_satisfied")) if outcome.get("customer_satisfied") is not None else None,
        requires_escalation=outcome.get("requires_escalation", False),

        # Resolution
        resolution_status=resolution.get("status"),
        follow_up_required=resolution.get("follow_up_required", False),
        follow_up_owner=resolution.get("follow_up_owner"),
        follow_up_timeline=resolution.get("follow_up_timeline"),

        # JSON fields
        issues=summary.get("issues"),
        actions_taken=resolution.get("actions_taken"),
        promises_made=resolution.get("promises_made"),
        key_quotes=summary.get("key_quotes"),
        topics=summary.get("topics"),
        raw_summary=summary
    )


def init_supabase() -> SupabaseClient:
    """Initialize and return Supabase client."""
    return SupabaseClient()


# =============================================================================
# CLI for testing
# =============================================================================

if __name__ == "__main__":
    print("Testing Supabase connection...")

    try:
        client = init_supabase()
        print("✓ Connected to Supabase")

        # Test query
        stats = client.get_overview_stats()
        print(f"✓ Overview stats: {stats}")

    except Exception as e:
        print(f"✗ Error: {e}")
