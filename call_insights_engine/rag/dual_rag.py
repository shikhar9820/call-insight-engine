"""
Dual RAG System - Separate RAGs for Classification and Suggestions
- Classification RAG: Category mapping, keywords, examples
- Suggestion RAG: SOPs, procedures, resolution steps
"""

import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

# ChromaDB imports
try:
    import chromadb
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False

# Google Generative AI
try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


@dataclass
class SearchResult:
    """Result from RAG search."""
    text: str
    source: str
    score: float
    metadata: Dict[str, Any]
    rag_type: str  # 'classification' or 'suggestion'


class DualRAG:
    """
    Dual RAG system with separate indexes for:
    1. Classification: Category definitions, mapping rules, examples
    2. Suggestions: SOPs, procedures, resolution steps
    """

    _instance: Optional['DualRAG'] = None

    def __new__(cls):
        """Singleton pattern."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        """Initialize dual RAG system."""
        if self._initialized:
            return

        self.api_key = os.environ.get("GOOGLE_API_KEY")
        self.base_dir = Path(__file__).parent.parent
        self.persist_dir = self.base_dir / "chroma_db_dual"

        # Knowledge base directories
        self.classification_kb = self.base_dir / "knowledge_base" / "classification"
        self.suggestion_kb = self.base_dir / "knowledge_base" / "suggestions"

        # Initialize components
        self._init_chromadb()
        self._init_genai()
        self._initialized = True

    def _init_chromadb(self):
        """Initialize ChromaDB with two collections."""
        if not CHROMADB_AVAILABLE:
            raise RuntimeError("ChromaDB not available")

        self.client = chromadb.PersistentClient(path=str(self.persist_dir))

        # Classification collection
        self.classification_collection = self.client.get_or_create_collection(
            name="classification_rag",
            metadata={"description": "Category mapping, keywords, classification rules"}
        )

        # Suggestion collection
        self.suggestion_collection = self.client.get_or_create_collection(
            name="suggestion_rag",
            metadata={"description": "SOPs, procedures, resolution steps"}
        )

        print(f"DualRAG initialized:")
        print(f"  Classification: {self.classification_collection.count()} docs")
        print(f"  Suggestions: {self.suggestion_collection.count()} docs")

    def _init_genai(self):
        """Initialize Gemini."""
        self.model = None
        if GENAI_AVAILABLE and self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel("gemini-2.0-flash-001")

    def _get_embedding(self, text: str) -> List[float]:
        """Get embedding for text."""
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=text,
            task_type="retrieval_document"
        )
        return result['embedding']

    def _get_query_embedding(self, text: str) -> List[float]:
        """Get embedding for query."""
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=text,
            task_type="retrieval_query"
        )
        return result['embedding']

    def _chunk_text(self, text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
        """Split text into overlapping chunks."""
        chunks = []
        lines = text.split('\n')
        current_chunk = []
        current_size = 0

        for line in lines:
            line_size = len(line)

            if current_size + line_size > chunk_size and current_chunk:
                chunks.append('\n'.join(current_chunk))

                overlap_lines = []
                overlap_size = 0
                for prev_line in reversed(current_chunk):
                    if overlap_size + len(prev_line) <= overlap:
                        overlap_lines.insert(0, prev_line)
                        overlap_size += len(prev_line)
                    else:
                        break

                current_chunk = overlap_lines
                current_size = overlap_size

            current_chunk.append(line)
            current_size += line_size

        if current_chunk:
            chunks.append('\n'.join(current_chunk))

        return chunks

    def index_all(self, force: bool = False) -> Dict[str, Any]:
        """Index both knowledge bases."""
        stats = {
            "classification": self._index_directory(
                self.classification_kb,
                self.classification_collection,
                "classification",
                force
            ),
            "suggestion": self._index_directory(
                self.suggestion_kb,
                self.suggestion_collection,
                "suggestion",
                force
            )
        }
        return stats

    def _index_directory(
        self,
        directory: Path,
        collection,
        rag_type: str,
        force: bool = False
    ) -> Dict[str, Any]:
        """Index a directory into a collection."""
        stats = {"files": 0, "chunks": 0, "errors": []}

        if not directory.exists():
            print(f"Warning: {directory} not found")
            return stats

        txt_files = list(directory.glob("*.txt"))
        print(f"\nIndexing {rag_type} RAG: {len(txt_files)} files in {directory.name}/")

        if force:
            # Clear collection
            try:
                self.client.delete_collection(collection.name)
                collection = self.client.create_collection(
                    name=collection.name,
                    metadata=collection.metadata
                )
                if rag_type == "classification":
                    self.classification_collection = collection
                else:
                    self.suggestion_collection = collection
            except:
                pass

        for file_path in txt_files:
            try:
                content = file_path.read_text(encoding='utf-8')
                chunks = self._chunk_text(content)

                print(f"  {file_path.name}: {len(chunks)} chunks")

                for i, chunk in enumerate(chunks):
                    chunk_id = f"{rag_type}_{file_path.stem}_{i}"

                    # Check if exists
                    existing = collection.get(ids=[chunk_id])
                    if existing['ids']:
                        continue

                    embedding = self._get_embedding(chunk)

                    collection.add(
                        ids=[chunk_id],
                        embeddings=[embedding],
                        documents=[chunk],
                        metadatas=[{
                            "source_file": file_path.stem,
                            "source_name": file_path.name,
                            "chunk_index": i,
                            "rag_type": rag_type
                        }]
                    )
                    stats["chunks"] += 1

                stats["files"] += 1

            except Exception as e:
                stats["errors"].append(f"{file_path.name}: {e}")

        print(f"  Total: {stats['chunks']} new chunks indexed")
        return stats

    def search_classification(self, query: str, top_k: int = 3) -> List[SearchResult]:
        """
        Search classification RAG for category mapping context.

        Use this BEFORE analysis to get:
        - Category definitions
        - Mapping rules
        - Classification examples
        """
        return self._search(self.classification_collection, query, top_k, "classification")

    def search_suggestions(self, query: str, top_k: int = 3) -> List[SearchResult]:
        """
        Search suggestion RAG for SOP recommendations.

        Use this AFTER analysis to get:
        - SOP procedures
        - Resolution steps
        - Escalation paths
        """
        return self._search(self.suggestion_collection, query, top_k, "suggestion")

    def _search(self, collection, query: str, top_k: int, rag_type: str) -> List[SearchResult]:
        """Internal search method."""
        if collection.count() == 0:
            return []

        query_embedding = self._get_query_embedding(query)

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"]
        )

        search_results = []
        if results and results['ids'] and results['ids'][0]:
            for i, doc_id in enumerate(results['ids'][0]):
                search_results.append(SearchResult(
                    text=results['documents'][0][i],
                    source=results['metadatas'][0][i].get('source_name', 'unknown'),
                    score=1 - results['distances'][0][i],
                    metadata=results['metadatas'][0][i],
                    rag_type=rag_type
                ))

        return search_results

    def get_classification_context(self, transcript_snippet: str) -> str:
        """
        Get classification context for better issue mapping.

        Args:
            transcript_snippet: First 500 chars of transcript

        Returns:
            Context string with category definitions and mapping rules
        """
        if self.classification_collection.count() == 0:
            return ""

        context_parts = []

        # Get category definitions
        cat_results = self.search_classification(
            "category definitions buylead deactivation payment severity",
            top_k=2
        )
        if cat_results:
            context_parts.append("## CATEGORY CLASSIFICATION GUIDE:")
            for r in cat_results:
                context_parts.append(r.text[:1200])

        # Get relevant examples based on transcript
        example_results = self.search_classification(
            f"classification example for: {transcript_snippet[:200]}",
            top_k=1
        )
        if example_results:
            context_parts.append("\n## RELEVANT CLASSIFICATION EXAMPLES:")
            for r in example_results:
                context_parts.append(r.text[:800])

        return "\n\n".join(context_parts)

    def get_sop_recommendations(self, issues: List[Dict]) -> List[Dict]:
        """
        Get SOP recommendations for classified issues.

        Args:
            issues: List of issue dicts with 'category' field

        Returns:
            List of SOP recommendation dicts with clean, formatted guidance
        """
        if self.suggestion_collection.count() == 0:
            return []

        # Pre-defined clean SOP summaries for each category
        CLEAN_SOP = {
            "buylead_relevance": {
                "title": "BuyLead Relevance Issue",
                "steps": [
                    "1. Check if categories are correctly mapped in Seller Panel",
                    "2. Review 'Recommended Products' section",
                    "3. Verify Catalog Quality Score (CQS) > 80%",
                    "4. Ensure product descriptions, photos, prices are complete",
                    "5. If still irrelevant, escalate to category mapping team"
                ]
            },
            "buylead_availability": {
                "title": "BuyLead Availability Issue",
                "steps": [
                    "1. Check total approved BuyLeads in seller's categories",
                    "2. If < 10 leads available, explain low demand in category",
                    "3. Suggest adding more product categories",
                    "4. Guide to 'Recommended Products' to expand catalog",
                    "5. Ask seller to check again after changes"
                ]
            },
            "buylead_roi": {
                "title": "BuyLead ROI/Conversion Issue",
                "steps": [
                    "1. Review seller's consumption pattern and conversion rate",
                    "2. Check if seller is using filters effectively",
                    "3. Verify seller contacts leads within 1 hour",
                    "4. Suggest GST-verified and membership leads",
                    "5. Discuss plan upgrade or category optimization"
                ]
            },
            "payment": {
                "title": "Payment Issue",
                "steps": [
                    "1. Verify payment status in backend system",
                    "2. Check for pending refund requests",
                    "3. If double charge, initiate refund ticket immediately",
                    "4. For EMI issues, connect with finance team",
                    "5. Document all disputes with transaction IDs"
                ]
            },
            "deactivation": {
                "title": "Deactivation Request (CRITICAL)",
                "steps": [
                    "1. FIRST: Understand root cause of deactivation request",
                    "2. Offer resolution for underlying issues",
                    "3. If service-related: Offer complimentary extension (max 1-2 months)",
                    "4. If BuyLead concern: Offer free leads (min 25, max 50)",
                    "5. If still wants to deactivate: Process as per policy",
                    "6. Document reason for retention analysis"
                ]
            },
            "employee": {
                "title": "Employee Complaint",
                "steps": [
                    "1. Apologize for any inconvenience caused",
                    "2. Document the specific complaint details",
                    "3. Assure customer of internal review",
                    "4. Do NOT promise disciplinary action",
                    "5. Escalate to team lead if serious"
                ]
            },
            "technical": {
                "title": "Technical Issue",
                "steps": [
                    "1. Ask seller to log out and log in again",
                    "2. Try alternate browser (Chrome/Firefox)",
                    "3. On mobile: Reinstall or update the app",
                    "4. Clear cache and cookies",
                    "5. If persists: Raise technical support ticket"
                ]
            },
            "pns": {
                "title": "PNS (Calls) Issue",
                "steps": [
                    "1. Check if number is mapped under PNS settings",
                    "2. Verify TrueCaller not blocking IM numbers",
                    "3. For spam: Guide to press #1 during call to block",
                    "4. Set time slots for office/non-office hours",
                    "5. If persists: Raise internal ticket to PNS team"
                ]
            },
            "catalog": {
                "title": "Catalog Issue",
                "steps": [
                    "1. Check product visibility in search",
                    "2. Verify catalog quality score (target > 80%)",
                    "3. Ensure all required fields are filled",
                    "4. Check if products are in correct categories",
                    "5. For visibility issues, raise mapping ticket"
                ]
            }
        }

        recommendations = []
        seen_categories = set()

        for issue in issues:
            if not isinstance(issue, dict):
                continue

            category = issue.get("category", "other")

            # Skip duplicates
            if category in seen_categories:
                continue
            seen_categories.add(category)

            # Get clean SOP if available
            if category in CLEAN_SOP:
                sop = CLEAN_SOP[category]
                recommendations.append({
                    "issue_category": category,
                    "title": sop["title"],
                    "sop_guidance": "\n".join(sop["steps"]),
                    "steps": sop["steps"]
                })
            else:
                # Fallback to RAG search for unknown categories
                query = f"How to handle {category} issue step by step"
                results = self.search_suggestions(query, top_k=1)
                if results:
                    recommendations.append({
                        "issue_category": category,
                        "title": f"{category.replace('_', ' ').title()} Issue",
                        "sop_guidance": results[0].text[:400],
                        "steps": []
                    })

        return recommendations

    @property
    def is_available(self) -> bool:
        """Check if dual RAG is available."""
        return (
            self.classification_collection.count() > 0 or
            self.suggestion_collection.count() > 0
        )

    def get_stats(self) -> Dict[str, Any]:
        """Get statistics."""
        return {
            "classification_docs": self.classification_collection.count(),
            "suggestion_docs": self.suggestion_collection.count(),
            "total_docs": (
                self.classification_collection.count() +
                self.suggestion_collection.count()
            )
        }


# Singleton instance
dual_rag = DualRAG()


# Convenience functions
def get_classification_context(transcript_snippet: str) -> str:
    """Get classification context from Classification RAG."""
    return dual_rag.get_classification_context(transcript_snippet)


def get_sop_recommendations(issues: List[Dict]) -> List[Dict]:
    """Get SOP recommendations from Suggestion RAG."""
    return dual_rag.get_sop_recommendations(issues)


def search_classification(query: str, top_k: int = 3) -> List[SearchResult]:
    """Search classification RAG."""
    return dual_rag.search_classification(query, top_k)


def search_suggestions(query: str, top_k: int = 3) -> List[SearchResult]:
    """Search suggestion RAG."""
    return dual_rag.search_suggestions(query, top_k)


if __name__ == "__main__":
    import sys

    rag = DualRAG()

    if len(sys.argv) > 1:
        cmd = sys.argv[1]

        if cmd == "index":
            force = "--force" in sys.argv
            stats = rag.index_all(force=force)
            print("\nIndexing complete!")
            print(f"Classification: {stats['classification']}")
            print(f"Suggestions: {stats['suggestion']}")

        elif cmd == "stats":
            stats = rag.get_stats()
            print(f"Classification RAG: {stats['classification_docs']} docs")
            print(f"Suggestion RAG: {stats['suggestion_docs']} docs")

        elif cmd == "test":
            # Test classification
            print("\n=== Testing Classification RAG ===")
            context = rag.get_classification_context("I am not getting relevant leads, all wrong category")
            print(context[:500] if context else "No context")

            # Test suggestions
            print("\n=== Testing Suggestion RAG ===")
            recs = rag.get_sop_recommendations([{"category": "buylead_relevance", "description": "wrong leads"}])
            for r in recs:
                print(f"Category: {r['issue_category']}")
                print(f"SOP: {r['sop_guidance'][:200]}...")

    else:
        print("Dual RAG System")
        print("-" * 40)
        print("Commands:")
        print("  python dual_rag.py index [--force]")
        print("  python dual_rag.py stats")
        print("  python dual_rag.py test")
