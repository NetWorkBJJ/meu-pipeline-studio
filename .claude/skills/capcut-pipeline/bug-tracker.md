# Bug Tracker

Known bugs with root cause analysis and fix specifications.

## ~~Bug #1: updateSubtitleTimings Receives Wrong IDs~~ FIXED

Added `textMaterialId` and `textSegmentId` fields to `StoryBlock`. After `writeTextSegments` in Stage 1 and Stage 6, the returned `material_id` and `segment_id` are stored on each block. Stage 3 now has a "Re-sync timings" button that passes `textMaterialId` (not audio IDs) to `updateSubtitleTimings`.

---

## ~~Bug #2: Duplicate Insertion in Stage 6~~ FIXED

Stage6Insert now calls `analyzeProject` on mount to detect existing content. If content exists, it calls `clearTextSegments` and `clearVideoSegments` before re-inserting. The unreliable `hasInserted` local state was removed.

---

## ~~Bug #3: generate_srt Has No IPC Channel~~ FIXED

Added `capcut:generate-srt` IPC handler, `generateSrt` preload method, and type declaration.

---

## Known Limitations (not bugs)

1. **Image dimensions hardcoded**: `get_media_info()` returns 1920x1080 for all images without calling ffprobe. Photos could have different dimensions.

2. **No deduplication on batch insert**: `insert_media_batch`, `insert_audio_batch` append without checking if the same file was already inserted. This is by design (same file can appear multiple times in timeline).

3. **CapCut must be closed for project creation**: `create_project()` writes to `root_meta_info.json`, but running CapCut will overwrite it with its cached version.
