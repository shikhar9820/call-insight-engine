# Fast RAG Enrichment - Uses existing analysis, just adds SOP recommendations
# Much faster - no Gemini API calls needed

import sys
import os
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
sys.stdout.reconfigure(encoding='utf-8')


def fast_enrich():
    """Fast enrichment using existing data + Suggestion RAG only."""
    print("\n" + "="*60)
    print("FAST RAG ENRICHMENT (Using existing analysis)")
    print("="*60)

    # Initialize
    from database.supabase_client import SupabaseClient
    db = SupabaseClient()
    print("Connected to Supabase!")

    from rag.dual_rag import dual_rag, get_sop_recommendations
    print(f"Suggestion RAG ready: {dual_rag.suggestion_collection.count()} docs")

    # Get all insights with raw_summary
    print("\nFetching existing insights...")
    result = db.client.table("call_insights").select(
        "id, call_id, raw_summary, churn_risk_score, deactivation_intent"
    ).execute()

    insights = result.data or []
    print(f"Found {len(insights)} insights to enrich")

    updated = 0
    start = datetime.now()

    for idx, insight in enumerate(insights):
        try:
            raw_summary = insight.get('raw_summary')
            if not raw_summary:
                continue

            # Parse raw_summary if string
            if isinstance(raw_summary, str):
                raw_summary = json.loads(raw_summary)

            issues = raw_summary.get('issues', [])
            if not issues:
                continue

            # Get SOP recommendations from Suggestion RAG
            sop_recs = get_sop_recommendations(issues)

            # Add SOP alert for high-risk
            churn_risk = insight.get('churn_risk_score', 0) or 0
            deact_intent = insight.get('deactivation_intent', False)

            sop_alert = None
            if deact_intent or churn_risk > 0.7:
                sop_alert = {
                    "level": "high",
                    "message": "High churn risk. Follow Deactivation SOP - retention first.",
                    "reference": "Ticket SOP - Deactivation"
                }

            # Update raw_summary with SOP data
            raw_summary['sop_recommendations'] = sop_recs
            if sop_alert:
                raw_summary['sop_alert'] = sop_alert

            # Update database
            db.client.table("call_insights").update({
                "raw_summary": json.dumps(raw_summary)
            }).eq("id", insight['id']).execute()

            updated += 1

            if (idx + 1) % 50 == 0:
                elapsed = (datetime.now() - start).total_seconds()
                print(f"  Progress: {idx+1}/{len(insights)} ({updated} enriched) - {elapsed:.0f}s")

        except Exception as e:
            print(f"  Error on {insight['id'][:8]}: {e}")

    elapsed = (datetime.now() - start).total_seconds()
    print(f"\n{'='*60}")
    print(f"ENRICHMENT COMPLETE")
    print(f"  Total: {len(insights)}")
    print(f"  Enriched: {updated}")
    print(f"  Time: {elapsed:.1f}s ({elapsed/60:.1f} min)")


if __name__ == "__main__":
    fast_enrich()
