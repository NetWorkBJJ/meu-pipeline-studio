"""
Google Gemini TTS generator for MEU PIPELINE STUDIO.
Communicates via JSON-line protocol with progress events.
Adapted from NardotoStudio content_creator.py.
"""

import sys
import json
import os
import base64
import wave
import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

log = logging.getLogger("bridge.tts")


# ---------------------------------------------------------------------------
# Voice catalog (30 Gemini TTS voices organized by pitch)
# ---------------------------------------------------------------------------

GEMINI_VOICES = {
    # Higher pitch
    "Zephyr": {"id": "Zephyr", "pitch": "higher"},
    "Leda": {"id": "Leda", "pitch": "higher"},
    "Laomedeia": {"id": "Laomedeia", "pitch": "higher"},
    "Achernar": {"id": "Achernar", "pitch": "higher"},
    # Middle pitch
    "Puck": {"id": "Puck", "pitch": "middle"},
    "Kore": {"id": "Kore", "pitch": "middle"},
    "Aoede": {"id": "Aoede", "pitch": "middle"},
    "Callirrhoe": {"id": "Callirrhoe", "pitch": "middle"},
    "Autonoe": {"id": "Autonoe", "pitch": "middle"},
    "Despina": {"id": "Despina", "pitch": "middle"},
    "Erinome": {"id": "Erinome", "pitch": "middle"},
    "Rasalgethi": {"id": "Rasalgethi", "pitch": "middle"},
    "Gacrux": {"id": "Gacrux", "pitch": "middle"},
    "Pulcherrima": {"id": "Pulcherrima", "pitch": "middle"},
    "Vindemiatrix": {"id": "Vindemiatrix", "pitch": "middle"},
    "Sadaltager": {"id": "Sadaltager", "pitch": "middle"},
    "Sulafat": {"id": "Sulafat", "pitch": "middle"},
    # Lower middle pitch
    "Fenrir": {"id": "Fenrir", "pitch": "lower_middle"},
    "Orus": {"id": "Orus", "pitch": "lower_middle"},
    "Iapetus": {"id": "Iapetus", "pitch": "lower_middle"},
    "Umbriel": {"id": "Umbriel", "pitch": "lower_middle"},
    "Alnilam": {"id": "Alnilam", "pitch": "lower_middle"},
    "Schedar": {"id": "Schedar", "pitch": "lower_middle"},
    "Achird": {"id": "Achird", "pitch": "lower_middle"},
    "Zubenelgenubi": {"id": "Zubenelgenubi", "pitch": "lower_middle"},
    # Lower pitch
    "Charon": {"id": "Charon", "pitch": "lower"},
    "Enceladus": {"id": "Enceladus", "pitch": "lower"},
    "Algieba": {"id": "Algieba", "pitch": "lower"},
    "Algenib": {"id": "Algenib", "pitch": "lower"},
    "Sadachbia": {"id": "Sadachbia", "pitch": "lower"},
}


# ---------------------------------------------------------------------------
# Narration styles (35 styles in 4 categories)
# ---------------------------------------------------------------------------

NARRATION_STYLES = {
    # === ENERGIA/INTENSIDADE (7) ===
    "Neutro": {
        "prefix": "",
        "description": "Narracao padrao, sem estilo especifico",
        "category": "Energia",
    },
    "Energetico": {
        "prefix": "Fale de forma energetica, vibrante e cheia de entusiasmo: ",
        "description": "Tom vibrante e animado",
        "category": "Energia",
    },
    "Empolgado": {
        "prefix": "Fale de forma muito empolgada, como se estivesse contando uma novidade incrivel: ",
        "description": "Extremamente animado",
        "category": "Energia",
    },
    "Calmo": {
        "prefix": "Fale de forma calma, pausada e tranquila: ",
        "description": "Tom relaxante e sereno",
        "category": "Energia",
    },
    "Sussurrado": {
        "prefix": "Fale de forma suave e sussurrada, quase como um segredo: ",
        "description": "Tom baixo e intimo",
        "category": "Energia",
    },
    "Intenso": {
        "prefix": "Fale de forma intensa e poderosa, com muita conviccao: ",
        "description": "Tom forte e determinado",
        "category": "Energia",
    },
    "Explosivo": {
        "prefix": "Fale de forma explosiva e impactante, como um narrador de esportes: ",
        "description": "Maximo entusiasmo",
        "category": "Energia",
    },
    # === CONTEXTO/PROFISSAO (10) ===
    "Profissional": {
        "prefix": "Fale de forma profissional, seria e objetiva: ",
        "description": "Tom corporativo e formal",
        "category": "Profissao",
    },
    "Jornalistico": {
        "prefix": "Fale como um ancora de telejornal, com clareza e autoridade: ",
        "description": "Estilo de noticiario",
        "category": "Profissao",
    },
    "Locutor Radio": {
        "prefix": "Fale como um locutor de radio FM, animado e com boa diccao: ",
        "description": "Estilo radio profissional",
        "category": "Profissao",
    },
    "Documentario": {
        "prefix": "Fale como narrador de documentario, com voz grave e contemplativa: ",
        "description": "Estilo Discovery/NatGeo",
        "category": "Profissao",
    },
    "Educativo": {
        "prefix": "Fale de forma didatica, clara e explicativa como um professor: ",
        "description": "Tom de aula/tutorial",
        "category": "Profissao",
    },
    "Coach": {
        "prefix": "Fale como um treinador motivacional, com energia e confianca: ",
        "description": "Estilo motivacional",
        "category": "Profissao",
    },
    "Influencer": {
        "prefix": "Fale como um youtuber popular, casual e conectado com o publico: ",
        "description": "Estilo redes sociais",
        "category": "Profissao",
    },
    "Vendedor": {
        "prefix": "Fale de forma persuasiva e convincente, como um vendedor experiente: ",
        "description": "Estilo comercial",
        "category": "Profissao",
    },
    "Podcast": {
        "prefix": "Fale como host de podcast, conversacional e engajante: ",
        "description": "Estilo conversacional",
        "category": "Profissao",
    },
    "Apresentador TV": {
        "prefix": "Fale como apresentador de TV, carismatico e cativante: ",
        "description": "Estilo televisivo",
        "category": "Profissao",
    },
    # === EMOCAO (10) ===
    "Dramatico": {
        "prefix": "Fale de forma dramatica, intensa e emotiva: ",
        "description": "Tom teatral com emocao",
        "category": "Emocao",
    },
    "Misterioso": {
        "prefix": "Fale de forma misteriosa, suspense e intrigante: ",
        "description": "Tom de suspense/thriller",
        "category": "Emocao",
    },
    "Romantico": {
        "prefix": "Fale de forma romantica, suave e apaixonada: ",
        "description": "Tom amoroso e poetico",
        "category": "Emocao",
    },
    "Nostalgico": {
        "prefix": "Fale de forma nostalgica, como quem lembra do passado com carinho: ",
        "description": "Tom de saudade",
        "category": "Emocao",
    },
    "Esperancoso": {
        "prefix": "Fale de forma esperancosa e otimista, transmitindo positividade: ",
        "description": "Tom otimista",
        "category": "Emocao",
    },
    "Melancolico": {
        "prefix": "Fale de forma melancolica e triste, com emocao contida: ",
        "description": "Tom triste e reflexivo",
        "category": "Emocao",
    },
    "Raiva": {
        "prefix": "Fale de forma seria e firme, com raiva controlada: ",
        "description": "Tom de indignacao",
        "category": "Emocao",
    },
    "Surpreso": {
        "prefix": "Fale como se estivesse revelando algo surpreendente e chocante: ",
        "description": "Tom de revelacao",
        "category": "Emocao",
    },
    "Inspirador": {
        "prefix": "Fale de forma inspiradora, elevando e motivando o ouvinte: ",
        "description": "Tom motivacional",
        "category": "Emocao",
    },
    "Filosofico": {
        "prefix": "Fale de forma reflexiva e filosofica, como um pensador: ",
        "description": "Tom contemplativo",
        "category": "Emocao",
    },
    # === GENERO/ESTILO (8) ===
    "Storytelling": {
        "prefix": "Fale como um contador de historias, envolvente e cativante: ",
        "description": "Narrativa envolvente",
        "category": "Genero",
    },
    "ASMR": {
        "prefix": "Fale de forma muito suave, relaxante e aconchegante como ASMR: ",
        "description": "Tom super relaxante",
        "category": "Genero",
    },
    "Comedia": {
        "prefix": "Fale de forma divertida e bem-humorada, com timing comico: ",
        "description": "Tom de humor",
        "category": "Genero",
    },
    "Terror": {
        "prefix": "Fale de forma sombria e assustadora, como narrador de historia de terror: ",
        "description": "Tom sinistro",
        "category": "Genero",
    },
    "Epico": {
        "prefix": "Fale de forma epica e heroica, como narrador de trailer de filme: ",
        "description": "Tom grandioso",
        "category": "Genero",
    },
    "Cientifico": {
        "prefix": "Fale de forma tecnica e cientifica, precisa e informativa: ",
        "description": "Tom academico",
        "category": "Genero",
    },
    "Infantil": {
        "prefix": "Fale de forma alegre e ludica, como contador de historias infantis: ",
        "description": "Tom para criancas",
        "category": "Genero",
    },
    "Fantasia": {
        "prefix": "Fale como narrador de fantasia medieval, mistico e encantador: ",
        "description": "Tom de mundo magico",
        "category": "Genero",
    },
}


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

SAMPLE_RATE = 24000
SAMPLE_WIDTH = 2  # 16-bit
CHANNELS = 1


def _resolve_voice_id(voice_name: str) -> str:
    """Resolve voice name to Gemini voice ID."""
    entry = GEMINI_VOICES.get(voice_name)
    if entry:
        return entry["id"]
    return "Kore"


def _resolve_narration_prefix(params: dict) -> str:
    """Resolve narration prefix: custom prompt overrides built-in style."""
    custom = params.get("custom_style_prompt", "")
    if custom:
        return custom
    style = params.get("style", "Neutro")
    entry = NARRATION_STYLES.get(style, NARRATION_STYLES.get("Neutro"))
    return entry["prefix"] if entry else ""


def _resolve_tts_model(params: dict) -> str:
    """Resolve TTS model: flash (default) or pro."""
    model = params.get("tts_model", "flash")
    if model == "pro":
        return "gemini-2.5-pro-preview-tts"
    return "gemini-2.5-flash-preview-tts"


def _emit_progress(request_id: str, current: int, total: int, message: str):
    """Emit a progress event through stdout JSON-line protocol."""
    if not request_id:
        return
    progress = {
        "id": request_id,
        "type": "progress",
        "data": {
            "current": current,
            "total": total,
            "message": message,
        },
    }
    sys.stdout.write(json.dumps(progress, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _duration_from_bytes(data: bytes) -> float:
    """Calculate audio duration in seconds from raw PCM bytes."""
    return len(data) / (SAMPLE_RATE * SAMPLE_WIDTH * CHANNELS)


def _save_wav(path: str, data: bytes):
    """Save raw PCM data as a WAV file."""
    with wave.open(path, "wb") as wav:
        wav.setnchannels(CHANNELS)
        wav.setsampwidth(SAMPLE_WIDTH)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(data)


def _call_tts_with_retry(client, model, contents, config, chunk_index):
    """Call Gemini TTS with retry on rate limit."""
    max_retries = 3
    retry_delays = [2, 5, 10]

    for attempt in range(max_retries):
        try:
            return client.models.generate_content(
                model=model, contents=contents, config=config
            )
        except Exception as e:
            error_str = str(e).lower()
            is_rate_limit = "429" in error_str or "rate" in error_str or "quota" in error_str
            if is_rate_limit and attempt < max_retries - 1:
                delay = retry_delays[attempt]
                log.warning(
                    "Rate limited on chunk %d, retrying in %ds (attempt %d/%d)",
                    chunk_index, delay, attempt + 1, max_retries,
                )
                time.sleep(delay)
                continue
            raise


# ---------------------------------------------------------------------------
# Text chunking
# ---------------------------------------------------------------------------

def chunk_text(text: str, max_chars: int = 2000) -> list:
    """Split text at sentence boundaries, respecting max_chars limit."""
    chunks = []
    remaining = text.strip()
    while remaining:
        if len(remaining) <= max_chars:
            chunks.append(remaining)
            break
        cut_point = max_chars
        for i in range(min(max_chars, len(remaining) - 1), max(int(max_chars * 0.5), 0), -1):
            if i < len(remaining) and remaining[i] in ".!?\n":
                cut_point = i + 1
                break
        chunks.append(remaining[:cut_point].strip())
        remaining = remaining[cut_point:].strip()
    return chunks


# ---------------------------------------------------------------------------
# Main TTS generation
# ---------------------------------------------------------------------------

def generate_tts(params: dict) -> dict:
    """
    Generate TTS audio from text using Google Gemini.

    Params:
        api_key, text, chunks, voice, style, custom_style_prompt,
        tts_model, output_dir, generate_srt, max_workers, _request_id
    """
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        return {"success": False, "error": "google-genai not installed. Run: pip install google-genai"}

    api_key = params.get("api_key")
    text = params.get("text", "")
    text_chunks = params.get("chunks", [])
    voice = params.get("voice", "Kore")
    output_dir = params.get("output_dir")
    generate_srt = params.get("generate_srt", False)
    max_workers = params.get("max_workers", 3)
    request_id = params.get("_request_id", "")

    if not api_key:
        return {"success": False, "error": "API key not provided"}
    if not output_dir:
        return {"success": False, "error": "Output directory not provided"}
    if not text_chunks and not text:
        return {"success": False, "error": "Text not provided"}

    client = genai.Client(api_key=api_key)
    voice_id = _resolve_voice_id(voice)
    narration_prefix = _resolve_narration_prefix(params)
    model_name = _resolve_tts_model(params)

    os.makedirs(output_dir, exist_ok=True)

    # Chunk text if not pre-chunked
    chunks = text_chunks if text_chunks else chunk_text(text)
    total = len(chunks)

    _emit_progress(request_id, 0, total, f"Preparando {total} partes de audio...")

    # Build TTS config
    tts_config = types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_id)
            )
        ),
    )

    parts_result = [None] * total
    completed = 0

    def generate_chunk(chunk_text_str, index):
        styled_text = f"{narration_prefix}{chunk_text_str}" if narration_prefix else chunk_text_str
        try:
            response = _call_tts_with_retry(
                client, model_name, styled_text, tts_config, index
            )
            for part in response.candidates[0].content.parts:
                if hasattr(part, "inline_data") and part.inline_data:
                    raw_data = part.inline_data.data
                    if isinstance(raw_data, bytes):
                        return (index, raw_data, None)
                    return (index, base64.b64decode(raw_data), None)
            return (index, None, "No audio data in response")
        except Exception as e:
            return (index, None, str(e))

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(generate_chunk, c, i): i for i, c in enumerate(chunks)
        }
        for future in as_completed(futures):
            idx, data, error = future.result()
            completed += 1

            if data:
                duration_s = _duration_from_bytes(data)
                duration_ms = int(duration_s * 1000)
                part_path = os.path.join(output_dir, f"parte_{idx + 1:02d}.wav")
                _save_wav(part_path, data)

                parts_result[idx] = {
                    "index": idx,
                    "path": part_path,
                    "duration_ms": duration_ms,
                    "status": "ok",
                    "chars": len(chunks[idx]),
                }
                log.info("Chunk %d/%d OK (%.1fs, %d chars)", idx + 1, total, duration_s, len(chunks[idx]))
            else:
                parts_result[idx] = {
                    "index": idx,
                    "path": "",
                    "duration_ms": 0,
                    "status": "error",
                    "error": error or "Unknown error",
                    "chars": len(chunks[idx]),
                }
                log.error("Chunk %d/%d FAILED: %s", idx + 1, total, error)

            _emit_progress(request_id, completed, total, f"Audio: {completed}/{total}")

    # Combine successful parts
    valid_parts = [(i, p) for i, p in enumerate(parts_result) if p and p["status"] == "ok"]
    combined_path = ""
    total_duration_ms = 0

    if valid_parts:
        all_audio = b""
        for i in range(total):
            p = parts_result[i]
            if p and p["status"] == "ok":
                part_path = p["path"]
                with wave.open(part_path, "rb") as wf:
                    all_audio += wf.readframes(wf.getnframes())

        combined_path = os.path.join(output_dir, "audio_completo.wav")
        _save_wav(combined_path, all_audio)
        total_duration_ms = int(_duration_from_bytes(all_audio) * 1000)

    # Generate SRT if requested
    srt_path = None
    if generate_srt and valid_parts:
        srt_path = _generate_srt_from_parts(chunks, parts_result, output_dir)

    _emit_progress(request_id, total, total, "Concluido!")

    return {
        "success": True,
        "output_dir": output_dir,
        "combined_audio_path": combined_path,
        "parts": [p for p in parts_result if p],
        "total_duration_ms": total_duration_ms,
        "srt_path": srt_path,
    }


def _generate_srt_from_parts(chunks, parts_result, output_dir):
    """Generate SRT file from chunk durations."""
    def format_srt_time(seconds):
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    srt_lines = []
    current_time = 0.0
    counter = 1

    for i, chunk_text_str in enumerate(chunks):
        part = parts_result[i] if i < len(parts_result) else None
        if part and part["status"] == "ok" and part["duration_ms"] > 0:
            duration_s = part["duration_ms"] / 1000.0
            start = current_time
            end = current_time + duration_s
            srt_lines.append(str(counter))
            srt_lines.append(f"{format_srt_time(start)} --> {format_srt_time(end)}")
            srt_lines.append(chunk_text_str.strip())
            srt_lines.append("")
            current_time = end
            counter += 1

    srt_path = os.path.join(output_dir, "legendas.srt")
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(srt_lines))
    return srt_path


# ---------------------------------------------------------------------------
# Voice preview
# ---------------------------------------------------------------------------

def preview_voice(params: dict) -> dict:
    """
    Generate a short voice preview (~3 seconds).
    Returns base64-encoded WAV for inline playback.
    """
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        return {"success": False, "error": "google-genai not installed"}

    api_key = params.get("api_key")
    voice = params.get("voice", "Kore")
    sample_text = params.get("sample_text", "")

    if not api_key:
        return {"success": False, "error": "API key not provided"}

    if not sample_text:
        sample_text = "Ola! Este e um teste de voz do Google Gemini. Como esta soando?"

    voice_id = _resolve_voice_id(voice)
    narration_prefix = _resolve_narration_prefix(params)
    styled_text = f"{narration_prefix}{sample_text}" if narration_prefix else sample_text

    client = genai.Client(api_key=api_key)
    model_name = _resolve_tts_model(params)

    tts_config = types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_id)
            )
        ),
    )

    try:
        response = client.models.generate_content(
            model=model_name, contents=styled_text, config=tts_config
        )
        for part in response.candidates[0].content.parts:
            if hasattr(part, "inline_data") and part.inline_data:
                raw_data = part.inline_data.data
                if isinstance(raw_data, str):
                    raw_data = base64.b64decode(raw_data)

                duration_s = _duration_from_bytes(raw_data)

                # Encode as WAV with header for browser playback
                import io
                wav_buffer = io.BytesIO()
                with wave.open(wav_buffer, "wb") as wav:
                    wav.setnchannels(CHANNELS)
                    wav.setsampwidth(SAMPLE_WIDTH)
                    wav.setframerate(SAMPLE_RATE)
                    wav.writeframes(raw_data)

                wav_b64 = base64.b64encode(wav_buffer.getvalue()).decode("ascii")
                return {
                    "success": True,
                    "audio_base64": wav_b64,
                    "duration_s": round(duration_s, 2),
                }

        return {"success": False, "error": "No audio data in response"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ---------------------------------------------------------------------------
# Catalog endpoints
# ---------------------------------------------------------------------------

def list_voices(params: dict) -> dict:
    """Return the catalog of available Gemini TTS voices."""
    voices = []
    for name, info in GEMINI_VOICES.items():
        voices.append({
            "name": name,
            "id": info["id"],
            "pitch": info["pitch"],
        })
    return {"voices": voices}


def list_narration_styles(params: dict) -> dict:
    """Return available narration style presets."""
    styles = []
    for key, config in NARRATION_STYLES.items():
        styles.append({
            "key": key,
            "description": config.get("description", ""),
            "category": config.get("category", ""),
        })
    return {"styles": styles}
