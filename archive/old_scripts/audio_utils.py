# Copyright 2025 IndiaMART
# Call Insights Engine - Audio Processing Utilities

"""
Audio processing utilities for the call insights pipeline.
Handles audio download, validation, preprocessing, and noise reduction.
"""

import os

# Configure ffmpeg path BEFORE importing pydub
# Use imageio-ffmpeg which bundles ffmpeg binaries
try:
    import imageio_ffmpeg
    _ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
    _ffmpeg_dir = os.path.dirname(_ffmpeg_path)
    os.environ["PATH"] = _ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
    os.environ["FFMPEG_BINARY"] = _ffmpeg_path
except ImportError:
    _ffmpeg_path = None

import base64
import tempfile
import requests
import numpy as np
from urllib.parse import urlparse, parse_qs
from typing import Optional, Tuple, Dict, Any
from dataclasses import dataclass

# Now configure pydub with the ffmpeg path
if _ffmpeg_path:
    try:
        from pydub import AudioSegment
        AudioSegment.converter = _ffmpeg_path
        # ffprobe might not exist in imageio-ffmpeg, but ffmpeg can handle it
        AudioSegment.ffprobe = _ffmpeg_path
    except ImportError:
        pass


@dataclass
class AudioMetadata:
    """Metadata about an audio file."""
    file_path: str
    file_size_bytes: int
    duration_seconds: Optional[float]
    format: str
    sample_rate: Optional[int]
    is_valid: bool
    error_message: Optional[str] = None


@dataclass
class ProcessedAudio:
    """Processed audio ready for API calls."""
    base64_content: str
    mime_type: str
    file_path: str
    metadata: AudioMetadata


def parse_audio_url(url: str) -> str:
    """
    Parse audio URL and extract actual audio URL if nested.

    Some URLs have the actual audio URL as a query parameter.
    e.g., https://example.com/redirect?soundurl=https://actual-audio.mp3

    Args:
        url: Input URL (may be direct or redirect)

    Returns:
        Actual audio URL
    """
    parsed = urlparse(url)
    query_params = parse_qs(parsed.query)

    # Check for common redirect parameters
    redirect_params = ['soundurl', 'url', 'audio', 'file', 'src']
    for param in redirect_params:
        if param in query_params:
            return query_params[param][0]

    return url


def download_audio(
    url: str,
    output_dir: Optional[str] = None,
    filename_prefix: str = "call_audio",
    timeout: int = 60
) -> Tuple[str, Optional[str]]:
    """
    Download audio file from URL.

    Args:
        url: URL of the audio file
        output_dir: Directory to save file (uses temp dir if None)
        filename_prefix: Prefix for the saved file
        timeout: Request timeout in seconds

    Returns:
        Tuple of (file_path, error_message)
        If successful, error_message is None
    """
    try:
        # Parse URL to get actual audio URL
        actual_url = parse_audio_url(url)

        # Create output directory if needed
        if output_dir is None:
            output_dir = tempfile.gettempdir()
        os.makedirs(output_dir, exist_ok=True)

        # Determine file extension from URL or content-type
        parsed_url = urlparse(actual_url)
        url_ext = os.path.splitext(parsed_url.path)[1].lower()
        if url_ext not in ['.mp3', '.wav', '.ogg', '.m4a', '.webm', '.flac']:
            url_ext = '.mp3'  # Default to mp3

        # Download file
        response = requests.get(actual_url, timeout=timeout, stream=True)
        response.raise_for_status()

        # Check content type
        content_type = response.headers.get('content-type', '')
        if 'audio' not in content_type and 'octet-stream' not in content_type:
            # Try to proceed anyway, might still be valid audio
            pass

        # Save file
        filename = f"{filename_prefix}{url_ext}"
        file_path = os.path.join(output_dir, filename)

        with open(file_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        return file_path, None

    except requests.exceptions.Timeout:
        return "", f"Download timeout after {timeout} seconds"
    except requests.exceptions.RequestException as e:
        return "", f"Download error: {str(e)}"
    except Exception as e:
        return "", f"Unexpected error: {str(e)}"


def validate_audio_file(file_path: str) -> AudioMetadata:
    """
    Validate an audio file and extract metadata.

    Args:
        file_path: Path to the audio file

    Returns:
        AudioMetadata with validation results
    """
    try:
        if not os.path.exists(file_path):
            return AudioMetadata(
                file_path=file_path,
                file_size_bytes=0,
                duration_seconds=None,
                format="unknown",
                sample_rate=None,
                is_valid=False,
                error_message="File not found"
            )

        file_size = os.path.getsize(file_path)

        # Check minimum file size (empty or too small)
        if file_size < 1000:  # Less than 1KB
            return AudioMetadata(
                file_path=file_path,
                file_size_bytes=file_size,
                duration_seconds=None,
                format="unknown",
                sample_rate=None,
                is_valid=False,
                error_message="File too small, likely invalid"
            )

        # Check maximum file size (100MB limit)
        if file_size > 100 * 1024 * 1024:
            return AudioMetadata(
                file_path=file_path,
                file_size_bytes=file_size,
                duration_seconds=None,
                format="unknown",
                sample_rate=None,
                is_valid=False,
                error_message="File too large (>100MB)"
            )

        # Determine format from extension
        ext = os.path.splitext(file_path)[1].lower()
        format_map = {
            '.mp3': 'mp3',
            '.wav': 'wav',
            '.ogg': 'ogg',
            '.m4a': 'm4a',
            '.webm': 'webm',
            '.flac': 'flac'
        }
        audio_format = format_map.get(ext, 'unknown')

        # Try to get duration using pydub if available
        duration = None
        sample_rate = None
        try:
            from pydub import AudioSegment
            audio = AudioSegment.from_file(file_path)
            duration = len(audio) / 1000.0  # Convert ms to seconds
            sample_rate = audio.frame_rate
        except ImportError:
            # pydub not installed, skip duration detection
            pass
        except Exception:
            # Audio file might be corrupted
            pass

        return AudioMetadata(
            file_path=file_path,
            file_size_bytes=file_size,
            duration_seconds=duration,
            format=audio_format,
            sample_rate=sample_rate,
            is_valid=True
        )

    except Exception as e:
        return AudioMetadata(
            file_path=file_path,
            file_size_bytes=0,
            duration_seconds=None,
            format="unknown",
            sample_rate=None,
            is_valid=False,
            error_message=str(e)
        )


def encode_audio_base64(file_path: str) -> Tuple[str, Optional[str]]:
    """
    Encode audio file to base64.

    Args:
        file_path: Path to the audio file

    Returns:
        Tuple of (base64_string, error_message)
    """
    try:
        with open(file_path, 'rb') as f:
            audio_bytes = f.read()
        base64_content = base64.b64encode(audio_bytes).decode('utf-8')
        return base64_content, None
    except Exception as e:
        return "", f"Encoding error: {str(e)}"


def get_mime_type(file_path: str) -> str:
    """
    Get MIME type for audio file.

    Args:
        file_path: Path to the audio file

    Returns:
        MIME type string
    """
    ext = os.path.splitext(file_path)[1].lower()
    mime_map = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.webm': 'audio/webm',
        '.flac': 'audio/flac'
    }
    return mime_map.get(ext, 'audio/mpeg')


def process_audio_for_api(
    url: str,
    call_id: str,
    output_dir: Optional[str] = None
) -> Tuple[Optional[ProcessedAudio], Optional[str]]:
    """
    Complete audio processing pipeline: download, validate, encode.

    Args:
        url: URL of the audio file
        call_id: Unique identifier for the call
        output_dir: Directory to save temporary files

    Returns:
        Tuple of (ProcessedAudio, error_message)
        If successful, error_message is None
    """
    # Create temp directory for this call
    if output_dir is None:
        output_dir = os.path.join(tempfile.gettempdir(), f"call_{call_id}")
    os.makedirs(output_dir, exist_ok=True)

    # Download audio
    file_path, error = download_audio(
        url=url,
        output_dir=output_dir,
        filename_prefix=f"call_{call_id}"
    )
    if error:
        return None, f"Download failed: {error}"

    # Validate audio
    metadata = validate_audio_file(file_path)
    if not metadata.is_valid:
        return None, f"Validation failed: {metadata.error_message}"

    # Encode to base64
    base64_content, error = encode_audio_base64(file_path)
    if error:
        return None, f"Encoding failed: {error}"

    # Get MIME type
    mime_type = get_mime_type(file_path)

    return ProcessedAudio(
        base64_content=base64_content,
        mime_type=mime_type,
        file_path=file_path,
        metadata=metadata
    ), None


def cleanup_temp_files(call_id: str, output_dir: Optional[str] = None):
    """
    Clean up temporary files for a processed call.

    Args:
        call_id: Unique identifier for the call
        output_dir: Directory where temp files were saved
    """
    import shutil

    if output_dir is None:
        output_dir = os.path.join(tempfile.gettempdir(), f"call_{call_id}")

    if os.path.exists(output_dir):
        try:
            shutil.rmtree(output_dir)
        except Exception:
            pass  # Ignore cleanup errors


def estimate_duration_from_size(file_size_bytes: int, format: str = 'mp3') -> float:
    """
    Estimate audio duration from file size.
    Useful when pydub is not available.

    Args:
        file_size_bytes: Size of the audio file
        format: Audio format

    Returns:
        Estimated duration in seconds
    """
    # Approximate bitrates (bytes per second)
    bitrate_map = {
        'mp3': 16000,   # ~128kbps
        'wav': 176400,  # ~1411kbps (CD quality)
        'ogg': 16000,   # ~128kbps
        'm4a': 16000,   # ~128kbps
        'webm': 12000,  # ~96kbps
        'flac': 100000  # Variable, estimate
    }
    bytes_per_second = bitrate_map.get(format, 16000)
    return file_size_bytes / bytes_per_second


# =============================================================================
# AUDIO PREPROCESSING & NOISE REDUCTION
# =============================================================================

def reduce_noise(
    file_path: str,
    output_path: Optional[str] = None,
    noise_reduction_strength: float = 0.75
) -> Tuple[str, Optional[str]]:
    """
    Apply noise reduction to audio file.

    Uses spectral gating to reduce background noise while preserving speech.
    For large files, processes in chunks to avoid memory issues.

    Args:
        file_path: Path to input audio file
        output_path: Path for output file (auto-generated if None)
        noise_reduction_strength: 0.0 to 1.0, higher = more aggressive

    Returns:
        Tuple of (output_file_path, error_message)
    """
    try:
        import noisereduce as nr
        import scipy.io.wavfile as wavfile
        import subprocess

        # Get ffmpeg path
        ffmpeg_exe = _ffmpeg_path
        if not ffmpeg_exe:
            try:
                import imageio_ffmpeg
                ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            except ImportError:
                return file_path, "ffmpeg not available"

        # Generate output path
        if output_path is None:
            base, ext = os.path.splitext(file_path)
            output_path = f"{base}_denoised.mp3"

        # Create temp directory in same location as output
        temp_dir = os.path.dirname(output_path) or os.path.dirname(file_path)

        # Convert input to WAV using ffmpeg directly (16kHz mono for efficiency)
        wav_input = os.path.join(temp_dir, 'temp_input.wav')
        cmd = [ffmpeg_exe, '-y', '-i', file_path, '-ar', '16000', '-ac', '1', wav_input]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            return file_path, f"ffmpeg conversion failed: {result.stderr[:200]}"

        # Read WAV file
        sample_rate, samples = wavfile.read(wav_input)

        # Convert to float for processing
        if samples.dtype == np.int16:
            samples_float = samples.astype(np.float32) / 32768.0
        elif samples.dtype == np.float32:
            samples_float = samples
        else:
            samples_float = samples.astype(np.float32) / np.max(np.abs(samples))

        # Process in chunks for large files (> 60 seconds at 16kHz = 960000 samples)
        chunk_size = 960000  # 60 seconds at 16kHz

        if len(samples_float) > chunk_size:
            # Process in chunks
            # Use first 0.5 seconds as noise profile
            noise_samples = min(int(sample_rate * 0.5), len(samples_float) // 10)
            noise_clip = samples_float[:noise_samples]

            reduced_chunks = []
            for i in range(0, len(samples_float), chunk_size):
                chunk = samples_float[i:i + chunk_size]
                reduced_chunk = nr.reduce_noise(
                    y=chunk,
                    sr=sample_rate,
                    y_noise=noise_clip,
                    prop_decrease=noise_reduction_strength,
                    stationary=True  # Faster for chunked processing
                )
                reduced_chunks.append(reduced_chunk)

            reduced_noise = np.concatenate(reduced_chunks)
        else:
            # Process entire file at once
            noise_samples = min(int(sample_rate * 0.5), len(samples_float) // 4)
            noise_clip = samples_float[:noise_samples]

            reduced_noise = nr.reduce_noise(
                y=samples_float,
                sr=sample_rate,
                y_noise=noise_clip,
                prop_decrease=noise_reduction_strength,
                stationary=False
            )

        # Convert back to int16
        reduced_samples = (reduced_noise * 32768.0).clip(-32768, 32767).astype(np.int16)

        # Save as WAV
        wav_output = os.path.join(temp_dir, 'temp_denoised.wav')
        wavfile.write(wav_output, sample_rate, reduced_samples)

        # Convert to MP3 using ffmpeg
        cmd = [ffmpeg_exe, '-y', '-i', wav_output, '-b:a', '128k', output_path]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            return file_path, f"ffmpeg mp3 conversion failed: {result.stderr[:200]}"

        # Cleanup temp files
        for temp_file in [wav_input, wav_output]:
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except:
                    pass

        return output_path, None

    except ImportError as e:
        return file_path, f"Missing dependency: {e}. Install with: pip install noisereduce scipy"
    except MemoryError:
        return file_path, "File too large for noise reduction - skipping"
    except Exception as e:
        return file_path, f"Noise reduction failed: {str(e)}"


def normalize_audio(
    file_path: str,
    output_path: Optional[str] = None,
    target_dBFS: float = -20.0
) -> Tuple[str, Optional[str]]:
    """
    Normalize audio volume to consistent level using ffmpeg.

    Uses simple volume normalization that preserves file size.

    Args:
        file_path: Path to input audio file
        output_path: Path for output file (auto-generated if None)
        target_dBFS: Target volume level in dBFS

    Returns:
        Tuple of (output_file_path, error_message)
    """
    try:
        import subprocess

        # Get ffmpeg path
        ffmpeg_exe = _ffmpeg_path
        if not ffmpeg_exe:
            try:
                import imageio_ffmpeg
                ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            except ImportError:
                return file_path, "ffmpeg not available"

        # Generate output path
        if output_path is None:
            base, ext = os.path.splitext(file_path)
            output_path = f"{base}_normalized.mp3"

        # First, get the current volume level using volumedetect
        detect_cmd = [
            ffmpeg_exe, '-i', file_path, '-af', 'volumedetect', '-f', 'null', '-'
        ]
        result = subprocess.run(detect_cmd, capture_output=True, text=True)

        # Parse max_volume from output (in stderr)
        max_volume = 0.0
        for line in result.stderr.split('\n'):
            if 'max_volume' in line:
                try:
                    # Format: "max_volume: -5.0 dB"
                    max_volume = float(line.split(':')[1].strip().split()[0])
                except:
                    pass

        # Calculate volume adjustment needed
        # If max is -5dB and target is -3dB, we need +2dB
        volume_adjust = -max_volume - 3  # Aim for -3dB peak

        # If volume adjustment is minimal, skip processing
        if abs(volume_adjust) < 1.0:
            import shutil
            shutil.copy2(file_path, output_path)
            return output_path, None

        # Get original audio properties to preserve them
        probe_cmd = [ffmpeg_exe, '-i', file_path]
        probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)

        # Extract bitrate and sample rate from probe output
        original_bitrate = 16  # Default to low telephony quality
        original_sample_rate = 8000
        for line in probe_result.stderr.split('\n'):
            if 'Audio:' in line:
                # Try to extract bitrate
                if 'kb/s' in line:
                    try:
                        parts = line.split('kb/s')[0].split()
                        original_bitrate = int(parts[-1].replace(',', ''))
                    except:
                        pass
                # Try to extract sample rate
                if 'Hz' in line:
                    try:
                        for part in line.split(','):
                            if 'Hz' in part:
                                original_sample_rate = int(part.strip().split()[0])
                                break
                    except:
                        pass

        # Apply volume filter preserving original quality
        cmd = [
            ffmpeg_exe, '-y', '-i', file_path,
            '-af', f'volume={volume_adjust}dB',
            '-c:a', 'libmp3lame',
            '-b:a', f'{original_bitrate}k',
            '-ar', str(original_sample_rate),
            output_path
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0 or not os.path.exists(output_path):
            return file_path, f"ffmpeg normalization failed"

        return output_path, None

    except Exception as e:
        return file_path, f"Normalization failed: {str(e)}"


def apply_voice_enhancement(
    file_path: str,
    output_path: Optional[str] = None
) -> Tuple[str, Optional[str]]:
    """
    Apply voice-focused audio enhancement using ffmpeg filters.

    - Applies bandpass filter (300Hz - 3400Hz) for telephony voice
    - Reduces very low and very high frequencies (non-speech)

    Args:
        file_path: Path to input audio file
        output_path: Path for output file

    Returns:
        Tuple of (output_file_path, error_message)
    """
    try:
        import subprocess

        # Get ffmpeg path
        ffmpeg_exe = _ffmpeg_path
        if not ffmpeg_exe:
            try:
                import imageio_ffmpeg
                ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            except ImportError:
                return file_path, "ffmpeg not available"

        # Generate output path
        if output_path is None:
            base, ext = os.path.splitext(file_path)
            output_path = f"{base}_enhanced.mp3"

        # Apply bandpass filter using ffmpeg
        # highpass at 300Hz + lowpass at 3400Hz (telephony voice band)
        cmd = [
            ffmpeg_exe, '-y', '-i', file_path,
            '-af', 'highpass=f=300,lowpass=f=3400',
            '-b:a', '128k',
            output_path
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            return file_path, f"ffmpeg enhancement failed: {result.stderr[:200]}"

        return output_path, None

    except Exception as e:
        return file_path, f"Enhancement failed: {str(e)}"


def preprocess_audio(
    file_path: str,
    output_dir: Optional[str] = None,
    enable_noise_reduction: bool = True,
    enable_normalization: bool = True,
    enable_voice_enhancement: bool = False,
    noise_reduction_strength: float = 0.5
) -> Tuple[str, Dict[str, Any], Optional[str]]:
    """
    Complete audio preprocessing pipeline.

    Args:
        file_path: Path to input audio file
        output_dir: Directory for output files
        enable_noise_reduction: Apply noise reduction
        enable_normalization: Normalize volume
        enable_voice_enhancement: Apply voice bandpass filter
        noise_reduction_strength: 0.0-1.0 for noise reduction

    Returns:
        Tuple of (processed_file_path, processing_info, error_message)
    """
    processing_info = {
        'original_file': file_path,
        'noise_reduction_applied': False,
        'normalization_applied': False,
        'voice_enhancement_applied': False,
        'errors': []
    }

    current_file = file_path

    # Setup output directory
    if output_dir is None:
        output_dir = os.path.dirname(file_path)

    base_name = os.path.splitext(os.path.basename(file_path))[0]

    # Step 1: Noise reduction
    if enable_noise_reduction:
        output_path = os.path.join(output_dir, f"{base_name}_step1_denoised.mp3")
        result, error = reduce_noise(current_file, output_path, noise_reduction_strength)
        if error:
            processing_info['errors'].append(f"Noise reduction: {error}")
        else:
            current_file = result
            processing_info['noise_reduction_applied'] = True

    # Step 2: Voice enhancement (bandpass filter)
    if enable_voice_enhancement:
        output_path = os.path.join(output_dir, f"{base_name}_step2_enhanced.mp3")
        result, error = apply_voice_enhancement(current_file, output_path)
        if error:
            processing_info['errors'].append(f"Voice enhancement: {error}")
        else:
            current_file = result
            processing_info['voice_enhancement_applied'] = True

    # Step 3: Volume normalization
    if enable_normalization:
        output_path = os.path.join(output_dir, f"{base_name}_step3_normalized.mp3")
        result, error = normalize_audio(current_file, output_path)
        if error:
            processing_info['errors'].append(f"Normalization: {error}")
        else:
            current_file = result
            processing_info['normalization_applied'] = True

    # Create final processed file
    final_path = os.path.join(output_dir, f"{base_name}_processed.mp3")
    if current_file != file_path:
        import shutil
        shutil.copy2(current_file, final_path)
        processing_info['processed_file'] = final_path

        # Cleanup intermediate step files
        for step_file in [
            os.path.join(output_dir, f"{base_name}_step1_denoised.mp3"),
            os.path.join(output_dir, f"{base_name}_step2_enhanced.mp3"),
            os.path.join(output_dir, f"{base_name}_step3_normalized.mp3"),
            os.path.join(output_dir, 'temp_input.wav'),
            os.path.join(output_dir, 'temp_denoised.wav'),
        ]:
            if os.path.exists(step_file) and step_file != final_path:
                try:
                    os.remove(step_file)
                except:
                    pass
    else:
        final_path = file_path
        processing_info['processed_file'] = file_path

    # Return error only if ALL processing failed
    error_msg = None
    if processing_info['errors'] and not any([
        processing_info['noise_reduction_applied'],
        processing_info['normalization_applied'],
        processing_info['voice_enhancement_applied']
    ]):
        error_msg = "; ".join(processing_info['errors'])

    return final_path, processing_info, error_msg


def process_audio_for_api_with_preprocessing(
    url: str,
    call_id: str,
    output_dir: Optional[str] = None,
    enable_preprocessing: bool = True,
    noise_reduction_strength: float = 0.5
) -> Tuple[Optional[ProcessedAudio], Dict[str, Any], Optional[str]]:
    """
    Complete audio processing pipeline with optional preprocessing.

    Download → Validate → Preprocess (denoise, normalize) → Encode

    Args:
        url: URL of the audio file
        call_id: Unique identifier for the call
        output_dir: Directory to save temporary files
        enable_preprocessing: Enable noise reduction & normalization
        noise_reduction_strength: 0.0-1.0

    Returns:
        Tuple of (ProcessedAudio, processing_info, error_message)
    """
    processing_info = {'preprocessing_enabled': enable_preprocessing}

    # Create temp directory for this call
    if output_dir is None:
        output_dir = os.path.join(tempfile.gettempdir(), f"call_{call_id}")
    os.makedirs(output_dir, exist_ok=True)

    # Download audio
    file_path, error = download_audio(
        url=url,
        output_dir=output_dir,
        filename_prefix=f"call_{call_id}"
    )
    if error:
        return None, processing_info, f"Download failed: {error}"

    # Validate audio
    metadata = validate_audio_file(file_path)
    if not metadata.is_valid:
        return None, processing_info, f"Validation failed: {metadata.error_message}"

    processing_info['original_size_bytes'] = metadata.file_size_bytes
    processing_info['original_duration'] = metadata.duration_seconds

    # Apply preprocessing if enabled
    final_file_path = file_path
    if enable_preprocessing:
        processed_path, preprocess_info, preprocess_error = preprocess_audio(
            file_path=file_path,
            output_dir=output_dir,
            enable_noise_reduction=True,
            enable_normalization=True,
            enable_voice_enhancement=False,  # Can be harsh on telephony audio
            noise_reduction_strength=noise_reduction_strength
        )
        processing_info.update(preprocess_info)

        if preprocess_error:
            processing_info['preprocessing_warning'] = preprocess_error
            # Continue with original file if preprocessing fails
        else:
            final_file_path = processed_path
            # Update metadata for processed file
            metadata = validate_audio_file(final_file_path)

    # Encode to base64
    base64_content, error = encode_audio_base64(final_file_path)
    if error:
        return None, processing_info, f"Encoding failed: {error}"

    # Get MIME type
    mime_type = get_mime_type(final_file_path)

    processing_info['final_size_bytes'] = os.path.getsize(final_file_path)

    return ProcessedAudio(
        base64_content=base64_content,
        mime_type=mime_type,
        file_path=final_file_path,
        metadata=metadata
    ), processing_info, None
