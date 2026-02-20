# Referencia Completa: NardotoStudio

Documento de referencia COMPLETO e DETALHADO do projeto NardotoStudio
(C:\Users\ander\Desktop\NardotoStudio-master). Cobertura: ~97 arquivos, ~63.500 linhas.
Nenhuma informacao foi omitida ou resumida.

---

## 1. VISAO GERAL DO PROJETO

### Stack
- **Electron Forge** + Webpack (nao electron-vite)
- **React 18** + TypeScript
- **Tailwind CSS** (com tailwind.config.js, nao CSS-first)
- **Zustand** para stores especializados
- **React Context** para estado de projeto/UI/log
- **Python 3.10+** via spawnSync (sync_engine.py compilado com Nuitka para producao)
- **wavesurfer.js** para waveforms de audio
- **Framer Motion** para animacoes

### Totais
- **~286 arquivos fonte**
- **~121.000 linhas** de codigo
- **main.js**: 18.627 linhas (monolitico, todo o backend Electron)
- **python_src/**: 19 arquivos, ~13.425 linhas
- **components/**: ~162 arquivos, ~56.800 linhas
- **services/**: ~51 arquivos, ~22.800 linhas

### Navegacao (State Machine em App.tsx)
```
selectedWorkspace === null  -->  WorkspaceSelectorScreen
selectedWorkspace !== null  -->  MainLayout(activeWorkspace)
```
- App.tsx mantem: selectedWorkspace, pendingProjectRef
- WorkspaceSelectorScreen: lista workspaces, card default separado, grid custom
- MainLayout: toda a aplicacao com tabs, timeline, sidebars, panels

---

## 2. MAIN PROCESS (main.js - 18.627 linhas)

### 2.1 Variaveis Globais

```javascript
let mainWindow = null          // BrowserWindow principal
let projectWatcher = null      // FSWatcher para draft_content.json
let watchDebounceTimer = null  // Timer de debounce do watcher
global.currentProjectPath = '' // Path do projeto atual (para extension bridge)
```

### 2.2 Funcoes Utilitarias

#### validatePath(inputPath)
```javascript
function validatePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') return null
  const resolved = path.resolve(inputPath)
  // Prevencao de path traversal
  if (resolved.includes('..')) return null
  return resolved
}
```

#### isCapCutRunning()
Verifica se CapCut esta rodando usando 3 metodos em sequencia:
1. PowerShell: `Get-Process -Name "CapCut" -ErrorAction SilentlyContinue`
2. WMIC: `wmic process where "name='CapCut.exe'" get ProcessId`
3. tasklist: `tasklist /FI "IMAGENAME eq CapCut.exe"`

#### getPythonCmd()
Tenta `python` primeiro, fallback para `python3`.

#### ensureDraftContentPath(inputPath)
Se o path aponta para um diretorio, anexa `/draft_content.json`.

#### extractTextFromContent(content)
```javascript
function extractTextFromContent(content) {
  if (!content) return ''
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content)
      // Pattern 1: objeto com campo text
      if (parsed.text) return parsed.text
      // Pattern 2: array styles com campo text
      if (parsed.styles && Array.isArray(parsed.styles)) {
        for (const style of parsed.styles) {
          if (style.text) return style.text
        }
      }
      return ''
    } catch {
      // Pattern 3: texto puro (nao e JSON)
      return content.substring(0, 50)
    }
  }
  return ''
}
```

#### syncCapCutMetadata(draftPath)
```javascript
function syncCapCutMetadata(draftPath) {
  draftPath = ensureDraftContentPath(draftPath)
  const projectFolder = path.dirname(draftPath)
  const projectFolderForward = projectFolder.replace(/\\/g, '/')
  const timestamp = Date.now() * 1000  // microsegundos (padrao CapCut)

  // Ler draft para obter duracao e tamanho
  let duration = 0
  let draftSize = fs.statSync(draftPath).size
  const draft = JSON.parse(fs.readFileSync(draftPath, 'utf-8'))
  duration = draft.duration || 0
  // Fallback: calcular dos tracks
  if (!duration) {
    for (const track of (draft.tracks || [])) {
      for (const seg of (track.segments || [])) {
        const tr = seg.target_timerange || {}
        const end = (tr.start || 0) + (tr.duration || 0)
        if (end > duration) duration = end
      }
    }
  }

  // 1. draft_meta_info.json (per-project)
  const meta = JSON.parse(fs.readFileSync(metaInfoPath, 'utf-8'))
  meta.tm_draft_modified = timestamp
  meta.tm_duration = duration
  meta.draft_timeline_materials_size_ = draftSize  // COM underscore final
  meta.cloud_draft_sync = false
  fs.writeFileSync(metaInfoPath, JSON.stringify(meta), 'utf-8')

  // 2. root_meta_info.json (indice global)
  // Procura primeiro no diretorio pai, depois no path padrao do CapCut
  const rootMeta = JSON.parse(fs.readFileSync(rootMetaPath, 'utf-8'))
  for (const draft of (rootMeta.all_draft_store || [])) {
    if (draft.draft_fold_path === projectFolderForward) {
      draft.tm_draft_modified = timestamp
      draft.tm_duration = duration
      draft.draft_timeline_materials_size = draftSize  // SEM underscore final
      draft.cloud_draft_sync = false
      break
    }
  }
  fs.writeFileSync(rootMetaPath, JSON.stringify(rootMeta), 'utf-8')

  return { timestamp, duration, draftSize }
}
```

**IMPORTANTE**: Esta funcao e chamada apos TODA operacao de escrita no draft_content.json.

#### runPython(command)
```javascript
function runPython(command) {
  const syncEnginePath = isDev
    ? path.join(__dirname, '..', 'python_src', 'sync_engine.py')
    : path.join(process.resourcesPath, 'sync_engine.exe')

  const jsonStr = JSON.stringify(command)
  let args

  // Se JSON > 7000 chars, usar arquivo temporario
  if (jsonStr.length > 7000) {
    const tempFile = path.join(os.tmpdir(), `nardoto_cmd_${Date.now()}.json`)
    fs.writeFileSync(tempFile, jsonStr, 'utf-8')
    args = isDev
      ? [syncEnginePath, '--file', tempFile]
      : ['--file', tempFile]
  } else {
    args = isDev ? [syncEnginePath, jsonStr] : [jsonStr]
  }

  const result = spawnSync(executable, args, {
    timeout: 60000,      // 60 segundos
    maxBuffer: 50 * 1024 * 1024,  // 50MB
    encoding: 'utf-8'
  })

  return JSON.parse(result.stdout)
}
```

### 2.3 Handlers IPC - Projeto

#### analyze-project
```javascript
ipcMain.handle('analyze-project', async (_, draftPath) => {
  global.currentProjectPath = path.dirname(draftPath)

  const content = fs.readFileSync(draftPath, 'utf-8')
  const project = JSON.parse(content)
  const tracks = project.tracks || []
  const materials = project.materials || {}

  // Build materialMap: material_id -> {name, text}
  const materialMap = {}
  for (const [, matList] of Object.entries(materials)) {
    if (Array.isArray(matList)) {
      matList.forEach(mat => {
        if (mat.id) {
          materialMap[mat.id] = {
            name: mat.name || mat.path || '',
            text: extractTextFromContent(mat.content)
          }
        }
      })
    }
  }

  // Map tracks com segments enriquecidos
  const trackInfos = tracks.map((track, index) => {
    const segments = track.segments || []
    const duration = segments.reduce((sum, seg) =>
      sum + (seg.target_timerange?.duration || 0), 0)

    const enrichedSegments = segments.map(seg => {
      const mat = materialMap[seg.material_id] || {}
      return {
        ...seg,
        text: mat.text || '',
        materialName: mat.name ? path.basename(mat.name) : ''
      }
    })

    // Nome do track: texto para text/subtitle, filename para outros
    let name = ''
    if (enrichedSegments.length > 0) {
      const first = enrichedSegments[0]
      if (['text', 'subtitle'].includes(track.type)) {
        name = first.text || first.materialName || 'Texto'
      } else {
        name = first.materialName || first.text || ''
      }
    }

    return {
      index,
      type: track.type,
      segments: segments.length,
      duration,
      durationSec: duration / 1000000,
      name,
      segmentsData: enrichedSegments
    }
  })

  return { tracks: trackInfos }
})
```

**NOTA**: Este handler e em Node.js PURO (nao Python). Le o draft_content.json direto com readFileSync.

#### detect-capcut-folder
Escaneia DUAS pastas do CapCut:
1. `%LOCALAPPDATA%/CapCut Drafts` (projetos importados da nuvem)
2. `%LOCALAPPDATA%/CapCut/User Data/Projects/com.lveditor.draft` (projetos locais)

Para cada subpasta, verifica existencia de `draft_content.json`. Retorna array de projetos com `{name, path, draftPath, modifiedAt, duration}`.

#### check-fix-project-version
Verifica campo `version` no draft_content.json. Se versao > 100.x.x (bugada pelo CapCut), corrige para `"8.0.1"`.

### 2.4 Handlers IPC - File Watching

#### watch-project
```javascript
ipcMain.handle('watch-project', async (event, draftPath) => {
  // Fecha watcher anterior
  if (projectWatcher) {
    projectWatcher.close()
    projectWatcher = null
  }

  if (!draftPath || !fs.existsSync(draftPath)) {
    return { success: false, error: 'Caminho invalido' }
  }

  projectWatcher = fs.watch(draftPath, { persistent: false }, (eventType) => {
    // Debounce 500ms
    if (watchDebounceTimer) clearTimeout(watchDebounceTimer)
    watchDebounceTimer = setTimeout(() => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('project-file-changed', { draftPath, eventType })
      }
    }, 500)
  })

  projectWatcher.on('error', (err) => {
    console.error('[Main] Erro no watcher:', err)
  })

  return { success: true }
})
```

#### unwatch-project
```javascript
ipcMain.handle('unwatch-project', async () => {
  if (projectWatcher) {
    projectWatcher.close()
    projectWatcher = null
  }
  if (watchDebounceTimer) {
    clearTimeout(watchDebounceTimer)
    watchDebounceTimer = null
  }
  return { success: true }
})
```

### 2.5 Handlers IPC - Media Insertion

#### insert-media-batch
Handler MASSIVO para insercao de midias em lote. Parametros:
- `draftPath`: caminho do draft_content.json
- `mediaFiles`: array de paths de midia
- `insertMode`: 'end' | 'replace' | 'start'
- `audioTrackMode`: 'same' | 'separate'
- `imageDuration`: duracao padrao para imagens (ms)
- `addAnimations`: boolean (Ken Burns)

Fluxo:
1. Le draft_content.json
2. Para cada arquivo de midia:
   - Detecta tipo (video/image/audio) via extensao
   - Obtem metadata (duracao, dimensoes) via Python ffprobe
   - Cria material entry (video material com has_audio, type, width, height, path)
   - Cria 6 materiais auxiliares (speed, placeholder, canvas, channel, color, vocal)
   - Cria segment entry (target_timerange, source_timerange, clip, extra_material_refs)
3. Envia progress events via `media-import-progress`
4. Processa metadata em paralelo (batches de 20)
5. Chama syncCapCutMetadata

#### insert-director-scenes
Insere cenas do diretor em track separada. Cada cena tem posicao, duracao e media associada.

#### link-director-media
Sincroniza video segments com timings do diretor (ajusta posicoes e duracoes para match).

### 2.6 Handlers IPC - SRT

#### insert-srt (via Python)
```javascript
ipcMain.handle('insert-srt', async (_, { draftPath, srtFolders, createTitle, selectedFiles, separateTracks }) => {
  const result = runPython({
    action: 'insert_srt',
    draft_path: ensureDraftContentPath(draftPath),
    create_title: createTitle,
    selected_file_paths: selectedFiles,
    srt_folder: srtFolders?.[0] || '',
    selected_files: [],
    separate_tracks: separateTracks || false
  })
  syncCapCutMetadata(draftPath)
  return result
})
```

#### insert-srt-batch (via Python)
Insere multiplos SRTs sequencialmente na timeline com gap configuravel entre eles.

#### create-srt-from-script
Converte texto bruto em arquivo SRT usando reading rate para calcular duracoes.

#### insert-srt-sequential
Insere arquivos SRT em sequencia, um apos o outro.

#### load-project-subtitles
Le legendas diretamente do draft_content.json (Node.js, nao Python):
- Itera materials.texts
- Extrai texto via extractTextFromContent
- Retorna [{text, materialId, start_ms, duration_ms, end_ms, trackIndex}]

#### create-and-insert-srt
Cria arquivo SRT a partir de texto + insere via Python em um unico handler.

### 2.7 Handlers IPC - Sync

#### sync-project (via Python)
```javascript
ipcMain.handle('sync-project', async (_, { draftPath, audioTrackIndex, mode, syncSubtitles, applyAnimations }) => {
  const result = runPython({
    action: 'sync',
    draft_path: ensureDraftContentPath(draftPath),
    audio_track_index: audioTrackIndex,
    mode: mode || 'audio',
    sync_subtitles: syncSubtitles !== false,
    apply_animations: applyAnimations || false
  })
  syncCapCutMetadata(draftPath)
  return result
})
```

Modos:
- `'audio'`: sincroniza video com audio (remove gaps de audio, ajusta video para match)
- `'subtitle'`: sincroniza com base em legendas

#### flatten-audio-tracks (via Python)
Consolida multiplas tracks de audio em uma unica track sequencial.

#### loop-video (via Python)
Repete segmentos de video para preencher a duracao total do audio.
- `order`: 'random' | 'sequential'

#### loop-audio (via Python)
Repete segmentos de audio para preencher uma duracao-alvo.

#### apply-animations (via Python)
Aplica animacoes Ken Burns aleatorias a todas as imagens do projeto.

### 2.8 Handlers IPC - Timeline

#### timeline-get-segments
Le segmentos de um track especifico com material info enriquecido.

#### timeline-reorder-segments
Recebe array de IDs na nova ordem. Recalcula posicoes (start) sequencialmente. Salva e sync metadata.

#### timeline-delete-segment
Remove segment por ID de qualquer track. Recalcula posicoes dos restantes. Salva e sync metadata.

#### timeline-extract-audio / timeline-extract-audio-track
Extrai audio de segmento(s) para arquivo(s) WAV.

### 2.9 Handlers IPC - Backup

#### list-backups
Lista todos os backups em `.backups/` com nome, data, tamanho, descricao.

#### check-backup
Verifica se existem backups para o projeto.

#### undo-changes
Restaura backup especifico (por nome) ou o mais recente. Copia backup de volta para `draft_content.json`.

#### delete-backup / delete-all-backups
Remove backup(s).

#### save-backup-description
Salva descricao textual para o backup mais recente (arquivo `.desc` lado a lado).

### 2.10 Handlers IPC - File System

| Handler | Funcao |
|---------|--------|
| `list-directory-tree` | Arvore recursiva completa de um diretorio |
| `list-directory-children` | Filhos imediatos de um diretorio (lazy loading) |
| `read-file-content` | Le conteudo de arquivo (com limite de tamanho) |
| `write-file-simple` | Escreve conteudo em arquivo |
| `create-folder` | Cria diretorio |
| `rename-file-or-folder` | Renomeia (valida path traversal) |
| `delete-file` | Deleta arquivo ou diretorio |
| `copy-file` | Copia arquivo para destino |
| `open-folder-in-explorer` | Abre pasta no Windows Explorer |

### 2.11 Handlers IPC - Dialogs

| Handler | Funcao |
|---------|--------|
| `dialog:openFile` | dialog.showOpenDialog com filtros por tipo |
| `dialog:openFolder` | dialog.showOpenDialog para pastas |
| `dialog:save` | dialog.showSaveDialog |
| `prompt-dialog` | Input dialog customizado (titulo, mensagem, default) |
| `confirm-dialog` | Confirm dialog customizado (titulo, mensagem, botoes) |

### 2.12 Handlers IPC - Workspace

#### manage-workspaces
Operacoes CRUD unificadas via campo `operation`:
- `list`: lista todos workspaces do registry
- `create`: cria novo workspace (pasta + workspace.json + registra)
- `update`: atualiza nome/descricao
- `delete`: remove workspace e desregistra
- `open`: marca como lastOpenedId
- `set-thumbnail`: salva thumbnail do workspace
- `ensure-default`: garante existencia do workspace Default

#### manage-workspace-projects
Operacoes de linking projeto-workspace:
- `link`: adiciona projeto ao workspace.json projects[]
- `unlink`: remove projeto do workspace.json projects[]
- `list`: lista projetos do workspace (filtrado)

#### filterProjectsByWorkspace
```javascript
// Default workspace: retorna TODOS os projetos
if (workspace.isDefault) {
  const allProjects = scanAllCapCutProjects()
  // Enriquece com workspaceId/workspaceName via buildProjectWorkspaceMap()
  return enrichWithWorkspaceInfo(allProjects)
}

// Workspace especifico: retorna apenas projetos linkados
const wsConfig = JSON.parse(fs.readFileSync(workspace.json))
return wsConfig.projects
  .filter(p => projectExists(p.capCutPath))
  .map(p => enrichProjectInfo(p))
```

#### buildProjectWorkspaceMap
```javascript
// Constroi Map de normalizePath(capCutPath) -> {wsId, wsName}
// Itera todos non-default workspaces, le workspace.json, indexa projects[]
```

#### getProjectWorkspaceId
```javascript
// Para um dado projectPath, itera registry -> workspace.json -> projects[]
// Compara normalizePath(project.capCutPath) com normalizePath(projectPath)
// Retorna workspaceId ou null
```

#### normalizePath
```javascript
function normalizePath(p) {
  return p.replace(/\\/g, '/').replace(/\/$/, '')
}
```

### 2.13 Handlers IPC - Config

| Handler | Funcao |
|---------|--------|
| `get-config` | Le configuracao do app (JSON em userData) |
| `set-config` | Salva configuracao |
| `get-app-version` | Retorna versao do package.json |

---

## 3. PYTHON SCRIPTS (9 arquivos, 13.425 linhas)

### 3.1 capcut_editor.py (1.299 linhas)

Biblioteca core de manipulacao do CapCut JSON.

#### Imports
```python
import os, sys, json, uuid, shutil, re, copy
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Any, Tuple
from enum import Enum
```

#### Constantes
- `CAPCUT_PROJECTS_PATH`: `%LOCALAPPDATA%/CapCut/User Data/Projects/com.lveditor.draft`
- `BACKUP_FOLDER = ".backups"`, `MAX_BACKUPS = 10`
- `TEMPLATES_DIR`: `python_src/templates/`
- `_templates_cache: Dict[str, dict]`

#### Enums
```python
class TrackType(Enum):
    VIDEO = "video"
    AUDIO = "audio"
    TEXT = "text"
    STICKER = "sticker"
    EFFECT = "effect"

class MediaType(Enum):
    VIDEO = "video"
    PHOTO = "photo"
    AUDIO = "audio"
    MUSIC = "music"
    TEXT_TO_AUDIO = "text_to_audio"

class AnimationType(Enum):
    IN = "in"
    OUT = "out"
    LOOP = "loop"
```

#### Funcoes Standalone

| Funcao | Assinatura | Proposito |
|--------|-----------|-----------|
| `_load_template(name)` | `str -> dict` | Carrega template JSON do disco ou cache, retorna deep copy |
| `hex_to_rgb(hex_color)` | `str -> list` | Converte `#FFFFFF` para `[1.0, 1.0, 1.0]` RGB normalizado |
| `_create_text_content(text, font_size, color)` | `str,int,str -> str` | Retorna texto como string plain |
| `generate_uuid()` | `-> str` | UUID4 uppercase com hifens |
| `seconds_to_us(seconds)` | `float -> int` | Segundos para microsegundos |
| `us_to_seconds(microseconds)` | `int -> float` | Microsegundos para segundos |
| `time_to_us(time_str)` | `str -> int` | Parseia "MM:SS", "HH:MM:SS", ou segundos para us |
| `us_to_time(microseconds)` | `int -> str` | Microsegundos para "MM:SS.ss" |
| `get_timestamp_us()` | `-> int` | Timestamp atual em microsegundos |

#### Classe CapCutProject

**Construtor**: `__init__(self, path: Path)`
- Sets: `self.path`, `self.draft_content_path`, `self.draft_info_path`, `self.draft_meta_path`, `self.data`, `self.modified`
- Auto-loads se arquivo existe

**Metodos de Classe (criacao/abertura):**

| Metodo | Proposito |
|--------|-----------|
| `list_projects() -> List[Dict]` | Le root_meta_info.json, retorna [{name, path, draftPath, modifiedAt, duration}] |
| `open(name_or_path) -> CapCutProject` | Abre por path, por nome, ou do folder default |
| `create(name) -> CapCutProject` | Cria projeto vazio com _create_empty_draft() |
| `_create_empty_draft() -> Dict` | Cria draft_content minimo (canvas 1080x1920, tracks/materials vazios) |

**Metodos I/O:**

| Metodo | Proposito |
|--------|-----------|
| `_load()` | Carrega draft_content.json |
| `save()` | Cria backup, recalcula duracao, salva JSON, atualiza meta timestamps |
| `_create_backup()` | Copia para .backups/ com timestamp, prune ate MAX_BACKUPS |
| `_recalculate_duration()` | max(start+duration) de todos segments |
| `_update_meta_timestamps()` | Atualiza ambos meta files com timestamp microsegundos |

**Properties:** `name`, `duration`, `duration_seconds`, `tracks`, `materials`

**Metodos de Track:**

| Metodo | Proposito |
|--------|-----------|
| `get_track(index)` | Retorna track por index |
| `get_track_by_type(track_type)` | Todas tracks de um tipo |
| `add_track(track_type) -> int` | Adiciona track vazio, retorna index |
| `find_or_create_track(track_type) -> int` | Encontra existente ou cria novo |

**Metodos de Segment:**

| Metodo | Proposito |
|--------|-----------|
| `add_segment(track_index, material_id, start, duration, source_start, source_duration)` | Cria segment com target_timerange + source_timerange + clip |
| `get_segment(track_index, segment_index)` | Retorna segment por indices |
| `move_segment(track_index, segment_index, new_start)` | Move para nova posicao na timeline |
| `set_segment_duration(track_index, segment_index, duration)` | Seta duracao em target e source |

**Metodos de Texto:**

| Metodo | Proposito |
|--------|-----------|
| `add_text(text, start, duration, color, size, position) -> str` | Cria material texto + animation + segment via templates. Retorna material_id |
| `edit_text(material_id, new_text) -> bool` | Edita texto existente (handles JSON ou plain) |
| `set_text_style(material_id, color, size, font) -> bool` | Atualiza estilo visual |
| `add_text_track(name) -> int` | Cria NOVA text track |
| `add_text_to_track(track_index, text, start, duration, color, size, position) -> str` | Adiciona texto em track especifico |
| `insert_srt_stems(stems_data) -> dict` | Insere SRT multi-track (Master + per-character) |

**Metodos de Import:**

| Metodo | Proposito |
|--------|-----------|
| `import_video(path, start) -> str` | Importa video, cria material + segment |
| `import_audio(path, start) -> str` | Importa audio |
| `import_image(path, start, duration) -> str` | Importa imagem (vai em materials.videos com type "photo") |

**Metodos de Animacao:**

| Metodo | Proposito |
|--------|-----------|
| `add_animation(track_index, segment_index, animation_type, duration, name)` | Via extra_material_refs |

**Metodos de Velocidade/Transformacao:**

| Metodo | Proposito |
|--------|-----------|
| `set_speed(track_index, segment_index, speed)` | 1.0 = normal |
| `reverse_segment(track_index, segment_index, reverse)` | Inversao de playback |
| `set_transform(track_index, segment_index, x, y, scale_x, scale_y, rotation, alpha)` | Transform completo |
| `set_scale(track_index, segment_index, scale)` | Scale uniforme |
| `set_opacity(track_index, segment_index, opacity)` | Alpha 0-1 |

**Metodos de Audio:**

| Metodo | Proposito |
|--------|-----------|
| `set_volume(track_index, segment_index, volume)` | 0.0 a 1.0 |
| `set_volume_percent(track_index, segment_index, percent)` | 0-100 |

**Metodos de Extracao:**

| Metodo | Proposito |
|--------|-----------|
| `align_audio_segments()` | Remove gaps entre segments de audio |
| `get_audio_files() -> List[Dict]` | Extrai audios: {path, name, start_ms, duration_ms, type, material_id, track} |
| `get_subtitles() -> List[Dict]` | Extrai legendas: {text, start_ms, end_ms, track, material_id} |
| `get_info() -> Dict` | Resumo: nome, duracao, contagem de tracks/materials |

#### Comunicacao
- CLI via argparse: comandos `list`, `info`, `add-text`
- Entry: `if __name__ == "__main__": main()`

### 3.2 sync_engine.py (2.263 linhas)

Engine de sincronizacao, insercao de midia, SRT e animacoes.

#### Imports
```python
import json, sys, os, re, copy
from pathlib import Path
from datetime import datetime
import random, uuid
```

#### Constantes de Animacao
- `EFFECT_TEMPLATES`: 14 arrays de 7-8 UUIDs (resource IDs de efeitos CapCut)
- `ANIMATION_PATTERNS`: 6 funcoes de animacao Ken Burns

#### Funcoes de Keyframe Ken Burns

| Funcao | Efeito |
|--------|--------|
| `criar_keyframe_zoom_in_suave(duration)` | Scale 1.02 -> 1.15 |
| `criar_keyframe_pan_down(duration)` | Scale 1.15 fixo + Y -0.12 -> 0.12 |
| `criar_keyframe_zoom_out(duration)` | Scale 1.18 -> 1.05 |
| `criar_keyframe_zoom_in_forte(duration)` | Scale 1.0 -> 1.2 |
| `criar_keyframe_pan_down_forte(duration)` | Scale 1.2 + Y -0.15 -> 0.15 |
| `criar_keyframe_pan_horizontal(duration)` | Scale 1.15 + X -0.1 -> 0.1 |

Retornam listas de keyframes com propriedades: `KFTypeScaleX`, `KFTypeScaleY`, `KFTypePositionX`, `KFTypePositionY`.

#### Funcoes Auxiliares

| Funcao | Proposito |
|--------|-----------|
| `create_backup(file_path)` | Copia com timestamp para .backups/ |
| `parse_srt(filepath, debug)` | Regex parser para SRT: retorna [{start, duration, text}] em microsegundos |
| `limpar_nome_musica(nome)` | Remove extensao e numeros iniciais |
| `criar_material_texto(texto, font_size, is_subtitle, group_id)` | Cria material texto via template, retorna (mat_id, template_dict) |
| `criar_segmento_texto(mat_id, start, duration, y_pos, render_index, track_render_index)` | Cria segment texto + animation via templates, retorna (segment, animation) |

#### Funcoes Core de Sync

##### analyze_project(draft_path)
Retorna resumo de tracks: index, type, segments count, duration, name.

##### sync_project(draft_path, audio_track_index, mode, sync_subtitles, apply_animations)
**A funcao mais complexa.** Fluxo completo:

1. Le draft_content.json
2. Identifica audio track pelo index
3. **Remove gaps de audio**: recalcula start sequencial de cada segment
4. **Sync video com audio** (mode='audio'):
   - Encontra primeiro video track
   - Para cada video segment, ajusta duracao para match com audio correspondente
   - Se mais audios que videos: loop video segments
   - Se mais videos que audios: trunca
5. **Sync com director scenes** (se director_scenes.json existe):
   - Le cenas com media associada
   - Posiciona video segments conforme timing do diretor
6. **Sync subtitles com audio** (se sync_subtitles=true):
   - Encontra text tracks
   - Ajusta timing das legendas para alinhar com audio
7. **Apply Ken Burns** (se apply_animations=true):
   - Aplica animacao aleatoria a cada photo segment
8. Salva e retorna resultado

##### flatten_audio_tracks(draft_path)
Consolida multiplas tracks de audio em uma unica track sequencial. Remove tracks vazias.

##### apply_animations_to_images(draft_path)
Aplica Ken Burns random em TODOS os photo segments do projeto.

##### loop_video(draft_path, audio_track_index, order)
Loop de video para preencher duracao do audio:
- `order='random'`: ordem aleatoria
- `order='sequential'`: ordem original

##### loop_audio(draft_path, track_index, target_duration)
Loop de audio para preencher duracao-alvo.

#### Funcoes de Insercao SRT

##### insert_srt(draft_path, create_title, selected_file_paths, srt_folder, selected_files, separate_tracks)
Insere legendas SRT matching com segments de audio:
- Suporta novo formato (paths completos) e antigo (folder + filenames)
- Match por basename do audio
- Pode criar tracks separados por audio
- Opcional: cria titulo na primeira legenda

##### insert_srt_batch(draft_path, srt_files, create_title, gap_ms)
Insere multiplos SRTs sequencialmente com gap configuravel entre eles.

#### Funcoes de Insercao de Midia

##### insert_media_batch(draft_path, media_files, image_duration, media_files_with_duration)
Batch insert de videos/imagens sequencialmente na timeline.

##### insert_audio_batch(draft_path, audio_files, use_existing_track, track_index)
Batch insert de audios. Pode usar track existente ou criar novo.

##### criar_material_video(file_path, duration, width, height, has_audio, media_type)
Cria material completo de video/foto com todos os campos obrigatorios.

##### criar_materiais_auxiliares_video()
Cria 6 materiais auxiliares: speed, placeholder, canvas, channel, color, vocal.

##### criar_segmento_video(mat_id, start, duration, extra_refs, render_index)
Cria segment de video com target_timerange, source_timerange, clip, extra_material_refs.

##### criar_material_audio(file_path, duration)
Cria material de audio completo.

##### criar_materiais_auxiliares_audio()
Cria 5 materiais auxiliares de audio: speed, placeholder, beat, channel, vocal.

##### criar_segmento_audio(mat_id, start, duration, extra_refs, render_index)
Cria segment de audio.

#### Funcoes de Utilidade

| Funcao | Proposito |
|--------|-----------|
| `get_media_info(file_path)` | Duracao/dimensoes via wave ou ffprobe |
| `randomize_existing_media(draft_path)` | Embaralha material_ids de video segments |
| `import_media_folder(draft_path, folder_path, ...)` | Auto-detecta e importa toda midia de uma pasta |
| `insert_creator_content(draft_path, content_folder, add_animations)` | Insere conteudo gerado pelo Creator |
| `read_subtitles(draft_path)` | Le todas legendas com timing e material_id |
| `update_subtitles(draft_path, updated_subtitles)` | Atualiza texto de legendas por material_id |

#### Comunicacao
- CLI: `python sync_engine.py <json>` ou `--file <path>`
- Dispatch: analyze, sync, loop_video, loop_audio, insert_srt, insert_srt_batch, insert_media, insert_audio, randomize_media, apply_animations, insert_creator, import_folder, read_subtitles, update_subtitles, flatten-audio
- Retorna JSON em stdout, debug em stderr

### 3.3 content_creator.py (1.907 linhas)

Pipeline de geracao de conteudo AI (Gemini).

#### Constantes
- `VOZES_GEMINI`: 30 vozes TTS organizadas por pitch
- `ESTILOS_IMAGEM`: 12 estilos visuais (Professional Photo, Cinematic, Digital Art, etc.)
- `ESTILOS_NARRACAO`: 35 estilos de narracao em 4 categorias (Energy/7, Profession/10, Emotion/10, Genre/8)

#### Funcoes Principais

| Funcao | Proposito |
|--------|-----------|
| `generate_content(params)` | Pipeline completo: script -> image prompts -> images -> TTS audio -> SRT |
| `generate_script_only(params)` | Gera apenas script via Gemini (multi-part com context window) |
| `generate_audio_only(params)` | Gera apenas audio TTS por chunk. Salva WAV por parte + combinado |
| `regenerate_audio_part(params)` | Regenera uma parte de audio falhada e reconstroi combinado |
| `generate_audio_drama(params)` | Audio drama multi-personagem: parseia cenas de max 2 speakers, Multi-Speaker TTS para dialogos, Single-Speaker para monologos |
| `generate_images_only(params)` | Gera imagens de prompts custom. Batch de 5 com ThreadPoolExecutor |

#### Comunicacao
- CLI: `python content_creator.py <json>` ou `--file <path>`
- Actions: generate, generate_script, generate_audio, generate_images, generate_audio_drama, regenerate_audio_part
- Progress via file-based polling (escreve JSON em progress_file)

### 3.4 project_manager.py (680 linhas)

Import/export de projetos CapCut.

| Funcao | Proposito |
|--------|-----------|
| `get_all_media_paths(draft_content)` | Extrai TODOS os paths de midia (videos, audios, images, stickers, effects) |
| `update_media_paths(draft_content, path_mapping)` | Substitui paths usando mapping dict |
| `export_project(params)` | Exporta para ZIP: copia midia, converte paths para relativos, zipa |
| `import_project(params)` | Importa de ZIP: extrai, converte relativos para absolutos, cria meta, registra |
| `generate_draft_id()` | ID hex de 24 chars |
| `get_micro_timestamp()` | Timestamp em microsegundos |
| `create_draft_info(...)` | Cria draft_info.json |
| `create_draft_meta_info(...)` | Cria draft_meta_info.json |
| `register_in_root_meta(...)` | Registra projeto no root_meta_info.json (insere no inicio de all_draft_store) |

### 3.5 track_generator.py (585 linhas)

Gerador de tracks para audio drama (3 tracks separados).

#### Classe TrackGenerator

| Metodo | Proposito |
|--------|-----------|
| `load_config()` | Carrega JSON config (title, sfx list, ambience list, music list) |
| `analyze_narration_files()` | Analisa WAVs, calcula timing sequencial com 500ms gaps |
| `search_freesound(query, sound_type)` | Busca Freesound API com filtros de duracao |
| `download_sound(sound_id, sound_name, output_dir)` | Download HQ MP3 preview |
| `download_sfx()` | Download de todos SFX configurados |
| `download_music_and_ambience()` | Download de musica/ambience |
| `generate_narration_track()` | Base silenciosa + overlay narracoes com fade in/out |
| `generate_sfx_track()` | Base silenciosa + overlay SFX com volume/fades |
| `generate_music_track()` | Ambience layer + music layer com volume/fades/loop |
| `export_tracks(narration, sfx, music)` | Normaliza e exporta 3 MP3s a 320k |
| `generate_report(track_paths)` | JSON report com timing, clips, CapCut guide |

### 3.6 video_planner.py (617 linhas)

Sistema de planejamento de video com partes.

| Funcao | Proposito |
|--------|-----------|
| `create_project(params)` | Cria pasta com projeto.json + subfolders |
| `load_project(params)` | Carrega projeto.json |
| `save_project(params)` | Salva com timestamp atualizado |
| `add_part(params)` | Adiciona parte (script, imagePrompts, imagePaths, audioPath, status, voiceId, narrationStyle, srtConfig) |
| `remove_part(params)` | Remove parte, opcionalmente deleta arquivos |
| `update_part(params)` | Atualiza campos, auto-detecta status (empty/planning/producing/ready) |
| `reorder_parts(params)` | Reordena partes por lista de IDs |
| `list_projects(params)` | Lista todos projetos de uma pasta |

### 3.7 context_analyzer.py (578 linhas)

Wrappers para funcoes do CapCutProject.

| Funcao | Proposito |
|--------|-----------|
| `get_audio_duration(file_path)` | Duracao via pydub mediainfo |
| `get_audio_files_from_project(project_path)` | Wrapper CapCutProject.get_audio_files() |
| `get_subtitles_from_project(project_path)` | Wrapper CapCutProject.get_subtitles() |
| `insert_sound_to_project(project_path, audio_path, start_ms, duration_ms)` | Auto-detecta duracao, importa audio |
| `insert_subtitles_to_project(project_path, subtitles)` | Insere lista de {text, start_ms, duration_ms} |
| `insert_image_to_project(project_path, image_path, start_ms, duration_ms)` | Importa imagem |
| `insert_stems_to_project(project_path, stems_data)` | Wrapper insert_srt_stems() |
| `insert_scenes_from_subtitles(project_path, scenes)` | Insere imagens com duracao variavel baseada em legendas |
| `get_scenes_from_subtitles(project_path)` | Converte legendas para formato de cena |
| `transcribe_audio(audio_path, model_size)` | Transcricao Whisper |

### 3.8 dialog_stem_parser.py (422 linhas)

Parser de dialogo multi-personagem para SRT stems.

#### Constantes
- `CHARS_PER_SECOND = 12` (velocidade de leitura)
- `GAP_BETWEEN_LINES = 300` (ms entre linhas)
- `MAX_BLOCK_CHARS = 400` (max chars por bloco SRT)
- `DEFAULT_COLORS`: 6 cores (blue, gold, green, purple, pink, cyan)
- `DIALOG_PATTERN`: regex `^\[([A-Z][A-Z0-9_]*)\]\s*"([^"]+)"`

| Funcao | Proposito |
|--------|-----------|
| `split_long_text(text, max_chars)` | Split por sentenca/virgula/palavra |
| `parse_script(script_text)` | Parseia formato `[CHARACTER] "line"` |
| `calculate_duration(text)` | chars/CHARS_PER_SECOND, min 1000ms max 30000ms |
| `add_timing(lines)` | Timing sequencial com gaps |
| `generate_stems(parse_result)` | Master (com nomes) + per-character stems (sem nomes) |
| `format_srt_time(ms)` | Formato `00:00:00,000` |
| `generate_srt(lines)` | Gera conteudo SRT |
| `process_script(script_text)` | Pipeline completo: parse -> stems -> SRT master + SRT stems |
| `save_srt_files(result, output_dir)` | Salva master.srt + per-character SRTs |

### 3.9 audio_mixer.py (279 linhas)

Mixer de audio drama com tracks, clips, volume e fades.

| Funcao | Proposito |
|--------|-----------|
| `load_audio_file(file_path)` | Carrega mp3/wav/ogg via pydub |
| `apply_volume(audio, volume_db)` | Aplica ganho dB |
| `apply_fade(audio, fade_in_ms, fade_out_ms)` | Fade in/out |
| `process_clip(clip_data, base_path, track_volume_db)` | Processa clip: load, volume track+clip, fades. Retorna (audio, start_ms, loop) |
| `mix_timeline(timeline_path, output_path)` | Cria base silenciosa, processa tracks/clips com loop, normaliza, exporta MP3 320k |

Formato timeline.json:
```json
{
  "duration": 120000,
  "tracks": [{
    "type": "narration",
    "volume": 0,
    "clips": [{
      "file": "narration_01.wav",
      "start": 0,
      "volume": 0,
      "fade_in": 100,
      "fade_out": 200,
      "loop": false
    }]
  }]
}
```

---

## 4. SISTEMA DE WORKSPACES

### 4.1 Estrutura de Dados

**Registry global** (`{userData}/workspaces.json`):
```json
{
  "workspaces": [
    { "id": "...", "name": "Default", "path": "...", "isDefault": true },
    { "id": "...", "name": "Meu Workspace", "path": "...", "isDefault": false }
  ],
  "lastOpenedId": "...",
  "defaultWorkspaceId": "..."
}
```

**Per-workspace** (`{workspace.path}/workspace.json`):
```json
{
  "id": "...",
  "name": "Meu Workspace",
  "description": "...",
  "path": "...",
  "isDefault": false,
  "projects": [
    {
      "name": "001",
      "capCutPath": "C:\\...\\001",
      "localPath": "C:\\...\\projetos\\001",
      "linkedAt": "2025-12-10T..."
    }
  ]
}
```

### 4.2 Filtragem de Projetos

**Default workspace**: Retorna TODOS os projetos CapCut encontrados, enriquecidos com workspaceId e workspaceName via `buildProjectWorkspaceMap()`.

**Workspace especifico**: Retorna APENAS projetos listados no `workspace.json` daquele workspace.

### 4.3 Navegacao Cross-Workspace

Quando no Default workspace, se o usuario clicar em um projeto que pertence a outro workspace:
1. Guarda projeto em `pendingProjectRef`
2. Chama `onSwitchToWorkspace(workspaceId)`
3. App.tsx muda para o workspace correto
4. useEffect detecta `pendingProjectRef`
5. Auto-abre o projeto com 300ms delay

### 4.4 WorkspaceSelectorScreen

- `loadWorkspaces()`: chama `ensure-default-workspace` + `list-workspaces`
- Default workspace exibido separadamente (card maior)
- Custom workspaces em grid
- Context menu: Renomear, Foto, Deletar (Default nao tem context menu)
- Freemium limits: free=0 extras, trial=1, vip/annual=infinity

### 4.5 WorkspaceCreateModal

- Campos: nome (obrigatorio) + descricao (opcional)
- Cria pasta no filesystem
- Cria workspace.json
- Registra no registry

---

## 5. SELECAO E ABERTURA DE PROJETO

### 5.1 handleSelectProject (10 passos)

```
1. Se projeto pertence a outro workspace e estamos no Default:
   -> pendingProjectRef = project
   -> onSwitchToWorkspace(workspaceId)
   -> return

2. Close project picker sidebar

3. Verifica se ja existe tab aberta para este draftPath:
   -> Se sim, apenas switchToTab(tabId)
   -> return

4. Unwatch projeto anterior:
   -> ipcRenderer.invoke('unwatch-project')

5. Limpa estado:
   -> setTracks([])
   -> setDraftPath(null)

6. Seta novos paths:
   -> setProjectPath(project.path)
   -> setProjectName(project.name)
   -> setDraftPath(project.draftPath)

7. check-fix-project-version:
   -> Verifica/corrige versao bugada do CapCut

8. ensure-nardoto-studio-folder:
   -> Garante pasta do app no workspace

9. analyze-project:
   -> Le draft_content.json em Node.js
   -> Retorna {tracks: TrackInfo[]}
   -> setTracks(result.tracks)

10. Cria nova tab:
    -> addProjectTab({ name, path, draftPath })
    -> setActiveProjectTabId(newTab.id)
```

### 5.2 Tab System

- `openProjectTabs[]`: array de tabs abertas
- `activeProjectTabId`: ID da tab ativa
- `addProjectTab()`: cria nova tab
- `switchToTab()`: muda tab ativa (com unwatch/rewatch)
- `closeTab()`: fecha tab (se era ativa, seleciona outra)

### 5.3 Recent Projects

- `addRecentProject()`: adiciona ao inicio da lista
- `saveRecentProjects()`: max 10 projetos, persiste em localStorage
- Relative date formatting PT-BR: "agora", "5min", "3h", "2d"

---

## 6. TIMELINE REAL-TIME

### 6.1 Cadeia de Eventos Completa

```
CapCut salva draft_content.json
    |
    v
fs.watch detecta mudanca (possivelmente multiplos eventos)
    |
    v
Debounce 500ms (clearTimeout + setTimeout)
    |
    v
mainWindow.webContents.send('project-file-changed', { draftPath, eventType })
    |
    v
Preload permite canal (ALLOWED_LISTEN_CHANNELS)
    |
    v
MainLayout useEffect listener recebe evento
    |
    v
Seguranca: data.draftPath === current draftPath
    |
    v  (sim)
startTransition(() => {
  ipcRenderer.invoke('analyze-project', draftPath)
})
    |
    v
setTracks(result.tracks) -> React re-renderiza TimelinePreview
```

### 6.2 useEffect 1 - Watch Lifecycle

```typescript
useEffect(() => {
  if (draftPath) {
    ipcRenderer.invoke('watch-project', draftPath)
  } else {
    ipcRenderer.invoke('unwatch-project')
  }
  return () => {
    ipcRenderer.invoke('unwatch-project')
  }
}, [draftPath])
```

### 6.3 useEffect 2 - File Change Listener

```typescript
useEffect(() => {
  const handleFileChanged = (_, data) => {
    if (draftPath && data.draftPath === draftPath) {
      startTransition(() => {
        ipcRenderer.invoke('analyze-project', draftPath)
          .then((result) => {
            if (!result.error && result.tracks) {
              setTracks(result.tracks)
            }
          })
      })
    }
  }

  ipcRenderer.on('project-file-changed', handleFileChanged)
  return () => {
    ipcRenderer.removeListener('project-file-changed', handleFileChanged)
  }
}, [draftPath])
```

### 6.4 handleReanalyze (manual)

```typescript
const handleReanalyze = async () => {
  setIsLoading(true)
  addLog('info', 'Reanalisando projeto...')
  const result = await ipcRenderer.invoke('analyze-project', draftPath)
  if (!result.error) {
    setTracks(result.tracks)
    addLog('success', 'Projeto reanalisado: ' + result.tracks.length + ' tracks')
  }
  setIsLoading(false)
}
```

---

## 7. TimelinePreview (701 linhas)

### 7.1 Props

```typescript
interface TimelinePreviewProps {
  tracks: TrackInfo[]
  selectedAudioTrack: number
  onTrackClick?: (trackIndex: number, trackType: string) => void
  onDeleteTrack?: (trackIndex: number) => void
  activeTab?: string
  mediaInsertMode?: 'video_image' | 'audio'
  projectPath?: string | null
  onLog?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void
  onRefresh?: () => void
}
```

### 7.2 Cores CapCut

```typescript
const trackColors: Record<string, string> = {
  video: '#175d62',      // Verde escuro/Teal
  audio: '#0e3058',      // Azul escuro
  text: '#9c4937',       // Marrom/vermelho
  subtitle: '#9c4937',   // Mesmo que texto
  effect: '#744a82',     // Roxo claro
  filter: '#47418b',     // Roxo escuro
  sticker: '#47418b',    // Mesmo que filter
}

const trackLabels: Record<string, string> = {
  video: 'Video',
  audio: 'Audio',
  text: 'Texto',
  subtitle: 'Legenda',
  effect: 'Efeito',
  filter: 'Filtro',
  sticker: 'Sticker',
}
```

### 7.3 Sort Order (cima para baixo)

```typescript
const order = ['filter', 'effect', 'sticker', 'text', 'subtitle', 'video', 'audio']
const sortedTracks = [...tracks].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
```

### 7.4 Posicionamento de Segmentos

```typescript
const left = (start / maxDuration) * 100        // percentual
const width = (duration / maxDuration) * 100     // percentual, minimo 0.3%
const maxDuration = Math.max(...tracks.map(t => t.duration), 1)
```

### 7.5 Texto em Segmentos

```typescript
// So mostra texto se segmento > 2% de largura
if (width > 2) {
  const maxChars = Math.max(3, Math.floor(width * 0.8))
  const truncatedText = displayText.length > maxChars
    ? displayText.substring(0, maxChars - 2) + '..'
    : displayText
}

// Texto para text/subtitle: conteudo do texto
// Texto para video/audio: nome do arquivo (path.basename)
```

### 7.6 Layout de Cada Track

```
[Track Label 80px] [Track Bar flex-1 h-5] [Segment Count 10px]
  right-aligned       bg-white/5 rounded      right-aligned
  truncate 12 chars   relative overflow-hidden text-[9px]
  text-[9px] muted    segments absolutos
```

### 7.7 Estado de Selecao

```typescript
// Segment selecionado: ring-2 ring-white ring-inset + cor mais clara
// adjustColor multiplica RGB por 1.3
function adjustColor(color: string, factor: number): string {
  const hex = color.replace('#', '')
  const r = Math.min(255, Math.floor(parseInt(hex.substring(0, 2), 16) * factor))
  const g = Math.min(255, Math.floor(parseInt(hex.substring(2, 4), 16) * factor))
  const b = Math.min(255, Math.floor(parseInt(hex.substring(4, 6), 16) * factor))
  return `rgb(${r}, ${g}, ${b})`
}
```

### 7.8 Drag and Drop

- Constrained ao mesmo track (cross-track nao permitido)
- Visual: dragged = opacity-50 scale-95, drop target = ring-2 ring-yellow-400
- On drop: calcula nova ordem de IDs, envia para `timeline-reorder-segments`
- On success: chama onRefresh() (handleReanalyze)

### 7.9 Context Menu

5 acoes disponiveis:
1. Extrair Audio (segment unico)
2. Extrair Audio da Track Inteira
3. Mover para inicio
4. Mover para fim
5. Deletar segmento

### 7.10 Highlight System

```typescript
// VIDEO badge (green) no primeiro video track quando em tab Media + modo video
const isVideoHighlighted = isInMediaTab && isVideoMode && track.type === 'video' && track.index === firstVideoTrackIndex

// REF badge (primary) no audio track selecionado
const isAudioHighlighted = track.type === 'audio' && track.index === selectedAudioTrack

// Visual: ring-2 ring-primary shadow-[0_0_12px] shadow-primary/50
```

### 7.11 Ruler

```typescript
// Simples: so tempo inicial e final
<span>0:00</span>
<span>{formatDuration(maxDuration)}</span>

// formatDuration divide por 1000000 (microsegundos)
const formatDuration = (ms) => {
  const seconds = Math.floor(ms / 1000000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}
```

---

## 8. TIMELINE AVANCADA (timeline/ subdirectory)

### 8.1 TimelineEditor (206 linhas)

Sistema de timeline mais avancado para editor dedicado.

```typescript
interface TimelineEditorProps {
  tracks: TrackData[]
  duration: number          // duracao total em segundos
  onTracksChange?: (tracks: TrackData[]) => void
  onSelectSegment?: (segmentId: string | null) => void
  selectedSegmentId?: string | null
}
```

- Zoom: 10-200 pixels/segundo, default 50
- Zoom in: x1.25, Zoom out: /1.25
- Fit to view: containerWidth / duration
- Ctrl+Scroll: zoom via mousewheel
- Track header: 132px fixo (nome + controles visibility/lock/mute)
- Ruler: sticky no topo

### 8.2 TimelineTrack (131 linhas)

```typescript
interface TrackData {
  id: string
  type: 'video' | 'audio' | 'text' | 'music'
  name: string
  segments: SegmentData[]
  visible: boolean
  locked: boolean
  muted?: boolean
  audioPath?: string      // para waveform
}
```

- Track height: 56px (h-14)
- Se audio/music com audioPath: renderiza WaveformDisplay a 30% opacidade como background
- Mesmas cores que TimelinePreview

### 8.3 TimelineSegment (108 linhas)

```typescript
interface SegmentData {
  id: string
  type: 'video' | 'audio' | 'text' | 'music'
  name: string
  startTime: number       // segundos
  duration: number        // segundos
  color?: string
  path?: string
  thumbnail?: string
}
```

- Posicionamento pixel-based: left = startTime * zoom, width = duration * zoom
- Minimo 20px de largura
- Thumbnail: imagem a 60% opacidade
- Selecao: ring-2 ring-white shadow-lg
- Resize handles: 6px nas bordas (cursor ew-resize) - TODO, nao implementado

### 8.4 TimelineRuler (59 linhas)

Intervalos adaptativos:
- zoom < 20: cada 10 segundos
- zoom < 50: cada 5 segundos
- zoom < 100: cada 2 segundos
- zoom >= 100: cada 1 segundo

Main markers (a cada 5 intervalos): linha 16px, branco 40%, label de tempo.
Sub-markers: linha 8px, branco 20%.

### 8.5 WaveformDisplay (105 linhas)

```typescript
const ws = WaveSurfer.create({
  container: containerRef.current,
  waveColor: color,
  progressColor: `${color}80`,
  cursorColor: 'transparent',
  barWidth: 2,
  barGap: 1,
  barRadius: 2,
  height,
  normalize: true,
  interact: false,
})

// Windows path para file:// URL
const fileUrl = audioPath.startsWith('file://')
  ? audioPath
  : `file:///${audioPath.replace(/\\/g, '/')}`
```

---

## 9. SISTEMA DE ACOES (CDI)

### 9.1 ActionRegistry (Singleton)

```typescript
class ActionRegistryClass {
  private actions: Map<string, ActionDefinition>
  private byCategory: Map<ActionCategory, ActionDefinition[]>
  private byShortcut: Map<string, ActionDefinition>

  register(action: ActionDefinition): void
  registerAll(actions: ActionDefinition[]): void
  unregister(actionId: string): boolean
  get(actionId: string): ActionDefinition | undefined
  getByShortcut(shortcut: string): ActionDefinition | undefined
  getAll(): ActionDefinition[]
  getByCategory(category: ActionCategory): ActionDefinition[]
  search(query: string): ActionDefinition[]  // busca em nome, descricao, tags, id
  groupByCategory(): Record<ActionCategory, ActionDefinition[]>
}
```

7 categorias: sync, media, subtitle, merge, render, ai, utility

### 9.2 ActionDefinition (types/actions.ts)

```typescript
interface ActionDefinition {
  id: string
  name: string
  description: string
  icon: string            // nome do icone Lucide
  category: ActionCategory
  steps: ActionStep[]
  requiresProject: boolean
  shortcut?: string
  tags?: string[]
}

type ActionCategory = 'sync' | 'media' | 'subtitle' | 'merge' | 'render' | 'ai' | 'utility'
```

### 9.3 ActionStep (13 tipos)

| Tipo | Proposito |
|------|-----------|
| `select` | Dropdown de opcoes |
| `file` | File picker |
| `folder` | Folder picker |
| `folder_preview` | Folder picker com preview de conteudo |
| `review` | Revisao de configuracoes antes de executar |
| `track_select` | Selecao de track do CapCut |
| `duration_mode` | Selecao de modo de duracao (audio/custom) |
| `slider` | Slider numerico |
| `input` | Input de texto |
| `toggle` | Toggle boolean |
| `multi_select` | Selecao multipla |
| `info` | Informacao (read-only) |
| `track_info` | Informacao de track (read-only) |

### 9.4 WizardStore (Zustand)

```typescript
interface WizardState {
  activeAction: ActionDefinition | null
  currentStep: number
  steps: ActionStep[]
  results: Record<string, any>
  isOpen: boolean
  isExecuting: boolean

  startAction: (action: ActionDefinition) => void
  nextStep: () => void
  prevStep: () => void
  setResult: (key: string, value: any) => void
  executeAction: () => void
  resetStep: (stepIndex: number) => void
  close: () => void
}
```

### 9.5 Acoes Individuais

#### srtAction (7 steps)
1. track_select: selecionar audio de referencia
2. folder: selecionar pasta com SRTs
3. folder_preview: preview dos SRTs encontrados
4. toggle: criar titulo
5. toggle: tracks separados
6. select: modo de insercao
7. review: confirmar

#### mediaAction (5 steps)
1. track_select: selecionar audio de referencia
2. folder: selecionar pasta com midias
3. duration_mode: duracao de imagens
4. select: modo de insercao (end/replace/start)
5. review: confirmar

#### syncAction (4 steps)
1. track_select: selecionar audio de referencia
2. select: modo (audio/subtitle)
3. toggle: sincronizar legendas
4. review: confirmar

#### loopAction (5 steps)
1. select: tipo (video/audio)
2. track_select: selecionar track
3. select: ordem (random/sequential)
4. slider: duracao-alvo (se audio)
5. review: confirmar

---

## 10. CONTEXTS (React)

### 10.1 ProjectContext

```typescript
interface ProjectState {
  projectPath: string | null
  projectName: string | null
  draftPath: string | null
  projectToOpen: { name, path, draftPath, modifiedAt } | null
  projectSource: 'local' | 'cloud'
  cloudFolderPath: string | null
  tracks: TrackInfo[]
  selectedAudioTrack: number
  cloudProjects: Array<{ name, path, draftPath, modifiedAt }>
}

interface ProjectActions {
  setProjectPath, setProjectName, setDraftPath, setProjectToOpen,
  setProjectSource, setCloudFolderPath, setTracks, setSelectedAudioTrack,
  setCloudProjects, hasProject(), clearProject()
}
```

### 10.2 UIContext

```typescript
interface UIState {
  showSidebar: boolean
  showActivityBar: boolean
  showHelp: boolean
  showProjectPicker: boolean
  showTemplatePicker: boolean
  showDeleteConfirm: boolean
  showMultiDeleteConfirm: boolean
  activeTab: string
  showActivityConsole: boolean
  showLogConsole: boolean
  isExporting: boolean
}

// + setters para cada um + toggleSidebar + toggleActivityBar + closeAllModals
```

### 10.3 LogContext

```typescript
type LogType = 'info' | 'success' | 'error' | 'warning'

interface LogEntry {
  type: LogType
  message: string
  timestamp: Date
}

// Actions: addLog, clearLogs, getLogsByType, getRecentLogs
// HOC: withLog<P> injects addLog as onLog prop
```

---

## 11. STORES (Zustand + localStorage)

### 11.1 wizardStore (Zustand, 448 linhas)
Ver secao 9.4 acima.

### 11.2 promptTemplateStore (Zustand, 1.266 linhas)
Gerenciamento de templates de prompt para AI. CRUD completo, import/export, favoritos, 8 categorias de default prompts.

### 11.3 mediaConfigStore (localStorage, 70 linhas)
```typescript
interface MediaConfig {
  imageDuration: number      // duracao padrao de imagens (ms)
  insertMode: 'end' | 'replace' | 'start'
  audioTrackMode: 'same' | 'separate'
  addAnimations: boolean
}
```

### 11.4 srtConfigStore (localStorage, 70 linhas)
```typescript
interface SrtConfig {
  fontSize: number
  fontFamily: string
  color: string
  position: 'bottom' | 'center' | 'top'
  animation: string
  createTitle: boolean
}
```

### 11.5 canvasStore (Zustand, 67 linhas)
Zoom, pan, cards positions, isPanning, selectedSceneId para o storyboard canvas.

### 11.6 narrationStyleStore (localStorage, 56 linhas)
CRUD para presets customizados de estilo de narracao TTS.

---

## 12. HOOKS

### 12.1 useProjectValidation

```typescript
function useProjectValidation(projectInfo: { tracks: any[], draftPath: string | null }) {
  const hasProject = tracks && tracks.length > 0
  const hasDraftPath = !!draftPath
  const isValid = hasProject && hasDraftPath
  return { isValid, message, hasProject, hasDraftPath }
}

// Funcao utilitaria (nao-hook):
function validateProject(projectInfo, onLog?): boolean
function validateIpcRenderer(onLog?): boolean
```

### 12.2 useClickOutside

```typescript
function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  handler: (event: MouseEvent | TouchEvent) => void,
  enabled: boolean = true
): void
// Listeners: mousedown + touchstart, cleanup automatico
```

### 12.3 useContextMenu

```typescript
interface ContextMenuState<T> { visible, x, y, data: T | null }

function useContextMenu<T>(): {
  contextMenu: ContextMenuState<T>,
  handleContextMenu: (e: MouseEvent, data: T) => void,
  closeMenu: () => void,
  isOpen: boolean
}
```

---

## 13. UTILS

### 13.1 ipcWrapper (210 linhas)

```typescript
// Wrapper com error handling consistente
async function invokeIpc<T>(channel, args?, options?: {
  onLog?, onSuccess?, onFinally?, successMessage?, silentSuccess?
}): Promise<T | null>

// Multiplas chamadas sequenciais
async function invokeIpcSequence<T>(calls[], globalOptions): Promise<T[]>

// Listener com auto-cleanup (para useEffect)
function listenIpc<T>(channel, callback): () => void  // retorna cleanup

// Hook React com loading state
function useIpc(globalOptions): { invoke, isLoading }
```

### 13.2 fileTypes (87 linhas)

```typescript
const FILE_EXTENSIONS = {
  text: ['txt', 'log'],
  markdown: ['md'],
  code: ['json', 'js', 'ts', 'tsx', 'py', 'html', 'css', 'jsx', 'xml', 'yaml', 'yml'],
  subtitle: ['srt', 'vtt'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma'],
  video: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv'],
}

function getFileExtension(filePath): string
function getFileCategory(filePath): FileCategory
function getLanguageFromExtension(ext): string
function getCategoryLabel(category): string
```

### 13.3 activityLogger (99 linhas)

```typescript
class ActivityLogger {
  private logs: LogEntry[] = []     // max 500
  private listeners: Function[] = []

  log(type, category, message, details?)
  action(category, message, details?)
  error(category, message, details?)
  info/success/warning(...)
  getLogs(): LogEntry[]
  clear()
  subscribe(fn): () => void        // retorna cleanup
}

export const logger = new ActivityLogger()  // singleton
```

### 13.4 performanceHelpers (201 linhas)

```typescript
function shallowCompare<P>(prevProps, nextProps): boolean
function compareIgnoringFunctions<P>(prevProps, nextProps): boolean
function memoPanel<P>(Component, displayName?): MemoExoticComponent
function memoListItem<P>(Component, displayName?): MemoExoticComponent
function withRenderLog<P>(Component, name): ComponentType  // dev only
function useRenderCounter(name, threshold=10, timeWindow=1000)
function useDebounce<T>(value, delay): T
function useThrottle<T>(value, interval): T
```

---

## 14. PRELOAD (229 linhas)

### 14.1 Canais Permitidos (Invoke)

169 canais permitidos para `ipcRenderer.invoke()`:
- Projeto: analyze-project, sync-project, undo-changes, detect-capcut-folder, scan-projects, etc.
- Timeline: timeline-get-segments, timeline-reorder-segments, timeline-delete-segment, etc.
- Media: insert-media-batch, insert-director-scenes, link-director-media, etc.
- SRT: insert-srt, insert-srt-batch, create-srt-from-script, load-project-subtitles, etc.
- Workspace: manage-workspaces, manage-workspace-projects
- File: list-directory-tree, read-file-content, write-file-simple, etc.
- Dialog: dialog:openFile, dialog:openFolder, prompt-dialog, confirm-dialog
- Config: get-config, set-config, get-app-version

### 14.2 Canais Permitidos (Listen)

- `project-file-changed`: mudanca no draft_content.json (file watcher)
- `project-progress`: progresso de operacoes longas
- `file:changed`: mudanca em arquivos monitorados
- Outros: update events, media-import-progress, etc.

### 14.3 API Exposta

```javascript
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, ...args) => {
      if (ALLOWED_INVOKE_CHANNELS.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args)
      }
      return Promise.reject(new Error(`Canal IPC nao permitido: ${channel}`))
    },
    on: (channel, callback) => {
      if (ALLOWED_LISTEN_CHANNELS.includes(channel)) {
        const subscription = (_event, ...args) => callback(...args)
        ipcRenderer.on(channel, subscription)
        return () => ipcRenderer.removeListener(channel, subscription)
      }
    },
    removeAllListeners: (channel) => { ... },
    send: (channel, ...args) => { ... }
  }
})
```

---

## 15. TYPES (src/types.ts)

```typescript
export type TrackType = 'video' | 'audio' | 'text' | 'subtitle' | 'effect' | 'filter'

export interface Segment {
  id: string
  material_id: string
  target_timerange: TimeRange
  source_timerange?: TimeRange
}

export interface TimeRange {
  start: number         // microsegundos
  duration: number      // microsegundos
}

export interface TrackInfo {
  index: number
  type: TrackType
  segments: number          // contagem
  duration: number          // total em microsegundos
  durationSec: number       // total em segundos
  name: string              // derivado do primeiro segment
  segmentsData: Segment[]   // segments enriquecidos
}
```

---

## 16. COMPONENTES LAYOUT

### 16.1 ActivityBar (282 linhas)

Barra lateral vertical estilo VS Code.

```typescript
type TabType = 'home' | 'browser' | 'context' | 'remotion' | 'tts' |
  'merge' | 'tradutor' | 'search' | 'aitools' | 'epidemic' | 'lipsync' | 'resumo' | 'config'
```

- 11 items principais + 1 bottom (Config)
- Items fixos: Files sidebar + Claude Chat sidebar
- Freemium gating: `isFeatureAccessible(featureId, planTier)`
- Tabs bloqueadas: Lock icon badge + onUpgradeRequired
- Active indicator: Framer Motion layoutId="activeIndicator"
- Colapsavel: icons-only (48px) ou expanded com labels (160px)
- Keyboard shortcuts: F2-F12 + Ctrl+R
- requiresProject: algumas tabs so aparecem com projeto aberto

### 16.2 TabBar (190 linhas)

Tabs de projetos abertos com:
- Drag-reorder entre tabs
- Close button (X)
- Active indicator (bottom border primary)
- Truncate de nomes longos

### 16.3 TitleBar (372 linhas)

Titlebar customizado com:
- Traffic lights (minimize, maximize, close)
- App name + versao
- Window controls

### 16.4 FileTreeSidebar (1.269 linhas)

Browser de arquivos completo com:
- Tree recursivo via `TreeNodeComponent` com lazy loading
- Deteccao de tipo por extensao: audio (roxo), video (azul), image (verde), srt (amarelo), json (laranja)
- Context menu por tipo de arquivo com 30+ acoes
- IPC channels usados: list-directory-tree, list-directory-children, open-folder-in-explorer, prompt-dialog, write-file-simple, create-folder, insert-media-folder, insert-media-single, dialog:openFile, copy-file, rename-file-or-folder, confirm-dialog, delete-file, read-file-content, flow:send-command, create-srt-from-script, insert-srt-sequential, dialog:save-stems, ai:mark-characters
- Auto-reload via evento `file:changed`
- Expanded paths preservados entre reloads

### 16.5 ProjectsSidebar (595 linhas)

Project picker sidebar com:
- Search por nome
- Filtro por workspace
- Recent projects
- Context menu por projeto

### 16.6 WelcomeScreen (144 linhas)

Tela home com:
- Logo video animado
- Recent projects (max 5) com formatacao relativa PT-BR
- Botoes: Open Project / New Project
- Link para selecao manual de pasta
- Card de noticias com gradient

---

## 17. FUNCOES PYTHON DETALHADAS

### 17.1 Templates JSON (python_src/templates/)

Templates usados para criar materials e segments CapCut:
- `text_material.json`: material de texto completo com todos os campos
- `text_segment.json`: segment de texto com clip, transform, etc.
- `text_animation.json`: animacao de texto (fade in/out)
- Outros templates para video, audio, etc.

Templates sao carregados via `_load_template(name)` com cache em memoria. Sempre retorna deep copy para evitar mutacao.

### 17.2 Criacao de Material de Texto (sync_engine.py)

```python
def criar_material_texto(texto, font_size=7.0, is_subtitle=True, group_id=None):
    template = _load_template('text_material')

    mat_id = str(uuid.uuid4()).upper()
    template['id'] = mat_id
    template['value']['text_content'] = texto

    # Configurar como subtitle ou texto normal
    if is_subtitle:
        template['value']['type'] = 'subtitle'

    # group_id para agrupar legendas na mesma "camada"
    if group_id:
        template['value']['group_id'] = group_id

    return mat_id, template
```

### 17.3 Criacao de Segment de Texto (sync_engine.py)

```python
def criar_segmento_texto(mat_id, start, duration, y_pos=0.8, render_index=0, track_render_index=0):
    seg_template = _load_template('text_segment')
    anim_template = _load_template('text_animation')

    seg_id = str(uuid.uuid4()).upper()
    anim_id = str(uuid.uuid4()).upper()

    seg_template['id'] = seg_id
    seg_template['material_id'] = mat_id
    seg_template['target_timerange'] = {'start': start, 'duration': duration}
    seg_template['source_timerange'] = {'start': 0, 'duration': duration}

    # Posicao Y (0.8 = parte inferior da tela)
    seg_template['clip']['transform']['position_y'] = y_pos

    anim_template['id'] = anim_id
    # Linkar animacao ao segment via extra_material_refs

    return seg_template, anim_template
```

### 17.4 Sync Project - Fluxo Completo (sync_engine.py)

```python
def sync_project(draft_path, audio_track_index=0, mode='audio',
                 sync_subtitles=True, apply_animations=False):

    draft = json.loads(open(draft_path).read())

    # 1. Identificar audio track
    audio_track = None
    audio_tracks = [t for t in draft['tracks'] if t['type'] == 'audio']
    if audio_track_index < len(audio_tracks):
        audio_track = audio_tracks[audio_track_index]

    # 2. Remover gaps de audio (recalcular start sequencial)
    current_pos = 0
    for seg in audio_track['segments']:
        seg['target_timerange']['start'] = current_pos
        current_pos += seg['target_timerange']['duration']

    # 3. Sync video com audio
    video_tracks = [t for t in draft['tracks'] if t['type'] == 'video']
    if video_tracks:
        video_track = video_tracks[0]
        # Ajustar cada video segment para match com audio
        for i, audio_seg in enumerate(audio_track['segments']):
            if i < len(video_track['segments']):
                video_seg = video_track['segments'][i]
                video_seg['target_timerange']['start'] = audio_seg['target_timerange']['start']
                video_seg['target_timerange']['duration'] = audio_seg['target_timerange']['duration']

    # 4. Sync subtitles (se habilitado)
    if sync_subtitles:
        text_tracks = [t for t in draft['tracks'] if t['type'] in ['text', 'subtitle']]
        # Ajustar timing de legendas para alinhar com audio

    # 5. Apply Ken Burns (se habilitado)
    if apply_animations:
        for track in video_tracks:
            for seg in track['segments']:
                # Verificar se e foto (type=photo no material)
                pattern = random.choice(ANIMATION_PATTERNS)
                keyframes = pattern(seg['target_timerange']['duration'])
                seg['common_keyframes'] = keyframes

    # 6. Salvar
    open(draft_path, 'w').write(json.dumps(draft))
    return {'success': True, 'message': '...'}
```

### 17.5 Insert SRT - Matching por Basename (sync_engine.py)

```python
def insert_srt(draft_path, create_title=False, selected_file_paths=None,
               srt_folder='', selected_files=None, separate_tracks=False):

    draft = json.loads(open(draft_path).read())

    # Coletar arquivos SRT
    srt_files = selected_file_paths or [os.path.join(srt_folder, f) for f in selected_files]

    # Encontrar audio segments para matching
    audio_tracks = [t for t in draft['tracks'] if t['type'] == 'audio']

    for srt_path in srt_files:
        srt_basename = os.path.splitext(os.path.basename(srt_path))[0]
        subtitles = parse_srt(srt_path)

        # Encontrar audio segment com mesmo basename
        matched_audio = None
        for track in audio_tracks:
            for seg in track['segments']:
                mat = find_material(draft, seg['material_id'])
                audio_name = os.path.splitext(os.path.basename(mat['path']))[0]
                if audio_name == srt_basename:
                    matched_audio = seg
                    break

        if not matched_audio:
            continue

        # Criar text track (novo ou existente)
        text_track_index = find_or_create_text_track(draft, separate_tracks)

        # Inserir cada legenda como material + segment
        audio_start = matched_audio['target_timerange']['start']
        for sub in subtitles:
            mat_id, mat = criar_material_texto(sub['text'])
            draft['materials']['texts'].append(mat)

            seg, anim = criar_segmento_texto(
                mat_id,
                audio_start + sub['start'],
                sub['duration']
            )
            draft['tracks'][text_track_index]['segments'].append(seg)
            draft['materials']['text_animations'].append(anim)

    open(draft_path, 'w').write(json.dumps(draft))
```

### 17.6 Insert Media Batch (sync_engine.py)

```python
def insert_media_batch(draft_path, media_files, image_duration=5000000,
                       media_files_with_duration=None):

    draft = json.loads(open(draft_path).read())

    # Encontrar ou criar video track
    video_track_index = find_or_create_track(draft, 'video')

    current_pos = get_track_end_time(draft, video_track_index)

    for file_info in (media_files_with_duration or media_files):
        file_path = file_info if isinstance(file_info, str) else file_info['path']
        duration = file_info.get('duration', image_duration) if isinstance(file_info, dict) else image_duration

        # Detectar tipo
        ext = os.path.splitext(file_path)[1].lower()
        is_image = ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
        is_video = ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm']

        if is_video:
            info = get_media_info(file_path)
            duration = info.get('duration', 5000000)

        # Criar material
        mat_id, mat = criar_material_video(file_path, duration, ...)
        draft['materials']['videos'].append(mat)

        # Criar materiais auxiliares (6 para video)
        aux_mats = criar_materiais_auxiliares_video()
        for aux in aux_mats:
            draft['materials'][aux['category']].append(aux['material'])

        # Criar segment
        seg = criar_segmento_video(mat_id, current_pos, duration, ...)
        draft['tracks'][video_track_index]['segments'].append(seg)

        current_pos += duration

    open(draft_path, 'w').write(json.dumps(draft))
```

---

## APENDICE: Dependencias Cross-File Python

```
context_analyzer.py  --importa-->  capcut_editor.py (CapCutProject)
sync_engine.py       --usa-->      templates/ (mesmos templates de capcut_editor)
audio_mixer.py       --usa-->      pydub
track_generator.py   --usa-->      pydub, requests (Freesound API)
content_creator.py   --usa-->      google.genai (Gemini API)
dialog_stem_parser.py              standalone
video_planner.py                   standalone
project_manager.py                 standalone
```

## APENDICE: Padroes de Comunicacao Python

| Arquivo | Input | Output | Progresso |
|---------|-------|--------|-----------|
| capcut_editor.py | argparse CLI | stdout texto | N/A |
| sync_engine.py | sys.argv[1] JSON ou --file | stdout JSON | stderr debug |
| content_creator.py | sys.argv[1] JSON ou --file | stdout JSON | File-based polling + logging |
| project_manager.py | sys.argv[1] JSON ou --file | stdout JSON | stderr JSON progress |
| track_generator.py | argparse (--config, --narration, --output) | stdout JSON | Logging |
| video_planner.py | sys.argv[1] JSON ou --file | stdout JSON | stderr JSON progress |
| context_analyzer.py | CLI flags (--get-subtitles, etc.) | stdout JSON | stderr debug |
| dialog_stem_parser.py | CLI flags (--parse, --save, etc.) | stdout JSON | N/A |
| audio_mixer.py | args posicionais (timeline.json, output.mp3) | stdout JSON | stdout logging |
