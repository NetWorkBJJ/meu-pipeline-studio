# CapCut Pipeline - Domain Knowledge Skill

Use this skill whenever working on Python scripts in `executions/`, IPC handlers in `src/main/ipc/`, preload API, or stage components that interact with CapCut. This provides the persistent domain knowledge needed to correctly manipulate CapCut's JSON format.

## 3 Invariants (NEVER violate)

1. **Read-Modify-Save**: Never rewrite `draft_content.json` from scratch. Read the full JSON, modify specific fields, write back. Preserve all unknown fields.
2. **Backup Before Write**: Call `create_backup()` before any write operation.
3. **Sync Metadata After Write**: Call `sync_metadata()` after any write to update `draft_meta_info.json` and `root_meta_info.json`.

## Unit Convention

| Context | Unit | Example |
|---------|------|---------|
| CapCut JSON internally | microseconds (us) | `3000000` = 3 seconds |
| App API / UI | milliseconds (ms) | `3000` = 3 seconds |
| Conversion | `us = ms * 1000` | Always convert at boundary |

## Bridge Methods (29 total)

| Method | Python File | Key Params |
|--------|------------|------------|
| `read_draft` | capcut_reader | draft_path |
| `read_audio_blocks` | capcut_reader | draft_path |
| `read_subtitles` | capcut_reader | draft_path |
| `write_text_segments` | capcut_writer | draft_path, blocks[{text, start_ms, end_ms}] |
| `update_subtitle_timings` | capcut_writer | draft_path, blocks[{material_id, start_ms, end_ms}] |
| `update_subtitle_texts` | capcut_writer | draft_path, updates[{material_id, new_text}] |
| `clear_text_segments` | capcut_writer | draft_path |
| `clear_video_segments` | capcut_writer | draft_path |
| `write_video_segments` | capcut_writer | draft_path, scenes[{media_path, start_ms, end_ms, media_type}] |
| `insert_media_batch` | capcut_writer | draft_path, media_files[], image_duration_ms |
| `insert_audio_batch` | capcut_writer | draft_path, audio_files[], use_existing_track |
| `analyze_project` | capcut_writer | draft_path |
| `create_project` | capcut_writer | name |
| `list_projects` | capcut_writer | (none) |
| `create_backup` | capcut_writer | draft_path |
| `get_media_info` | capcut_writer | file_path |
| `sync_metadata` | metadata_sync | draft_dir |
| `generate_srt` | srt_generator | blocks[], output_path |
| `sync_project` | sync_engine | draft_path, audio_track_index, mode, sync_subtitles, apply_animations |
| `apply_animations` | sync_engine | draft_path |
| `flatten_audio` | sync_engine | draft_path |
| `loop_video` | sync_engine | draft_path, audio_track_index, order |
| `loop_audio` | sync_engine | draft_path, track_index, target_duration_us |
| `insert_srt` | sync_engine | draft_path, srt_file_paths[], create_title, separate_tracks |
| `insert_srt_batch` | sync_engine | draft_path, srt_files[], create_title, gap_us |
| `validate_project` | debug_tools | project_path |
| `diagnose_root_meta` | debug_tools | project_name |
| `check_capcut_running` | debug_tools | (none) |
| `get_project_health` | debug_tools | project_path |

## File Watcher (Bidirectional Sync)

- `src/main/ipc/draft-watcher.ts` watches `draft_content.json` via `fs.watch`
- Debounce 800ms, grace period 2s after our own writes (suppressNextChange)
- On external change: calls `analyze_project` + `read_subtitles`, sends `capcut:project-changed` to renderer
- All write IPC handlers call `suppressNextChange()` before Python write operations
- Renderer listens via `onProjectChanged` callback, shows banner with "Recarregar" button

## Before Implementing

- **Porting NardotoStudio functions?** Read `ported-functions.md` first
- **Writing Python that touches draft JSON?** Read `capcut-json-format.md` first
- **Fixing bugs?** Read `bug-tracker.md` first
- **Any write operation?** Follow rules in `implementation-rules.md`

## Reference Codebase

NardotoStudio source: `c:\Users\ander\Desktop\NardotoStudio-master\python_src\`
Key files: `sync_engine.py` (2263 lines), `capcut_editor.py` (1299 lines), `project_manager.py` (680 lines)
