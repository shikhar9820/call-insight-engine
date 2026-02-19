# Copyright 2025 IndiaMART
# Call Insights Engine

"""
Call Insights Engine - Multi-Agent Pipeline for Call Transcription and Analysis

This package provides a complete pipeline for processing customer service calls:
1. Audio analysis and preprocessing
2. Speech-to-text transcription (Roman script)
3. Translation to English
4. Structured insight extraction
5. Quality validation and scoring

Usage:
    from call_insights_engine import process_single_call, CallInput

    call = CallInput(
        call_id="12345",
        audio_url="https://example.com/call.mp3"
    )
    result = process_single_call(call)
"""

from .main import (
    CallInput,
    ProcessingResult,
    process_single_call,
    process_batch,
    load_calls_from_csv
)

from .agent import (
    get_pipeline,
    get_text_pipeline,
    get_individual_agent
)

from .prompts import (
    get_agent_prompt,
    get_all_agent_names
)

from .audio_utils import (
    process_audio_for_api,
    download_audio,
    validate_audio_file
)

__version__ = "1.0.0"
__author__ = "IndiaMART"

__all__ = [
    # Main functions
    "process_single_call",
    "process_batch",
    "load_calls_from_csv",

    # Data classes
    "CallInput",
    "ProcessingResult",

    # Pipeline access
    "get_pipeline",
    "get_text_pipeline",
    "get_individual_agent",

    # Prompts
    "get_agent_prompt",
    "get_all_agent_names",

    # Audio utilities
    "process_audio_for_api",
    "download_audio",
    "validate_audio_file",
]
