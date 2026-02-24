"""Media Matcher: Match imported media files to planned scenes by filename convention."""

import os
import re
import logging
from pathlib import Path

log = logging.getLogger("bridge")

MEDIA_EXTENSIONS = {
    "video": {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"},
    "image": {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".gif"},
}

ALL_MEDIA_EXTENSIONS = MEDIA_EXTENSIONS["video"] | MEDIA_EXTENSIONS["image"]


def _detect_media_type(filepath: str) -> str | None:
    """Detect if a file is a video or image based on extension."""
    ext = Path(filepath).suffix.lower()
    if ext in MEDIA_EXTENSIONS["video"]:
        return "video"
    if ext in MEDIA_EXTENSIONS["image"]:
        return "photo"
    return None


def _extract_scene_number(filename: str) -> int | None:
    """Try to extract a scene number from a filename."""
    name = Path(filename).stem

    # Pattern 0a: (TAKE NNN) - AI generation naming with parentheses
    match = re.search(r"\(TAKE\s+(\d+)\)", name, re.IGNORECASE)
    if match:
        return int(match.group(1))

    name_lower = name.lower()

    # Pattern 0b: Take_NNN or take-NNN - AI generation naming without parentheses
    match = re.match(r"take[_\-\s](\d+)", name_lower)
    if match:
        return int(match.group(1))

    # Pattern 1: scene_NNN (exact convention)
    match = re.match(r"scene[_\-\s]?(\d+)", name_lower)
    if match:
        return int(match.group(1))

    # Pattern 2: cena_NNN (Portuguese)
    match = re.match(r"cena[_\-\s]?(\d+)", name_lower)
    if match:
        return int(match.group(1))

    # Pattern 3: Leading number NNN_description
    match = re.match(r"(\d+)[_\-\s]", name_lower)
    if match:
        return int(match.group(1))

    # Pattern 4: Just a number
    match = re.match(r"^(\d+)$", name_lower)
    if match:
        return int(match.group(1))

    return None


def _sort_key(filepath: str):
    """Sort key that uses extracted scene/take number, falling back to name."""
    num = _extract_scene_number(os.path.basename(filepath))
    return (num if num is not None else 999999, os.path.basename(filepath).lower())


def scan_media_folder(params):
    """Scan a folder for media files and return sorted list.

    params:
        folder_path: str - path to the folder

    Returns:
        files: list of absolute file paths (sorted by extracted number, then name)
        total: int - total media files found
        skipped: int - non-media files skipped
    """
    folder_path = params.get("folder_path", "")
    if not folder_path or not os.path.isdir(folder_path):
        return {"files": [], "total": 0, "skipped": 0, "error": "Invalid folder path"}

    all_entries = os.listdir(folder_path)
    media_files = []
    skipped = 0

    for entry in all_entries:
        full_path = os.path.join(folder_path, entry)
        if not os.path.isfile(full_path):
            continue
        if _detect_media_type(full_path) is not None:
            media_files.append(full_path)
        else:
            skipped += 1

    media_files.sort(key=_sort_key)

    log.info(
        "Scanned folder %s: %d media files, %d skipped",
        folder_path, len(media_files), skipped,
    )

    return {
        "files": media_files,
        "total": len(media_files),
        "skipped": skipped,
    }


def _make_match(scene, filepath, confidence, reason):
    """Create a match result dict."""
    return {
        "scene_id": scene["id"],
        "scene_index": scene["index"],
        "media_path": filepath,
        "confidence": confidence,
        "match_reason": reason,
    }


def match_media_to_scenes(params):
    """Match imported media files to scenes by filename convention.

    Matching phases (auto strategy):
      1. Exact match: file TAKE number == scene index
      2. Filename hint match: scene filename_hint found in file basename
      3. Media-type-aware sequential fallback: pair remaining files to remaining
         scenes by media type (videos to video scenes, images to image scenes)

    params:
        media_files: list of file paths
        scenes: list of {id, index, filename_hint, media_type}
        strategy: "auto" | "sequential"

    Returns:
        matches: list of {scene_id, scene_index, media_path, confidence, match_reason}
        unmatched_files: list of file paths
        unmatched_scenes: list of {id, index}
    """
    media_files = params.get("media_files", [])
    scenes = params.get("scenes", [])
    strategy = params.get("strategy", "auto")

    if not media_files or not scenes:
        return {
            "matches": [],
            "unmatched_files": media_files,
            "unmatched_scenes": [{"id": s["id"], "index": s["index"]} for s in scenes],
        }

    # Filter valid media files
    valid_files = [f for f in media_files if _detect_media_type(f)]
    invalid_files = [f for f in media_files if f not in valid_files]
    if invalid_files:
        log.warning("Skipping %d non-media files", len(invalid_files))

    matches = []
    matched_file_set = set()
    matched_scene_set = set()

    # Build index for quick scene lookup
    scene_by_index = {s["index"]: s for s in scenes}
    max_scene_index = max((s["index"] for s in scenes), default=0)

    if strategy == "auto":
        # Phase 1: Exact match by filename convention (TAKE number == scene index)
        for filepath in valid_files:
            scene_num = _extract_scene_number(os.path.basename(filepath))
            if scene_num is None:
                continue
            # Only match if number is within scene index range
            if scene_num > max_scene_index:
                continue
            scene = scene_by_index.get(scene_num)
            if scene and scene["id"] not in matched_scene_set:
                matches.append(_make_match(scene, filepath, 1.0, "filename_convention"))
                matched_file_set.add(filepath)
                matched_scene_set.add(scene["id"])

        # Phase 1.5: Match by filename_hint (e.g. scene_002 in basename)
        for filepath in valid_files:
            if filepath in matched_file_set:
                continue
            basename_lower = os.path.basename(filepath).lower()
            for scene in scenes:
                if scene["id"] in matched_scene_set:
                    continue
                hint = scene.get("filename_hint", "").lower().strip()
                if hint and hint in basename_lower:
                    matches.append(_make_match(scene, filepath, 0.8, "filename_hint"))
                    matched_file_set.add(filepath)
                    matched_scene_set.add(scene["id"])
                    break

        # Phase 2: Media-type-aware sequential fallback
        # Separate remaining files and scenes by media type, then pair each group
        remaining_files = [f for f in valid_files if f not in matched_file_set]
        remaining_scenes = [s for s in scenes if s["id"] not in matched_scene_set]

        # Group files by detected media type
        remaining_videos = sorted(
            [f for f in remaining_files if _detect_media_type(f) == "video"],
            key=_sort_key,
        )
        remaining_images = sorted(
            [f for f in remaining_files if _detect_media_type(f) == "photo"],
            key=_sort_key,
        )

        # Group scenes by expected media type
        video_scenes = [s for s in remaining_scenes if s.get("media_type") == "video"]
        image_scenes = [
            s for s in remaining_scenes
            if s.get("media_type") in ("photo", "image")
        ]

        # Pair videos to video scenes
        for filepath, scene in zip(remaining_videos, video_scenes):
            matches.append(_make_match(scene, filepath, 0.6, "sequential_by_type"))
            matched_file_set.add(filepath)
            matched_scene_set.add(scene["id"])

        # Pair images to image scenes
        for filepath, scene in zip(remaining_images, image_scenes):
            matches.append(_make_match(scene, filepath, 0.6, "sequential_by_type"))
            matched_file_set.add(filepath)
            matched_scene_set.add(scene["id"])

        # Phase 3: Catch-all for any remaining (cross-type if needed)
        leftover_files = sorted(
            [f for f in valid_files if f not in matched_file_set],
            key=_sort_key,
        )
        leftover_scenes = [s for s in scenes if s["id"] not in matched_scene_set]
        for filepath, scene in zip(leftover_files, leftover_scenes):
            matches.append(_make_match(scene, filepath, 0.3, "sequential_fallback"))
            matched_file_set.add(filepath)
            matched_scene_set.add(scene["id"])

    elif strategy == "sequential":
        sorted_files = sorted(valid_files, key=_sort_key)
        for filepath, scene in zip(sorted_files, scenes):
            matches.append(_make_match(scene, filepath, 0.7, "sequential"))
            matched_file_set.add(filepath)
            matched_scene_set.add(scene["id"])

    # Sort matches by scene index for consistent output
    matches.sort(key=lambda m: m["scene_index"])

    unmatched_files = [f for f in valid_files if f not in matched_file_set]
    unmatched_scenes = [
        {"id": s["id"], "index": s["index"]}
        for s in scenes
        if s["id"] not in matched_scene_set
    ]

    log.info(
        "Media matching complete: %d matched, %d unmatched files, %d unmatched scenes",
        len(matches), len(unmatched_files), len(unmatched_scenes),
    )

    return {
        "matches": matches,
        "unmatched_files": unmatched_files,
        "unmatched_scenes": unmatched_scenes,
    }
