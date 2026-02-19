"""Debug and diagnostic tools for CapCut project validation.

Provides functions to validate project structure, diagnose metadata issues,
check if CapCut is running, and get overall project health reports.
"""

import json
import os
import subprocess
from pathlib import Path


CAPCUT_PROJECTS_PATH = Path(
    os.environ.get("LOCALAPPDATA", "")
) / "CapCut" / "User Data" / "Projects" / "com.lveditor.draft"

# Materials expected by CapCut (from NardotoStudio reference)
EXPECTED_MATERIALS_KEYS = [
    "videos", "audios", "texts", "images", "stickers",
    "effects", "transitions", "filters", "canvases",
    "vocal_beautifys", "material_animations", "speeds",
    "sound_channel_mappings",
]


def validate_project(project_path: str) -> dict:
    """Validate a CapCut project structure and metadata consistency.

    Checks:
    - draft_content.json exists and is valid JSON
    - draft_info.json exists and has consistent draft_id
    - draft_meta_info.json exists and has consistent draft_id
    - Entry exists in root_meta_info.json with correct paths
    - draft_json_file points to an existing file
    - Materials structure matches NardotoStudio reference

    Returns a detailed validation report.
    """
    project_dir = Path(project_path)
    report = {
        "project_path": str(project_dir),
        "valid": True,
        "checks": [],
        "warnings": [],
        "errors": [],
    }

    draft_id_from_content = None
    draft_id_from_info = None
    draft_id_from_meta = None

    # --- Check 1: Project directory exists ---
    if not project_dir.exists():
        report["valid"] = False
        report["errors"].append(f"Project directory does not exist: {project_dir}")
        return report
    report["checks"].append("Project directory exists")

    # --- Check 2: draft_content.json ---
    draft_content_path = project_dir / "draft_content.json"
    if not draft_content_path.exists():
        report["valid"] = False
        report["errors"].append("draft_content.json not found")
    else:
        try:
            with open(draft_content_path, "r", encoding="utf-8") as f:
                draft = json.load(f)
            draft_id_from_content = draft.get("id", "")
            report["checks"].append(f"draft_content.json valid (id={draft_id_from_content[:12]}...)")

            # Check materials structure
            materials = draft.get("materials", {})
            extra_keys = set(materials.keys()) - set(EXPECTED_MATERIALS_KEYS)
            missing_keys = set(EXPECTED_MATERIALS_KEYS) - set(materials.keys())

            if extra_keys:
                report["warnings"].append(
                    f"Extra material types not in NardotoStudio reference: {sorted(extra_keys)}"
                )
            if missing_keys:
                report["warnings"].append(
                    f"Missing material types from NardotoStudio reference: {sorted(missing_keys)}"
                )
            if not extra_keys and not missing_keys:
                report["checks"].append("Materials structure matches NardotoStudio (13 types)")

            # Check tracks
            tracks = draft.get("tracks", [])
            report["checks"].append(f"Tracks count: {len(tracks)}")

            # Check duration
            duration = draft.get("duration", 0)
            report["checks"].append(f"Duration: {duration} us ({duration / 1000000:.2f}s)")

        except json.JSONDecodeError as e:
            report["valid"] = False
            report["errors"].append(f"draft_content.json invalid JSON: {e}")
        except Exception as e:
            report["valid"] = False
            report["errors"].append(f"Error reading draft_content.json: {e}")

    # --- Check 3: draft_info.json ---
    draft_info_path = project_dir / "draft_info.json"
    if not draft_info_path.exists():
        report["warnings"].append("draft_info.json not found (optional but recommended)")
    else:
        try:
            with open(draft_info_path, "r", encoding="utf-8") as f:
                info = json.load(f)
            draft_id_from_info = info.get("draft_id", "")
            report["checks"].append(f"draft_info.json valid (draft_id={draft_id_from_info[:12]}...)")
        except Exception as e:
            report["warnings"].append(f"Error reading draft_info.json: {e}")

    # --- Check 4: draft_meta_info.json ---
    draft_meta_path = project_dir / "draft_meta_info.json"
    if not draft_meta_path.exists():
        report["valid"] = False
        report["errors"].append("draft_meta_info.json not found")
    else:
        try:
            with open(draft_meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            draft_id_from_meta = meta.get("draft_id", "")

            # Check trailing underscore field
            has_size_field = "draft_timeline_materials_size_" in meta
            report["checks"].append(
                f"draft_meta_info.json valid (draft_id={draft_id_from_meta[:12]}..., "
                f"has_size_underscore={has_size_field})"
            )

            # Check fold_path
            fold_path = meta.get("draft_fold_path", "")
            expected_fold = str(project_dir).replace("\\", "/")
            if fold_path != expected_fold:
                report["errors"].append(
                    f"draft_meta_info.json fold_path mismatch: "
                    f"got '{fold_path}', expected '{expected_fold}'"
                )
                report["valid"] = False

        except Exception as e:
            report["valid"] = False
            report["errors"].append(f"Error reading draft_meta_info.json: {e}")

    # --- Check 5: draft_id consistency ---
    ids = {
        "content": draft_id_from_content,
        "info": draft_id_from_info,
        "meta": draft_id_from_meta,
    }
    non_null_ids = {k: v for k, v in ids.items() if v}
    unique_ids = set(non_null_ids.values())
    if len(unique_ids) > 1:
        report["valid"] = False
        report["errors"].append(f"draft_id mismatch across files: {non_null_ids}")
    elif len(unique_ids) == 1:
        report["checks"].append("draft_id consistent across all files")

    # --- Check 6: root_meta_info.json registration ---
    root_meta_path = CAPCUT_PROJECTS_PATH / "root_meta_info.json"
    if not root_meta_path.exists():
        report["errors"].append("root_meta_info.json not found at CapCut projects path")
        report["valid"] = False
    else:
        try:
            with open(root_meta_path, "r", encoding="utf-8") as f:
                root_meta = json.load(f)

            all_drafts = root_meta.get("all_draft_store", [])
            expected_fold = str(project_dir).replace("\\", "/")

            found_entry = None
            for entry in all_drafts:
                if entry.get("draft_fold_path") == expected_fold:
                    found_entry = entry
                    break

            if not found_entry:
                report["valid"] = False
                report["errors"].append(
                    f"Project NOT registered in root_meta_info.json "
                    f"(no entry with draft_fold_path='{expected_fold}'). "
                    f"Total entries: {len(all_drafts)}"
                )
            else:
                report["checks"].append("Project registered in root_meta_info.json")

                # Check draft_json_file
                json_file = found_entry.get("draft_json_file", "")
                expected_json = f"{expected_fold}/draft_content.json"
                if json_file != expected_json:
                    report["warnings"].append(
                        f"root_meta draft_json_file: '{json_file}' "
                        f"(expected '{expected_json}')"
                    )

                # Check draft_id matches
                root_draft_id = found_entry.get("draft_id", "")
                if draft_id_from_content and root_draft_id != draft_id_from_content:
                    report["errors"].append(
                        f"draft_id in root_meta ({root_draft_id}) "
                        f"does not match draft_content.json ({draft_id_from_content})"
                    )
                    report["valid"] = False

                # Check no trailing underscore in root
                if "draft_timeline_materials_size_" in found_entry:
                    report["warnings"].append(
                        "root_meta entry has trailing underscore on "
                        "draft_timeline_materials_size_ (should NOT have underscore)"
                    )

        except Exception as e:
            report["errors"].append(f"Error reading root_meta_info.json: {e}")

    return report


def diagnose_root_meta(project_name: str) -> dict:
    """Check if a project is registered in root_meta_info.json.

    Searches by project name and path, returns matching entries.
    """
    root_meta_path = CAPCUT_PROJECTS_PATH / "root_meta_info.json"
    result = {
        "root_meta_path": str(root_meta_path),
        "root_meta_exists": root_meta_path.exists(),
        "matches": [],
        "total_entries": 0,
    }

    if not root_meta_path.exists():
        return result

    try:
        with open(root_meta_path, "r", encoding="utf-8") as f:
            root_meta = json.load(f)

        all_drafts = root_meta.get("all_draft_store", [])
        result["total_entries"] = len(all_drafts)

        name_lower = project_name.lower()
        for i, entry in enumerate(all_drafts):
            draft_name = entry.get("draft_name", "")
            fold_path = entry.get("draft_fold_path", "")

            if name_lower in draft_name.lower() or name_lower in fold_path.lower():
                result["matches"].append({
                    "index": i,
                    "draft_name": draft_name,
                    "draft_id": entry.get("draft_id", ""),
                    "draft_fold_path": fold_path,
                    "draft_json_file": entry.get("draft_json_file", ""),
                    "tm_draft_create": entry.get("tm_draft_create", 0),
                    "tm_draft_modified": entry.get("tm_draft_modified", 0),
                    "tm_duration": entry.get("tm_duration", 0),
                    "folder_exists": os.path.isdir(fold_path.replace("/", "\\")),
                })

    except Exception as e:
        result["error"] = str(e)

    return result


def check_capcut_running() -> dict:
    """Check if CapCut is currently running.

    Important: CapCut must be closed when creating/modifying projects,
    otherwise it will overwrite root_meta_info.json with its cached version.
    """
    result = {
        "running": False,
        "processes": [],
        "warning": "",
    }

    try:
        output = subprocess.check_output(
            ["tasklist", "/FI", "IMAGENAME eq CapCut.exe", "/FO", "CSV", "/NH"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        for line in output.strip().split("\n"):
            line = line.strip()
            if line and "CapCut.exe" in line:
                result["running"] = True
                parts = line.replace('"', '').split(",")
                if len(parts) >= 2:
                    result["processes"].append({
                        "name": parts[0],
                        "pid": parts[1],
                    })
    except Exception:
        pass

    if result["running"]:
        result["warning"] = (
            "CapCut is running. Creating or modifying projects while CapCut is open "
            "may cause root_meta_info.json to be overwritten, losing new entries."
        )

    return result


def get_project_health(project_path: str) -> dict:
    """Get a comprehensive health status for a project.

    Combines validation, root_meta diagnosis, and CapCut status.
    """
    project_dir = Path(project_path)
    project_name = project_dir.name

    validation = validate_project(project_path)
    root_meta = diagnose_root_meta(project_name)
    capcut = check_capcut_running()

    # Overall health score
    error_count = len(validation.get("errors", []))
    warning_count = len(validation.get("warnings", []))
    check_count = len(validation.get("checks", []))

    if error_count == 0 and warning_count == 0:
        health = "healthy"
    elif error_count == 0:
        health = "warnings"
    else:
        health = "critical"

    return {
        "project_name": project_name,
        "project_path": str(project_dir),
        "health": health,
        "error_count": error_count,
        "warning_count": warning_count,
        "check_count": check_count,
        "capcut_running": capcut["running"],
        "capcut_warning": capcut.get("warning", ""),
        "registered_in_root_meta": len(root_meta.get("matches", [])) > 0,
        "validation": validation,
        "root_meta_info": root_meta,
    }
