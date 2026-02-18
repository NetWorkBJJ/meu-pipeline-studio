import sys
import json


def read_draft(params):
    """Read and parse a CapCut draft_content.json file."""
    from capcut_reader import read_draft as _read_draft
    return _read_draft(params["draft_path"])


def read_audio_blocks(params):
    """Read audio blocks from a CapCut draft."""
    from capcut_reader import read_audio_blocks as _read_audio_blocks
    return _read_audio_blocks(params["draft_path"])


def write_text_segments(params):
    """Write text segments to a CapCut draft."""
    from capcut_writer import write_text_segments as _write_text_segments
    return _write_text_segments(params["draft_path"], params["blocks"])


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


METHODS = {
    "read_draft": read_draft,
    "read_audio_blocks": read_audio_blocks,
    "write_text_segments": write_text_segments,
    "update_subtitle_timings": update_subtitle_timings,
    "sync_metadata": sync_metadata,
    "generate_srt": generate_srt,
    "write_video_segments": write_video_segments,
}


def main():
    """Main loop: read JSON-line from stdin, dispatch, write response to stdout."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except json.JSONDecodeError as e:
            continue

        request_id = request.get("id", "unknown")
        method_name = request.get("method")
        params = request.get("params", {})

        if method_name not in METHODS:
            response = {
                "id": request_id,
                "error": {"message": f"Unknown method: {method_name}"}
            }
        else:
            try:
                result = METHODS[method_name](params)
                response = {"id": request_id, "result": result}
            except Exception as e:
                response = {
                    "id": request_id,
                    "error": {"message": str(e)}
                }

        sys.stdout.write(json.dumps(response) + "
")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
