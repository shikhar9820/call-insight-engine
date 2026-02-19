# Copyright 2025 IndiaMART
# Call Insights Engine - Multi-Agent Pipeline
# Following Google ADK SequentialAgent pattern

import os

from google.adk.agents import Agent
from google.adk.agents import SequentialAgent

from dotenv import load_dotenv
from .prompts import get_agent_prompt

load_dotenv()

# Local RAG for business context (ChromaDB-based)
# Used by summarizer agent for SOP lookup and compliance checking
business_context_retrieval = None
try:
    from .rag.rag_tool import rag_tool
    if rag_tool.is_available:
        print("Local RAG (ChromaDB) available for business context")
        business_context_retrieval = rag_tool
    else:
        print("Local RAG not indexed yet. Run: python -m rag.local_rag index")
except ImportError as e:
    print(f"Local RAG not available: {e}")


def NewAgent(agentInstruction: str, ragTool: list, agentName: str = "call_agent") -> Agent:
    """
    Create and return an agent with the specified configuration.
    """
    return Agent(
        model='gemini-2.0-flash-001',
        name=agentName,
        instruction=agentInstruction,
        tools=ragTool
    )


# Agent 1: Audio Analyzer Agent
audio_analyzer_agent = NewAgent(
    agentInstruction=get_agent_prompt("audio_analyzer_agent"),
    ragTool=[],
    agentName="audio_analyzer_agent"
)

# Agent 2: Transcript Generator Agent
transcript_generator_agent = NewAgent(
    agentInstruction=get_agent_prompt("transcript_generator_agent"),
    ragTool=[],
    agentName="transcript_generator_agent"
)

# Agent 2.5: Diarization Corrector Agent (fixes speaker labels)
diarization_corrector_agent = NewAgent(
    agentInstruction=get_agent_prompt("diarization_corrector_agent"),
    ragTool=[],
    agentName="diarization_corrector_agent"
)

# Agent 3: Translator Agent
translator_agent = NewAgent(
    agentInstruction=get_agent_prompt("translator_agent"),
    ragTool=[],
    agentName="translator_agent"
)

# Agent 4: Summarizer Agent (can use RAG for business context)
summarizer_agent = NewAgent(
    agentInstruction=get_agent_prompt("summarizer_agent"),
    ragTool=[business_context_retrieval] if business_context_retrieval else [],
    agentName="summarizer_agent"
)

# Agent 5: Validator/Scorer Agent
validator_scorer_agent = NewAgent(
    agentInstruction=get_agent_prompt("validator_scorer_agent"),
    ragTool=[],
    agentName="validator_scorer_agent"
)

# ---------- Combine all agents into the sequential pipeline ----------
call_transcription_pipeline = SequentialAgent(
    name="CallTranscriptionPipeline",
    sub_agents=[
        audio_analyzer_agent,
        transcript_generator_agent,
        diarization_corrector_agent,  # NEW: Fix speaker labels after transcription
        translator_agent,
        summarizer_agent,
        validator_scorer_agent
    ]
)

root_agent = call_transcription_pipeline
