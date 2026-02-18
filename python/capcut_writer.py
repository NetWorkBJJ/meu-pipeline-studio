"""Write and modify CapCut draft_content.json files."""

import json
import uuid
from pathlib import Path


def _generate_id() -> str:
    """Generate a CapCut-style UUID."""
    return str(uuid.uuid4()).upper()


def _make_text_content(text: str) -> str:
    """Create the styled content JSON string for a text material."""
    content = {
        "styles": [{
            "font": {"id": "", "path": ""},
            "range": [0, len(text)],
            "size": 8.0,
            "fill": {"content": {"solid": {"color": [1.0, 1.0, 1.0]}}},
            "useLetterColor": True,
            "bold": False,
            "italic": False,
        }],
        "text": text,
    }
    return json.dumps(content, ensure_ascii=False)


def _make_default_extra_materials() -> dict:
    """Create default companion materials that each segment needs.

    Returns a dict with material entries and the list of refs.
    """
    speed_id = _generate_id()
    canvas_id = _generate_id()
    color_id = _generate_id()

    speed = {
        "id": speed_id,
        "type": "speed",
        "mode": 0,
        "speed": 1.0,
        "curve_speed": None,
    }

    canvas = {
        "id": canvas_id,
        "type": "canvas_param",
    }

    color = {
        "id": color_id,
        "type": "material_color",
        "value": "",
    }

    return {
        "speed": speed,
        "canvas": canvas,
        "color": color,
        "refs": [speed_id, canvas_id, color_id],
    }


def write_text_segments(draft_path: str, blocks: list) -> dict:
    """Add text subtitle segments to the CapCut draft.

    Each block should have: text, start_ms, end_ms.
    Creates both the text track segments and the text materials.
    Does NOT modify existing segments or materials.
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    materials = draft.setdefault("materials", {})
    texts = materials.setdefault("texts", [])
    speeds = materials.setdefault("speeds", [])
    canvases = materials.setdefault("canvases", [])
    material_colors = materials.setdefault("material_colors", [])

    text_track = None
    for track in draft.get("tracks", []):
        if track.get("type") == "text":
            text_track = track
            break

    if text_track is None:
        text_track = {
            "id": _generate_id(),
            "type": "text",
            "segments": [],
            "flag": 1,
            "attribute": 0,
        }
        draft.setdefault("tracks", []).append(text_track)

    render_base = 14000
    added_segments = []

    for i, block in enumerate(blocks):
        text = block["text"]
        start_ms = block["start_ms"]
        end_ms = block["end_ms"]
        dur_ms = end_ms - start_ms

        start_us = int(start_ms * 1000)
        dur_us = int(dur_ms * 1000)

        mat_id = _generate_id()
        seg_id = _generate_id()

        text_material = {
            "id": mat_id,
            "type": "subtitle",
            "recognize_text": text,
            "content": _make_text_content(text),
            "font_path": "",
            "text_color": "#FFFFFF",
            "text_size": 30,
            "alignment": 1,
            "words": {
                "end_time": [],
                "start_time": [],
                "text": [],
            },
        }
        texts.append(text_material)

        extras = _make_default_extra_materials()
        speeds.append(extras["speed"])
        canvases.append(extras["canvas"])
        material_colors.append(extras["color"])

        segment = {
            "id": seg_id,
            "material_id": mat_id,
            "target_timerange": {
                "start": start_us,
                "duration": dur_us,
            },
            "source_timerange": None,
            "render_index": render_base + i,
            "clip": {
                "alpha": 1.0,
                "flip": {"horizontal": False, "vertical": False},
                "rotation": 0.0,
                "scale": {"x": 1.0, "y": 1.0},
                "transform": {"x": 0.0, "y": -0.73},
            },
            "extra_material_refs": extras["refs"],
            "visible": True,
            "volume": 1.0,
            "source": "segmentsourcenormal",
        }
        text_track["segments"].append(segment)
        added_segments.append({
            "segment_id": seg_id,
            "material_id": mat_id,
            "text": text,
        })

    with open(path, "w", encoding="utf-8") as f:
        json.dump(draft, f, ensure_ascii=False)

    return {"added_count": len(added_segments), "segments": added_segments}


def update_subtitle_timings(draft_path: str, blocks: list) -> dict:
    """Update timing of existing text segments without changing text content.

    Each block should have: material_id, start_ms, end_ms.
    NEVER modifies the text content, only the timing.
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    timing_map = {}
    for block in blocks:
        timing_map[block["material_id"]] = {
            "start_us": int(block["start_ms"] * 1000),
            "duration_us": int((block["end_ms"] - block["start_ms"]) * 1000),
        }

    updated_count = 0
    for track in draft.get("tracks", []):
        if track.get("type") != "text":
            continue
        for seg in track.get("segments", []):
            mat_id = seg.get("material_id", "")
            if mat_id in timing_map:
                seg["target_timerange"]["start"] = timing_map[mat_id]["start_us"]
                seg["target_timerange"]["duration"] = timing_map[mat_id]["duration_us"]
                updated_count += 1

    with open(path, "w", encoding="utf-8") as f:
        json.dump(draft, f, ensure_ascii=False)

    return {"updated_count": updated_count}


def write_video_segments(draft_path: str, scenes: list) -> dict:
    """Add video/photo segments to the CapCut draft.

    Each scene should have: media_path, start_ms, end_ms, media_type ('video'|'photo').
    Creates both the video track segments and the video materials.
    Does NOT modify existing segments or materials.
    NEVER alters existing audio segments.
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    materials = draft.setdefault("materials", {})
    videos = materials.setdefault("videos", [])
    speeds = materials.setdefault("speeds", [])
    canvases = materials.setdefault("canvases", [])
    material_colors = materials.setdefault("material_colors", [])
    sound_channel_mappings = materials.setdefault("sound_channel_mappings", [])

    video_track = None
    for track in draft.get("tracks", []):
        if track.get("type") == "video":
            video_track = track
            break

    if video_track is None:
        video_track = {
            "id": _generate_id(),
            "type": "video",
            "segments": [],
            "flag": 0,
            "attribute": 0,
        }
        draft.setdefault("tracks", []).insert(0, video_track)

    added_segments = []

    for i, scene in enumerate(scenes):
        media_path = scene["media_path"]
        start_ms = scene["start_ms"]
        end_ms = scene["end_ms"]
        media_type = scene.get("media_type", "video")
        dur_ms = end_ms - start_ms

        start_us = int(start_ms * 1000)
        dur_us = int(dur_ms * 1000)

        mat_id = _generate_id()
        seg_id = _generate_id()

        video_material = {
            "id": mat_id,
            "type": media_type,
            "path": media_path,
            "duration": dur_us,
            "width": 1920,
            "height": 1080,
        }
        videos.append(video_material)

        extras = _make_default_extra_materials()
        speeds.append(extras["speed"])
        canvases.append(extras["canvas"])
        material_colors.append(extras["color"])

        scm_id = _generate_id()
        sound_channel_mappings.append({
            "id": scm_id,
            "type": "none",
        })
        extra_refs = extras["refs"] + [scm_id]

        segment = {
            "id": seg_id,
            "material_id": mat_id,
            "target_timerange": {
                "start": start_us,
                "duration": dur_us,
            },
            "source_timerange": {
                "start": 0,
                "duration": dur_us,
            },
            "render_index": 11000 + i,
            "clip": {
                "alpha": 1.0,
                "flip": {"horizontal": False, "vertical": False},
                "rotation": 0.0,
                "scale": {"x": 1.0, "y": 1.0},
                "transform": {"x": 0.0, "y": 0.0},
            },
            "extra_material_refs": extra_refs,
            "visible": True,
            "volume": 1.0,
            "source": "segmentsourcenormal",
        }
        video_track["segments"].append(segment)
        added_segments.append({
            "segment_id": seg_id,
            "material_id": mat_id,
            "media_path": media_path,
        })

    with open(path, "w", encoding="utf-8") as f:
        json.dump(draft, f, ensure_ascii=False)

    return {"added_count": len(added_segments), "segments": added_segments}
