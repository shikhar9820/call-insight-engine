"""
RAG Client for Call Insights Engine
Provides natural language querying of the knowledge base and call insights
"""

import os
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

# Try to import Vertex AI
try:
    import vertexai
    from vertexai.preview import rag
    from vertexai.generative_models import GenerativeModel, Part
    VERTEX_AI_AVAILABLE = True
except ImportError:
    VERTEX_AI_AVAILABLE = False

# Try to import Google Generative AI (fallback)
try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

# Try to import Supabase
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False


@dataclass
class RetrievalResult:
    """Result from RAG retrieval."""
    text: str
    source: str
    score: float
    metadata: Dict[str, Any] = None


@dataclass
class QueryResponse:
    """Response from RAG query."""
    query: str
    answer: str
    contexts: List[RetrievalResult]
    sources: List[str]


class RAGClient:
    """
    Client for querying the IndiaMART Call Insights RAG system.

    Supports:
    - Knowledge base queries (SOPs, product info, etc.)
    - Call transcript search
    - Combined contextual queries
    """

    def __init__(
        self,
        project_id: str = None,
        location: str = None,
        corpus_name: str = None,
        supabase_url: str = None,
        supabase_key: str = None,
    ):
        """Initialize RAG client with configuration."""
        self.project_id = project_id or os.environ.get("GOOGLE_CLOUD_PROJECT", "hackathon-techsas")
        self.location = location or os.environ.get("GOOGLE_CLOUD_LOCATION", "asia-south1")
        self.corpus_name = corpus_name or os.environ.get("RAG_CORPUS")
        self.supabase_url = supabase_url or os.environ.get("SUPABASE_URL")
        self.supabase_key = supabase_key or os.environ.get("SUPABASE_KEY")

        # Initialize clients
        self._init_vertex_ai()
        self._init_supabase()
        self._init_generative_model()

    def _init_vertex_ai(self):
        """Initialize Vertex AI."""
        self.vertex_ai_ready = False
        if VERTEX_AI_AVAILABLE and self.corpus_name:
            try:
                vertexai.init(project=self.project_id, location=self.location)
                self.vertex_ai_ready = True
                print(f"Vertex AI initialized with corpus: {self.corpus_name}")
            except Exception as e:
                print(f"Warning: Could not initialize Vertex AI: {e}")

    def _init_supabase(self):
        """Initialize Supabase client."""
        self.supabase: Optional[Client] = None
        if SUPABASE_AVAILABLE and self.supabase_url and self.supabase_key:
            try:
                self.supabase = create_client(self.supabase_url, self.supabase_key)
                print("Supabase client initialized")
            except Exception as e:
                print(f"Warning: Could not initialize Supabase: {e}")

    def _init_generative_model(self):
        """Initialize generative model for answer synthesis."""
        self.model = None

        # Try Vertex AI Generative Model first
        if VERTEX_AI_AVAILABLE and self.vertex_ai_ready:
            try:
                self.model = GenerativeModel("gemini-2.0-flash-001")
                self.model_type = "vertex"
                print("Using Vertex AI Generative Model")
                return
            except Exception as e:
                print(f"Could not init Vertex AI model: {e}")

        # Fallback to Google Generative AI
        if GENAI_AVAILABLE:
            api_key = os.environ.get("GOOGLE_API_KEY")
            if api_key:
                try:
                    genai.configure(api_key=api_key)
                    self.model = genai.GenerativeModel("gemini-2.0-flash-001")
                    self.model_type = "genai"
                    print("Using Google Generative AI")
                except Exception as e:
                    print(f"Could not init GenAI model: {e}")

    def retrieve_from_corpus(
        self,
        query: str,
        top_k: int = 5,
        distance_threshold: float = 0.5
    ) -> List[RetrievalResult]:
        """Retrieve relevant contexts from the RAG corpus."""
        if not self.vertex_ai_ready or not self.corpus_name:
            return []

        try:
            response = rag.retrieval_query(
                rag_resources=[
                    rag.RagResource(rag_corpus=self.corpus_name)
                ],
                text=query,
                similarity_top_k=top_k,
                vector_distance_threshold=distance_threshold,
            )

            results = []
            for ctx in response.contexts.contexts:
                results.append(RetrievalResult(
                    text=ctx.text,
                    source=getattr(ctx, 'source_uri', 'knowledge_base'),
                    score=getattr(ctx, 'distance', 0.0),
                    metadata={}
                ))
            return results

        except Exception as e:
            print(f"Retrieval error: {e}")
            return []

    def search_call_transcripts(
        self,
        query: str,
        limit: int = 10,
        filters: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """Search call transcripts in Supabase."""
        if not self.supabase:
            return []

        try:
            # Build query
            db_query = self.supabase.table("call_transcripts").select(
                "*, calls(*), call_insights(*)"
            )

            # Apply text search on transcript and translation
            if query:
                db_query = db_query.or_(
                    f"transcript.ilike.%{query}%,translation.ilike.%{query}%"
                )

            # Apply filters
            if filters:
                if filters.get("churn_risk_min"):
                    db_query = db_query.gte(
                        "call_insights.churn_risk_score",
                        filters["churn_risk_min"]
                    )
                if filters.get("sentiment"):
                    db_query = db_query.eq(
                        "call_insights.sentiment_end",
                        filters["sentiment"]
                    )
                if filters.get("issue_category"):
                    db_query = db_query.contains(
                        "call_insights.issues",
                        [{"category": filters["issue_category"]}]
                    )

            # Execute
            response = db_query.limit(limit).execute()
            return response.data if response.data else []

        except Exception as e:
            print(f"Transcript search error: {e}")
            return []

    def search_call_insights(
        self,
        issue_category: str = None,
        churn_risk_min: float = None,
        sentiment: str = None,
        deactivation_intent: bool = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Search call insights with filters."""
        if not self.supabase:
            return []

        try:
            query = self.supabase.table("call_insights").select(
                "*, calls(ucid, employee_name, company_name, call_start_time)"
            )

            if issue_category:
                query = query.contains("issues", [{"category": issue_category}])
            if churn_risk_min is not None:
                query = query.gte("churn_risk_score", churn_risk_min)
            if sentiment:
                query = query.eq("sentiment_end", sentiment)
            if deactivation_intent is not None:
                query = query.eq("deactivation_intent", deactivation_intent)

            response = query.limit(limit).order("created_at", desc=True).execute()
            return response.data if response.data else []

        except Exception as e:
            print(f"Insights search error: {e}")
            return []

    def generate_answer(
        self,
        query: str,
        contexts: List[RetrievalResult],
        call_data: List[Dict[str, Any]] = None
    ) -> str:
        """Generate an answer using retrieved contexts."""
        if not self.model:
            return "Model not available for answer generation."

        # Build context string
        context_text = "\n\n".join([
            f"[Source: {ctx.source}]\n{ctx.text}"
            for ctx in contexts
        ])

        # Add call data if available
        call_context = ""
        if call_data:
            call_context = "\n\nRelevant Call Data:\n"
            for call in call_data[:5]:  # Limit to 5 calls
                call_context += f"- Call ID: {call.get('call_id', 'N/A')}\n"
                if 'call_insights' in call:
                    insights = call['call_insights']
                    call_context += f"  Issues: {insights.get('issues', [])}\n"
                    call_context += f"  Sentiment: {insights.get('sentiment_end', 'N/A')}\n"

        # Build prompt
        prompt = f"""You are an IndiaMART customer service expert. Answer the following question based on the provided context.

Context from Knowledge Base:
{context_text}
{call_context}

Question: {query}

Provide a clear, actionable answer based on the context. If the context doesn't contain enough information, say so.
"""

        try:
            if self.model_type == "vertex":
                response = self.model.generate_content(prompt)
                return response.text
            else:  # genai
                response = self.model.generate_content(prompt)
                return response.text
        except Exception as e:
            return f"Error generating answer: {e}"

    def query(
        self,
        query: str,
        include_call_data: bool = True,
        top_k: int = 5
    ) -> QueryResponse:
        """
        Main query method - retrieves context and generates answer.

        Args:
            query: Natural language question
            include_call_data: Whether to search call transcripts
            top_k: Number of contexts to retrieve

        Returns:
            QueryResponse with answer and sources
        """
        # Retrieve from knowledge base
        contexts = self.retrieve_from_corpus(query, top_k=top_k)

        # Search call data if requested
        call_data = []
        if include_call_data:
            call_data = self.search_call_transcripts(query, limit=5)

        # Generate answer
        answer = self.generate_answer(query, contexts, call_data)

        # Collect sources
        sources = list(set([ctx.source for ctx in contexts]))
        if call_data:
            sources.append(f"call_transcripts ({len(call_data)} calls)")

        return QueryResponse(
            query=query,
            answer=answer,
            contexts=contexts,
            sources=sources
        )

    def ask(self, question: str) -> str:
        """Simple ask method - returns just the answer string."""
        response = self.query(question)
        return response.answer

    # Convenience methods for common queries

    def get_sop_for_issue(self, issue_type: str) -> str:
        """Get SOP guidance for a specific issue type."""
        query = f"What is the SOP for handling {issue_type} issues? Provide step-by-step resolution."
        return self.ask(query)

    def get_package_info(self, package_name: str) -> str:
        """Get information about a specific package."""
        query = f"What are the features and benefits of {package_name} package?"
        return self.ask(query)

    def analyze_issue_pattern(self, issue_category: str) -> Dict[str, Any]:
        """Analyze patterns for a specific issue category."""
        # Get relevant calls
        calls = self.search_call_insights(issue_category=issue_category, limit=50)

        # Get SOP context
        sop_query = f"How to handle {issue_category} issues according to SOP?"
        contexts = self.retrieve_from_corpus(sop_query, top_k=3)

        # Generate analysis
        analysis_prompt = f"""Analyze the following call data for {issue_category} issues:

Number of calls: {len(calls)}
Sample issues: {[c.get('issues', []) for c in calls[:5]]}

SOP Context:
{chr(10).join([ctx.text[:500] for ctx in contexts])}

Provide:
1. Common patterns observed
2. Recommended actions
3. SOP compliance assessment
"""

        analysis = self.generate_answer(analysis_prompt, contexts, calls)

        return {
            "issue_category": issue_category,
            "call_count": len(calls),
            "analysis": analysis,
            "sample_calls": calls[:5]
        }


# Standalone query function for simple usage
def query_knowledge_base(question: str) -> str:
    """Simple function to query the knowledge base."""
    client = RAGClient()
    return client.ask(question)


if __name__ == "__main__":
    import sys

    client = RAGClient()

    if len(sys.argv) > 1:
        question = " ".join(sys.argv[1:])
    else:
        question = "What is a BuyLead and how does the allocation work?"

    print(f"\nQuestion: {question}\n")
    print("-" * 50)

    response = client.query(question)

    print(f"\nAnswer:\n{response.answer}")
    print(f"\nSources: {response.sources}")
