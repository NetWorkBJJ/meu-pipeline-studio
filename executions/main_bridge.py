import sys
import json
import os
import time
import logging
from datetime import datetime, timedelta
from pathlib import Path


# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

def _setup_logging():
    """Configure structured logging to file and stderr."""
    if sys.platform == "darwin":
        log_dir = Path.home() / "Library" / "Application Support" / "workflowaa" / "logs"
    elif sys.platform == "win32":
        log_dir = Path(os.environ.get("APPDATA", "")) / "workflowaa" / "logs"
    else:
        log_dir = Path.home() / ".config" / "workflowaa" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    # Cleanup old logs (keep last 7 days)
    cutoff = datetime.now() - timedelta(days=7)
    for log_file in log_dir.glob("bridge-*.log"):
        try:
            date_str = log_file.stem.replace("bridge-", "")
            file_date = datetime.strptime(date_str, "%Y-%m-%d")
            if file_date < cutoff:
                log_file.unlink()
        except (ValueError, OSError):
            pass

    log_path = log_dir / f"bridge-{datetime.now().strftime('%Y-%m-%d')}.log"

    logger = logging.getLogger("bridge")
    logger.setLevel(logging.DEBUG)

    # File handler
    fh = logging.FileHandler(str(log_path), encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(logging.Formatter(
        "%(asctime)s | %(levelname)-5s | %(message)s",
        datefmt="%H:%M:%S",
    ))
    logger.addHandler(fh)

    return logger


log = _setup_logging()


def _summarize(obj, max_len=200):
    """Create a short summary of an object for logging."""
    s = json.dumps(obj, ensure_ascii=False, default=str)
    if len(s) > max_len:
        return s[:max_len] + "..."
    return s


# ---------------------------------------------------------------------------
# Method wrappers
# ---------------------------------------------------------------------------

def read_draft(params):
    """Read and parse a CapCut draft_content.json file."""
    from capcut_reader import read_draft as _read_draft
    return _read_draft(params["draft_path"])


def read_audio_blocks(params):
    """Read audio blocks from a CapCut draft."""
    from capcut_reader import read_audio_blocks as _read_audio_blocks
    return _read_audio_blocks(params["draft_path"])


def read_subtitles(params):
    """Read all subtitle texts with timestamps from a CapCut draft."""
    from capcut_reader import read_subtitles as _read_subtitles
    return _read_subtitles(params["draft_path"])


def write_text_segments(params):
    """Write text segments to a CapCut draft."""
    from capcut_writer import write_text_segments as _write_text_segments
    return _write_text_segments(params["draft_path"], params["blocks"])


def update_subtitle_texts(params):
    """Update text content of existing subtitles."""
    from capcut_writer import update_subtitle_texts as _update
    return _update(params["draft_path"], params["updates"])


def clear_text_segments(params):
    """Remove all text segments and materials from a CapCut draft."""
    from capcut_writer import clear_text_segments as _clear
    return _clear(params["draft_path"])


def clear_video_segments(params):
    """Remove all video segments and materials from a CapCut draft."""
    from capcut_writer import clear_video_segments as _clear
    return _clear(params["draft_path"])


def update_subtitle_timings(params):
    """Update subtitle timings in a CapCut draft."""
    from capcut_writer import update_subtitle_timings as _update_subtitle_timings
    return _update_subtitle_timings(params["draft_path"], params["blocks"])


def sync_metadata(params):
    """Sync metadata files after draft modification."""
    from metadata_sync import sync_metadata as _sync_metadata
    return _sync_metadata(params["draft_dir"])


def generate_srt(params):
    """Generate an SRT file from blocks."""
    from srt_generator import generate_srt as _generate_srt
    return _generate_srt(params["blocks"], params["output_path"])


def write_video_segments(params):
    """Write video segments to a CapCut draft."""
    from capcut_writer import write_video_segments as _write_video_segments
    return _write_video_segments(params["draft_path"], params["scenes"])


def _verify_sync(draft_path, sync_params):
    """Verify sync_project results persisted on disk. Returns mismatch count."""
    with open(draft_path, "r", encoding="utf-8") as f:
        verify = json.load(f)

    audio_segs = []
    text_segs = []
    for t in verify.get("tracks", []):
        if t.get("type") == "audio":
            audio_segs.extend(t.get("segments", []))
        elif t.get("type") == "text":
            text_segs.extend(t.get("segments", []))

    audio_count = sum(1 for t in verify.get("tracks", []) if t.get("type") == "audio")
    audio_segs.sort(key=lambda s: s.get("target_timerange", {}).get("start", 0))
    text_segs.sort(key=lambda s: s.get("target_timerange", {}).get("start", 0))

    mismatches = 0
    total = min(len(audio_segs), len(text_segs))
    for i in range(total):
        a = audio_segs[i].get("target_timerange", {})
        t = text_segs[i].get("target_timerange", {})
        if a.get("start") != t.get("start") or a.get("duration") != t.get("duration"):
            mismatches += 1

    log.info(
        "sync_project verify: audio_tracks=%d, audio_segs=%d, text_segs=%d, mismatches=%d/%d",
        audio_count, len(audio_segs), len(text_segs), mismatches, total,
    )
    return mismatches, audio_count


def sync_project(params):
    """Synchronize audio, video, and text segments in timeline."""
    from sync_engine import sync_project as _sync_project
    from metadata_sync import sync_metadata as _sync_metadata

    draft_path = params["draft_path"]
    sync_kwargs = dict(
        draft_path=draft_path,
        audio_track_index=params.get("audio_track_index", 0),
        mode=params.get("mode", "audio"),
        sync_subtitles=params.get("sync_subtitles", True),
        apply_animations=params.get("apply_animations", False),
    )

    result = _sync_project(**sync_kwargs)

    # Sync metadata after modifying the draft
    draft_dir = os.path.dirname(draft_path)
    _sync_metadata(draft_dir)

    # Verify: check BOTH audio track count AND text timing alignment
    time.sleep(0.5)
    mismatches, audio_count = _verify_sync(draft_path, sync_kwargs)

    if mismatches > 0 or audio_count > 1:
        log.warning(
            "sync_project verification FAILED (mismatches=%d, audio_tracks=%d). Retrying...",
            mismatches, audio_count,
        )
        time.sleep(1.0)
        result = _sync_project(**sync_kwargs)
        _sync_metadata(draft_dir)

        # Second verification
        time.sleep(1.0)
        mismatches2, audio_count2 = _verify_sync(draft_path, sync_kwargs)
        if mismatches2 > 0 or audio_count2 > 1:
            log.error(
                "sync_project STILL FAILED after retry (mismatches=%d, audio_tracks=%d)",
                mismatches2, audio_count2,
            )

    return result


def apply_animations(params):
    """Apply random animations to photo segments."""
    from sync_engine import apply_animations_to_images as _apply
    return _apply(params["draft_path"])


def analyze_project(params):
    """Analyze project and return track summary."""
    from capcut_writer import analyze_project as _analyze
    return _analyze(params["draft_path"])


def create_project(params):
    """Create a new CapCut project."""
    from capcut_writer import create_project as _create
    return _create(params["name"])


def list_projects(params):
    """List all CapCut projects."""
    from capcut_writer import list_projects as _list
    return _list()


def insert_media_batch(params):
    """Insert media files in batch into CapCut draft."""
    from capcut_writer import insert_media_batch as _insert
    return _insert(
        draft_path=params["draft_path"],
        media_files=params["media_files"],
        image_duration_ms=params.get("image_duration_ms", 5000),
    )


def create_backup(params):
    """Create a backup of draft_content.json."""
    from capcut_writer import create_backup as _backup
    result = _backup(params["draft_path"])
    return {"backup_path": result}


def insert_audio_batch(params):
    """Insert audio files in batch into CapCut draft."""
    from capcut_writer import insert_audio_batch as _insert
    return _insert(
        draft_path=params["draft_path"],
        audio_files=params["audio_files"],
        use_existing_track=params.get("use_existing_track", False),
    )


def insert_srt(params):
    """Insert SRT subtitles matched to audio tracks by basename."""
    from sync_engine import insert_srt as _insert
    return _insert(
        draft_path=params["draft_path"],
        srt_file_paths=params["srt_file_paths"],
        create_title=params.get("create_title", True),
        separate_tracks=params.get("separate_tracks", False),
    )


def insert_srt_batch(params):
    """Insert SRT files sequentially into the timeline."""
    from sync_engine import insert_srt_batch as _insert
    return _insert(
        draft_path=params["draft_path"],
        srt_files=params["srt_files"],
        create_title=params.get("create_title", True),
        gap_us=params.get("gap_us", 2000000),
    )


def flatten_audio(params):
    """Consolidate all audio tracks into a single sequential track."""
    from sync_engine import flatten_audio_tracks as _flatten
    from metadata_sync import sync_metadata as _sync_metadata

    draft_path = params["draft_path"]
    result = _flatten(draft_path)

    # Sync metadata immediately after modifying the draft
    draft_dir = os.path.dirname(draft_path)
    _sync_metadata(draft_dir)

    # Verify the write persisted (detect if CapCut overwrote during shutdown)
    import json as _json
    time.sleep(0.5)
    with open(draft_path, "r", encoding="utf-8") as f:
        verify = _json.load(f)
    audio_count = sum(1 for t in verify.get("tracks", []) if t.get("type") == "audio")
    if audio_count > 1:
        log.warning("Flatten was overwritten! Re-running flatten_audio (%d audio tracks found)", audio_count)
        result = _flatten(draft_path)
        _sync_metadata(draft_dir)

    return result


def loop_video(params):
    """Repeat video segments to fill audio duration."""
    from sync_engine import loop_video as _loop
    from metadata_sync import sync_metadata as _sync_metadata

    draft_path = params["draft_path"]
    result = _loop(
        draft_path=draft_path,
        audio_track_index=params.get("audio_track_index", 0),
        order=params.get("order", "random"),
    )

    draft_dir = os.path.dirname(draft_path)
    _sync_metadata(draft_dir)

    return result


def loop_audio(params):
    """Repeat audio segments to fill target duration."""
    from sync_engine import loop_audio as _loop
    from metadata_sync import sync_metadata as _sync_metadata

    draft_path = params["draft_path"]
    result = _loop(
        draft_path=draft_path,
        track_index=params["track_index"],
        target_duration_us=params["target_duration_us"],
    )

    draft_dir = os.path.dirname(draft_path)
    _sync_metadata(draft_dir)

    return result


# ---------------------------------------------------------------------------
# Debug methods
# ---------------------------------------------------------------------------

def validate_project(params):
    """Validate a CapCut project structure."""
    from debug_tools import validate_project as _validate
    return _validate(params["project_path"])


def diagnose_root_meta(params):
    """Diagnose root_meta_info.json for a project."""
    from debug_tools import diagnose_root_meta as _diagnose
    return _diagnose(params["project_name"])


def check_capcut_running(params):
    """Check if CapCut is currently running."""
    from debug_tools import check_capcut_running as _check
    return _check()


def close_capcut(params):
    """Close CapCut Desktop gracefully, then force if needed."""
    from debug_tools import close_capcut as _close
    return _close()


def get_project_health(params):
    """Get comprehensive project health report."""
    from debug_tools import get_project_health as _health
    return _health(params["project_path"])


def debug_sync_state(params):
    """Read the actual draft from disk and diagnose sync state."""
    from debug_tools import debug_sync_state as _debug
    return _debug(
        params["draft_path"],
        params.get("expected_segments"),
    )


# ---------------------------------------------------------------------------
# TTS methods
# ---------------------------------------------------------------------------

def tts_generate(params):
    """Generate TTS audio from text using Google Gemini."""
    from tts_generator import generate_tts
    return generate_tts(params)


def tts_preview_voice(params):
    """Generate a short voice preview."""
    from tts_generator import preview_voice
    return preview_voice(params)


def tts_list_voices(params):
    """List available Gemini TTS voices."""
    from tts_generator import list_voices
    return list_voices(params)


def tts_list_styles(params):
    """List available narration styles."""
    from tts_generator import list_narration_styles
    return list_narration_styles(params)


def load_full_project(params):
    """Load full project data for app hydration."""
    from capcut_reader import load_full_project as _load
    return _load(params["draft_path"])


# ---------------------------------------------------------------------------
# Director methods
# ---------------------------------------------------------------------------

def director_check_llm(params):
    """Check if an LLM CLI tool is available."""
    from llm_director import check_llm_cli
    return check_llm_cli(params)


def director_analyze_narrative(params):
    """Analyze script narrative using LLM."""
    from llm_director import analyze_narrative
    return analyze_narrative(params)


def director_generate_prompts(params):
    """Generate media prompts for scenes using LLM."""
    from llm_director import generate_prompts
    return generate_prompts(params)


def director_decide_media_types(params):
    """Let LLM decide video vs image per scene."""
    from llm_director import decide_media_types
    return decide_media_types(params)


def director_export_prompts(params):
    """Export scene prompts as structured document."""
    from llm_director import export_prompts
    return export_prompts(params)


def director_match_media(params):
    """Match imported media files to planned scenes."""
    from media_matcher import match_media_to_scenes
    return match_media_to_scenes(params)


def director_scan_media_folder(params):
    """Scan a folder for media files sorted by extracted number."""
    from media_matcher import scan_media_folder
    return scan_media_folder(params)


def ping(params):
    """Health check: confirms Python bridge is alive."""
    return {"ok": True, "pid": os.getpid()}


METHODS = {
    "ping": ping,
    "read_draft": read_draft,
    "load_full_project": load_full_project,
    "read_audio_blocks": read_audio_blocks,
    "read_subtitles": read_subtitles,
    "update_subtitle_texts": update_subtitle_texts,
    "write_text_segments": write_text_segments,
    "clear_text_segments": clear_text_segments,
    "clear_video_segments": clear_video_segments,
    "update_subtitle_timings": update_subtitle_timings,
    "sync_metadata": sync_metadata,
    "generate_srt": generate_srt,
    "write_video_segments": write_video_segments,
    "sync_project": sync_project,
    "apply_animations": apply_animations,
    "analyze_project": analyze_project,
    "create_project": create_project,
    "list_projects": list_projects,
    "insert_media_batch": insert_media_batch,
    "create_backup": create_backup,
    "insert_audio_batch": insert_audio_batch,
    "insert_srt": insert_srt,
    "insert_srt_batch": insert_srt_batch,
    "flatten_audio": flatten_audio,
    "loop_video": loop_video,
    "loop_audio": loop_audio,
    # Debug methods
    "validate_project": validate_project,
    "diagnose_root_meta": diagnose_root_meta,
    "check_capcut_running": check_capcut_running,
    "close_capcut": close_capcut,
    "get_project_health": get_project_health,
    "debug_sync_state": debug_sync_state,
    # TTS methods
    "tts_generate": tts_generate,
    "tts_preview_voice": tts_preview_voice,
    "tts_list_voices": tts_list_voices,
    "tts_list_styles": tts_list_styles,
    # Director methods
    "director_check_llm": director_check_llm,
    "director_analyze_narrative": director_analyze_narrative,
    "director_generate_prompts": director_generate_prompts,
    "director_decide_media_types": director_decide_media_types,
    "director_export_prompts": director_export_prompts,
    "director_match_media": director_match_media,
    "director_scan_media_folder": director_scan_media_folder,
}


def main():
    """Main loop: read JSON-line from stdin, dispatch, write response to stdout."""
    # Force UTF-8 for stdin/stdout on Windows
    if sys.platform == "win32":
        import io
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8")
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", write_through=True)

    log.info("Python bridge started (PID=%d)", os.getpid())
    log.info("Methods available: %s", sorted(METHODS.keys()))

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            log.warning("Invalid JSON received: %s", line[:100])
            continue

        request_id = request.get("id", "unknown")
        method_name = request.get("method")
        params = request.get("params", {})

        log.info(">>> [%s] %s params=%s", request_id[:8], method_name, _summarize(params))
        start_time = time.time()

        if method_name not in METHODS:
            elapsed_ms = int((time.time() - start_time) * 1000)
            log.error("<<< [%s] %s UNKNOWN_METHOD (%dms)", request_id[:8], method_name, elapsed_ms)
            response = {
                "id": request_id,
                "error": {"message": f"Unknown method: {method_name}"}
            }
        else:
            try:
                params["_request_id"] = request_id
                result = METHODS[method_name](params)
                elapsed_ms = int((time.time() - start_time) * 1000)
                log.info(
                    "<<< [%s] %s OK (%dms) result=%s",
                    request_id[:8], method_name, elapsed_ms, _summarize(result),
                )
                response = {"id": request_id, "result": result}
            except Exception as e:
                elapsed_ms = int((time.time() - start_time) * 1000)
                log.error(
                    "<<< [%s] %s ERROR (%dms): %s",
                    request_id[:8], method_name, elapsed_ms, str(e),
                    exc_info=True,
                )
                response = {
                    "id": request_id,
                    "error": {"message": str(e)}
                }

        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()

    log.info("Python bridge shutting down")


if __name__ == "__main__":
    main()
