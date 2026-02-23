"""Debug and diagnostic tools for CapCut project validation.

Provides functions to validate project structure, diagnose metadata issues,
check if CapCut is running, and get overall project health reports.
"""

import json
import os
import subprocess
import time
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


CAPCUT_PROCESSES = ["CapCut.exe", "CapCutHelper.exe", "CreativeGPT.exe"]


def check_capcut_running() -> dict:
    """Check if any CapCut-related process is currently running.

    Checks CapCut.exe, CapCutHelper.exe, and CreativeGPT.exe because
    background processes can modify project files even when the main app
    is closed.
    """
    result = {
        "running": False,
        "processes": [],
        "warning": "",
    }

    for proc_name in CAPCUT_PROCESSES:
        try:
            output = subprocess.check_output(
                ["tasklist", "/FI", f"IMAGENAME eq {proc_name}", "/FO", "CSV", "/NH"],
                text=True,
                stderr=subprocess.DEVNULL,
            )
            for line in output.strip().split("\n"):
                line = line.strip()
                if line and proc_name in line:
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
        names = [p["name"] for p in result["processes"]]
        result["warning"] = (
            f"CapCut processes running: {', '.join(names)}. "
            "Background processes can modify project files."
        )

    return result


def close_capcut() -> dict:
    """Close ALL CapCut processes. Tries graceful shutdown first, then force kill.

    Kills CapCut.exe, CapCutHelper.exe, and CreativeGPT.exe to prevent
    background processes from overwriting project files.

    Returns:
        dict with keys: closed (bool), was_running (bool), method (str), killed (list)
    """
    status = check_capcut_running()
    if not status["running"]:
        return {"closed": False, "was_running": False, "method": "none", "killed": []}

    killed = []

    # Try graceful close for all processes
    for proc_name in CAPCUT_PROCESSES:
        try:
            subprocess.run(
                ["taskkill", "/IM", proc_name],
                capture_output=True,
                text=True,
                timeout=5,
            )
        except Exception:
            pass

    # Wait up to 5 seconds for all processes to exit
    for _ in range(10):
        time.sleep(0.5)
        check = check_capcut_running()
        if not check["running"]:
            killed = [p["name"] for p in status["processes"]]
            return {"closed": True, "was_running": True, "method": "graceful", "killed": killed}

    # Force kill all remaining processes
    for proc_name in CAPCUT_PROCESSES:
        try:
            subprocess.run(
                ["taskkill", "/F", "/IM", proc_name],
                capture_output=True,
                text=True,
                timeout=5,
            )
        except Exception:
            pass

    # Final check
    time.sleep(1)
    check = check_capcut_running()
    killed = [p["name"] for p in status["processes"]]
    if not check["running"]:
        return {"closed": True, "was_running": True, "method": "force", "killed": killed}

    return {"closed": False, "was_running": True, "method": "failed", "killed": []}


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


def debug_sync_state(draft_path: str, expected_segments: list = None) -> dict:
    """Read the actual draft from disk and diagnose sync state.

    Compares the real draft_content.json on disk with the expected state
    from the app preview to identify why sync doesn't persist.

    Args:
        draft_path: Path to draft_content.json
        expected_segments: Optional list of expected audio segments from preview
            Each: { start_ms, end_ms, duration_ms }

    Returns detailed diagnostics including track state, gaps, metadata, and issues.
    """
    path = Path(draft_path)
    draft_dir = path.parent
    issues = []
    warnings = []

    # --- 1. Read draft from disk ---
    if not path.exists():
        return {"error": f"Draft not found: {draft_path}", "issues": ["DRAFT_NOT_FOUND"]}

    file_stat = path.stat()
    file_modified_ts = file_stat.st_mtime
    file_size_bytes = file_stat.st_size

    with open(path, "r", encoding="utf-8") as f:
        draft = json.load(f)

    # --- 2. Analyze audio tracks ---
    tracks = draft.get("tracks", [])
    audio_tracks = []
    all_audio_segs = []

    for idx, track in enumerate(tracks):
        if track.get("type") != "audio":
            continue

        segs = track.get("segments", [])
        if not segs:
            audio_tracks.append({
                "track_index": idx,
                "segment_count": 0,
                "first_start_us": 0,
                "last_end_us": 0,
                "has_gaps": False,
                "gap_count": 0,
                "total_gap_us": 0,
                "out_of_order": False,
            })
            continue

        # Sort segments by start time for analysis
        sorted_segs = sorted(
            segs,
            key=lambda s: s.get("target_timerange", {}).get("start", 0)
        )

        first_start = sorted_segs[0].get("target_timerange", {}).get("start", 0)
        last_seg = sorted_segs[-1].get("target_timerange", {})
        last_end = last_seg.get("start", 0) + last_seg.get("duration", 0)

        # Check for gaps and ordering
        gap_count = 0
        total_gap_us = 0
        out_of_order = False
        gaps_detail = []

        for i in range(1, len(sorted_segs)):
            prev_tr = sorted_segs[i - 1].get("target_timerange", {})
            curr_tr = sorted_segs[i].get("target_timerange", {})
            prev_end = prev_tr.get("start", 0) + prev_tr.get("duration", 0)
            curr_start = curr_tr.get("start", 0)

            gap = curr_start - prev_end
            if gap > 1000:  # > 1ms tolerance (in microseconds)
                gap_count += 1
                total_gap_us += gap
                if len(gaps_detail) < 5:  # Report first 5 gaps
                    gaps_detail.append({
                        "between_segments": [i - 1, i],
                        "gap_us": gap,
                        "gap_ms": round(gap / 1000, 1),
                        "at_position_ms": round(prev_end / 1000, 1),
                    })

            if curr_start < prev_end - 1000:  # Overlap detected
                out_of_order = True

        track_info = {
            "track_index": idx,
            "segment_count": len(segs),
            "first_start_us": first_start,
            "last_end_us": last_end,
            "has_gaps": gap_count > 0,
            "gap_count": gap_count,
            "total_gap_us": total_gap_us,
            "total_gap_ms": round(total_gap_us / 1000, 1),
            "out_of_order": out_of_order,
        }
        if gaps_detail:
            track_info["gaps_detail"] = gaps_detail
        audio_tracks.append(track_info)
        all_audio_segs.extend(segs)

    # --- 3. Analyze text tracks ---
    text_tracks = []
    for idx, track in enumerate(tracks):
        if track.get("type") != "text":
            continue
        segs = track.get("segments", [])
        text_tracks.append({
            "track_index": idx,
            "segment_count": len(segs),
        })

    # --- 4. Read metadata ---
    metadata = {}
    draft_meta_path = draft_dir / "draft_meta_info.json"
    if draft_meta_path.exists():
        with open(draft_meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        metadata["tm_draft_modified"] = meta.get("tm_draft_modified", 0)
        metadata["cloud_draft_sync"] = meta.get("cloud_draft_sync", "NOT_SET")
        metadata["materials_size"] = meta.get("draft_timeline_materials_size_", 0)
        metadata["tm_duration"] = meta.get("tm_duration", 0)

        # Check if metadata is recent (within last 5 minutes)
        now_us = int(time.time() * 1_000_000)
        meta_age_seconds = (now_us - metadata["tm_draft_modified"]) / 1_000_000
        metadata["age_seconds"] = round(meta_age_seconds, 1)
        metadata["is_recent"] = meta_age_seconds < 300  # 5 min

    # --- 5. Check issues ---
    total_audio_segs = sum(t["segment_count"] for t in audio_tracks)

    if len(audio_tracks) > 1:
        issues.append(
            f"MULTIPLE_AUDIO_TRACKS: Found {len(audio_tracks)} audio tracks "
            f"(expected 1 after flatten). Flatten may not have run or was reverted."
        )

    if len(audio_tracks) == 0:
        issues.append("NO_AUDIO_TRACKS: No audio tracks found in draft.")

    for at in audio_tracks:
        if at["has_gaps"]:
            issues.append(
                f"AUDIO_GAPS: Track {at['track_index']} has {at['gap_count']} gap(s) "
                f"totaling {at['total_gap_ms']}ms. Audio should be sequential without gaps."
            )
        if at["out_of_order"]:
            issues.append(
                f"AUDIO_OVERLAP: Track {at['track_index']} has overlapping segments."
            )

    if metadata.get("cloud_draft_sync") is not False:
        issues.append(
            f"CLOUD_SYNC_ENABLED: cloud_draft_sync={metadata.get('cloud_draft_sync')} "
            f"(should be False). CapCut may overwrite local changes with cloud version."
        )

    if metadata.get("age_seconds", 9999) > 300:
        issues.append(
            f"STALE_METADATA: tm_draft_modified is {metadata.get('age_seconds', '?')}s old. "
            f"Metadata should be updated after every draft write."
        )

    # --- 6. Compare with expected (preview) segments ---
    comparison = None
    if expected_segments and len(audio_tracks) > 0:
        actual_count = total_audio_segs
        expected_count = len(expected_segments)
        comparison = {
            "expected_count": expected_count,
            "actual_count": actual_count,
            "match": actual_count == expected_count,
            "actual_tracks": len(audio_tracks),
        }

        if actual_count != expected_count:
            issues.append(
                f"SEGMENT_COUNT_MISMATCH: Preview shows {expected_count} segments "
                f"but disk has {actual_count}."
            )

        # Compare first few segment positions
        if audio_tracks and expected_segments:
            actual_sorted = sorted(
                all_audio_segs,
                key=lambda s: s.get("target_timerange", {}).get("start", 0)
            )
            mismatches = []
            for i in range(min(5, len(expected_segments), len(actual_sorted))):
                exp = expected_segments[i]
                act_tr = actual_sorted[i].get("target_timerange", {})
                act_start_ms = act_tr.get("start", 0) / 1000
                act_end_ms = (act_tr.get("start", 0) + act_tr.get("duration", 0)) / 1000
                exp_start = exp.get("start_ms", 0)
                exp_end = exp.get("end_ms", 0)

                if abs(act_start_ms - exp_start) > 10 or abs(act_end_ms - exp_end) > 10:
                    mismatches.append({
                        "index": i,
                        "expected_start_ms": exp_start,
                        "actual_start_ms": round(act_start_ms, 1),
                        "expected_end_ms": exp_end,
                        "actual_end_ms": round(act_end_ms, 1),
                    })

            if mismatches:
                comparison["position_mismatches"] = mismatches
                issues.append(
                    f"POSITION_MISMATCH: {len(mismatches)} of first 5 segments have "
                    f"different positions on disk vs preview."
                )

    # --- 7. Check CapCut running ---
    capcut_running = False
    try:
        output = subprocess.check_output(
            ["tasklist", "/FI", "IMAGENAME eq CapCut.exe", "/FO", "CSV", "/NH"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        if "CapCut.exe" in output:
            capcut_running = True
            warnings.append(
                "CapCut Desktop is running. It may revert changes to the draft "
                "if metadata is not synced immediately after writing."
            )
    except Exception:
        pass

    return {
        "draft_path": str(path),
        "file_modified_time": file_modified_ts,
        "file_modified_ago_seconds": round(time.time() - file_modified_ts, 1),
        "file_size_bytes": file_size_bytes,
        "draft_duration_us": draft.get("duration", 0),
        "draft_duration_ms": round(draft.get("duration", 0) / 1000, 1),
        "total_tracks": len(tracks),
        "audio_tracks": audio_tracks,
        "audio_track_count": len(audio_tracks),
        "total_audio_segments": total_audio_segs,
        "text_tracks": text_tracks,
        "text_track_count": len(text_tracks),
        "total_text_segments": sum(t["segment_count"] for t in text_tracks),
        "metadata": metadata,
        "capcut_running": capcut_running,
        "comparison": comparison,
        "issues": issues,
        "warnings": warnings,
        "is_healthy": len(issues) == 0,
    }
