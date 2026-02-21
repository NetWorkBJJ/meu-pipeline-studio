# Python Executions Engineer - Memory

## CapCut Material Structure (NardotoStudio Reference)

### Extra Materials for Video/Photo Segments (6 materials)
Order in `extra_material_refs`: speed, placeholder_info, canvas, sound_channel_mapping, color, vocal_separation

Material list keys in `draft.materials`:
- `speeds` - speed objects
- `placeholder_infos` - placeholder_info objects
- `canvases` - canvas objects (type: "canvas_color")
- `sound_channel_mappings` - channel mapping objects
- `material_colors` - color gradient objects
- `vocal_separations` - vocal separation objects
- `vocal_beautifys` - kept in `_create_empty_draft()` for backward compat

### Extra Materials for Audio Segments (5 materials)
Order in `extra_material_refs`: speed, placeholder_info, beats, sound_channel_mapping, vocal_separation

Material list keys in `draft.materials`:
- `speeds` - speed objects (shared with video)
- `placeholder_infos` - placeholder_info objects (shared with video)
- `beats` - beat/rhythm detection objects (audio-specific, has ai_beats sub-object)
- `sound_channel_mappings` - channel mapping objects (shared with video)
- `vocal_separations` - vocal separation objects (shared with video)

### Audio Material Fields
Key fields: `category_name` ("local"), `check_flag` (1), `duration`, `id`, `local_material_id` (lowercase uuid), `music_id` (lowercase uuid), `name` (basename), `path` (forward slashes), `source_platform` (0), `type` ("extract_music"), `wave_points` ([])

### Audio Segment Fields
Key differences from video: `clip: None`, `track_attribute: 0`, `track_render_index: 1`, `volume: 1.0`, `enable_adjust: False`

### Video Material Complete Fields
Key fields: `aigc_type`, `audio_fade`, `category_name`, `check_flag` (62978047), `crop`, `crop_ratio` ("free"), `crop_scale`, `duration`, `has_audio`, `has_sound_separated`, `height`, `id`, `local_material_id` (lowercase uuid), `material_name` (basename), `path` (forward slashes), `source`, `source_platform`, `type`, `width`, `matting`, `stable`, `video_algorithm`

### Video Segment Complete Fields
Key fields: `caption_info`, `cartoon`, `clip`, `common_keyframes`, `enable_adjust/color_curves/color_wheels/hsl_curves/lut/video_mask` (all True), `extra_material_refs`, `group_id`, `hdr_settings`, `id`, `is_placeholder`, `keyframe_refs`, `last_nonzero_volume`, `material_id`, `render_index`, `render_timerange`, `responsive_layout`, `reverse`, `source`, `source_timerange`, `speed`, `state`, `target_timerange`, `template_id`, `template_scene` ("default"), `track_attribute` (1), `track_render_index`, `uniform_scale`, `visible`, `volume` (0.0 for video)

## ffprobe Enhancement
`_get_video_duration_us()` returns a dict with `duration_us`, `width`, `height`, `has_audio` using `-show_streams` flag alongside `-show_format`. Falls back to defaults on any error.

## Audio Duration Detection
`_get_audio_duration_us()` returns int (microseconds). Uses `wave` module natively for WAV files, `ffprobe` for other formats (mp3, aac, m4a, ogg, flac, wma). Falls back to 5,000,000us (5s).

## Key Patterns
- `os.path.basename()` for `material_name` / `name` field
- `str(uuid.uuid4()).lower()` for `local_material_id` and `music_id`
- `_generate_id()` returns UPPERCASE UUID for main material/segment IDs
- `media_path.replace("\\", "/")` for CapCut path format
- Constants: `IMAGE_EXTENSIONS`, `VIDEO_EXTENSIONS`, `AUDIO_EXTENSIONS` (line 28-30)
- `_create_empty_draft()` keeps both `vocal_beautifys` AND `vocal_separations` for compatibility

## sync_engine.py Structure
- Lines 1-202: Imports, helpers, 6 animation generators, ANIMATION_PATTERNS
- Lines 205-342: sync_project() - multi-track audio collection, gap removal, track merging, video/text sync
- Lines 345-408: _apply_animations(), apply_animations_to_images()
- Lines 412-655: flatten_audio_tracks(), loop_video(), loop_audio()
- sync_project() audio_track_index param is DEPRECATED (collects from ALL tracks now)
- Track deletion: iterate in reverse to preserve indices
- Deep-clone segments: json.loads(json.dumps(seg))

## External Modification Warning
- capcut_writer.py is actively modified by another agent (Orchestrator)
- Read-then-edit can fail if another agent modifies between operations
- Use specific, unique search strings in Edit to avoid ambiguity
- May need multiple read attempts before successful edit

## capcut_tts.py Voice System
- `VOICE_NAMES` dict: 254 voices (251 SAMI + 3 ElevenLabs), 33 languages, 37 tags
- Voice ID patterns: `BV{NNN}_streaming`, `BV{NNN}_V2_streaming`, `jp_{NNN}_streaming`, `ICL_en_{gender}_{name}`, `VOV{NNN}_bytesing3_{suffix}`
- ElevenLabs IDs are raw strings (not BV-prefixed)
- Discovery generates ~1447 candidate IDs, tests with ThreadPoolExecutor(max_workers=10)
- Cache: JSON file with version + discovered_at + voices[], 7-day TTL
- `_try_catalog_endpoints` tries 5 CapCut API endpoints before falling back to BV scan
- `_test_voice_id` uses WebSocket with 5s timeout, sends text "a" to validate
- main_bridge.py has 31+ methods in METHODS dict, CapCut TTS uses `capcut_tts_` prefix
