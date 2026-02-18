"""Read and extract data from CapCut draft_content.json files."""

import json
from pathlib import Path


def read_draft(draft_path: str) -> dict:
    """Read a CapCut draft and return a summary of its structure.

    Returns a dict with: canvas_config, duration_ms, tracks summary,
    text_materials, audio_materials, video_materials.
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    canvas = draft.get("canvas_config", {})
    duration_us = draft.get("duration", 0)
    tracks_raw = draft.get("tracks", [])

    tracks_summary = []
    for track in tracks_raw:
        tracks_summary.append({
            "type": track.get("type", "unknown"),
            "segment_count": len(track.get("segments", [])),
            "id": track.get("id", ""),
        })

    materials = draft.get("materials", {})

    text_materials = []
    for m in materials.get("texts", []):
        text_materials.append({
            "id": m.get("id", ""),
            "recognize_text": m.get("recognize_text", ""),
            "type": m.get("type", ""),
            "text_color": m.get("text_color", ""),
            "text_size": m.get("text_size", 0),
        })

    audio_materials = []
    for m in materials.get("audios", []):
        audio_materials.append({
            "id": m.get("id", ""),
            "path": m.get("path", ""),
            "duration": m.get("duration", 0),
            "tone_type": m.get("tone_type", ""),
            "tone_platform": m.get("tone_platform", ""),
            "type": m.get("type", ""),
        })

    video_materials = []
    for m in materials.get("videos", []):
        video_materials.append({
            "id": m.get("id", ""),
            "path": m.get("path", ""),
            "type": m.get("type", ""),
            "width": m.get("width", 0),
            "height": m.get("height", 0),
            "duration": m.get("duration", 0),
        })

    return {
        "canvas_config": {
            "width": canvas.get("width", 0),
            "height": canvas.get("height", 0),
            "ratio": canvas.get("ratio", ""),
        },
        "duration_ms": duration_us / 1000,
        "tracks": tracks_summary,
        "text_materials": text_materials,
        "audio_materials": audio_materials,
        "video_materials": video_materials,
    }


def read_audio_blocks(draft_path: str) -> list:
    """Read audio segments from the draft and return as blocks.

    Each block contains: id, material_id, start_ms, end_ms, duration_ms,
    file_path, tone_type, tone_platform.
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    tracks = draft.get("tracks", [])
    materials = draft.get("materials", {})

    audio_materials_map = {}
    for m in materials.get("audios", []):
        audio_materials_map[m["id"]] = m

    blocks = []
    for track in tracks:
        if track.get("type") != "audio":
            continue
        for seg in track.get("segments", []):
            tr = seg.get("target_timerange", {})
            start_us = tr.get("start", 0)
            dur_us = tr.get("duration", 0)
            mat_id = seg.get("material_id", "")
            mat = audio_materials_map.get(mat_id, {})

            blocks.append({
                "id": seg.get("id", ""),
                "material_id": mat_id,
                "start_ms": start_us / 1000,
                "end_ms": (start_us + dur_us) / 1000,
                "duration_ms": dur_us / 1000,
                "file_path": mat.get("path", ""),
                "tone_type": mat.get("tone_type", ""),
                "tone_platform": mat.get("tone_platform", ""),
            })

    blocks.sort(key=lambda b: b["start_ms"])
    return blocks
