"""
Local RAG System using ChromaDB
Simple, fast, and free - no cloud dependencies
"""

import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import hashlib
import json

from dotenv import load_dotenv

load_dotenv()

# ChromaDB imports
try:
    import chromadb
    from chromadb.config import Settings
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False
    print("ChromaDB not installed. Run: pip install chromadb")

# Google Generative AI for embeddings and generation
try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    print("Google GenAI not installed. Run: pip install google-generativeai")


@dataclass
class SearchResult:
    """Result from RAG search."""
    text: str
    source: str
    score: float
    metadata: Dict[str, Any]


class LocalRAG:
    """
    Local RAG system using ChromaDB for vector storage.

    Features:
    - Index knowledge base files
    - Semantic search over documents
    - Answer generation with Gemini
    - Persistent storage (survives restarts)
    """

    def __init__(
        self,
        persist_directory: str = None,
        collection_name: str = "indiamart_knowledge_base",
        api_key: str = None
    ):
        """Initialize local RAG system."""
        self.persist_directory = persist_directory or str(
            Path(__file__).parent.parent / "chroma_db"
        )
        self.collection_name = collection_name
        self.api_key = api_key or os.environ.get("GOOGLE_API_KEY")

        # Knowledge base directory
        self.kb_directory = Path(__file__).parent.parent / "knowledge_base"

        # Initialize components
        self._init_chromadb()
        self._init_genai()

    def _init_chromadb(self):
        """Initialize ChromaDB client."""
        if not CHROMADB_AVAILABLE:
            raise RuntimeError("ChromaDB not available. Install with: pip install chromadb")

        # Create persistent client
        self.client = chromadb.PersistentClient(path=self.persist_directory)

        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"description": "IndiaMART SOPs and knowledge base"}
        )

        print(f"ChromaDB initialized at: {self.persist_directory}")
        print(f"Collection '{self.collection_name}' has {self.collection.count()} documents")

    def _init_genai(self):
        """Initialize Google Generative AI."""
        self.model = None
        self.embed_model = None

        if GENAI_AVAILABLE and self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel("gemini-2.0-flash-001")
            print("Gemini model initialized")
        else:
            print("Warning: Gemini not available. Set GOOGLE_API_KEY in .env")

    def _get_embedding(self, text: str) -> List[float]:
        """Get embedding for text using Gemini."""
        if not GENAI_AVAILABLE or not self.api_key:
            raise RuntimeError("Google GenAI not configured")

        result = genai.embed_content(
            model="models/text-embedding-004",
            content=text,
            task_type="retrieval_document"
        )
        return result['embedding']

    def _get_query_embedding(self, text: str) -> List[float]:
        """Get embedding for query using Gemini."""
        if not GENAI_AVAILABLE or not self.api_key:
            raise RuntimeError("Google GenAI not configured")

        result = genai.embed_content(
            model="models/text-embedding-004",
            content=text,
            task_type="retrieval_query"
        )
        return result['embedding']

    def _chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """Split text into overlapping chunks."""
        chunks = []
        lines = text.split('\n')
        current_chunk = []
        current_size = 0

        for line in lines:
            line_size = len(line)

            if current_size + line_size > chunk_size and current_chunk:
                # Save current chunk
                chunks.append('\n'.join(current_chunk))

                # Keep overlap
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

        # Don't forget the last chunk
        if current_chunk:
            chunks.append('\n'.join(current_chunk))

        return chunks

    def _get_file_hash(self, file_path: Path) -> str:
        """Get hash of file content for change detection."""
        content = file_path.read_text(encoding='utf-8')
        return hashlib.md5(content.encode()).hexdigest()

    def index_knowledge_base(self, force_reindex: bool = False) -> Dict[str, Any]:
        """
        Index all knowledge base files into ChromaDB.

        Args:
            force_reindex: If True, reindex even if already indexed

        Returns:
            Summary of indexing operation
        """
        if not self.kb_directory.exists():
            raise FileNotFoundError(f"Knowledge base directory not found: {self.kb_directory}")

        txt_files = list(self.kb_directory.glob("*.txt"))
        print(f"Found {len(txt_files)} knowledge base files")

        stats = {
            "files_processed": 0,
            "chunks_indexed": 0,
            "files_skipped": 0,
            "errors": []
        }

        for file_path in txt_files:
            try:
                file_hash = self._get_file_hash(file_path)
                file_id = file_path.stem

                # Check if already indexed (unless force_reindex)
                if not force_reindex:
                    existing = self.collection.get(
                        where={"source_file": file_id}
                    )
                    if existing and existing['ids']:
                        # Check if hash matches
                        if existing['metadatas'] and existing['metadatas'][0].get('file_hash') == file_hash:
                            print(f"  Skipping {file_path.name} (already indexed)")
                            stats["files_skipped"] += 1
                            continue
                        else:
                            # File changed, delete old chunks
                            self.collection.delete(where={"source_file": file_id})
                            print(f"  Re-indexing {file_path.name} (file changed)")

                # Read and chunk the file
                content = file_path.read_text(encoding='utf-8')
                chunks = self._chunk_text(content)

                print(f"  Indexing {file_path.name}: {len(chunks)} chunks")

                # Index each chunk
                for i, chunk in enumerate(chunks):
                    chunk_id = f"{file_id}_chunk_{i}"

                    # Get embedding
                    embedding = self._get_embedding(chunk)

                    # Add to collection
                    self.collection.add(
                        ids=[chunk_id],
                        embeddings=[embedding],
                        documents=[chunk],
                        metadatas=[{
                            "source_file": file_id,
                            "source_name": file_path.name,
                            "chunk_index": i,
                            "total_chunks": len(chunks),
                            "file_hash": file_hash
                        }]
                    )
                    stats["chunks_indexed"] += 1

                stats["files_processed"] += 1

            except Exception as e:
                error_msg = f"Error indexing {file_path.name}: {str(e)}"
                print(f"  ERROR: {error_msg}")
                stats["errors"].append(error_msg)

        print(f"\nIndexing complete!")
        print(f"  Files processed: {stats['files_processed']}")
        print(f"  Chunks indexed: {stats['chunks_indexed']}")
        print(f"  Files skipped: {stats['files_skipped']}")
        print(f"  Total documents in collection: {self.collection.count()}")

        return stats

    def search(self, query: str, top_k: int = 5) -> List[SearchResult]:
        """
        Search the knowledge base.

        Args:
            query: Search query
            top_k: Number of results to return

        Returns:
            List of SearchResult objects
        """
        if self.collection.count() == 0:
            print("Warning: Knowledge base is empty. Run index_knowledge_base() first.")
            return []

        # Get query embedding
        query_embedding = self._get_query_embedding(query)

        # Search
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"]
        )

        # Convert to SearchResult objects
        search_results = []
        if results and results['ids'] and results['ids'][0]:
            for i, doc_id in enumerate(results['ids'][0]):
                search_results.append(SearchResult(
                    text=results['documents'][0][i],
                    source=results['metadatas'][0][i].get('source_name', 'unknown'),
                    score=1 - results['distances'][0][i],  # Convert distance to similarity
                    metadata=results['metadatas'][0][i]
                ))

        return search_results

    def ask(self, question: str, top_k: int = 5) -> str:
        """
        Ask a question and get an AI-generated answer.

        Args:
            question: The question to ask
            top_k: Number of context chunks to use

        Returns:
            Generated answer
        """
        if not self.model:
            return "Error: Gemini model not configured. Set GOOGLE_API_KEY in .env"

        # Search for relevant context
        results = self.search(question, top_k=top_k)

        if not results:
            return "No relevant information found in knowledge base. Please run index_knowledge_base() first."

        # Build context
        context_parts = []
        sources = set()
        for r in results:
            context_parts.append(f"[From {r.source}]\n{r.text}")
            sources.add(r.source)

        context = "\n\n---\n\n".join(context_parts)

        # Generate answer
        prompt = f"""You are an IndiaMART customer service expert. Answer the following question based ONLY on the provided context.

CONTEXT:
{context}

QUESTION: {question}

INSTRUCTIONS:
- Answer based only on the context provided
- Be specific and actionable
- If the context doesn't contain the answer, say "I don't have enough information to answer this"
- Reference the SOP or document if applicable

ANSWER:"""

        try:
            response = self.model.generate_content(prompt)
            answer = response.text

            # Add sources
            answer += f"\n\n---\nSources: {', '.join(sources)}"

            return answer

        except Exception as e:
            return f"Error generating answer: {str(e)}"

    def get_sop_for_issue(self, issue_type: str) -> str:
        """Get SOP guidance for a specific issue type."""
        question = f"What is the step-by-step SOP for handling {issue_type} issues? Include resolution steps and escalation paths."
        return self.ask(question)

    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the indexed knowledge base."""
        # Get all documents with metadata
        all_docs = self.collection.get(include=["metadatas"])

        files = {}
        for meta in all_docs['metadatas']:
            source = meta.get('source_name', 'unknown')
            if source not in files:
                files[source] = 0
            files[source] += 1

        return {
            "total_chunks": self.collection.count(),
            "files_indexed": len(files),
            "chunks_per_file": files,
            "persist_directory": self.persist_directory
        }

    def clear(self):
        """Clear all indexed documents."""
        self.client.delete_collection(self.collection_name)
        self.collection = self.client.create_collection(
            name=self.collection_name,
            metadata={"description": "IndiaMART SOPs and knowledge base"}
        )
        print("Knowledge base cleared.")


def main():
    """CLI interface for local RAG."""
    import sys

    rag = LocalRAG()

    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "index":
            force = "--force" in sys.argv
            rag.index_knowledge_base(force_reindex=force)

        elif command == "search":
            if len(sys.argv) > 2:
                query = " ".join(sys.argv[2:])
                results = rag.search(query)
                print(f"\nSearch results for: '{query}'\n")
                for i, r in enumerate(results, 1):
                    print(f"{i}. [{r.source}] (score: {r.score:.3f})")
                    print(f"   {r.text[:200]}...")
                    print()
            else:
                print("Usage: python local_rag.py search <query>")

        elif command == "ask":
            if len(sys.argv) > 2:
                question = " ".join(sys.argv[2:])
                print(f"\nQuestion: {question}\n")
                print("-" * 50)
                answer = rag.ask(question)
                print(answer)
            else:
                print("Usage: python local_rag.py ask <question>")

        elif command == "stats":
            stats = rag.get_stats()
            print("\nKnowledge Base Statistics:")
            print(f"  Total chunks: {stats['total_chunks']}")
            print(f"  Files indexed: {stats['files_indexed']}")
            print(f"  Chunks per file:")
            for file, count in stats['chunks_per_file'].items():
                print(f"    - {file}: {count}")

        elif command == "clear":
            rag.clear()

        else:
            print(f"Unknown command: {command}")
            print("Available commands: index, search, ask, stats, clear")
    else:
        print("IndiaMART Local RAG System")
        print("-" * 30)
        print("Commands:")
        print("  python local_rag.py index [--force]  - Index knowledge base")
        print("  python local_rag.py search <query>   - Search documents")
        print("  python local_rag.py ask <question>   - Ask a question")
        print("  python local_rag.py stats            - Show statistics")
        print("  python local_rag.py clear            - Clear all indexed data")


if __name__ == "__main__":
    main()
