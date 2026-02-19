# Referencia Tecnica: NardotoStudio -> MEU PIPELINE STUDIO

Documento de referencia permanente com padroes, estruturas e convencoes do CapCut
extraidos do NardotoStudio (projeto de referencia em C:\Users\ander\Desktop\NardotoStudio-master).

---

## 1. Mapa de Funcionalidades

### Python Bridge (executions/main_bridge.py) - 20 metodos

| Metodo | Origem | Descricao |
|--------|--------|-----------|
| read_draft | capcut_reader | Le draft_content.json e retorna resumo |
| read_audio_blocks | capcut_reader | Extrai blocos de audio com timing |
| write_text_segments | capcut_writer | Insere legendas via template |
| update_subtitle_timings | capcut_writer | Atualiza timing sem alterar texto |
| sync_metadata | metadata_sync | Sincroniza draft_meta + root_meta |
| generate_srt | srt_generator | Gera arquivo SRT a partir de blocos |
| write_video_segments | capcut_writer | Insere segmentos de video/foto |
| sync_project | sync_engine | Sync audio-video-texto + gap removal |
| apply_animations | sync_engine | Ken Burns em fotos |
| analyze_project | capcut_writer | Resumo de tracks/segmentos |
| create_project | capcut_writer | Cria projeto CapCut do zero |
| list_projects | capcut_writer | Lista projetos do root_meta_info |
| insert_media_batch | capcut_writer | Insere midias em lote |
| create_backup | capcut_writer | Backup timestamped (.backups/) |
| insert_audio_batch | capcut_writer | Insere audios em lote |
| insert_srt | sync_engine | Insere SRT matched por basename |
| insert_srt_batch | sync_engine | Insere SRTs sequencialmente |
| flatten_audio | sync_engine | Consolida audio tracks em uma |
| loop_video | sync_engine | Repete video para preencher duracao |
| loop_audio | sync_engine | Repete audio para preencher duracao |

### IPC Channels (capcut.handlers.ts)

| Canal IPC | Metodo Python |
|-----------|---------------|
| capcut:read-draft | read_draft |
| capcut:read-audio-blocks | read_audio_blocks |
| capcut:write-text-segments | write_text_segments |
| capcut:update-subtitle-timings | update_subtitle_timings |
| capcut:sync-metadata | sync_metadata |
| capcut:write-video-segments | write_video_segments |
| capcut:sync-project | sync_project |
| capcut:apply-animations | apply_animations |
| capcut:analyze-project | analyze_project |
| capcut:insert-media-batch | insert_media_batch |
| capcut:create-backup | create_backup |
| capcut:insert-audio-batch | insert_audio_batch |
| capcut:insert-srt | insert_srt |
| capcut:insert-srt-batch | insert_srt_batch |
| capcut:flatten-audio | flatten_audio |
| capcut:loop-video | loop_video |
| capcut:loop-audio | loop_audio |

---

## 2. Estruturas JSON do CapCut

### Unidades de Tempo
- CapCut interno: **microsegundos** (us) - 1 segundo = 1.000.000 us
- Nossa API/UI: **milissegundos** (ms) - conversao: us = ms * 1000
- SRT: HH:MM:SS,mmm (milissegundos)

### Video Material (completo)
```json
{
  "aigc_type": "none",
  "audio_fade": null,
  "category_name": "local",
  "check_flag": 62978047,
  "crop": {"lower_left_x": 0.0, "lower_left_y": 1.0, "lower_right_x": 1.0, "lower_right_y": 1.0, "upper_left_x": 0.0, "upper_left_y": 0.0, "upper_right_x": 1.0, "upper_right_y": 0.0},
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
  "type": "video | photo",
  "width": 1920,
  "matting": {"flag": 0, "has_use_quick_brush": false, "has_use_quick_eraser": false, "interactiveTime": [], "path": "", "strokes": []},
  "stable": {"matrix_path": "", "stable_level": 0, "time_range": {"duration": 0, "start": 0}},
  "video_algorithm": {"algorithms": [], "path": ""}
}
```

### Audio Material (completo)
```json
{
  "category_name": "local",
  "check_flag": 1,
  "duration": 5000000,
  "id": "UUID-UPPERCASE",
  "local_material_id": "uuid-lowercase",
  "music_id": "uuid-lowercase",
  "name": "filename.mp3",
  "path": "C:/path/to/file.mp3",
  "source_platform": 0,
  "type": "extract_music",
  "wave_points": []
}
```

### Video Segment (completo)
```json
{
  "caption_info": null,
  "cartoon": false,
  "clip": {"alpha": 1.0, "flip": {"horizontal": false, "vertical": false}, "rotation": 0.0, "scale": {"x": 1.0, "y": 1.0}, "transform": {"x": 0.0, "y": 0.0}},
  "common_keyframes": [],
  "enable_adjust": true,
  "enable_color_curves": true,
  "enable_color_wheels": true,
  "enable_hsl_curves": true,
  "enable_lut": true,
  "enable_video_mask": true,
  "extra_material_refs": ["speed_id", "placeholder_id", "canvas_id", "channel_id", "color_id", "vocal_id"],
  "group_id": "",
  "hdr_settings": {"intensity": 1.0, "mode": 1, "nits": 1000},
  "id": "UUID-UPPERCASE",
  "is_placeholder": false,
  "keyframe_refs": [],
  "last_nonzero_volume": 1.0,
  "material_id": "UUID-UPPERCASE",
  "render_index": 11000,
  "render_timerange": {"duration": 0, "start": 0},
  "responsive_layout": {"enable": false, "horizontal_pos_layout": 0, "size_layout": 0, "target_follow": "", "vertical_pos_layout": 0},
  "reverse": false,
  "source": "segmentsourcenormal",
  "source_timerange": {"duration": 5000000, "start": 0},
  "speed": 1.0,
  "state": 0,
  "target_timerange": {"duration": 5000000, "start": 0},
  "template_id": "",
  "template_scene": "default",
  "track_attribute": 1,
  "track_render_index": 0,
  "uniform_scale": {"on": true, "value": 1.0},
  "visible": true,
  "volume": 0.0
}
```

### Audio Segment (completo)
```json
{
  "caption_info": null,
  "cartoon": false,
  "clip": null,
  "common_keyframes": [],
  "enable_adjust": false,
  "extra_material_refs": ["speed_id", "placeholder_id", "beat_id", "channel_id", "vocal_id"],
  "id": "UUID-UPPERCASE",
  "material_id": "UUID-UPPERCASE",
  "render_index": 0,
  "source_timerange": {"duration": 5000000, "start": 0},
  "target_timerange": {"duration": 5000000, "start": 0},
  "volume": 1.0,
  "speed": 1.0,
  "reverse": false,
  "track_attribute": 0,
  "track_render_index": 1
}
```

### 6 Materiais Auxiliares de Video
```
speed:          { id, mode: 0, speed: 1.0, type: "speed", curve_speed: null }
placeholder:    { id, meta_type: "none", type: "placeholder_info", error_path: "", error_text: "" }
canvas:         { id, type: "canvas_color", blur: 0.0, color: "", album_image: "" }
channel:        { id, type: "none", audio_channel_mapping: 0, is_config_open: false }
color:          { id, is_gradient: false, solid_color: "", gradient_angle: 90.0 }
vocal:          { id, type: "vocal_separation", choice: 0, final_algorithm: "" }
```

### 5 Materiais Auxiliares de Audio
```
speed:          { id, mode: 0, speed: 1.0, type: "speed" }
placeholder:    { id, meta_type: "none", type: "placeholder_info" }
beat:           { id, type: "beats", gear: 404, mode: 404, ai_beats: {...} }
channel:        { id, type: "none", audio_channel_mapping: 0 }
vocal:          { id, type: "vocal_separation", choice: 0 }
```

---

## 3. Padroes Criticos

### Metadata
- `draft_meta_info.json`: campo `"draft_timeline_materials_size_"` (COM underscore no final)
- `root_meta_info.json`: campo `"draft_timeline_materials_size"` (SEM underscore)
- `root_meta_info.json`: campo `"draft_json_file"` e CRITICO para CapCut localizar o projeto
- Timestamp: microsegundos (int64) via `int(datetime.now().timestamp() * 1_000_000)`

### Track Types
- CapCut reconhece APENAS: `"video"`, `"audio"`, `"text"`
- NAO usar `"subtitle"` como tipo de track (nao reconhecido)
- Track de video e OBRIGATORIA para CapCut renderizar legendas

### UUID Format
- Material IDs: `str(uuid.uuid4()).upper()` (maiusculo com hifens)
- local_material_id: `str(uuid.uuid4()).lower()` (minusculo)
- music_id: `str(uuid.uuid4()).lower()` (minusculo)

### Paths
- CapCut espera forward slashes: `C:/Users/...` (NAO backslash)
- Normalizar com `.replace("\\", "/")`

### Templates
- 3 templates em `executions/templates/`: text_material, text_segment, text_animation
- SEMPRE fazer deep copy (cache em memoria, `copy.deepcopy()`)
- Extraidos de projetos CapCut reais para garantir compatibilidade

### Backup
- Criar ANTES de qualquer escrita no draft_content.json
- Pasta `.backups/` dentro do projeto, max 10 backups
- Formato: `draft_content_YYYYMMDD_HHMMSS.json`

### Ken Burns (6 animacoes)
1. zoom_in_suave: scale 1.02 -> 1.15
2. zoom_in_forte: scale 1.0 -> 1.2
3. zoom_out: scale 1.18 -> 1.05
4. pan_down: Y -0.12 -> 0.12, scale 1.15
5. pan_down_forte: Y -0.15 -> 0.15, scale 1.2
6. pan_horizontal: X -0.1 -> 0.1, scale 1.15
- Aplicar via `seg['common_keyframes']` + `seg['enable_adjust'] = True`
- Pre-scale: `seg['clip']['scale'] = {'x': 1.15, 'y': 1.15}`

---

## 4. Mapeamento Pipeline -> Funcoes

| Stage | Funcao Principal | Funcoes de Suporte |
|-------|-----------------|-------------------|
| 1. Script | scriptSplitter.ts (TS) | generate_srt (Python) |
| 2. Audio | read_audio_blocks | flatten_audio, insert_audio_batch |
| 3. Sync | sync_project | apply_animations, loop_video, loop_audio |
| 4. Director | sceneGrouper.ts (TS) | - |
| 5. Media | insert_media_batch | get_media_info (ffprobe) |
| 6. Insert | write_text_segments, write_video_segments | insert_srt, insert_srt_batch, sync_metadata, create_backup |

---

## 5. Diferencas Arquiteturais

| Aspecto | NardotoStudio | MEU PIPELINE STUDIO |
|---------|--------------|---------------------|
| Bridge | argv JSON (processo por comando) | stdin/stdout JSON-line (processo persistente) |
| Organizacao | Monolitico (sync_engine.py 2300 linhas) | Modular (5 arquivos especializados) |
| Backup | Inline, sem pasta dedicada | .backups/ com rotacao max 10 |
| Templates | Mesmos 3 templates | Mesmos 3 templates |
| Metadata | Inline no capcut_editor.py | Arquivo dedicado metadata_sync.py |
| Criacao projeto | Classe OOP CapCutProject | Funcoes standalone |
| UI | Actions/Wizard multi-step | Pipeline 6 stages linear |
