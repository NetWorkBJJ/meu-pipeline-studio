"""Sync engine for CapCut timeline synchronization.

Adapted from NardotoStudio sync_engine.py.
Handles audio-video-text sync, gap removal, and photo animations.
"""

import json
import os
import random
import re
import sys
import uuid
from datetime import datetime
from pathlib import Path

from capcut_writer import create_backup, _recalculate_duration
from draft_io import save_draft
from template_loader import load_template


# ---------------------------------------------------------------------------
# Animation Keyframe Generators
# ---------------------------------------------------------------------------

def _generate_uuid() -> str:
    return str(uuid.uuid4()).upper()


def _keyframe_entry(time_offset: int, values: list) -> dict:
    return {
        "id": _generate_uuid(),
        "time_offset": time_offset,
        "values": values,
        "curveType": "Line",
        "left_control": {"x": 0.0, "y": 0.0},
        "right_control": {"x": 0.0, "y": 0.0},
    }


def criar_keyframe_zoom_in_suave(duration: int) -> list:
    """Soft zoom in: scale 1.02 -> 1.15."""
    return [
        {
            "id": _generate_uuid(),
            "property_type": "KFTypeScaleX",
            "keyframe_list": [
                _keyframe_entry(0, [1.02]),
                _keyframe_entry(duration, [1.15]),
            ],
        },
        {
            "id": _generate_uuid(),
            "property_type": "KFTypeScaleY",
            "keyframe_list": [
                _keyframe_entry(0, [1.02]),
                _keyframe_entry(duration, [1.15]),
            ],
        },
    ]


def criar_keyframe_zoom_in_forte(duration: int) -> list:
    """Strong zoom in: scale 1.0 -> 1.2."""
    return [
        {
            "id": _generate_uuid(),
            "property_type": "KFTypeScaleX",
            "keyframe_list": [
                _keyframe_entry(0, [1.0]),
                _keyframe_entry(duration, [1.2]),
            ],
        },
        {
            "id": _generate_uuid(),
            "property_type": "KFTypeScaleY",
            "keyframe_list": [
                _keyframe_entry(0, [1.0]),
                _keyframe_entry(duration, [1.2]),
            ],
        },
    ]


def criar_keyframe_zoom_out(duration: int) -> list:
    """Zoom out: scale 1.18 -> 1.05."""
    return [
        {
            "id": _generate_uuid(),
            "property_type": "KFTypeScaleX",
            "keyframe_list": [
                _keyframe_entry(0, [1.18]),
                _keyframe_entry(duration, [1.05]),
            ],
        },
        {
            "id": _generate_uuid(),
            "property_type": "KFTypeScaleY",
            "keyframe_list": [
                _keyframe_entry(0, [1.18]),
                _keyframe_entry(duration, [1.05]),
            ],
        },
    ]


def criar_keyframe_pan_down(duration: int) -> list:
    """Pan down with 1.15x scale: Y -0.12 -> 0.12."""
    return [
        {
            "id": _generate_uuid(),
            "property_type": "KFTypeScaleX",
            "keyframe_list": [
                _keyframe_entry(0, [1.15]),
                _keyframe_entry(duration, [1.15]),
            ],
        },
        {
            "id": _generate_uuid(),
            "property_type": "KFTypeScaleY",
            "keyframe_list": [
                _keyframe_entry(0, [1.15]),
                _keyframe_entry(duration, [1.15]),
            ],
        },
        {
            "id": _generate_uuid(),
            "property_type": "KFTypePositionY",
            "keyframe_list": [
                _keyframe_entry(0, [-0.12]),
                _keyframe_entry(duration, [0.12]),
            ],
        },
    ]


def criar_keyframe_pan_down_forte(duration: int) -> list:
    """Strong pan down with 1.2x scale: Y -0.15 -> 0.15."""
    return [
        {
            "id": _generate_uuid(),
            "property_type": "KFTypeScaleX",
            "keyframe_list": [
                _keyframe_entry(0, [1.2]),
                _keyframe_entry(duration, [1.2]),
            ],
        },
        {
            "id": _generate_uuid(),
            "property_type": "KFTypeScaleY",
            "keyframe_list": [
                _keyframe_entry(0, [1.2]),
                _keyframe_entry(duration, [1.2]),
            ],
        },
        {
            "id": _generate_uuid(),
            "property_type": "KFTypePositionY",
            "keyframe_list": [
                _keyframe_entry(0, [-0.15]),
                _keyframe_entry(duration, [0.15]),
            ],
        },
    ]


def criar_keyframe_pan_horizontal(duration: int) -> list:
    """Horizontal pan with 1.15x scale: X -0.1 -> 0.1."""
    return [
        {
            "id": _generate_uuid(),
            "property_type": "KFTypeScaleX",
            "keyframe_list": [
                _keyframe_entry(0, [1.15]),
                _keyframe_entry(duration, [1.15]),
            ],
        },
        {
            "id": _generate_uuid(),
            "property_type": "KFTypeScaleY",
            "keyframe_list": [
                _keyframe_entry(0, [1.15]),
                _keyframe_entry(duration, [1.15]),
            ],
        },
        {
            "id": _generate_uuid(),
            "property_type": "KFTypePositionX",
            "keyframe_list": [
                _keyframe_entry(0, [-0.1]),
                _keyframe_entry(duration, [0.1]),
            ],
        },
    ]


ANIMATION_PATTERNS = [
    criar_keyframe_zoom_in_suave,
    criar_keyframe_zoom_in_forte,
    criar_keyframe_zoom_out,
    criar_keyframe_pan_down,
    criar_keyframe_pan_down_forte,
    criar_keyframe_pan_horizontal,
]


# ---------------------------------------------------------------------------
# Core Sync Functions
# ---------------------------------------------------------------------------

def sync_project(draft_path: str, audio_track_index: int = 0,
                 mode: str = "audio", sync_subtitles: bool = True,
                 apply_animations: bool = False) -> dict:
    """Synchronize audio, video, and text segments in the timeline.

    Steps:
    1. Collect all audio segments from ALL audio tracks
    2. Remove gaps between audio segments (reposition sequentially)
    3. Merge all audio into a single track (remove extra tracks)
    4. Sync video segment durations to match audio
    5. Sync text/subtitle timings to audio
    6. Optionally apply animations to photo segments

    Args:
        draft_path: Path to draft_content.json.
        audio_track_index: Deprecated, ignored. Audio is collected from all tracks.
        mode: 'audio' (sync to audio) or 'subtitle' (sync to text).
        sync_subtitles: Whether to sync text timings to audio.
        apply_animations: Whether to apply random animations to photos.

    Returns: { success, stats: { gapsRemoved, mediaModified, subtitlesModified } }
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    create_backup(draft_path)

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    tracks = draft.get("tracks", [])
    stats = {"gapsRemoved": 0, "mediaModified": 0, "subtitlesModified": 0}

    # --- Collect audio segments from ALL audio tracks ---
    audio_segs = []
    audio_track_indices = []
    for idx, track in enumerate(tracks):
        if track.get("type") == "audio":
            audio_track_indices.append(idx)
            audio_segs.extend(track.get("segments", []))

    if not audio_segs:
        return {"success": True, "stats": stats, "message": "No audio segments found"}

    # Sort audio by timeline position
    audio_segs.sort(key=lambda s: s.get("target_timerange", {}).get("start", 0))

    # --- Remove gaps between audio segments ---
    current_time = audio_segs[0].get("target_timerange", {}).get("start", 0)
    for seg in audio_segs:
        tr = seg.get("target_timerange", {})
        old_start = tr.get("start", 0)
        if old_start != current_time:
            stats["gapsRemoved"] += 1
        tr["start"] = current_time
        current_time += tr.get("duration", 0)

    # Place all audio segments into the first audio track
    if audio_track_indices:
        tracks[audio_track_indices[0]]["segments"] = audio_segs
        # Remove extra audio tracks (iterate in reverse to preserve indices)
        for idx in reversed(audio_track_indices[1:]):
            del tracks[idx]

    # --- Collect video segments ---
    video_segs = []
    for track in tracks:
        if track.get("type") == "video":
            video_segs = list(track.get("segments", []))
            break

    # --- Collect text segments ---
    text_segs = []
    for track in tracks:
        if track.get("type") == "text":
            text_segs.extend(track.get("segments", []))

    if mode == "audio":
        # Sync video to audio durations
        for i in range(min(len(audio_segs), len(video_segs))):
            a_tr = audio_segs[i].get("target_timerange", {})
            v_tr = video_segs[i].get("target_timerange", {})

            v_tr["start"] = a_tr.get("start", 0)
            v_tr["duration"] = a_tr.get("duration", 0)

            # Also update source_timerange for trimming
            src = video_segs[i].get("source_timerange")
            if src is not None:
                src["duration"] = a_tr.get("duration", 0)

            stats["mediaModified"] += 1

        # Sync subtitles to audio
        if sync_subtitles and text_segs:
            text_segs.sort(
                key=lambda s: s.get("target_timerange", {}).get("start", 0)
            )
            for i in range(min(len(audio_segs), len(text_segs))):
                a_tr = audio_segs[i].get("target_timerange", {})
                t_tr = text_segs[i].get("target_timerange", {})
                t_tr["start"] = a_tr.get("start", 0)
                t_tr["duration"] = a_tr.get("duration", 0)
                stats["subtitlesModified"] += 1

    elif mode == "subtitle":
        # Sync video to subtitle durations
        text_segs.sort(
            key=lambda s: s.get("target_timerange", {}).get("start", 0)
        )
        for i in range(min(len(text_segs), len(video_segs))):
            t_tr = text_segs[i].get("target_timerange", {})
            v_tr = video_segs[i].get("target_timerange", {})
            v_tr["start"] = t_tr.get("start", 0)
            v_tr["duration"] = t_tr.get("duration", 0)

            src = video_segs[i].get("source_timerange")
            if src is not None:
                src["duration"] = t_tr.get("duration", 0)

            stats["mediaModified"] += 1

    # Apply animations to photo segments
    if apply_animations:
        anim_stats = _apply_animations(draft, video_segs)
        stats["animationsApplied"] = anim_stats

    _recalculate_duration(draft)

    save_draft(draft, str(path), sync_meta=False)

    return {"success": True, "stats": stats}


def _apply_animations(draft: dict, video_segs: list) -> int:
    """Apply random keyframe animations to photo segments."""
    materials_map = {}
    for mat in draft.get("materials", {}).get("videos", []):
        materials_map[mat.get("id", "")] = mat

    patterns = list(ANIMATION_PATTERNS)
    random.shuffle(patterns)
    pattern_idx = 0
    applied = 0

    for seg in video_segs:
        mat_id = seg.get("material_id", "")
        mat = materials_map.get(mat_id, {})

        # Only animate photos (not videos)
        if mat.get("type") != "photo":
            continue

        duration = seg.get("target_timerange", {}).get("duration", 0)
        if duration <= 0:
            continue

        # Pick animation pattern (cycle through)
        pattern_fn = patterns[pattern_idx % len(patterns)]
        pattern_idx += 1

        keyframes = pattern_fn(duration)
        seg["common_keyframes"] = keyframes

        # Set scale to match animation base
        seg.setdefault("clip", {}).setdefault("scale", {})
        seg["clip"]["scale"]["x"] = 1.15
        seg["clip"]["scale"]["y"] = 1.15

        applied += 1

    return applied


def apply_animations_to_images(draft_path: str) -> dict:
    """Apply random animations to all photo segments in the project.

    Returns: { applied: number }
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    create_backup(draft_path)

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    video_segs = []
    for track in draft.get("tracks", []):
        if track.get("type") == "video":
            video_segs.extend(track.get("segments", []))

    applied = _apply_animations(draft, video_segs)

    save_draft(draft, str(path))

    return {"applied": applied}


# ---------------------------------------------------------------------------
# Advanced Sync Functions
# ---------------------------------------------------------------------------

def flatten_audio_tracks(draft_path: str) -> dict:
    """Consolidate all audio tracks into a single sequential track.

    Collects all audio segments from all tracks, sorts by position,
    repositions them sequentially without gaps, and merges into one track.

    Returns: { success, stats: { totalSegments, originalTracks, removedTracks } }
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    create_backup(draft_path)

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    tracks = draft.get("tracks", [])

    # Collect all audio segments from all tracks
    all_audio_segs = []
    audio_track_indices = []
    for idx, track in enumerate(tracks):
        if track.get("type") == "audio":
            audio_track_indices.append(idx)
            all_audio_segs.extend(track.get("segments", []))

    if not all_audio_segs:
        return {
            "success": True,
            "stats": {"totalSegments": 0, "originalTracks": 0, "removedTracks": 0},
            "message": "No audio segments found",
        }

    original_track_count = len(audio_track_indices)
    original_segment_count = len(all_audio_segs)

    # Sort by timeline position
    all_audio_segs.sort(
        key=lambda s: s.get("target_timerange", {}).get("start", 0)
    )

    # Reposition sequentially without gaps
    current_time = 0
    for seg in all_audio_segs:
        seg["target_timerange"]["start"] = current_time
        src = seg.get("source_timerange")
        if src is not None:
            src["start"] = 0
        current_time += seg["target_timerange"]["duration"]

    # Place all in the first audio track
    first_audio_idx = audio_track_indices[0]
    tracks[first_audio_idx]["segments"] = all_audio_segs

    # Remove extra audio tracks (reverse order to preserve indices)
    removed = 0
    for idx in reversed(audio_track_indices[1:]):
        del tracks[idx]
        removed += 1

    _recalculate_duration(draft)

    save_draft(draft, str(path), sync_meta=False)

    return {
        "success": True,
        "stats": {
            "totalSegments": original_segment_count,
            "originalTracks": original_track_count,
            "removedTracks": removed,
        },
    }


def loop_video(draft_path: str, audio_track_index: int = 0,
               order: str = "random") -> dict:
    """Repeat video segments to fill the total audio duration.

    Deep-clones existing video segments and repositions them sequentially
    until they cover the full audio track duration.

    Args:
        draft_path: Path to draft_content.json.
        audio_track_index: Index of the audio track to match duration.
        order: 'random' shuffles segments each cycle, 'sequential' keeps order.

    Returns: { success, stats: { originalCount, newCount, cycles } }
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    create_backup(draft_path)

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    tracks = draft.get("tracks", [])

    # Calculate total audio duration
    audio_duration = 0
    audio_count = 0
    for track in tracks:
        if track.get("type") == "audio":
            if audio_count == audio_track_index:
                for seg in track.get("segments", []):
                    tr = seg.get("target_timerange", {})
                    seg_end = tr.get("start", 0) + tr.get("duration", 0)
                    if seg_end > audio_duration:
                        audio_duration = seg_end
                break
            audio_count += 1

    # Fallback: use any audio track
    if audio_duration == 0:
        for track in tracks:
            if track.get("type") == "audio":
                for seg in track.get("segments", []):
                    tr = seg.get("target_timerange", {})
                    seg_end = tr.get("start", 0) + tr.get("duration", 0)
                    if seg_end > audio_duration:
                        audio_duration = seg_end
                break

    if audio_duration == 0:
        return {"success": False, "error": "No audio found to determine target duration"}

    # Find video track and its segments
    video_track_idx = None
    video_originals = []
    for idx, track in enumerate(tracks):
        if track.get("type") == "video":
            video_track_idx = idx
            video_originals = list(track.get("segments", []))
            break

    if not video_originals:
        return {"success": False, "error": "No video segments found"}

    # Build new segments by looping
    new_segments = []
    current_time = 0
    cycles = 0

    while current_time < audio_duration:
        cycles += 1
        batch = list(video_originals)
        if order == "random":
            random.shuffle(batch)

        for seg in batch:
            if current_time >= audio_duration:
                break
            # Deep-clone the segment
            new_seg = json.loads(json.dumps(seg))
            new_seg["id"] = _generate_uuid()
            new_seg["target_timerange"]["start"] = current_time
            new_segments.append(new_seg)
            current_time += new_seg["target_timerange"]["duration"]

    tracks[video_track_idx]["segments"] = new_segments

    _recalculate_duration(draft)

    save_draft(draft, str(path))

    return {
        "success": True,
        "stats": {
            "originalCount": len(video_originals),
            "newCount": len(new_segments),
            "cycles": cycles,
        },
    }


def loop_audio(draft_path: str, track_index: int,
               target_duration_us: int) -> dict:
    """Repeat audio segments to fill a target duration.

    Deep-clones existing audio segments sequentially until
    the target duration is reached.

    Args:
        draft_path: Path to draft_content.json.
        track_index: Index of the track to loop.
        target_duration_us: Target duration in microseconds.

    Returns: { success, stats: { originalCount, newCount, cycles } }
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    create_backup(draft_path)

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    tracks = draft.get("tracks", [])
    if track_index >= len(tracks):
        return {"success": False, "error": f"Track index {track_index} does not exist"}

    originals = list(tracks[track_index].get("segments", []))
    if not originals:
        return {"success": False, "error": "No segments in the specified track"}

    new_segments = []
    current_time = 0
    cycles = 0

    while current_time < target_duration_us:
        cycles += 1
        for seg in originals:
            if current_time >= target_duration_us:
                break
            new_seg = json.loads(json.dumps(seg))
            new_seg["id"] = _generate_uuid()
            new_seg["target_timerange"]["start"] = current_time
            new_segments.append(new_seg)
            current_time += new_seg["target_timerange"]["duration"]

    tracks[track_index]["segments"] = new_segments

    _recalculate_duration(draft)

    save_draft(draft, str(path))

    return {
        "success": True,
        "stats": {
            "originalCount": len(originals),
            "newCount": len(new_segments),
            "cycles": cycles,
        },
    }


# ---------------------------------------------------------------------------
# SRT Insertion Functions
# ---------------------------------------------------------------------------

def parse_srt(filepath: str) -> list:
    """Parse an SRT file and return list of subtitle entries.

    Each entry: { start: int_us, duration: int_us, text: str }
    """
    try:
        with open(filepath, "r", encoding="utf-8-sig") as f:
            content = f.read()
    except UnicodeDecodeError:
        with open(filepath, "r", encoding="cp1252") as f:
            content = f.read()

    # Normalize line endings
    content = content.replace("\r\n", "\n").replace("\r", "\n")

    pattern = (
        r"(\d+)\s*\n"
        r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*"
        r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*\n"
        r"([\s\S]*?)(?=\n\n|\n\d+\s*\n|$)"
    )

    entries = []
    for match in re.findall(pattern, content):
        _idx, h1, m1, s1, ms1, h2, m2, s2, ms2, text = match
        start_us = (int(h1) * 3600 + int(m1) * 60 + int(s1)) * 1_000_000 + int(ms1) * 1000
        end_us = (int(h2) * 3600 + int(m2) * 60 + int(s2)) * 1_000_000 + int(ms2) * 1000
        text = text.strip().replace("\n", " ")

        if text and end_us > start_us:
            entries.append({
                "start": start_us,
                "duration": end_us - start_us,
                "text": text,
            })

    return entries


def _create_text_material(text: str, font_size: float = 5.0,
                          is_subtitle: bool = False,
                          group_id: str = "") -> tuple:
    """Create a text material and animation material pair using templates.

    Returns: (material_id, animation_id, text_material_dict, animation_material_dict)
    """
    mat_id = _generate_uuid()
    anim_id = _generate_uuid()

    text_mat = load_template("text_material_template")
    text_mat["id"] = mat_id
    text_mat["content"] = text
    text_mat["group_id"] = group_id
    text_mat["font_size"] = font_size
    text_mat["type"] = "subtitle" if is_subtitle else "text"
    text_mat["recognize_text"] = text

    anim_mat = load_template("text_animation_template")
    anim_mat["id"] = anim_id

    return mat_id, anim_id, text_mat, anim_mat


def _create_text_segment(mat_id: str, anim_id: str, start_us: int,
                         duration_us: int, y_pos: float = -0.75,
                         render_index: int = 14000) -> dict:
    """Create a text segment using the segment template.

    Returns: segment dict
    """
    seg_id = _generate_uuid()

    seg = load_template("text_segment_template")
    seg["id"] = seg_id
    seg["material_id"] = mat_id
    seg["extra_material_refs"] = [anim_id]
    seg["target_timerange"] = {"start": start_us, "duration": duration_us}
    seg["clip"]["transform"]["y"] = y_pos
    seg["render_index"] = render_index

    return seg


def insert_srt(draft_path: str, srt_file_paths: list,
               create_title: bool = True,
               separate_tracks: bool = False) -> dict:
    """Insert SRT subtitles into the timeline, matching to audio tracks by basename.

    For each audio segment, looks for an SRT file with the same basename.
    Each subtitle from the SRT is positioned relative to the audio start time.

    Args:
        draft_path: Path to draft_content.json.
        srt_file_paths: List of full paths to .srt files.
        create_title: If True, creates a title text for each audio.
        separate_tracks: If True, creates a separate text track per audio.

    Returns: { success, stats: { totalSubtitles, tracksCreated } }
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    create_backup(draft_path)

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    # Build map of audio segments with their material info
    audios_mat = {m["id"]: m for m in draft.get("materials", {}).get("audios", [])}
    audio_segments = []
    for track in draft.get("tracks", []):
        if track.get("type") == "audio":
            for seg in track.get("segments", []):
                mat_id = seg.get("material_id", "")
                mat = audios_mat.get(mat_id, {})
                audio_segments.append({
                    "name": mat.get("name", ""),
                    "start": seg["target_timerange"]["start"],
                    "duration": seg["target_timerange"]["duration"],
                })

    # Build map: lowercase basename (without ext) -> full SRT path
    srt_map = {}
    for srt_path in srt_file_paths:
        basename = os.path.splitext(os.path.basename(srt_path))[0].lower()
        srt_map[basename] = srt_path

    total = 0
    all_text_mats = []
    all_anim_mats = []
    all_subtitle_segs = []
    all_title_segs = []
    per_audio_tracks = []

    for i, audio in enumerate(audio_segments):
        audio_basename = os.path.splitext(os.path.basename(audio["name"]))[0].lower()

        if audio_basename not in srt_map:
            continue

        srt_path = srt_map[audio_basename]
        if not os.path.exists(srt_path):
            continue

        # Create title text
        if create_title:
            title_text = os.path.splitext(os.path.basename(audio["name"]))[0]
            # Clean numeric prefixes
            title_text = re.sub(r"^\d+[-_.\s]*", "", title_text).strip()
            mat_id, anim_id, text_mat, anim_mat = _create_text_material(
                title_text, font_size=7.0, group_id=f"title_{i}"
            )
            all_text_mats.append(text_mat)
            all_anim_mats.append(anim_mat)
            title_seg = _create_text_segment(
                mat_id, anim_id, audio["start"], audio["duration"],
                y_pos=-0.85, render_index=15000 + i,
            )
            all_title_segs.append(title_seg)

        # Parse and insert subtitles
        group_id = f"srt_{int(datetime.now().timestamp() * 1000)}_{i}"
        current_audio_segs = []

        for entry in parse_srt(srt_path):
            if entry["start"] + entry["duration"] <= audio["duration"]:
                mat_id, anim_id, text_mat, anim_mat = _create_text_material(
                    entry["text"], font_size=5.0, is_subtitle=True,
                    group_id=group_id,
                )
                all_text_mats.append(text_mat)
                all_anim_mats.append(anim_mat)

                seg = _create_text_segment(
                    mat_id, anim_id,
                    audio["start"] + entry["start"],
                    entry["duration"],
                    y_pos=-0.75,
                    render_index=14000 + total,
                )

                if separate_tracks:
                    current_audio_segs.append(seg)
                else:
                    all_subtitle_segs.append(seg)
                total += 1

        if separate_tracks and current_audio_segs:
            per_audio_tracks.append(current_audio_segs)

    # Create text tracks
    new_tracks = []
    if separate_tracks and per_audio_tracks:
        for track_segs in per_audio_tracks:
            new_tracks.append({
                "attribute": 0, "flag": 1,
                "id": _generate_uuid(),
                "is_default_name": True, "name": "",
                "segments": track_segs, "type": "text",
            })
    elif all_subtitle_segs:
        new_tracks.append({
            "attribute": 0, "flag": 1,
            "id": _generate_uuid(),
            "is_default_name": True, "name": "",
            "segments": all_subtitle_segs, "type": "text",
        })

    if all_title_segs:
        new_tracks.append({
            "attribute": 0, "flag": 1,
            "id": _generate_uuid(),
            "is_default_name": True, "name": "",
            "segments": all_title_segs, "type": "text",
        })

    # Append materials and tracks
    draft.setdefault("materials", {}).setdefault("texts", []).extend(all_text_mats)
    draft["materials"].setdefault("material_animations", []).extend(all_anim_mats)
    draft.setdefault("tracks", []).extend(new_tracks)

    _recalculate_duration(draft)

    save_draft(draft, str(path))

    return {
        "success": True,
        "stats": {"totalSubtitles": total, "tracksCreated": len(new_tracks)},
    }


def insert_srt_batch(draft_path: str, srt_files: list,
                     create_title: bool = True,
                     gap_us: int = 2_000_000) -> dict:
    """Insert multiple SRT files sequentially into the timeline.

    Each SRT file is placed one after another with a configurable gap.
    Does NOT depend on audio tracks.

    Args:
        draft_path: Path to draft_content.json.
        srt_files: List of full paths to .srt files.
        create_title: If True, creates a title text for each file.
        gap_us: Gap between SRT blocks in microseconds (default 2s).

    Returns: { success, stats: { totalSubtitles, totalFiles, tracksCreated } }
    """
    path = Path(draft_path)
    if not path.exists():
        raise FileNotFoundError(f"Draft not found: {draft_path}")

    create_backup(draft_path)

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    total = 0
    all_text_mats = []
    all_anim_mats = []
    all_subtitle_segs = []
    all_title_segs = []
    current_time = 0

    for i, srt_path in enumerate(srt_files):
        if not os.path.exists(srt_path):
            continue

        entries = parse_srt(srt_path)
        if not entries:
            continue

        block_duration = max(e["start"] + e["duration"] for e in entries)
        block_name = os.path.splitext(os.path.basename(srt_path))[0]
        # Clean numeric prefixes
        clean_name = re.sub(r"^\d+[-_.\s]*", "", block_name).strip()

        # Create title
        if create_title:
            mat_id, anim_id, text_mat, anim_mat = _create_text_material(
                clean_name or block_name, font_size=7.0,
                group_id=f"batch_title_{i}",
            )
            all_text_mats.append(text_mat)
            all_anim_mats.append(anim_mat)
            title_seg = _create_text_segment(
                mat_id, anim_id, current_time, block_duration,
                y_pos=-0.85, render_index=15000 + i,
            )
            all_title_segs.append(title_seg)

        # Insert subtitles
        batch_ts = int(datetime.now().timestamp() * 1000)
        for j, entry in enumerate(entries):
            group_id = f"batch_{batch_ts}_{i}_{j}"
            mat_id, anim_id, text_mat, anim_mat = _create_text_material(
                entry["text"], font_size=5.0, is_subtitle=True,
                group_id=group_id,
            )
            all_text_mats.append(text_mat)
            all_anim_mats.append(anim_mat)
            seg = _create_text_segment(
                mat_id, anim_id,
                current_time + entry["start"],
                entry["duration"],
                y_pos=-0.75,
                render_index=14000 + total,
            )
            all_subtitle_segs.append(seg)
            total += 1

        current_time += block_duration + gap_us

    if not all_subtitle_segs:
        return {"success": False, "error": "No subtitles found in the selected files"}

    # Ensure video track exists (required for CapCut to render text)
    has_video = any(t.get("type") == "video" for t in draft.get("tracks", []))
    if not has_video:
        draft.setdefault("tracks", []).insert(0, {
            "attribute": 0, "flag": 0,
            "id": _generate_uuid(),
            "is_default_name": True, "name": "",
            "segments": [], "type": "video",
        })

    # Create text tracks
    new_tracks = []
    if all_subtitle_segs:
        new_tracks.append({
            "attribute": 0, "flag": 1,
            "id": _generate_uuid(),
            "is_default_name": True, "name": "",
            "segments": all_subtitle_segs, "type": "text",
        })
    if all_title_segs:
        new_tracks.append({
            "attribute": 0, "flag": 1,
            "id": _generate_uuid(),
            "is_default_name": True, "name": "",
            "segments": all_title_segs, "type": "text",
        })

    # Append
    draft.setdefault("materials", {}).setdefault("texts", []).extend(all_text_mats)
    draft["materials"].setdefault("material_animations", []).extend(all_anim_mats)
    draft.setdefault("tracks", []).extend(new_tracks)

    _recalculate_duration(draft)

    save_draft(draft, str(path))

    return {
        "success": True,
        "stats": {
            "totalSubtitles": total,
            "totalFiles": len(srt_files),
            "tracksCreated": len(new_tracks),
        },
    }
