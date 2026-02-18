"""Generate SRT subtitle files from story blocks."""


def _ms_to_srt_time(ms: float) -> str:
    """Convert milliseconds to SRT timestamp format HH:MM:SS,mmm."""
    total_ms = int(ms)
    hours = total_ms // 3600000
    minutes = (total_ms % 3600000) // 60000
    seconds = (total_ms % 60000) // 1000
    millis = total_ms % 1000
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"


def generate_srt(blocks: list, output_path: str) -> dict:
    """Generate an SRT file from a list of blocks.

    Each block should have: index, text, start_ms, end_ms.
    """
    lines = []
    for block in blocks:
        idx = block["index"]
        text = block["text"]
        start = _ms_to_srt_time(block["start_ms"])
        end = _ms_to_srt_time(block["end_ms"])
        lines.append(f"{idx}")
        lines.append(f"{start} --> {end}")
        lines.append(text)
        lines.append("")

    srt_content = "\n".join(lines)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(srt_content)

    return {"output_path": output_path, "block_count": len(blocks)}
