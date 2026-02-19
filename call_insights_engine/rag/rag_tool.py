"""
RAG Tool for Agent Integration
Provides a callable tool for Gemini agents to query the knowledge base
"""

import os
from typing import Dict, Any, Optional
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Import local RAG
from .local_rag import LocalRAG


class RAGTool:
    """
    RAG Tool wrapper for agent integration.

    Can be used by:
    - Summarizer agent for SOP context
    - Validator agent for compliance checking
    - Analysis module for recommendations
    """

    _instance: Optional['RAGTool'] = None
    _rag: Optional[LocalRAG] = None

    def __new__(cls):
        """Singleton pattern to reuse RAG instance."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize RAG tool."""
        if RAGTool._rag is None:
            try:
                RAGTool._rag = LocalRAG()
                print("RAG Tool initialized")
            except Exception as e:
                print(f"Warning: Could not initialize RAG: {e}")
                RAGTool._rag = None

    @property
    def is_available(self) -> bool:
        """Check if RAG is available."""
        return RAGTool._rag is not None and RAGTool._rag.collection.count() > 0

    def get_sop_context(self, issue_category: str) -> str:
        """
        Get SOP context for a specific issue category.

        Args:
            issue_category: The type of issue (e.g., "buylead_relevance", "deactivation")

        Returns:
            Relevant SOP context as string
        """
        if not self.is_available:
            return ""

        query = f"What is the SOP for handling {issue_category} issues? Include resolution steps."
        results = RAGTool._rag.search(query, top_k=3)

        if not results:
            return ""

        context_parts = []
        for r in results:
            context_parts.append(f"[{r.source}]\n{r.text}")

        return "\n\n---\n\n".join(context_parts)

    def get_resolution_steps(self, issue_description: str) -> str:
        """
        Get resolution steps for a described issue.

        Args:
            issue_description: Description of the customer issue

        Returns:
            Relevant resolution steps
        """
        if not self.is_available:
            return ""

        query = f"How to resolve this customer issue: {issue_description}"
        return RAGTool._rag.ask(query)

    def check_sop_compliance(self, actions_taken: list, issue_category: str) -> Dict[str, Any]:
        """
        Check if actions taken comply with SOP.

        Args:
            actions_taken: List of actions the executive took
            issue_category: The category of issue

        Returns:
            Compliance assessment
        """
        if not self.is_available:
            return {"compliant": None, "reason": "RAG not available"}

        # Get SOP for this issue
        sop_context = self.get_sop_context(issue_category)

        if not sop_context:
            return {"compliant": None, "reason": "No SOP found for this issue"}

        # Use Gemini to check compliance
        prompt = f"""Compare the actions taken by the executive against the SOP.

SOP FOR {issue_category.upper()}:
{sop_context}

ACTIONS TAKEN BY EXECUTIVE:
{chr(10).join(f'- {action}' for action in actions_taken)}

Analyze:
1. Were the correct SOP steps followed?
2. Were any critical steps missed?
3. Overall compliance score (0-100)

Respond in this format:
COMPLIANCE_SCORE: [0-100]
STEPS_FOLLOWED: [list of correct steps]
STEPS_MISSED: [list of missed steps]
ASSESSMENT: [brief assessment]
"""

        try:
            answer = RAGTool._rag.ask(prompt)

            # Parse response (simplified)
            compliance_score = 50  # Default
            if "COMPLIANCE_SCORE:" in answer:
                try:
                    score_line = [l for l in answer.split('\n') if 'COMPLIANCE_SCORE:' in l][0]
                    compliance_score = int(''.join(filter(str.isdigit, score_line.split(':')[1][:5])))
                except:
                    pass

            return {
                "compliant": compliance_score >= 70,
                "score": compliance_score,
                "assessment": answer,
                "sop_reference": issue_category
            }
        except Exception as e:
            return {"compliant": None, "reason": f"Error: {str(e)}"}

    def enrich_summary(self, summary: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enrich a call summary with SOP context and recommendations.

        Args:
            summary: The call summary from summarizer agent

        Returns:
            Enriched summary with SOP references
        """
        if not self.is_available:
            return summary

        enriched = summary.copy()

        # Get issues from summary
        issues = summary.get("issues", [])

        if not issues:
            return enriched

        # Add SOP recommendations for each issue
        sop_recommendations = []
        for issue in issues:
            if isinstance(issue, dict):
                category = issue.get("category", "other")

                # Get relevant SOP
                sop_context = self.get_sop_context(category)

                if sop_context:
                    sop_recommendations.append({
                        "issue_category": category,
                        "sop_guidance": sop_context[:500] + "..." if len(sop_context) > 500 else sop_context,
                        "reference": f"See {category} SOP"
                    })

        enriched["sop_recommendations"] = sop_recommendations

        # Check if follow-up is needed based on SOP
        risk_signals = summary.get("risk_signals", {})
        if risk_signals.get("deactivation_intent") or risk_signals.get("churn_risk_score", 0) > 0.7:
            enriched["sop_alert"] = {
                "level": "high",
                "message": "High churn risk detected. Follow Deactivation SOP - attempt retention before processing.",
                "reference": "Ticket SOP - Deactivation"
            }

        return enriched

    def get_classification_context(self, transcript_keywords: str) -> str:
        """
        Get classification context from RAG to help improve issue categorization.

        This method is called BEFORE analysis to provide the LLM with:
        1. Category definitions from knowledge base
        2. Relevant SOP context based on transcript keywords

        Args:
            transcript_keywords: Key phrases from the transcript (first 500 chars or extracted keywords)

        Returns:
            Context string to include in analysis prompt
        """
        if not self.is_available:
            return ""

        context_parts = []

        # 1. Get category definitions
        cat_results = RAGTool._rag.search("issue category definitions classification guide", top_k=2)
        if cat_results:
            context_parts.append("## CATEGORY CLASSIFICATION GUIDE:")
            for r in cat_results:
                context_parts.append(r.text[:1000])

        # 2. Get relevant SOP based on transcript keywords
        keyword_results = RAGTool._rag.search(f"SOP procedure for: {transcript_keywords[:300]}", top_k=2)
        if keyword_results:
            context_parts.append("\n## RELEVANT SOP CONTEXT:")
            for r in keyword_results:
                context_parts.append(f"[{r.source}]\n{r.text[:500]}")

        return "\n\n".join(context_parts)

    def search(self, query: str, top_k: int = 5) -> list:
        """Direct search in knowledge base."""
        if not self.is_available:
            return []
        return RAGTool._rag.search(query, top_k)

    def ask(self, question: str) -> str:
        """Direct question to knowledge base."""
        if not self.is_available:
            return "RAG not available"
        return RAGTool._rag.ask(question)


# Singleton instance
rag_tool = RAGTool()


def get_sop_context(issue_category: str) -> str:
    """Convenience function for getting SOP context."""
    return rag_tool.get_sop_context(issue_category)


def enrich_call_summary(summary: Dict[str, Any]) -> Dict[str, Any]:
    """Convenience function for enriching summaries."""
    return rag_tool.enrich_summary(summary)


def check_compliance(actions: list, issue: str) -> Dict[str, Any]:
    """Convenience function for compliance checking."""
    return rag_tool.check_sop_compliance(actions, issue)


def get_classification_context(transcript_keywords: str) -> str:
    """Convenience function for getting classification context before analysis."""
    return rag_tool.get_classification_context(transcript_keywords)
