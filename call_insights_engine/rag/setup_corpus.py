"""
Vertex AI RAG Corpus Setup Script
Creates and configures the RAG corpus for IndiaMART Call Insights Engine
"""

import os
import sys
from pathlib import Path
from typing import Optional
import time

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Vertex AI imports
try:
    import vertexai
    from vertexai.preview import rag
    from google.cloud import storage
    VERTEX_AI_AVAILABLE = True
    # RagCorpus type hint only
    RagCorpus = type(None)  # Placeholder for type hints
except ImportError:
    VERTEX_AI_AVAILABLE = False
    RagCorpus = type(None)
    print("Warning: Vertex AI libraries not installed. Run: pip install google-cloud-aiplatform")

# Configuration
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "hackathon-techsas")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "asia-south1")
CORPUS_DISPLAY_NAME = "indiamart-call-insights-corpus"
CORPUS_DESCRIPTION = "Knowledge base for IndiaMART call analysis including SOPs, product info, and business context"

# Knowledge base directory
KNOWLEDGE_BASE_DIR = Path(__file__).parent.parent / "knowledge_base"


def initialize_vertex_ai():
    """Initialize Vertex AI with project and location."""
    if not VERTEX_AI_AVAILABLE:
        raise RuntimeError("Vertex AI libraries not available")

    vertexai.init(project=PROJECT_ID, location=LOCATION)
    print(f"Initialized Vertex AI: project={PROJECT_ID}, location={LOCATION}")


def list_existing_corpora() -> list:
    """List all existing RAG corpora in the project."""
    corpora = rag.list_corpora()
    corpus_list = list(corpora)
    print(f"Found {len(corpus_list)} existing corpora")
    for corpus in corpus_list:
        print(f"  - {corpus.display_name}: {corpus.name}")
    return corpus_list


def get_or_create_corpus() -> RagCorpus:
    """Get existing corpus or create a new one."""
    # Check for existing corpus
    existing_corpora = list_existing_corpora()
    for corpus in existing_corpora:
        if corpus.display_name == CORPUS_DISPLAY_NAME:
            print(f"Found existing corpus: {corpus.name}")
            return corpus

    # Create new corpus
    print(f"Creating new corpus: {CORPUS_DISPLAY_NAME}")

    # Configure embedding model
    embedding_model_config = rag.EmbeddingModelConfig(
        publisher_model="publishers/google/models/text-embedding-004"
    )

    corpus = rag.create_corpus(
        display_name=CORPUS_DISPLAY_NAME,
        description=CORPUS_DESCRIPTION,
        embedding_model_config=embedding_model_config,
    )

    print(f"Created corpus: {corpus.name}")
    return corpus


def upload_knowledge_base_files(corpus: RagCorpus) -> list:
    """Upload all knowledge base files to the corpus."""
    if not KNOWLEDGE_BASE_DIR.exists():
        raise FileNotFoundError(f"Knowledge base directory not found: {KNOWLEDGE_BASE_DIR}")

    uploaded_files = []
    txt_files = list(KNOWLEDGE_BASE_DIR.glob("*.txt"))

    print(f"Found {len(txt_files)} files to upload")

    for file_path in txt_files:
        print(f"Uploading: {file_path.name}")
        try:
            # Read file content
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Upload to corpus using inline content
            rag_file = rag.upload_file(
                corpus_name=corpus.name,
                path=str(file_path),
                display_name=file_path.stem,
                description=f"IndiaMART SOP document: {file_path.stem}"
            )

            uploaded_files.append({
                'name': file_path.name,
                'rag_file': rag_file.name if hasattr(rag_file, 'name') else str(rag_file)
            })
            print(f"  Uploaded: {file_path.name}")

        except Exception as e:
            print(f"  Error uploading {file_path.name}: {e}")

    return uploaded_files


def upload_from_gcs(corpus: RagCorpus, gcs_uri: str) -> dict:
    """Upload files from Google Cloud Storage to corpus."""
    print(f"Importing from GCS: {gcs_uri}")

    try:
        response = rag.import_files(
            corpus_name=corpus.name,
            paths=[gcs_uri],
            chunk_size=512,
            chunk_overlap=100,
        )
        print(f"Import completed: {response}")
        return {'gcs_uri': gcs_uri, 'response': str(response)}
    except Exception as e:
        print(f"Error importing from GCS: {e}")
        return {'gcs_uri': gcs_uri, 'error': str(e)}


def list_corpus_files(corpus: RagCorpus) -> list:
    """List all files in the corpus."""
    files = rag.list_files(corpus_name=corpus.name)
    file_list = list(files)
    print(f"Corpus contains {len(file_list)} files:")
    for f in file_list:
        print(f"  - {f.display_name}: {f.name}")
    return file_list


def test_retrieval(corpus: RagCorpus, query: str = "What is a BuyLead?") -> dict:
    """Test retrieval from the corpus."""
    print(f"\nTesting retrieval with query: '{query}'")

    try:
        response = rag.retrieval_query(
            rag_resources=[
                rag.RagResource(
                    rag_corpus=corpus.name,
                )
            ],
            text=query,
            similarity_top_k=5,
            vector_distance_threshold=0.5,
        )

        print(f"Retrieved {len(response.contexts.contexts)} contexts")
        for i, context in enumerate(response.contexts.contexts):
            print(f"\n--- Context {i+1} ---")
            print(f"Source: {context.source_uri if hasattr(context, 'source_uri') else 'N/A'}")
            print(f"Score: {context.distance if hasattr(context, 'distance') else 'N/A'}")
            print(f"Text: {context.text[:500]}...")

        return {
            'query': query,
            'num_contexts': len(response.contexts.contexts),
            'contexts': [
                {
                    'text': ctx.text[:500],
                    'distance': getattr(ctx, 'distance', None)
                }
                for ctx in response.contexts.contexts
            ]
        }
    except Exception as e:
        print(f"Retrieval error: {e}")
        return {'query': query, 'error': str(e)}


def save_corpus_config(corpus: RagCorpus):
    """Save corpus configuration to .env file."""
    env_path = Path(__file__).parent.parent / ".env"

    # Read existing .env
    if env_path.exists():
        with open(env_path, 'r') as f:
            lines = f.readlines()
    else:
        lines = []

    # Update or add RAG_CORPUS
    corpus_line = f"RAG_CORPUS={corpus.name}\n"
    updated = False

    for i, line in enumerate(lines):
        if line.startswith("RAG_CORPUS=") or line.startswith("# RAG_CORPUS="):
            lines[i] = corpus_line
            updated = True
            break

    if not updated:
        lines.append(f"\n# RAG Corpus (auto-generated)\n{corpus_line}")

    # Write back
    with open(env_path, 'w') as f:
        f.writelines(lines)

    print(f"Updated .env with RAG_CORPUS={corpus.name}")


def setup_complete_corpus():
    """Complete setup: create corpus and upload all knowledge base files."""
    print("=" * 60)
    print("IndiaMART Call Insights - RAG Corpus Setup")
    print("=" * 60)

    # Initialize
    initialize_vertex_ai()

    # Get or create corpus
    corpus = get_or_create_corpus()

    # Upload knowledge base files
    print("\n--- Uploading Knowledge Base Files ---")
    uploaded = upload_knowledge_base_files(corpus)

    # List files in corpus
    print("\n--- Corpus Contents ---")
    list_corpus_files(corpus)

    # Test retrieval
    print("\n--- Testing Retrieval ---")
    test_queries = [
        "What is a BuyLead and how does it work?",
        "How to handle deactivation requests?",
        "What are the different subscription packages?",
        "How to resolve BuyLead relevance issues?"
    ]

    for query in test_queries:
        test_retrieval(corpus, query)
        print()

    # Save config
    save_corpus_config(corpus)

    print("\n" + "=" * 60)
    print("Setup Complete!")
    print(f"Corpus Name: {corpus.name}")
    print(f"Files Uploaded: {len(uploaded)}")
    print("=" * 60)

    return corpus


def delete_corpus(corpus_name: str):
    """Delete a corpus (use with caution)."""
    print(f"Deleting corpus: {corpus_name}")
    try:
        rag.delete_corpus(name=corpus_name)
        print("Corpus deleted successfully")
    except Exception as e:
        print(f"Error deleting corpus: {e}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="RAG Corpus Setup")
    parser.add_argument("--setup", action="store_true", help="Run complete setup")
    parser.add_argument("--list", action="store_true", help="List existing corpora")
    parser.add_argument("--test", type=str, help="Test retrieval with query")
    parser.add_argument("--delete", type=str, help="Delete corpus by name")

    args = parser.parse_args()

    if not VERTEX_AI_AVAILABLE:
        print("Error: Vertex AI libraries not available")
        print("Install with: pip install google-cloud-aiplatform")
        sys.exit(1)

    initialize_vertex_ai()

    if args.setup:
        setup_complete_corpus()
    elif args.list:
        list_existing_corpora()
    elif args.test:
        corpora = list_existing_corpora()
        for corpus in corpora:
            if corpus.display_name == CORPUS_DISPLAY_NAME:
                test_retrieval(corpus, args.test)
                break
    elif args.delete:
        delete_corpus(args.delete)
    else:
        parser.print_help()
