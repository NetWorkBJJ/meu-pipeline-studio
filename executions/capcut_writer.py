"""Write and modify CapCut draft_content.json files.

Uses real CapCut JSON templates for safe material creation.
Includes backup system, project creation, and batch media insertion.
"""

import json
import os
import shutil
import subprocess
import uuid
from datetime import datetime
from pathlib import Path

from draft_io import save_draft
from template_loader import load_template


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

def _get_capcut_projects_path() -> Path:
    """Get the CapCut projects path based on the current platform."""
    import sys as _sys
    if _sys.platform == "darwin":
        return Path.home() / "Movies" / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"
    return Path(
        os.environ.get("LOCALAPPDATA", "")
    ) / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"


CAPCUT_PROJECTS_PATH = _get_capcut_projects_path()

MAX_BACKUPS = 10

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".aac", ".m4a", ".ogg", ".flac", ".wma"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _generate_id() -> str:
    """Generate a CapCut-style UUID (uppercase with hyphens)."""
    return str(uuid.uuid4()).upper()


def _get_timestamp_us() -> int:
    """Get current timestamp in microseconds."""
    return int(datetime.now().timestamp() * 1_000_000)


def hex_to_rgb(hex_color: str) -> list:
    """Convert hex color to normalized RGB [r, g, b] (0.0-1.0)."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) != 6:
        return [1.0, 1.0, 1.0]
    try:
        r = int(hex_color[0:2], 16) / 255.0
        g = int(hex_color[2:4], 16) / 255.0
        b = int(hex_color[4:6], 16) / 255.0
        return [r, g, b]
    except ValueError:
        return [1.0, 1.0, 1.0]


def _make_text_content(text: str, font_size: float = 8.0,
                       color: list | None = None) -> str:
    """Create the styled content JSON string for a text material."""
    if color is None:
        color = [1.0, 1.0, 1.0]
    content = {
        "styles": [{
            "font": {"id": "", "path": ""},
            "range": [0, len(text)],
            "size": font_size,
            "fill": {"content": {"solid": {"color": color}}},
            "useLetterColor": True,
            "bold": False,
            "italic": False,
        }],
        "text": text,
    }
    return json.dumps(content, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Backup System
# ---------------------------------------------------------------------------

def create_backup(draft_path: str) -> str | None:
    """Create a timestamped backup of draft_content.json.

    Backups are stored in .backups/ inside the project folder.
    Keeps a maximum of MAX_BACKUPS, deletes oldest when exceeded.

    Returns the backup path or None if backup failed.
    """
    path = Path(draft_path)
    if not path.exists():
        return None

    backup_dir = path.parent / ".backups"
    backup_dir.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = backup_dir / f"draft_content_{timestamp}.json"

    shutil.copy2(str(path), str(backup_path))

    # Cleanup old backups (keep MAX_BACKUPS most recent)
    backups = sorted(backup_dir.glob("draft_content_*.json"))
    while len(backups) > MAX_BACKUPS:
        oldest = backups.pop(0)
        oldest.unlink(missing_ok=True)

    return str(backup_path)


# ---------------------------------------------------------------------------
# Auxiliary Materials (for video/photo segments)
# ---------------------------------------------------------------------------

def _make_extra_materials_video() -> dict:
    """Create companion materials for a video/photo segment.

    Returns a dict with material entries and the list of extra_material_refs.
    Includes: speed, placeholder_info, canvas, sound_channel_mapping, color,
    vocal_separation.  Matches the complete NardotoStudio reference structure.
    """
    speed_id = _generate_id()
    placeholder_id = _generate_id()
    canvas_id = _generate_id()
    channel_id = _generate_id()
    color_id = _generate_id()
    vocal_id = _generate_id()

    speed = {
        "curve_speed": None,
        "id": speed_id,
        "mode": 0,
        "speed": 1.0,
        "type": "speed",
    }

    placeholder = {
        "error_path": "",
        "error_text": "",
        "id": placeholder_id,
        "meta_type": "none",
        "res_path": "",
        "res_text": "",
        "type": "placeholder_info",
    }

    canvas = {
        "album_image": "",
        "blur": 0.0,
        "color": "",
        "id": canvas_id,
        "image": "",
        "image_id": "",
        "image_name": "",
        "source_platform": 0,
        "team_id": "",
        "type": "canvas_color",
    }

    channel = {
        "audio_channel_mapping": 0,
        "id": channel_id,
        "is_config_open": False,
        "type": "none",
    }

    color = {
        "gradient_angle": 90.0,
        "gradient_colors": [],
        "gradient_percents": [],
        "height": 0.0,
        "id": color_id,
        "is_color_clip": False,
        "is_gradient": False,
        "solid_color": "",
        "width": 0.0,
    }

    vocal = {
        "choice": 0,
        "enter_from": "",
        "final_algorithm": "",
        "id": vocal_id,
        "production_path": "",
        "removed_sounds": [],
        "time_range": None,
        "type": "vocal_separation",
    }

    return {
        "speed": speed,
        "placeholder": placeholder,
        "canvas": canvas,
        "sound_channel_mapping": channel,
        "color": color,
        "vocal_separation": vocal,
        "refs": [speed_id, placeholder_id, canvas_id, channel_id, color_id, vocal_id],
    }


# ---------------------------------------------------------------------------
# Text Segments (Template-Based)
# ---------------------------------------------------------------------------

def write_text_segments(draft_path: str, blocks: list) -> dict:
    """Add text subtitle segments to the CapCut draft using real templates.

    Each block should have: text, start_ms, end_ms.
    Optional: text_color (hex), text_size (int), font_size (float).
    Creates both the text track segments and the text materials.
    Does NOT modify existing segments or materials.
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    create_backup(draft_path)

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    materials = draft.setdefault("materials", {})
    texts = materials.setdefault("texts", [])
    anims = materials.setdefault("material_animations", [])

    # Find or create text track
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

    group_id = f"import_{int(datetime.now().timestamp() * 1000)}"
    added_segments = []

    for i, block in enumerate(blocks):
        text = block["text"]
        start_ms = block["start_ms"]
        end_ms = block["end_ms"]
        dur_ms = end_ms - start_ms
        text_color = block.get("text_color", "#FFFFFF")
        text_size = block.get("text_size", 30)
        font_size = block.get("font_size", 5.0)

        start_us = int(start_ms * 1000)
        dur_us = int(dur_ms * 1000)

        mat_id = _generate_id()
        seg_id = _generate_id()
        anim_id = _generate_id()

        rgb = hex_to_rgb(text_color)

        # --- Text material (from template) ---
        text_mat = load_template("text_material_template")
        text_mat["id"] = mat_id
        text_mat["group_id"] = group_id
        text_mat["content"] = _make_text_content(text, font_size, rgb)
        text_mat["text_color"] = text_color
        text_mat["text_size"] = text_size
        text_mat["font_size"] = font_size
        text_mat["recognize_text"] = text
        texts.append(text_mat)

        # --- Animation material (from template) ---
        anim_mat = load_template("text_animation_template")
        anim_mat["id"] = anim_id
        anims.append(anim_mat)

        # --- Segment (from template) ---
        seg = load_template("text_segment_template")
        seg["id"] = seg_id
        seg["material_id"] = mat_id
        seg["extra_material_refs"] = [anim_id]
        seg["target_timerange"] = {"start": start_us, "duration": dur_us}
        seg["render_index"] = 14000 + i
        seg["clip"]["transform"]["y"] = -0.8

        text_track["segments"].append(seg)
        added_segments.append({
            "segment_id": seg_id,
            "material_id": mat_id,
            "text": text,
        })

    # Recalculate project duration
    _recalculate_duration(draft)

    save_draft(draft, str(path))

    return {"added_count": len(added_segments), "segments": added_segments}


# ---------------------------------------------------------------------------
# Clear Segments
# ---------------------------------------------------------------------------

def clear_text_segments(draft_path: str) -> dict:
    """Remove all text segments, text materials, and text animations from the draft.

    Useful before re-inserting to avoid duplicates.
    Returns: { removed_segments, removed_materials, removed_animations }
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    create_backup(draft_path)

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    materials = draft.get("materials", {})
    removed_segments = 0
    removed_materials = 0
    removed_animations = 0

    # Collect material_ids from text track segments
    text_mat_ids = set()
    anim_ids = set()

    for track in draft.get("tracks", []):
        if track.get("type") == "text":
            for seg in track.get("segments", []):
                text_mat_ids.add(seg.get("material_id", ""))
                for ref in seg.get("extra_material_refs", []):
                    anim_ids.add(ref)
            removed_segments += len(track.get("segments", []))
            track["segments"] = []

    # Remove text materials by collected IDs
    if "texts" in materials:
        before = len(materials["texts"])
        materials["texts"] = [
            m for m in materials["texts"] if m.get("id", "") not in text_mat_ids
        ]
        removed_materials = before - len(materials["texts"])

    # Remove animation materials by collected IDs
    if "material_animations" in materials:
        before = len(materials["material_animations"])
        materials["material_animations"] = [
            m for m in materials["material_animations"] if m.get("id", "") not in anim_ids
        ]
        removed_animations = before - len(materials["material_animations"])

    _recalculate_duration(draft)

    save_draft(draft, str(path))

    return {
        "removed_segments": removed_segments,
        "removed_materials": removed_materials,
        "removed_animations": removed_animations,
    }


def clear_video_segments(draft_path: str) -> dict:
    """Remove all video segments and their materials from the draft.

    Removes video materials and all 6 auxiliary material types.
    Does NOT remove audio segments or text segments.
    Returns: { removed_segments, removed_materials }
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    create_backup(draft_path)

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    materials = draft.get("materials", {})
    removed_segments = 0
    removed_materials = 0

    # Collect material_ids and extra_material_refs from video track segments
    video_mat_ids = set()
    aux_ids = set()

    for track in draft.get("tracks", []):
        if track.get("type") == "video":
            for seg in track.get("segments", []):
                video_mat_ids.add(seg.get("material_id", ""))
                for ref in seg.get("extra_material_refs", []):
                    aux_ids.add(ref)
            removed_segments += len(track.get("segments", []))
            track["segments"] = []

    # Remove video materials
    if "videos" in materials:
        before = len(materials["videos"])
        materials["videos"] = [
            m for m in materials["videos"] if m.get("id", "") not in video_mat_ids
        ]
        removed_materials += before - len(materials["videos"])

    # Remove auxiliary materials by collected IDs
    for key in [
        "speeds", "placeholder_infos", "canvases",
        "sound_channel_mappings", "material_colors", "vocal_separations",
    ]:
        if key in materials:
            before = len(materials[key])
            materials[key] = [
                m for m in materials[key] if m.get("id", "") not in aux_ids
            ]
            removed_materials += before - len(materials[key])

    _recalculate_duration(draft)

    save_draft(draft, str(path))

    return {
        "removed_segments": removed_segments,
        "removed_materials": removed_materials,
    }


# ---------------------------------------------------------------------------
# Subtitle Timing Update
# ---------------------------------------------------------------------------

def update_subtitle_timings(draft_path: str, blocks: list) -> dict:
    """Update timing of existing text segments without changing text content.

    Each block should have: material_id, start_ms, end_ms.
    NEVER modifies the text content, only the timing.
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    create_backup(draft_path)

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

    _recalculate_duration(draft)

    save_draft(draft, str(path))

    return {"updated_count": updated_count}


def update_subtitle_texts(draft_path: str, updates: list) -> dict:
    """Update the text content of existing subtitle materials.

    Each update should have: material_id, new_text.
    Only changes the content field of text materials.
    NEVER modifies timings.
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    create_backup(draft_path)

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    updates_map = {u["material_id"]: u["new_text"] for u in updates}

    updated_count = 0
    for txt in draft.get("materials", {}).get("texts", []):
        if txt["id"] in updates_map:
            new_text = updates_map[txt["id"]]
            # Rebuild the content JSON string with the new text
            old_content = txt.get("content", "")
            try:
                parsed = json.loads(old_content)
                parsed["text"] = new_text
                # Update style range to match new text length
                for style in parsed.get("styles", []):
                    if "range" in style and len(style["range"]) == 2:
                        style["range"][1] = len(new_text)
                txt["content"] = json.dumps(parsed, ensure_ascii=False)
            except (json.JSONDecodeError, TypeError):
                # If content is plain string, just replace it
                txt["content"] = new_text
            updated_count += 1

    save_draft(draft, str(path))

    return {"updated_count": updated_count}


# ---------------------------------------------------------------------------
# Video Segments
# ---------------------------------------------------------------------------

def write_video_segments(draft_path: str, scenes: list) -> dict:
    """Add video/photo segments to the CapCut draft.

    Each scene should have: media_path, start_ms, end_ms, media_type ('video'|'photo').
    Creates both the video track segments and the video materials.
    Uses the complete NardotoStudio reference structure for materials and segments.
    Does NOT modify existing segments or materials.
    NEVER alters existing audio segments.
    """
    # Sort scenes by timeline position to ensure correct render_index ordering
    scenes = sorted(scenes, key=lambda s: s.get("start_ms", 0))

    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    create_backup(draft_path)

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    materials = draft.setdefault("materials", {})
    videos = materials.setdefault("videos", [])
    speeds = materials.setdefault("speeds", [])
    placeholders = materials.setdefault("placeholder_infos", [])
    canvases = materials.setdefault("canvases", [])
    scm_list = materials.setdefault("sound_channel_mappings", [])
    material_colors = materials.setdefault("material_colors", [])
    vocal_list = materials.setdefault("vocal_separations", [])

    # Find or create video track
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

        # Probe real dimensions/audio for the media file
        info = get_media_info(media_path)
        width = info["width"]
        height = info["height"]

        mat_id = _generate_id()
        seg_id = _generate_id()

        video_material = {
            "aigc_type": "none",
            "audio_fade": None,
            "category_name": "local",
            "check_flag": 62978047,
            "crop": {
                "lower_left_x": 0.0, "lower_left_y": 1.0,
                "lower_right_x": 1.0, "lower_right_y": 1.0,
                "upper_left_x": 0.0, "upper_left_y": 0.0,
                "upper_right_x": 1.0, "upper_right_y": 0.0,
            },
            "crop_ratio": "free",
            "crop_scale": 1.0,
            "duration": dur_us,
            "has_audio": info.get("has_audio", media_type == "video"),
            "has_sound_separated": False,
            "height": height,
            "id": mat_id,
            "local_material_id": str(uuid.uuid4()).lower(),
            "material_name": os.path.basename(media_path),
            "path": media_path.replace("\\", "/"),
            "source": 0,
            "source_platform": 0,
            "type": media_type,
            "width": width,
            "matting": {
                "flag": 0,
                "has_use_quick_brush": False,
                "has_use_quick_eraser": False,
                "interactiveTime": [],
                "path": "",
                "strokes": [],
            },
            "stable": {
                "matrix_path": "",
                "stable_level": 0,
                "time_range": {"duration": 0, "start": 0},
            },
            "video_algorithm": {"algorithms": [], "path": ""},
        }
        videos.append(video_material)

        extras = _make_extra_materials_video()
        speeds.append(extras["speed"])
        placeholders.append(extras["placeholder"])
        canvases.append(extras["canvas"])
        scm_list.append(extras["sound_channel_mapping"])
        material_colors.append(extras["color"])
        vocal_list.append(extras["vocal_separation"])

        render_index_value = 11000 + len(video_track["segments"]) + i

        segment = {
            "caption_info": None,
            "cartoon": False,
            "clip": {
                "alpha": 1.0,
                "flip": {"horizontal": False, "vertical": False},
                "rotation": 0.0,
                "scale": {"x": 1.0, "y": 1.0},
                "transform": {"x": 0.0, "y": 0.0},
            },
            "common_keyframes": [],
            "enable_adjust": True,
            "enable_color_curves": True,
            "enable_color_wheels": True,
            "enable_hsl_curves": True,
            "enable_lut": True,
            "enable_video_mask": True,
            "extra_material_refs": extras["refs"],
            "group_id": "",
            "hdr_settings": {"intensity": 1.0, "mode": 1, "nits": 1000},
            "id": seg_id,
            "is_placeholder": False,
            "keyframe_refs": [],
            "last_nonzero_volume": 1.0,
            "material_id": mat_id,
            "render_index": render_index_value,
            "render_timerange": {"duration": 0, "start": 0},
            "responsive_layout": {
                "enable": False,
                "horizontal_pos_layout": 0,
                "size_layout": 0,
                "target_follow": "",
                "vertical_pos_layout": 0,
            },
            "reverse": False,
            "source": "segmentsourcenormal",
            "source_timerange": {"start": 0, "duration": dur_us},
            "speed": 1.0,
            "state": 0,
            "target_timerange": {"start": start_us, "duration": dur_us},
            "template_id": "",
            "template_scene": "default",
            "track_attribute": 1,
            "track_render_index": 0,
            "uniform_scale": {"on": True, "value": 1.0},
            "visible": True,
            "volume": 0.0,
        }
        video_track["segments"].append(segment)
        added_segments.append({
            "segment_id": seg_id,
            "material_id": mat_id,
            "media_path": media_path,
        })

    _recalculate_duration(draft)

    # Disable main track magnet/snap so gaps are preserved
    config = draft.setdefault("config", {})
    config["maintrack_adsorb"] = False

    save_draft(draft, str(path))

    return {"added_count": len(added_segments), "segments": added_segments}


# ---------------------------------------------------------------------------
# Batch Media Insertion
# ---------------------------------------------------------------------------

def get_media_info(file_path: str) -> dict:
    """Detect media type, duration, dimensions, and audio presence for a file.

    Uses ffprobe for videos to read real width/height/duration/audio.
    Falls back to safe defaults when ffprobe is unavailable.

    Returns: { type, duration_us, width, height, has_audio }
    """
    ext = Path(file_path).suffix.lower()

    if ext in IMAGE_EXTENSIONS:
        return {
            "type": "photo",
            "duration_us": 5_000_000,  # default 5s for images
            "width": 1920,
            "height": 1080,
            "has_audio": False,
        }

    if ext in VIDEO_EXTENSIONS:
        probe = _get_video_duration_us(file_path)
        return {
            "type": "video",
            "duration_us": probe["duration_us"],
            "width": probe["width"],
            "height": probe["height"],
            "has_audio": probe["has_audio"],
        }

    return {
        "type": "video",
        "duration_us": 5_000_000,
        "width": 1920,
        "height": 1080,
        "has_audio": False,
    }


def _get_video_duration_us(file_path: str) -> dict:
    """Get video duration, dimensions, and audio presence using ffprobe.

    Returns a dict with keys: duration_us, width, height, has_audio.
    Falls back to safe defaults (5s, 1920x1080, no audio) on any error.
    """
    defaults = {
        "duration_us": 5_000_000,
        "width": 1920,
        "height": 1080,
        "has_audio": False,
    }
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                "-show_streams",
                file_path,
            ],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            duration_us = 5_000_000
            width = 1920
            height = 1080
            has_audio = False

            if "format" in data and "duration" in data["format"]:
                duration_us = int(float(data["format"]["duration"]) * 1_000_000)

            for stream in data.get("streams", []):
                if stream.get("codec_type") == "video":
                    width = stream.get("width", width)
                    height = stream.get("height", height)
                elif stream.get("codec_type") == "audio":
                    has_audio = True

            return {
                "duration_us": duration_us,
                "width": width,
                "height": height,
                "has_audio": has_audio,
            }
    except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError,
            ValueError, KeyError):
        pass
    return defaults


def insert_media_batch(draft_path: str, media_files: list,
                       image_duration_ms: int = 5000) -> dict:
    """Insert multiple media files (images/videos) into the CapCut draft.

    Uses the complete NardotoStudio reference structure for materials and segments.

    Args:
        draft_path: Path to draft_content.json.
        media_files: List of file path strings.
        image_duration_ms: Default duration for images in milliseconds.

    Returns: { inserted, videos, images }
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    create_backup(draft_path)

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    materials = draft.setdefault("materials", {})
    videos_mat = materials.setdefault("videos", [])
    speeds = materials.setdefault("speeds", [])
    placeholders = materials.setdefault("placeholder_infos", [])
    canvases = materials.setdefault("canvases", [])
    scm_list = materials.setdefault("sound_channel_mappings", [])
    material_colors = materials.setdefault("material_colors", [])
    vocal_list = materials.setdefault("vocal_separations", [])

    # Find or create video track
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

    # Calculate start position (after last existing segment)
    current_time_us = 0
    for seg in video_track.get("segments", []):
        tr = seg.get("target_timerange", {})
        seg_end = tr.get("start", 0) + tr.get("duration", 0)
        if seg_end > current_time_us:
            current_time_us = seg_end

    image_duration_us = int(image_duration_ms * 1000)
    video_count = 0
    image_count = 0

    for i, file_path in enumerate(media_files):
        if not os.path.exists(file_path):
            continue

        info = get_media_info(file_path)
        media_type = info["type"]
        width = info["width"]
        height = info["height"]

        if media_type == "photo":
            dur_us = image_duration_us
            image_count += 1
        else:
            dur_us = info["duration_us"]
            video_count += 1

        mat_id = _generate_id()
        seg_id = _generate_id()

        video_material = {
            "aigc_type": "none",
            "audio_fade": None,
            "category_name": "local",
            "check_flag": 62978047,
            "crop": {
                "lower_left_x": 0.0, "lower_left_y": 1.0,
                "lower_right_x": 1.0, "lower_right_y": 1.0,
                "upper_left_x": 0.0, "upper_left_y": 0.0,
                "upper_right_x": 1.0, "upper_right_y": 0.0,
            },
            "crop_ratio": "free",
            "crop_scale": 1.0,
            "duration": dur_us,
            "has_audio": info.get("has_audio", media_type == "video"),
            "has_sound_separated": False,
            "height": height,
            "id": mat_id,
            "local_material_id": str(uuid.uuid4()).lower(),
            "material_name": os.path.basename(file_path),
            "path": file_path.replace("\\", "/"),
            "source": 0,
            "source_platform": 0,
            "type": media_type,
            "width": width,
            "matting": {
                "flag": 0,
                "has_use_quick_brush": False,
                "has_use_quick_eraser": False,
                "interactiveTime": [],
                "path": "",
                "strokes": [],
            },
            "stable": {
                "matrix_path": "",
                "stable_level": 0,
                "time_range": {"duration": 0, "start": 0},
            },
            "video_algorithm": {"algorithms": [], "path": ""},
        }
        videos_mat.append(video_material)

        extras = _make_extra_materials_video()
        speeds.append(extras["speed"])
        placeholders.append(extras["placeholder"])
        canvases.append(extras["canvas"])
        scm_list.append(extras["sound_channel_mapping"])
        material_colors.append(extras["color"])
        vocal_list.append(extras["vocal_separation"])

        render_index_value = 11000 + len(video_track["segments"])

        segment = {
            "caption_info": None,
            "cartoon": False,
            "clip": {
                "alpha": 1.0,
                "flip": {"horizontal": False, "vertical": False},
                "rotation": 0.0,
                "scale": {"x": 1.0, "y": 1.0},
                "transform": {"x": 0.0, "y": 0.0},
            },
            "common_keyframes": [],
            "enable_adjust": True,
            "enable_color_curves": True,
            "enable_color_wheels": True,
            "enable_hsl_curves": True,
            "enable_lut": True,
            "enable_video_mask": True,
            "extra_material_refs": extras["refs"],
            "group_id": "",
            "hdr_settings": {"intensity": 1.0, "mode": 1, "nits": 1000},
            "id": seg_id,
            "is_placeholder": False,
            "keyframe_refs": [],
            "last_nonzero_volume": 1.0,
            "material_id": mat_id,
            "render_index": render_index_value,
            "render_timerange": {"duration": 0, "start": 0},
            "responsive_layout": {
                "enable": False,
                "horizontal_pos_layout": 0,
                "size_layout": 0,
                "target_follow": "",
                "vertical_pos_layout": 0,
            },
            "reverse": False,
            "source": "segmentsourcenormal",
            "source_timerange": {"start": 0, "duration": dur_us},
            "speed": 1.0,
            "state": 0,
            "target_timerange": {"start": current_time_us, "duration": dur_us},
            "template_id": "",
            "template_scene": "default",
            "track_attribute": 1,
            "track_render_index": 0,
            "uniform_scale": {"on": True, "value": 1.0},
            "visible": True,
            "volume": 0.0,
        }
        video_track["segments"].append(segment)
        current_time_us += dur_us

    _recalculate_duration(draft)

    save_draft(draft, str(path))

    return {
        "inserted": video_count + image_count,
        "videos": video_count,
        "images": image_count,
    }


# ---------------------------------------------------------------------------
# Audio Materials and Segments
# ---------------------------------------------------------------------------

def _make_audio_material(file_path: str, duration_us: int) -> dict:
    """Create a CapCut audio material entry.

    Returns: { id, local_material_id, material }
    """
    mat_id = _generate_id()
    local_mat_id = str(uuid.uuid4()).lower()
    music_id = str(uuid.uuid4()).lower()

    material = {
        "category_name": "local",
        "check_flag": 1,
        "duration": duration_us,
        "id": mat_id,
        "local_material_id": local_mat_id,
        "music_id": music_id,
        "name": os.path.basename(file_path),
        "path": file_path.replace("\\", "/"),
        "source_platform": 0,
        "type": "extract_music",
        "wave_points": [],
    }

    return {"id": mat_id, "local_material_id": local_mat_id, "material": material}


def _make_extra_materials_audio() -> dict:
    """Create companion materials for an audio segment.

    Returns a dict with material entries and the list of extra_material_refs.
    Includes: speed, placeholder_info, beats, sound_channel_mapping, vocal_separation.
    """
    speed_id = _generate_id()
    placeholder_id = _generate_id()
    beat_id = _generate_id()
    channel_id = _generate_id()
    vocal_id = _generate_id()

    speed = {
        "curve_speed": None,
        "id": speed_id,
        "mode": 0,
        "speed": 1.0,
        "type": "speed",
    }

    placeholder = {
        "error_path": "",
        "error_text": "",
        "id": placeholder_id,
        "meta_type": "none",
        "res_path": "",
        "res_text": "",
        "type": "placeholder_info",
    }

    beat = {
        "ai_beats": {
            "beat_speed_infos": [],
            "beats_path": "",
            "beats_url": "",
            "melody_path": "",
            "melody_percents": [0.0],
            "melody_url": "",
        },
        "enable_ai_beats": False,
        "gear": 404,
        "gear_count": 0,
        "id": beat_id,
        "mode": 404,
        "type": "beats",
        "user_beats": [],
        "user_delete_ai_beats": None,
    }

    channel = {
        "audio_channel_mapping": 0,
        "id": channel_id,
        "is_config_open": False,
        "type": "none",
    }

    vocal = {
        "choice": 0,
        "enter_from": "",
        "final_algorithm": "",
        "id": vocal_id,
        "production_path": "",
        "removed_sounds": [],
        "time_range": None,
        "type": "vocal_separation",
    }

    return {
        "speed": speed,
        "placeholder": placeholder,
        "beat": beat,
        "sound_channel_mapping": channel,
        "vocal_separation": vocal,
        "refs": [speed_id, placeholder_id, beat_id, channel_id, vocal_id],
    }


def _make_audio_segment(mat_id: str, start_us: int, duration_us: int,
                        extra_refs: list, render_index: int = 0) -> dict:
    """Create a CapCut audio segment entry."""
    seg_id = _generate_id()
    return {
        "caption_info": None,
        "cartoon": False,
        "clip": None,
        "common_keyframes": [],
        "enable_adjust": False,
        "enable_color_curves": True,
        "enable_color_wheels": True,
        "enable_hsl_curves": True,
        "enable_video_mask": True,
        "extra_material_refs": extra_refs,
        "group_id": "",
        "id": seg_id,
        "is_placeholder": False,
        "keyframe_refs": [],
        "last_nonzero_volume": 1.0,
        "material_id": mat_id,
        "render_index": render_index,
        "render_timerange": {"duration": 0, "start": 0},
        "responsive_layout": {
            "enable": False,
            "horizontal_pos_layout": 0,
            "size_layout": 0,
            "target_follow": "",
            "vertical_pos_layout": 0,
        },
        "reverse": False,
        "source": "segmentsourcenormal",
        "source_timerange": {"duration": duration_us, "start": 0},
        "speed": 1.0,
        "state": 0,
        "target_timerange": {"duration": duration_us, "start": start_us},
        "template_id": "",
        "template_scene": "default",
        "track_attribute": 0,
        "track_render_index": 1,
        "uniform_scale": None,
        "visible": True,
        "volume": 1.0,
    }


def _get_audio_duration_us(file_path: str) -> int:
    """Get audio duration using wave (for WAV) or ffprobe. Falls back to 5s."""
    ext = Path(file_path).suffix.lower()

    # Native fallback for WAV (no ffprobe needed)
    if ext == ".wav":
        try:
            import wave
            with wave.open(file_path, "rb") as wf:
                frames = wf.getnframes()
                rate = wf.getframerate()
                return int((frames / rate) * 1_000_000)
        except Exception:
            pass

    # ffprobe for all other formats
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                file_path,
            ],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            seconds = float(data.get("format", {}).get("duration", 5.0))
            return int(seconds * 1_000_000)
    except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError,
            ValueError, KeyError):
        pass
    return 5_000_000


def insert_audio_batch(draft_path: str, audio_files: list,
                       use_existing_track: bool = False) -> dict:
    """Insert multiple audio files into the CapCut draft.

    Args:
        draft_path: Path to draft_content.json.
        audio_files: List of audio file path strings.
        use_existing_track: If True, append to first existing audio track.

    Returns: { inserted, total_duration_us }
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    create_backup(draft_path)

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    materials = draft.setdefault("materials", {})
    audios_mat = materials.setdefault("audios", [])
    speeds = materials.setdefault("speeds", [])
    placeholders = materials.setdefault("placeholder_infos", [])
    beats = materials.setdefault("beats", [])
    scm_list = materials.setdefault("sound_channel_mappings", [])
    vocal_list = materials.setdefault("vocal_separations", [])

    # Find or create audio track
    audio_track = None
    if use_existing_track:
        for track in draft.get("tracks", []):
            if track.get("type") == "audio":
                audio_track = track
                break

    if audio_track is None:
        audio_track = {
            "id": _generate_id(),
            "type": "audio",
            "segments": [],
            "flag": 0,
            "attribute": 0,
        }
        draft.setdefault("tracks", []).append(audio_track)

    # Calculate start position (after last existing segment in this track)
    current_time_us = 0
    for seg in audio_track.get("segments", []):
        tr = seg.get("target_timerange", {})
        seg_end = tr.get("start", 0) + tr.get("duration", 0)
        if seg_end > current_time_us:
            current_time_us = seg_end

    inserted = 0

    for file_path in audio_files:
        if not os.path.exists(file_path):
            continue

        dur_us = _get_audio_duration_us(file_path)

        audio_mat = _make_audio_material(file_path, dur_us)
        audios_mat.append(audio_mat["material"])

        extras = _make_extra_materials_audio()
        speeds.append(extras["speed"])
        placeholders.append(extras["placeholder"])
        beats.append(extras["beat"])
        scm_list.append(extras["sound_channel_mapping"])
        vocal_list.append(extras["vocal_separation"])

        segment = _make_audio_segment(
            audio_mat["id"], current_time_us, dur_us,
            extras["refs"], render_index=len(audio_track["segments"]),
        )
        audio_track["segments"].append(segment)
        current_time_us += dur_us
        inserted += 1

    _recalculate_duration(draft)

    save_draft(draft, str(path))

    return {"inserted": inserted, "total_duration_us": current_time_us}


# ---------------------------------------------------------------------------
# Project Analysis
# ---------------------------------------------------------------------------

def analyze_project(draft_path: str) -> dict:
    """Analyze a CapCut project and return track summary.

    Returns: { tracks: [{ index, type, segments, duration_ms, name }] }
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    tracks_info = []
    materials_map = {}
    for mat_type in ["videos", "audios", "texts"]:
        for mat in draft.get("materials", {}).get(mat_type, []):
            materials_map[mat.get("id", "")] = mat

    for idx, track in enumerate(draft.get("tracks", [])):
        segments = track.get("segments", [])
        total_dur_us = 0
        first_name = ""

        for seg in segments:
            tr = seg.get("target_timerange", {})
            total_dur_us += tr.get("duration", 0)
            if not first_name:
                mat = materials_map.get(seg.get("material_id", ""), {})
                first_name = (
                    mat.get("path", "")
                    or mat.get("recognize_text", "")
                    or mat.get("content", "")
                )[:60]

        tracks_info.append({
            "index": idx,
            "type": track.get("type", "unknown"),
            "segments": len(segments),
            "duration_ms": total_dur_us / 1000,
            "name": first_name,
        })

    return {"tracks": tracks_info}


# ---------------------------------------------------------------------------
# Project Creation
# ---------------------------------------------------------------------------

def _get_platform_info() -> dict:
    """Get CapCut platform info for the current OS."""
    import sys as _sys
    import platform as _platform
    if _sys.platform == "darwin":
        return {
            "app_id": 346280,
            "app_source": "cc",
            "app_version": "4.0.0",
            "device_id": "",
            "hard_disk_id": "",
            "mac_address": "",
            "os": "mac",
            "os_version": _platform.release(),
        }
    return {
        "app_id": 359289,
        "app_source": "cc",
        "app_version": "4.0.0",
        "device_id": "",
        "hard_disk_id": "",
        "mac_address": "",
        "os": "windows",
        "os_version": "10.0.22631",
    }


def _create_empty_draft(project_name: str) -> dict:
    """Create a complete draft_content.json matching NardotoStudio main.js."""
    now_sec = int(datetime.now().timestamp())
    platform_info = _get_platform_info()
    return {
        "canvas_config": {"height": 1080, "width": 1920, "ratio": "16:9"},
        "color_space": 0,
        "config": {
            "adjust_max_index": 0,
            "attachment_info": [],
            "combination_max_index": 0,
            "export_range": None,
            "extract_audio_last_index": 0,
            "lyrics_recognition_id": "",
            "lyrics_sync": False,
            "maintrack_adsorb": True,
            "material_save_mode": 0,
            "original_sound_last_index": 0,
            "record_audio_last_index": 0,
            "sticker_max_index": 0,
            "subtitle_recognition_id": "",
            "subtitle_sync": True,
            "system_font_list": [],
            "video_mute": False,
            "zoom_info_params": None,
        },
        "cover": None,
        "create_time": now_sec,
        "duration": 0,
        "extra_info": None,
        "fps": 30.0,
        "free_render_index_mode_on": False,
        "group_container": None,
        "id": _generate_id(),
        "keyframe_graph_list": [],
        "keyframes": {
            "adjusts": [],
            "audios": [],
            "effects": [],
            "filters": [],
            "handwrites": [],
            "stickers": [],
            "texts": [],
            "videos": [],
        },
        "last_modified_platform": platform_info,
        "materials": {
            "ai_translates": [],
            "audio_balances": [],
            "audio_effects": [],
            "audio_fades": [],
            "audio_track_indexes": [],
            "audios": [],
            "beats": [],
            "canvases": [],
            "chromas": [],
            "color_curves": [],
            "digital_humans": [],
            "drafts": [],
            "effects": [],
            "flowers": [],
            "green_screens": [],
            "handwrites": [],
            "hsl": [],
            "images": [],
            "log_color_wheels": [],
            "loudnesses": [],
            "manual_deformations": [],
            "masks": [],
            "material_animations": [],
            "material_colors": [],
            "multi_language_refs": [],
            "placeholder_infos": [],
            "placeholders": [],
            "plugin_effects": [],
            "primary_color_wheels": [],
            "realtime_denoises": [],
            "shapes": [],
            "smart_crops": [],
            "smart_relights": [],
            "sound_channel_mappings": [],
            "speeds": [],
            "stickers": [],
            "tail_leaders": [],
            "text_templates": [],
            "texts": [],
            "time_marks": [],
            "transitions": [],
            "video_effects": [],
            "video_trackings": [],
            "videos": [],
            "vocal_separations": [],
        },
        "mutable_config": None,
        "name": project_name,
        "new_version": "113.0.0",
        "platform": platform_info,
        "relationships": [],
        "render_index_track_mode_on": False,
        "retouch_cover": None,
        "source": "default",
        "static_cover_image_path": "",
        "tracks": [],
        "update_time": now_sec,
        "version": 360000,
    }


def create_project(project_name: str) -> dict:
    """Create a new CapCut project from scratch.

    Creates the project folder, draft_content.json, metadata files,
    and registers the project in root_meta_info.json.
    Follows NardotoStudio's complete metadata structure so CapCut
    recognises the project without errors.

    IMPORTANT: CapCut must be CLOSED when creating projects, otherwise
    it will overwrite root_meta_info.json with its cached version.

    Returns: { project_path, draft_path, warnings }
    """
    warnings = []

    if not CAPCUT_PROJECTS_PATH.exists():
        raise FileNotFoundError(
            f"CapCut projects path not found: {CAPCUT_PROJECTS_PATH}"
        )

    # Check if CapCut is running
    try:
        import sys as _sys
        capcut_proc = "CapCut.exe" if _sys.platform == "win32" else "CapCut"
        if _sys.platform == "win32":
            output = subprocess.check_output(
                ["tasklist", "/FI", f"IMAGENAME eq {capcut_proc}", "/FO", "CSV", "/NH"],
                text=True, stderr=subprocess.DEVNULL,
            )
            is_running = capcut_proc in output
        else:
            try:
                subprocess.check_output(
                    ["pgrep", "-x", capcut_proc],
                    text=True, stderr=subprocess.DEVNULL,
                )
                is_running = True
            except subprocess.CalledProcessError:
                is_running = False
        if is_running:
            warnings.append(
                "CapCut is running. The project may not be registered correctly. "
                "Close CapCut and recreate the project if it does not appear."
            )
    except Exception:
        pass

    project_dir = CAPCUT_PROJECTS_PATH / project_name
    project_dir.mkdir(exist_ok=True)

    # Normalise paths to forward slashes (required by CapCut JSON)
    project_dir_str = str(project_dir).replace("\\", "/")
    root_path_str = str(CAPCUT_PROJECTS_PATH).replace("\\", "/")

    # Create draft_content.json (+ template-2.tmp, .bak mirrors)
    draft = _create_empty_draft(project_name)
    draft_path = project_dir / "draft_content.json"
    save_draft(draft, str(draft_path), sync_meta=False)

    now_us = _get_timestamp_us()
    now_sec = int(datetime.now().timestamp())
    draft_id = draft["id"]

    # ---------------------------------------------------------------
    # draft_info.json
    # On macOS: CapCut reads draft_info.json as the primary draft file
    #           (full draft content, same as draft_content.json)
    # On Windows: small metadata file (28 fields, timestamps in SECONDS)
    # ---------------------------------------------------------------
    import sys as _sys
    if _sys.platform == "darwin":
        # macOS: draft_info.json IS the draft content
        draft_info_json = json.dumps(draft, ensure_ascii=False, separators=(",", ":"))
        with open(project_dir / "draft_info.json", "wb") as f:
            f.write(draft_info_json.encode("utf-8"))
            f.flush()
            os.fsync(f.fileno())
    else:
        draft_info = {
            "draft_cloud_capcut_purchase_info": None,
            "draft_cloud_purchase_info": None,
            "draft_cloud_template_id": "",
            "draft_cloud_tutorial_info": None,
            "draft_cloud_videocut_purchase_info": None,
            "draft_cover": "",
            "draft_deeplink_url": "",
            "draft_enterprise_info": None,
            "draft_fold_path": project_dir_str,
            "draft_id": draft_id,
            "draft_is_ai_shorts": False,
            "draft_is_article_video_draft": False,
            "draft_is_from_deeplink": False,
            "draft_is_invisible": False,
            "draft_materials_copied": False,
            "draft_materials_copied_path": None,
            "draft_name": project_name,
            "draft_new_version": "",
            "draft_removable_storage_device": "",
            "draft_root_path": root_path_str,
            "draft_segment_extra_info": None,
            "draft_timeline_materials_size": 0,
            "draft_type": "normal",
            "tm_draft_cloud_completed": None,
            "tm_draft_cloud_modified": 0,
            "tm_draft_create": now_sec,
            "tm_draft_modified": now_sec,
            "tm_draft_removed": 0,
        }
        with open(project_dir / "draft_info.json", "w", encoding="utf-8") as f:
            json.dump(draft_info, f, ensure_ascii=False, indent=2)

    # ---------------------------------------------------------------
    # draft_meta_info.json  (complete, 26+ fields)
    # Note: draft_timeline_materials_size_ has trailing underscore
    # Note: written WITHOUT indent to match CapCut format
    # ---------------------------------------------------------------
    draft_meta = {
        "cloud_draft_cover": True,
        "cloud_draft_sync": True,
        "draft_cloud_last_action_download": False,
        "draft_cloud_purchase_info": "",
        "draft_cloud_template_id": "",
        "draft_cloud_tutorial_info": "",
        "draft_cloud_videocut_purchase_info": "",
        "draft_cover": "",
        "draft_enterprise_info": {
            "draft_enterprise_extra": "",
            "draft_enterprise_id": "",
            "draft_enterprise_name": "",
            "enterprise_material": [],
        },
        "draft_fold_path": project_dir_str,
        "draft_id": draft_id,
        "draft_is_ai_shorts": False,
        "draft_is_article_video_draft": False,
        "draft_is_cloud_temp_draft": False,
        "draft_is_from_deeplink": "false",
        "draft_is_invisible": False,
        "draft_is_web_article_video": False,
        "draft_materials": [
            {"type": 0, "value": []},
            {"type": 1, "value": []},
            {"type": 2, "value": []},
            {"type": 3, "value": []},
            {"type": 6, "value": []},
            {"type": 7, "value": []},
            {"type": 8, "value": []},
        ],
        "draft_materials_copied_info": [],
        "draft_name": project_name,
        "draft_need_rename_folder": False,
        "draft_new_version": "",
        "draft_removable_storage_device": "",
        "draft_root_path": root_path_str,
        "draft_segment_extra_info": [],
        "draft_timeline_materials_size_": 0,
        "streaming_edit_draft_ready": True,
        "tm_draft_create": now_us,
        "tm_draft_modified": now_us,
        "tm_draft_removed": 0,
        "tm_duration": 0,
    }
    with open(project_dir / "draft_meta_info.json", "w", encoding="utf-8") as f:
        json.dump(draft_meta, f, ensure_ascii=False)

    # ---------------------------------------------------------------
    # root_meta_info.json  (complete, 24+ fields per entry)
    # Note: draft_timeline_materials_size WITHOUT trailing underscore
    # Note: draft_json_file is CRITICAL for CapCut to find the project
    # Note: written WITHOUT indent to match CapCut format
    # ---------------------------------------------------------------
    root_meta_path = CAPCUT_PROJECTS_PATH / "root_meta_info.json"
    root_meta = {
        "all_draft_store": [],
        "draft_ids": 0,
        "root_path": root_path_str,
    }
    if root_meta_path.exists():
        try:
            with open(root_meta_path, "r", encoding="utf-8") as f:
                root_meta = json.load(f)
        except Exception:
            pass

    new_entry = {
        "cloud_draft_cover": True,
        "cloud_draft_sync": True,
        "draft_cloud_last_action_download": False,
        "draft_cloud_purchase_info": "",
        "draft_cloud_template_id": "",
        "draft_cloud_tutorial_info": "",
        "draft_cloud_videocut_purchase_info": "",
        "draft_cover": "",
        "draft_fold_path": project_dir_str,
        "draft_id": draft_id,
        "draft_is_ai_shorts": False,
        "draft_is_cloud_temp_draft": False,
        "draft_is_invisible": False,
        "draft_is_web_article_video": False,
        "draft_json_file": f"{project_dir_str}/draft_content.json",
        "draft_name": project_name,
        "draft_new_version": "",
        "draft_root_path": root_path_str,
        "draft_timeline_materials_size": 0,
        "draft_type": "",
        "draft_web_article_video_enter_from": "",
        "streaming_edit_draft_ready": True,
        "tm_draft_cloud_completed": "",
        "tm_draft_cloud_entry_id": -1,
        "tm_draft_cloud_modified": 0,
        "tm_draft_cloud_parent_entry_id": -1,
        "tm_draft_cloud_space_id": -1,
        "tm_draft_cloud_user_id": -1,
        "tm_draft_create": now_us,
        "tm_draft_modified": now_us,
        "tm_draft_removed": 0,
        "tm_duration": 0,
    }

    # Remove any existing entries for the same path to avoid duplicates
    all_drafts = root_meta.setdefault("all_draft_store", [])
    all_drafts[:] = [
        entry for entry in all_drafts
        if entry.get("draft_fold_path", "") != project_dir_str
    ]

    # Insert new entry at the beginning (newest first)
    all_drafts.insert(0, new_entry)

    with open(root_meta_path, "w", encoding="utf-8") as f:
        json.dump(root_meta, f, ensure_ascii=False)

    # Post-creation validation
    draft_json_path = f"{project_dir_str}/draft_content.json"
    validation_ok = True
    try:
        with open(root_meta_path, "r", encoding="utf-8") as f:
            verify = json.load(f)
        found = any(
            e.get("draft_fold_path") == project_dir_str
            for e in verify.get("all_draft_store", [])
        )
        if not found:
            warnings.append("Post-creation check: entry not found in root_meta_info.json")
            validation_ok = False
    except Exception as e:
        warnings.append(f"Post-creation check failed: {e}")
        validation_ok = False

    return {
        "project_path": project_dir_str,
        "draft_path": draft_json_path,
        "warnings": warnings,
        "validation_ok": validation_ok,
    }


def list_projects() -> list:
    """List all CapCut projects from root_meta_info.json.

    Returns: List of dicts with name, path, draft_path, modified_us,
    created_us, duration_us, materials_size, cover, exists.
    """
    root_meta_path = CAPCUT_PROJECTS_PATH / "root_meta_info.json"
    if not root_meta_path.exists():
        return []

    with open(root_meta_path, "r", encoding="utf-8") as f:
        root_meta = json.load(f)

    projects = []
    for entry in root_meta.get("all_draft_store", []):
        fold_path = entry.get("draft_fold_path", "")
        draft_json = entry.get("draft_json_file", "")
        if not draft_json and fold_path:
            draft_json = fold_path.rstrip("/") + "/draft_content.json"

        # Check if project folder actually exists on disk
        check_path = fold_path.replace("/", os.sep) if fold_path else ""
        exists = os.path.isdir(check_path) if check_path else False

        projects.append({
            "name": entry.get("draft_name", ""),
            "path": fold_path,
            "draft_path": draft_json,
            "modified_us": entry.get("tm_draft_modified", 0),
            "created_us": entry.get("tm_draft_create", 0),
            "duration_us": entry.get("tm_duration", 0),
            "materials_size": entry.get("draft_timeline_materials_size", 0),
            "cover": entry.get("draft_cover", ""),
            "exists": exists,
        })

    return projects


# ---------------------------------------------------------------------------
# Duration Recalculation
# ---------------------------------------------------------------------------

def _recalculate_duration(draft: dict) -> None:
    """Recalculate total project duration from all segments."""
    max_end = 0
    for track in draft.get("tracks", []):
        for seg in track.get("segments", []):
            tr = seg.get("target_timerange", {})
            seg_end = tr.get("start", 0) + tr.get("duration", 0)
            if seg_end > max_end:
                max_end = seg_end
    draft["duration"] = max_end
