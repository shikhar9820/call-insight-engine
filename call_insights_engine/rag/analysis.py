"""
Call Insights Analysis Module
Provides deep analysis of call data with business context
"""

import os
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import Counter
from dotenv import load_dotenv

load_dotenv()

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

# Import local RAG for SOP context
try:
    from .local_rag import LocalRAG
    RAG_AVAILABLE = True
except ImportError:
    RAG_AVAILABLE = False
    LocalRAG = None


@dataclass
class IssueAnalysis:
    """Analysis of a specific issue category."""
    category: str
    count: int
    percentage: float
    subcategories: Dict[str, int]
    sentiment_distribution: Dict[str, int]
    avg_churn_risk: float
    common_resolutions: List[str]
    escalation_rate: float


@dataclass
class ChurnRiskAnalysis:
    """Analysis of churn risk patterns."""
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    top_risk_factors: List[Dict[str, Any]]
    risk_by_issue: Dict[str, float]
    deactivation_intents: int


@dataclass
class TrendAnalysis:
    """Trend analysis over time."""
    period: str
    total_calls: int
    issue_trends: Dict[str, List[int]]
    sentiment_trend: Dict[str, List[int]]
    churn_risk_trend: List[float]


@dataclass
class BuyLeadAnalysis:
    """Specific analysis for BuyLead related issues."""
    total_buylead_issues: int
    issue_breakdown: Dict[str, int]
    relevance_complaints: int
    availability_complaints: int
    roi_complaints: int
    common_resolutions: List[str]
    sop_compliance_score: float


class CallInsightsAnalyzer:
    """
    Analyzer for call insights data with IndiaMART business context.

    Provides:
    - Issue category analysis
    - Churn risk analysis
    - BuyLead specific analysis
    - Trend analysis
    - SOP compliance checking
    """

    # Issue taxonomy based on SOPs
    ISSUE_TAXONOMY = {
        "buylead_quality": {
            "subcategories": ["spam_leads", "irrelevant_leads", "fake_leads", "wrong_region", "retail_leads"],
            "severity": "high",
            "sop_reference": "BuyLead SOP Issue 3"
        },
        "buylead_availability": {
            "subcategories": ["no_leads", "less_leads", "sold_out", "lapsed_leads"],
            "severity": "high",
            "sop_reference": "BuyLead SOP Issue 2"
        },
        "buylead_accessibility": {
            "subcategories": ["page_not_loading", "app_issue", "login_issue"],
            "severity": "medium",
            "sop_reference": "BuyLead SOP Issue 1"
        },
        "maturity_roi": {
            "subcategories": ["no_conversion", "buyer_not_responding", "buyer_denied", "low_roi"],
            "severity": "high",
            "sop_reference": "BuyLead SOP Issue 4"
        },
        "payment": {
            "subcategories": ["failed_payment", "refund_request", "emi_issue", "pricing_dispute"],
            "severity": "high",
            "sop_reference": "Ticket SOP - Deactivation"
        },
        "subscription": {
            "subcategories": ["upgrade_query", "renewal_issue", "deactivation_request", "package_change"],
            "severity": "high",
            "sop_reference": "Ticket SOP - Deactivation"
        },
        "pns": {
            "subcategories": ["calls_not_received", "spam_calls", "call_disconnection", "number_mapping"],
            "severity": "medium",
            "sop_reference": "Ticket SOP - PNS Issues"
        },
        "catalog": {
            "subcategories": ["product_mapping", "category_issue", "cqs_low", "products_rejected"],
            "severity": "medium",
            "sop_reference": "Seller Call Checklist - Catalog"
        },
        "technical": {
            "subcategories": ["app_crash", "website_issue", "notification_issue", "lms_issue"],
            "severity": "medium",
            "sop_reference": "Ticket SOP"
        },
        "employee": {
            "subcategories": ["am_not_responding", "misbehavior", "mis_commitment", "excessive_calls"],
            "severity": "high",
            "sop_reference": "Ticket SOP - Employee Issues"
        }
    }

    def __init__(self, supabase_url: str = None, supabase_key: str = None):
        """Initialize analyzer with database connection."""
        self.supabase_url = supabase_url or os.environ.get("SUPABASE_URL")
        self.supabase_key = supabase_key or os.environ.get("SUPABASE_KEY")
        self.supabase: Optional[Client] = None

        if SUPABASE_AVAILABLE and self.supabase_url and self.supabase_key:
            self.supabase = create_client(self.supabase_url, self.supabase_key)

        # Initialize Gemini for AI analysis
        self.model = None
        if GENAI_AVAILABLE:
            api_key = os.environ.get("GOOGLE_API_KEY")
            if api_key:
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel("gemini-2.0-flash-001")

        # Initialize RAG for SOP-based recommendations
        self.rag = None
        if RAG_AVAILABLE and LocalRAG:
            try:
                self.rag = LocalRAG()
                if self.rag.collection.count() > 0:
                    print("RAG initialized for SOP-based recommendations")
                else:
                    self.rag = None
                    print("RAG available but not indexed")
            except Exception as e:
                print(f"RAG initialization failed: {e}")

    def get_call_insights(
        self,
        limit: int = 1000,
        days_back: int = 30,
        filters: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """Fetch call insights from database."""
        if not self.supabase:
            return []

        try:
            query = self.supabase.table("call_insights").select(
                "*, calls(ucid, employee_name, company_name, call_start_time, call_duration_seconds)"
            )

            # Apply date filter
            if days_back:
                start_date = (datetime.now() - timedelta(days=days_back)).isoformat()
                query = query.gte("created_at", start_date)

            # Apply additional filters
            if filters:
                if filters.get("issue_category"):
                    query = query.contains("issues", [{"category": filters["issue_category"]}])
                if filters.get("churn_risk_min"):
                    query = query.gte("churn_risk_score", filters["churn_risk_min"])
                if filters.get("deactivation_intent"):
                    query = query.eq("deactivation_intent", True)

            response = query.limit(limit).order("created_at", desc=True).execute()
            return response.data if response.data else []

        except Exception as e:
            print(f"Error fetching insights: {e}")
            return []

    def analyze_issues(self, insights: List[Dict[str, Any]] = None) -> Dict[str, IssueAnalysis]:
        """Analyze issue distribution and patterns."""
        if insights is None:
            insights = self.get_call_insights()

        if not insights:
            return {}

        total_calls = len(insights)
        issue_counts = Counter()
        subcategory_counts = {}
        sentiment_by_issue = {}
        churn_by_issue = {}

        for insight in insights:
            issues = insight.get("issues", [])
            if isinstance(issues, list):
                for issue in issues:
                    if isinstance(issue, dict):
                        category = issue.get("category", "other")
                        subcategory = issue.get("subcategory", "unspecified")

                        issue_counts[category] += 1

                        if category not in subcategory_counts:
                            subcategory_counts[category] = Counter()
                        subcategory_counts[category][subcategory] += 1

                        if category not in sentiment_by_issue:
                            sentiment_by_issue[category] = Counter()
                        sentiment_by_issue[category][insight.get("sentiment_end", "neutral")] += 1

                        if category not in churn_by_issue:
                            churn_by_issue[category] = []
                        churn_by_issue[category].append(insight.get("churn_risk_score", 0) or 0)

        # Build analysis results
        results = {}
        for category, count in issue_counts.items():
            avg_churn = sum(churn_by_issue.get(category, [0])) / max(len(churn_by_issue.get(category, [1])), 1)

            results[category] = IssueAnalysis(
                category=category,
                count=count,
                percentage=round(count / total_calls * 100, 2) if total_calls else 0,
                subcategories=dict(subcategory_counts.get(category, {})),
                sentiment_distribution=dict(sentiment_by_issue.get(category, {})),
                avg_churn_risk=round(avg_churn, 3),
                common_resolutions=[],  # Would need to analyze from transcripts
                escalation_rate=0  # Would need escalation data
            )

        return results

    def analyze_churn_risk(self, insights: List[Dict[str, Any]] = None) -> ChurnRiskAnalysis:
        """Analyze churn risk patterns."""
        if insights is None:
            insights = self.get_call_insights()

        if not insights:
            return ChurnRiskAnalysis(0, 0, 0, [], {}, 0)

        high_risk = 0
        medium_risk = 0
        low_risk = 0
        deactivation_intents = 0
        risk_by_issue = {}

        for insight in insights:
            churn_score = insight.get("churn_risk_score", 0) or 0

            if churn_score >= 0.7:
                high_risk += 1
            elif churn_score >= 0.4:
                medium_risk += 1
            else:
                low_risk += 1

            if insight.get("deactivation_intent"):
                deactivation_intents += 1

            # Track risk by issue
            issues = insight.get("issues", [])
            if isinstance(issues, list):
                for issue in issues:
                    if isinstance(issue, dict):
                        category = issue.get("category", "other")
                        if category not in risk_by_issue:
                            risk_by_issue[category] = []
                        risk_by_issue[category].append(churn_score)

        # Calculate average risk per issue
        avg_risk_by_issue = {
            cat: round(sum(scores) / len(scores), 3)
            for cat, scores in risk_by_issue.items()
            if scores
        }

        # Sort by risk
        sorted_risk = sorted(avg_risk_by_issue.items(), key=lambda x: x[1], reverse=True)

        return ChurnRiskAnalysis(
            high_risk_count=high_risk,
            medium_risk_count=medium_risk,
            low_risk_count=low_risk,
            top_risk_factors=[{"issue": k, "avg_risk": v} for k, v in sorted_risk[:5]],
            risk_by_issue=avg_risk_by_issue,
            deactivation_intents=deactivation_intents
        )

    def analyze_buylead_issues(self, insights: List[Dict[str, Any]] = None) -> BuyLeadAnalysis:
        """Specific analysis for BuyLead related issues (80% of issues)."""
        if insights is None:
            insights = self.get_call_insights()

        buylead_categories = ["buylead_quality", "buylead_availability", "buylead_accessibility", "maturity_roi"]

        total_buylead = 0
        breakdown = Counter()
        relevance = 0
        availability = 0
        roi = 0

        for insight in insights:
            issues = insight.get("issues", [])
            if isinstance(issues, list):
                for issue in issues:
                    if isinstance(issue, dict):
                        category = issue.get("category", "")
                        subcategory = issue.get("subcategory", "")

                        if category in buylead_categories:
                            total_buylead += 1
                            breakdown[category] += 1

                            if category == "buylead_quality" or subcategory in ["irrelevant_leads", "spam_leads"]:
                                relevance += 1
                            if category == "buylead_availability" or subcategory in ["no_leads", "less_leads", "sold_out"]:
                                availability += 1
                            if category == "maturity_roi" or subcategory in ["no_conversion", "low_roi"]:
                                roi += 1

        return BuyLeadAnalysis(
            total_buylead_issues=total_buylead,
            issue_breakdown=dict(breakdown),
            relevance_complaints=relevance,
            availability_complaints=availability,
            roi_complaints=roi,
            common_resolutions=[
                "Check product/category mapping",
                "Expand location preferences",
                "Adjust ISQ filters",
                "Enable notifications",
                "Educate on quick BL consumption"
            ],
            sop_compliance_score=0.0  # Would need to analyze against SOP steps
        )

    def generate_summary_report(self, days_back: int = 30) -> Dict[str, Any]:
        """Generate a comprehensive summary report."""
        insights = self.get_call_insights(days_back=days_back)

        if not insights:
            return {"error": "No data available"}

        issue_analysis = self.analyze_issues(insights)
        churn_analysis = self.analyze_churn_risk(insights)
        buylead_analysis = self.analyze_buylead_issues(insights)

        # Calculate sentiment distribution
        sentiment_counts = Counter()
        for insight in insights:
            sentiment_counts[insight.get("sentiment_end", "neutral")] += 1

        report = {
            "period": f"Last {days_back} days",
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_calls_analyzed": len(insights),
                "high_risk_calls": churn_analysis.high_risk_count,
                "deactivation_intents": churn_analysis.deactivation_intents,
                "buylead_issues_percentage": round(
                    buylead_analysis.total_buylead_issues / max(len(insights), 1) * 100, 1
                )
            },
            "sentiment_distribution": dict(sentiment_counts),
            "churn_risk": {
                "high": churn_analysis.high_risk_count,
                "medium": churn_analysis.medium_risk_count,
                "low": churn_analysis.low_risk_count,
                "top_risk_factors": churn_analysis.top_risk_factors
            },
            "issue_breakdown": {
                cat: {
                    "count": analysis.count,
                    "percentage": analysis.percentage,
                    "avg_churn_risk": analysis.avg_churn_risk
                }
                for cat, analysis in issue_analysis.items()
            },
            "buylead_analysis": {
                "total_issues": buylead_analysis.total_buylead_issues,
                "relevance_complaints": buylead_analysis.relevance_complaints,
                "availability_complaints": buylead_analysis.availability_complaints,
                "roi_complaints": buylead_analysis.roi_complaints,
                "breakdown": buylead_analysis.issue_breakdown
            },
            "recommendations": self._generate_recommendations(
                issue_analysis, churn_analysis, buylead_analysis
            )
        }

        return report

    def get_sop_recommendation(self, issue_category: str) -> str:
        """Get SOP-based recommendation for an issue category using RAG."""
        if not self.rag:
            # Fallback to static recommendations
            taxonomy = self.ISSUE_TAXONOMY.get(issue_category, {})
            return taxonomy.get('sop_reference', 'See general SOP')

        try:
            query = f"What are the key resolution steps for {issue_category} issues?"
            return self.rag.ask(query)
        except Exception as e:
            return f"SOP lookup failed: {e}"

    def _generate_recommendations(
        self,
        issue_analysis: Dict[str, IssueAnalysis],
        churn_analysis: ChurnRiskAnalysis,
        buylead_analysis: BuyLeadAnalysis
    ) -> List[str]:
        """Generate actionable recommendations based on analysis."""
        recommendations = []

        # High churn risk
        if churn_analysis.high_risk_count > 0:
            rec = f"URGENT: {churn_analysis.high_risk_count} high-risk calls detected. Prioritize follow-up on these accounts."
            if self.rag:
                sop_context = self.rag.search("high churn risk customer retention", top_k=1)
                if sop_context:
                    rec += f" SOP: {sop_context[0].text[:200]}..."
            recommendations.append(rec)

        # Deactivation intents
        if churn_analysis.deactivation_intents > 0:
            rec = f"CRITICAL: {churn_analysis.deactivation_intents} deactivation intents identified."
            if self.rag:
                sop_context = self.rag.search("deactivation process retention", top_k=1)
                if sop_context:
                    rec += f" Follow SOP: L1→L2→L3 escalation, max 7 days retention attempt."
                else:
                    rec += " Follow deactivation SOP - attempt retention before processing."
            else:
                rec += " Follow deactivation SOP - attempt retention before processing."
            recommendations.append(rec)

        # BuyLead relevance issues
        if buylead_analysis.relevance_complaints > 10:
            rec = f"BuyLead relevance is a major concern ({buylead_analysis.relevance_complaints} complaints)."
            if self.rag:
                sop_context = self.rag.search("buylead relevance product mapping", top_k=1)
                if sop_context:
                    rec += f" SOP Focus: Check product/category mapping, promote BLNI marking, adjust filters."
                else:
                    rec += " Focus on: Product mapping corrections, BLNI education, filter optimization."
            else:
                rec += " Focus on: Product mapping corrections, BLNI education, filter optimization."
            recommendations.append(rec)

        # BuyLead availability
        if buylead_analysis.availability_complaints > 10:
            rec = f"BuyLead availability issues ({buylead_analysis.availability_complaints} complaints)."
            if self.rag:
                rec += " SOP: Check category demand, enable notifications, expand product portfolio."
            else:
                rec += " Educate sellers on: Active consumption, notification settings, category expansion."
            recommendations.append(rec)

        # ROI/Maturity issues
        if buylead_analysis.roi_complaints > 10:
            rec = f"ROI/Maturity concerns high ({buylead_analysis.roi_complaints} complaints)."
            if self.rag:
                rec += " SOP: Verify lead relevance, educate on quick response, check competitive pricing."
            else:
                rec += " Focus on: Quick response education, competitive pricing, follow-up best practices."
            recommendations.append(rec)

        # Top issue categories with SOP references
        if issue_analysis:
            top_issues = sorted(
                issue_analysis.items(),
                key=lambda x: x[1].count,
                reverse=True
            )[:3]

            for cat, analysis in top_issues:
                if analysis.avg_churn_risk > 0.5:
                    sop_ref = self.ISSUE_TAXONOMY.get(cat, {}).get('sop_reference', 'SOP')
                    recommendations.append(
                        f"High-risk category '{cat}' ({analysis.count} issues, "
                        f"{analysis.avg_churn_risk:.1%} avg churn risk). "
                        f"Reference: {sop_ref}"
                    )

        return recommendations

    def ai_analyze(self, query: str, data: Dict[str, Any] = None) -> str:
        """Use AI to analyze data and answer questions."""
        if not self.model:
            return "AI model not available"

        if data is None:
            data = self.generate_summary_report()

        prompt = f"""You are an IndiaMART customer service analyst. Analyze the following data and answer the question.

Data Summary:
{data}

Question: {query}

Provide specific, actionable insights based on the data.
"""

        try:
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            return f"Error generating analysis: {e}"


def run_analysis():
    """Run analysis and print report."""
    analyzer = CallInsightsAnalyzer()

    print("=" * 60)
    print("IndiaMART Call Insights Analysis Report")
    print("=" * 60)

    report = analyzer.generate_summary_report(days_back=30)

    import json
    print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    run_analysis()
