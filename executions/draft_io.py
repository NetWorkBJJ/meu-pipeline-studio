"""Centralized I/O for CapCut draft_content.json files.

Writes draft data to ALL locations that CapCut reads from:
  - Root draft_content.json
  - Root draft_content.json.bak
  - Root template-2.tmp
  - Timelines/{UUID}/draft_content.json
  - Timelines/{UUID}/draft_content.json.bak
  - Timelines/{UUID}/template-2.tmp

Also invalidates CapCut binary cache (draft.extra) and optionally
syncs metadata files (draft_meta_info.json, root_meta_info.json).
"""

import json
import os
import sys
from pathlib import Path


def _write_bytes_fsync(file_path: str, data: bytes) -> None:
    """Write bytes to file with flush + fsync to guarantee disk persistence."""
    with open(file_path, "wb") as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())


def _invalidate_cache(dir_path: Path) -> bool:
    """Rename draft.extra -> draft.extra.backup to force CapCut reload.

    Returns True if cache was invalidated, False otherwise.
    """
    extra = dir_path / "draft.extra"
    if not extra.exists():
        return False
    backup = dir_path / "draft.extra.backup"
    try:
        if backup.exists():
            os.remove(str(backup))
        os.rename(str(extra), str(backup))
        return True
    except OSError:
        return False


def save_draft(draft: dict, draft_path: str, sync_meta: bool = True) -> dict:
    """Write draft_content.json to ALL required CapCut locations.

    This replicates the write pattern used by apps that successfully modify
    CapCut projects. CapCut reads from multiple file locations and uses a
    binary cache; all must be updated for changes to take effect.

    Args:
        draft: The complete draft_content dict to write.
        draft_path: Path to the root draft_content.json.
        sync_meta: If True, sync metadata files after writing (default True).

    Returns:
        dict with written_files, cache_invalidated, metadata_synced.
    """
    path = Path(draft_path)
    draft_dir = path.parent

    # Serialize once, minified (matches CapCut internal format)
    json_str = json.dumps(draft, ensure_ascii=False, separators=(",", ":"))
    data_bytes = json_str.encode("utf-8")

    written_files = []
    cache_invalidated = []

    # --- Root directory writes ---
    _write_bytes_fsync(str(path), data_bytes)
    written_files.append(str(path))

    # Mirror to all draft file variants so CapCut picks up changes.
    # Both draft_content.json and draft_info.json must stay in sync.
    main_name = path.name
    mirror_names = ["draft_content.json.bak", "template-2.tmp"]
    # Always mirror to the other draft file (whichever wasn't the main path)
    if main_name != "draft_content.json":
        mirror_names.append("draft_content.json")
    if main_name != "draft_info.json":
        mirror_names.append("draft_info.json")

    for mirror_name in mirror_names:
        mirror_path = draft_dir / mirror_name
        try:
            _write_bytes_fsync(str(mirror_path), data_bytes)
            written_files.append(str(mirror_path))
        except OSError:
            pass

    if _invalidate_cache(draft_dir):
        cache_invalidated.append(str(draft_dir / "draft.extra"))

    # --- Timelines subdirectory writes ---
    timelines_dir = draft_dir / "Timelines"
    if timelines_dir.exists() and timelines_dir.is_dir():
        for item in timelines_dir.iterdir():
            if not item.is_dir():
                continue
            # Each UUID subdirectory may contain draft files
            sub_draft = item / "draft_content.json"
            # Only sync if the subdirectory already has a draft_content.json
            # (CapCut creates this structure; we don't create it from scratch)
            if not sub_draft.exists():
                continue
            try:
                _write_bytes_fsync(str(sub_draft), data_bytes)
                written_files.append(str(sub_draft))
            except OSError:
                pass

            for mirror_name in ["draft_content.json.bak", "template-2.tmp"]:
                mirror_path = item / mirror_name
                try:
                    _write_bytes_fsync(str(mirror_path), data_bytes)
                    written_files.append(str(mirror_path))
                except OSError:
                    pass

            if _invalidate_cache(item):
                cache_invalidated.append(str(item / "draft.extra"))

    # --- Metadata sync ---
    metadata_synced = False
    if sync_meta:
        try:
            from metadata_sync import sync_metadata
            sync_metadata(str(draft_dir))
            metadata_synced = True
        except Exception:
            pass

    return {
        "written_files": len(written_files),
        "cache_invalidated": len(cache_invalidated),
        "metadata_synced": metadata_synced,
    }


def read_draft(draft_path: str) -> dict:
    """Read and parse the draft file.

    If the specified path does not exist, tries alternative filenames
    in the same directory (draft_info.json, draft_content.json, template.tmp).
    """
    path = Path(draft_path)
    if not path.exists():
        parent = path.parent
        for candidate in ["draft_info.json", "draft_content.json", "template.tmp"]:
            alt = parent / candidate
            if alt.exists():
                path = alt
                break
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
