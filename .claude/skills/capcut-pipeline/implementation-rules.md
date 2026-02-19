# Implementation Rules

Hard constraints to follow when writing Python code that touches CapCut JSON.

## R1: Never Simplify Material Structures

If NardotoStudio has 22 fields in a video material, the ported code MUST also have all 22 fields. Do not omit fields you don't understand. They are forward-compatibility fields that CapCut reads and may break if missing.

## R2: Text Content is a JSON String

The `content` field of a text material is a JSON **string** (not a dict). Serialize with `json.dumps()`:

```python
content = json.dumps({
    "styles": [{
        "font": {"id": "", "path": ""},
        "range": [0, len(text)],
        "size": font_size,
        "fill": {"content": {"solid": {"color": [r, g, b]}}},
        "useLetterColor": True,
        "bold": False,
        "italic": False,
    }],
    "text": text,
}, ensure_ascii=False)
```

## R3: UUID Case Convention

- Material IDs and Segment IDs: `str(uuid.uuid4()).upper()` -> `"A1B2C3D4-E5F6-..."`
- `local_material_id` and `music_id`: `str(uuid.uuid4()).lower()` -> `"a1b2c3d4-e5f6-..."`

## R4: Extra Material Refs Order

Order in `extra_material_refs` list MUST match exactly:

- **Video**: `[speed_id, placeholder_id, canvas_id, channel_id, color_id, vocal_id]` (6 refs)
- **Audio**: `[speed_id, placeholder_id, beat_id, channel_id, vocal_id]` (5 refs)
- **Text**: `[anim_id]` (1 ref)

## R5: Recalculate Duration Before Save

Always call `_recalculate_duration(draft)` before writing JSON to disk:

```python
def _recalculate_duration(draft):
    max_end = 0
    for track in draft.get("tracks", []):
        for seg in track.get("segments", []):
            tr = seg.get("target_timerange", {})
            seg_end = tr.get("start", 0) + tr.get("duration", 0)
            if seg_end > max_end:
                max_end = seg_end
    draft["duration"] = max_end
```

## R6: Track Ordering

- Video track MUST be at `tracks[0]` (use `tracks.insert(0, track)`)
- Audio tracks appended after video
- Text tracks appended last
- Never reorder existing tracks

## R7: Verify After Write

After any write operation, run `validate_project` and `get_project_health` to confirm the project is valid. These are already wired in the bridge and IPC.

## R8: Path Convention

- `path` field: always use forward slashes (`file_path.replace("\\", "/")`)
- `material_name` field: always use `os.path.basename(file_path)`

## R9: Backup and Metadata

Every write function MUST:
1. Call `create_backup(draft_path)` at the start
2. Call `sync_metadata(draft_dir)` after saving (or ensure caller does via IPC)

## R10: Never Rewrite Unknown Fields

When loading a `draft_content.json`:
- Use `json.load()` to get the full dict
- Modify ONLY the specific fields you need
- Use `json.dump()` to write back the complete dict
- This preserves fields added by newer CapCut versions

## R11: Porting Process

When porting a function from NardotoStudio:
1. Read the ENTIRE source function in NardotoStudio first
2. Read `capcut-json-format.md` for field reference
3. Check `ported-functions.md` to see if a similar function already exists
4. Copy field structures EXACTLY (do not rename fields, do not simplify)
5. Adapt only the function signature and bridge protocol
6. Test with a real CapCut project

## R12: check_flag Values

These are magic numbers that CapCut uses internally. NEVER change them:
- Video material: `62978047`
- Text material: `7`
- Audio material: `1`

## R13: Timestamp Handling

- All values inside `draft_content.json` are in **microseconds** (us)
- The bridge API accepts **milliseconds** (ms) from the renderer
- Conversion: `us = int(ms * 1000)` at the Python boundary
- NEVER store ms values in the draft JSON

## R14: JSON Write Format

- `draft_content.json`: write WITH `indent=2`
- `draft_meta_info.json`: write WITHOUT indent (single line)
- `root_meta_info.json`: write WITHOUT indent (single line)
- All files: `ensure_ascii=False` for Unicode support
