# CapCut JSON Format Reference

Extracted from NardotoStudio working code and real CapCut templates.

## 1. Top-Level Structure (`draft_content.json`)

```json
{
  "canvas_config": { "height": 1080, "width": 1920, "ratio": "16:9" },
  "color_space": 0,
  "config": { "subtitle_sync": true, "maintrack_adsorb": true, ... },
  "create_time": 1700000000,
  "duration": 15000000,
  "fps": 30.0,
  "id": "UUID-UPPERCASE",
  "keyframes": { "adjusts":[], "audios":[], "effects":[], "filters":[], "texts":[], "videos":[] },
  "materials": { ... },
  "name": "project_name",
  "new_version": "113.0.0",
  "platform": { "app_id": 359289, "app_source": "cc", "os": "windows" },
  "tracks": [ ... ],
  "version": 360000
}
```

## 2. Track Structure

```json
{
  "id": "UUID-UPPERCASE",
  "type": "video" | "audio" | "text",
  "segments": [ ... ],
  "flag": 0,
  "attribute": 0
}
```

- Video tracks: `type: "video"`, `flag: 0`, inserted at `tracks[0]`
- Audio tracks: `type: "audio"`, `flag: 0`, appended to tracks
- Text tracks: `type: "text"`, `flag: 1`, appended to tracks
- NEVER use `type: "subtitle"` for tracks (only for material type field)

## 3. Materials Dict Keys

```
materials.videos[]              - Video/photo materials
materials.audios[]              - Audio materials
materials.texts[]               - Text/subtitle materials
materials.speeds[]              - Speed materials (auxiliary)
materials.placeholder_infos[]   - Placeholder materials (auxiliary)
materials.canvases[]            - Canvas materials (auxiliary, video only)
materials.sound_channel_mappings[] - Channel mapping (auxiliary)
materials.material_colors[]     - Color materials (auxiliary, video only)
materials.vocal_separations[]   - Vocal separation (auxiliary)
materials.material_animations[] - Animation materials (auxiliary, text only)
materials.beats[]               - Beat materials (auxiliary, audio only)
```

## 4. Video Material (22+ fields)

```json
{
  "aigc_type": "none",
  "audio_fade": null,
  "category_name": "local",
  "check_flag": 62978047,
  "crop": {
    "lower_left_x": 0.0, "lower_left_y": 1.0,
    "lower_right_x": 1.0, "lower_right_y": 1.0,
    "upper_left_x": 0.0, "upper_left_y": 0.0,
    "upper_right_x": 1.0, "upper_right_y": 0.0
  },
  "crop_ratio": "free",
  "crop_scale": 1.0,
  "duration": 5000000,
  "has_audio": true,
  "has_sound_separated": false,
  "height": 1080,
  "id": "UUID-UPPERCASE",
  "local_material_id": "uuid-lowercase",
  "material_name": "filename.mp4",
  "path": "C:/path/to/file.mp4",
  "source": 0,
  "source_platform": 0,
  "type": "video" | "photo",
  "width": 1920,
  "matting": {
    "flag": 0, "has_use_quick_brush": false, "has_use_quick_eraser": false,
    "interactiveTime": [], "path": "", "strokes": []
  },
  "stable": {
    "matrix_path": "", "stable_level": 0,
    "time_range": { "duration": 0, "start": 0 }
  },
  "video_algorithm": { "algorithms": [], "path": "" }
}
```

**Critical**: `check_flag: 62978047` for video, `path` uses forward slashes, `material_name` = `os.path.basename()`.

## 5. Audio Material (12 fields)

```json
{
  "category_name": "local",
  "check_flag": 1,
  "duration": 5000000,
  "id": "UUID-UPPERCASE",
  "local_material_id": "uuid-lowercase",
  "music_id": "uuid-lowercase",
  "name": "audio_file.wav",
  "path": "C:/path/to/audio.wav",
  "source_platform": 0,
  "type": "extract_music",
  "wave_points": []
}
```

**Critical**: `type: "extract_music"` (not "audio"), `check_flag: 1`.

## 6. Text Material (template-based, 60+ fields)

Uses `executions/templates/text_material_template.json`. Key fields to customize:

```
id          -> UUID-UPPERCASE
group_id    -> "import_{timestamp_ms}"
content     -> JSON.dumps({ "styles": [...], "text": "..." })
text_color  -> "#FFFFFF"
text_size   -> 30
font_size   -> 5.0
type        -> "subtitle"
check_flag  -> 7
```

**CRITICAL**: `content` is a **JSON string** (serialized with `json.dumps()`), NOT a dict:
```json
{
  "styles": [{
    "font": { "id": "", "path": "" },
    "range": [0, text_length],
    "size": 5.0,
    "fill": { "content": { "solid": { "color": [1.0, 1.0, 1.0] } } },
    "useLetterColor": true,
    "bold": false,
    "italic": false
  }],
  "text": "The actual subtitle text"
}
```

## 7. Video Segment (35+ fields)

```json
{
  "caption_info": null,
  "cartoon": false,
  "clip": {
    "alpha": 1.0,
    "flip": { "horizontal": false, "vertical": false },
    "rotation": 0.0,
    "scale": { "x": 1.0, "y": 1.0 },
    "transform": { "x": 0.0, "y": 0.0 }
  },
  "common_keyframes": [],
  "enable_adjust": true,
  "enable_color_curves": true,
  "enable_color_wheels": true,
  "enable_hsl_curves": true,
  "enable_lut": true,
  "enable_video_mask": true,
  "extra_material_refs": ["speed_id", "placeholder_id", "canvas_id", "channel_id", "color_id", "vocal_id"],
  "group_id": "",
  "hdr_settings": { "intensity": 1.0, "mode": 1, "nits": 1000 },
  "id": "UUID-UPPERCASE",
  "is_placeholder": false,
  "keyframe_refs": [],
  "last_nonzero_volume": 1.0,
  "material_id": "UUID-UPPERCASE (matches video material id)",
  "render_index": 11000,
  "render_timerange": { "duration": 0, "start": 0 },
  "responsive_layout": { "enable": false, "horizontal_pos_layout": 0, "size_layout": 0, "target_follow": "", "vertical_pos_layout": 0 },
  "reverse": false,
  "source": "segmentsourcenormal",
  "source_timerange": { "start": 0, "duration": 5000000 },
  "speed": 1.0,
  "state": 0,
  "target_timerange": { "start": 0, "duration": 5000000 },
  "template_id": "",
  "template_scene": "default",
  "track_attribute": 1,
  "track_render_index": 0,
  "uniform_scale": { "on": true, "value": 1.0 },
  "visible": true,
  "volume": 0.0
}
```

## 8. Audio Segment

Same as video segment except:
- `clip`: `null` (not an object)
- `enable_adjust`: `false`
- `extra_material_refs`: `["speed_id", "placeholder_id", "beat_id", "channel_id", "vocal_id"]`
- `track_attribute`: `0`
- `uniform_scale`: `null` (not an object)
- `volume`: `1.0` (not 0.0)

## 9. Text Segment (template-based)

Uses `executions/templates/text_segment_template.json`. Key differences from video:
- `clip.transform.y`: `-0.8` (bottom of screen for subtitles)
- `extra_material_refs`: `["anim_id"]` (single animation reference)
- `render_index`: `14000+`
- `source_timerange`: `null`

## 10. Auxiliary Materials Table

| Segment Type | Aux Count | Materials (in order) |
|-------------|-----------|---------------------|
| Video/Photo | 6 | speed, placeholder_info, canvas_color, sound_channel_mapping, material_color, vocal_separation |
| Audio | 5 | speed, placeholder_info, beats, sound_channel_mapping, vocal_separation |
| Text | 1 | material_animations (type: "sticker_animation") |

**Order in `extra_material_refs` MUST match this table.**

## 11. Metadata Files

### `draft_meta_info.json`
- Field: `draft_timeline_materials_size_` (WITH trailing underscore)
- Timestamps: microseconds
- Written WITHOUT indent

### `root_meta_info.json`
- Field: `draft_timeline_materials_size` (WITHOUT trailing underscore)
- MUST have `draft_json_file` field pointing to `draft_content.json`
- Timestamps: microseconds
- Written WITHOUT indent
- New entries inserted at `all_draft_store[0]` (newest first)

### `draft_info.json`
- Timestamps: SECONDS (not microseconds)
- Written WITH indent

## 12. UUID Convention

- Material IDs / Segment IDs: `str(uuid.uuid4()).upper()` -> `"A1B2C3D4-E5F6-..."`
- `local_material_id` / `music_id`: `str(uuid.uuid4()).lower()` -> `"a1b2c3d4-e5f6-..."`
