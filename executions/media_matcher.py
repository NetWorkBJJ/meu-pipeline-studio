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
    name = Path(filename).stem.lower()

    # Pattern 1: scene_NNN (exact convention)
    match = re.match(r"scene[_\-\s]?(\d+)", name)
    if match:
        return int(match.group(1))

    # Pattern 2: cena_NNN (Portuguese)
    match = re.match(r"cena[_\-\s]?(\d+)", name)
    if match:
        return int(match.group(1))

    # Pattern 3: Leading number NNN_description
    match = re.match(r"(\d+)[_\-\s]", name)
    if match:
        return int(match.group(1))

    # Pattern 4: Just a number
    match = re.match(r"^(\d+)$", name)
    if match:
        return int(match.group(1))

    return None


def match_media_to_scenes(params):
    """Match imported media files to scenes by filename convention.

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

    if strategy == "auto":
        # Phase 1: Exact match by filename convention
        for filepath in valid_files:
            scene_num = _extract_scene_number(os.path.basename(filepath))
            if scene_num is None:
                continue

            for scene in scenes:
                if scene["id"] in matched_scene_set:
                    continue
                if scene["index"] == scene_num:
                    matches.append({
                        "scene_id": scene["id"],
                        "scene_index": scene["index"],
                        "media_path": filepath,
                        "confidence": 1.0,
                        "match_reason": "filename_convention",
                    })
                    matched_file_set.add(filepath)
                    matched_scene_set.add(scene["id"])
                    break

        # Phase 2: Sequential assignment for remaining
        remaining_files = sorted(
            [f for f in valid_files if f not in matched_file_set],
            key=lambda f: os.path.basename(f).lower(),
        )
        remaining_scenes = [s for s in scenes if s["id"] not in matched_scene_set]

        for filepath, scene in zip(remaining_files, remaining_scenes):
            matches.append({
                "scene_id": scene["id"],
                "scene_index": scene["index"],
                "media_path": filepath,
                "confidence": 0.5,
                "match_reason": "sequential_fallback",
            })
            matched_file_set.add(filepath)
            matched_scene_set.add(scene["id"])

    elif strategy == "sequential":
        sorted_files = sorted(valid_files, key=lambda f: os.path.basename(f).lower())
        for filepath, scene in zip(sorted_files, scenes):
            matches.append({
                "scene_id": scene["id"],
                "scene_index": scene["index"],
                "media_path": filepath,
                "confidence": 0.7,
                "match_reason": "sequential",
            })
            matched_file_set.add(filepath)
            matched_scene_set.add(scene["id"])

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
