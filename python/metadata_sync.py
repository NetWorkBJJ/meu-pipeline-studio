"""Sync CapCut metadata files after draft modifications."""

import json
import os
from pathlib import Path


def _get_materials_size(draft_dir: str) -> int:
    """Calculate total size of all material files referenced in the draft."""
    draft_path = Path(draft_dir) / "draft_content.json"
    if not draft_path.exists():
        return 0

    total_size = 0
    with open(draft_path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    materials = draft.get("materials", {})

    for mat_list_key in ["audios", "videos"]:
        for mat in materials.get(mat_list_key, []):
            file_path = mat.get("path", "")
            if not file_path or file_path.startswith("##"):
                continue
            if os.path.exists(file_path):
                try:
                    total_size += os.path.getsize(file_path)
                except OSError:
                    pass

    return total_size


def sync_metadata(draft_dir: str) -> dict:
    """Sync draft_meta_info.json and root_meta_info.json after draft changes.

    - draft_meta_info.json uses field "draft_timeline_materials_size_" (WITH trailing underscore)
    - root_meta_info.json uses field "draft_timeline_materials_size" (WITHOUT trailing underscore)
    """
    draft_dir_path = Path(draft_dir)
    materials_size = _get_materials_size(draft_dir)

    draft_meta_path = draft_dir_path / "draft_meta_info.json"
    if draft_meta_path.exists():
        with open(draft_meta_path, "r", encoding="utf-8") as f:
            draft_meta = json.load(f)
        draft_meta["draft_timeline_materials_size_"] = materials_size
        with open(draft_meta_path, "w", encoding="utf-8") as f:
            json.dump(draft_meta, f, ensure_ascii=False)

    root_meta_path = draft_dir_path.parent.parent / "root_meta_info.json"
    if root_meta_path.exists():
        with open(root_meta_path, "r", encoding="utf-8") as f:
            root_meta = json.load(f)

        draft_id = None
        if draft_meta_path.exists():
            with open(draft_meta_path, "r", encoding="utf-8") as f:
                dm = json.load(f)
            draft_id = dm.get("draft_id")

        if draft_id and "all_draft_store" in root_meta:
            for entry in root_meta["all_draft_store"]:
                if entry.get("draft_id") == draft_id:
                    entry["draft_timeline_materials_size"] = materials_size
                    break

        with open(root_meta_path, "w", encoding="utf-8") as f:
            json.dump(root_meta, f, ensure_ascii=False)

    return {"materials_size": materials_size, "synced": True}
