# Ported Functions Map: NardotoStudio -> MEU PIPELINE STUDIO

## Already Ported (29 bridge methods)

### capcut_reader.py
| Bridge Method | NardotoStudio Source | Status |
|--------------|---------------------|--------|
| `read_draft` | capcut_editor.CapCutProject._load | DONE |
| `read_audio_blocks` | capcut_editor.CapCutProject.get_audio_files | DONE |
| `read_subtitles` | sync_engine.read_subtitles | DONE |

### capcut_writer.py
| Bridge Method | NardotoStudio Source | Status |
|--------------|---------------------|--------|
| `write_text_segments` | sync_engine.criar_material_texto + criar_segmento_texto | DONE (template-based) |
| `update_subtitle_timings` | (no direct equivalent) | DONE |
| `update_subtitle_texts` | sync_engine.update_subtitles | DONE |
| `clear_text_segments` | (new) | DONE - removes text segments + materials + animations |
| `clear_video_segments` | (new) | DONE - removes video segments + materials + 6 aux types |
| `write_video_segments` | sync_engine.criar_material_video + criar_segmento_video | DONE (22+ fields) |
| `insert_media_batch` | sync_engine.insert_media_batch | DONE |
| `insert_audio_batch` | sync_engine.insert_audio_batch | DONE |
| `analyze_project` | sync_engine.analyze_project | DONE |
| `create_project` | project_manager.create/register | DONE |
| `list_projects` | capcut_editor.CapCutProject.list_projects | DONE |
| `create_backup` | sync_engine.create_backup | DONE (max 10) |
| `get_media_info` | sync_engine.get_media_info | DONE (ffprobe+wave) |

### metadata_sync.py
| Bridge Method | NardotoStudio Source | Status |
|--------------|---------------------|--------|
| `sync_metadata` | capcut_editor._update_meta_timestamps | DONE |

### srt_generator.py
| Bridge Method | NardotoStudio Source | Status |
|--------------|---------------------|--------|
| `generate_srt` | dialog_stem_parser.generate_srt | DONE |

### sync_engine.py
| Bridge Method | NardotoStudio Source | Status |
|--------------|---------------------|--------|
| `sync_project` | sync_engine.sync_project | DONE |
| `apply_animations` | sync_engine.apply_animations_to_images | DONE |
| `flatten_audio` | sync_engine.flatten_audio_tracks | DONE |
| `loop_video` | sync_engine.loop_video | DONE |
| `loop_audio` | sync_engine.loop_audio | DONE |
| `insert_srt` | sync_engine.insert_srt | DONE |
| `insert_srt_batch` | sync_engine.insert_srt_batch | DONE |

### debug_tools.py
| Bridge Method | NardotoStudio Source | Status |
|--------------|---------------------|--------|
| `validate_project` | (new, not in NardotoStudio) | DONE |
| `diagnose_root_meta` | (new) | DONE |
| `check_capcut_running` | (new) | DONE |
| `get_project_health` | (new) | DONE |

---

## NOT YET Ported from NardotoStudio

### MEDIUM Priority (useful features)

| NardotoStudio Function | File | What It Does |
|----------------------|------|-------------|
| `randomize_existing_media(draft_path)` | sync_engine.py | Swaps material_id between existing video segments |
| `import_media_folder(draft_path, folder_path, ...)` | sync_engine.py | Imports entire folder: auto-detects images/videos/audios/SRTs |
| `CapCutProject.add_animation(seg_id, type, ...)` | capcut_editor.py | Apply entry/exit/loop animations to a specific segment |
| `CapCutProject.set_volume(seg_id, volume)` | capcut_editor.py | Set volume per segment |
| `CapCutProject.set_transform(seg_id, x, y, ...)` | capcut_editor.py | Position/scale/rotation per segment |
| `export_project(params)` | project_manager.py | Export project as ZIP with media copies + path remapping |
| `import_project(params)` | project_manager.py | Import ZIP, extract, register in CapCut |

### LOW Priority (specialized features, not in pipeline scope)

| NardotoStudio Function | File | What It Does |
|----------------------|------|-------------|
| `insert_creator_content(...)` | sync_engine.py | Insert AI-generated content (images/ + audios/) |
| `CapCutProject.insert_srt_stems(stems_data)` | capcut_editor.py | Multi-character SRT insertion (parallel tracks) |
| `dialog_stem_parser.process_script(...)` | dialog_stem_parser.py | Parse multi-character scripts |
| `generate_content(params)` | content_creator.py | AI content generation pipeline |
| `mix_timeline(...)` | audio_mixer.py | pydub-based audio mixing |
| `TrackGenerator.run()` | track_generator.py | SFX/music track generation |

---

## IPC Coverage

All 29 bridge methods have corresponding IPC channels and preload methods. No gaps.
