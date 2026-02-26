# MEU PIPELINE STUDIO

Studio de pre-edicao automatizada para CapCut. Transforma um roteiro em texto em um projeto CapCut completo com legendas sincronizadas, audio e midias posicionadas na timeline.

## Framework DOE

Este projeto segue o Framework **DOE** (Directives, Orchestration, Executions):

- **Directives** (`/directives`) - Visao estrategica, regras de negocio e playbook do projeto. Antes de codificar, LEIA as diretrizes relevantes em `directives/regras_do_projeto.md`.
- **Orchestration** - O agente orquestrador (voce) gerencia a criacao de arquivos e a logica do sistema, baseado nas diretrizes.
- **Executions** (`/executions`) - Scripts Python operacionais e deterministicos. Todo codigo Python do projeto vive aqui.

Documento de governanca: `Agents.md` (raiz do projeto).

## Stack

- **Electron 39** (electron-vite 5) - app desktop com acesso ao filesystem
- **React 19** + **TypeScript 5.9** - renderer
- **Tailwind CSS v4** - estilizacao (CSS-first @theme, sem tailwind.config.js)
- **Zustand 5** - estado global (7 stores: project, stage, ui, log, workspace, veo3, veo3Automation)
- **Framer Motion 11** - animacoes e transicoes (AnimatePresence, motion.div)
- **Lucide React** - icones SVG
- **Python 3.10+** - manipulacao do draft_content.json do CapCut (child_process, JSON-line protocol)

## Pipeline (5 Stages)

| Stage | O Que Faz | Lib/Modulo | Componente |
|-------|-----------|------------|------------|
| 1. Script | Roteiro -> blocos de legenda | `scriptSplitter.ts` | Stage1Script |
| 2. Audio | TTS multi-provider (Google, ElevenLabs, MiniMax) | Python `tts_generator.py` + `capcut_reader.py` | Stage2Audio |
| 3. Sync | Sincroniza texto + audio | `syncEngine.ts` | Stage3Sync |
| 4. Director | Config, planejamento, prompts, import, insercao | `sceneGrouper.ts` + `capcut_writer.py` | Stage4Director |
| 5. Veo3 | Geracao de video com Veo3 via browser automation | `flowCommandBuilder.ts` + injectors JS | Stage5Veo3 |

### Stage 4 Sub-steps

| Step | Nome | O Que Faz |
|------|------|-----------|
| 0 | Configuracao | Configura chapters, scene grouping |
| 1 | Planejamento | Planeja cenas com LLM |
| 2 | Prompts | Gera prompts para cada cena |
| 3 | Importacao | Importa e associa midias as cenas |
| 4 | Insercao | Insere texto+video no CapCut (backup, clear, write, sync) |

## Estrutura do Projeto

```
src/main/
  index.ts                     - Electron entry, inicia Python bridge + registra IPC
  python/bridge.ts             - Python process manager (spawn, JSON-line)
  services/ai33.service.ts     - Wrapper da API ai33.pro (ElevenLabs, MiniMax, SFX, gen)
  ipc/handlers.ts              - Registro central de IPC handlers
  ipc/capcut.handlers.ts       - read-audio-blocks, write-text/video-segments, sync-metadata
  ipc/file.handlers.ts         - Selecao de arquivos (dialog)
  ipc/project.handlers.ts      - Selecao de draft, paths
  ipc/workspace.handlers.ts    - CRUD de workspaces, load/save status
  ipc/director.handlers.ts     - Planejamento LLM, scene grouping
  ipc/tts.handlers.ts          - Google TTS, CapCut local TTS
  ipc/ai33.handlers.ts         - 25+ handlers para ai33.pro API
  ipc/veo3.handlers.ts         - Browser control, injector comms
  ipc/draft-watcher.ts         - File watcher bidirecional no draft_content.json
  veo3/injectors/              - Scripts JS injetados no browser (automacao Veo3)

src/preload/
  index.ts                     - contextBridge API
  index.d.ts                   - Tipos do preload para renderer

src/renderer/src/
  App.tsx                      - Root component (AppLayout + ToastContainer)
  stores/
    useProjectStore.ts         - Dados do projeto (draft, blocks, scenes, recentProjects)
    useStageStore.ts           - Stage atual, navegacao
    useUIStore.ts              - Estado de UI (currentView, loading, timeline)
    useLogStore.ts             - Logs do app
    useWorkspaceStore.ts       - Workspace/project selection, CRUD
    useVeo3Store.ts            - Videos, contas e comandos Veo3
    useVeo3AutomationStore.ts  - Estado da automacao Veo3
  types/
    project.ts                 - StoryBlock, AudioBlock, Scene, etc.
    capcut.ts                  - Tipos do draft_content.json
    ipc.ts                     - Tipos de IPC
    ai33.ts                    - Tipos da API ai33.pro
    tts.ts                     - Tipos de resposta TTS
    veo3.ts                    - Tipos Veo3
    workspace.ts               - Tipos de workspace
  lib/
    scriptSplitter.ts          - Stage 1: split de roteiro em blocos
    syncEngine.ts              - Stage 3: sincronizacao texto+audio
    sceneGrouper.ts            - Stage 4: agrupamento de cenas
    scenePlanner.ts            - Planejamento de cenas + deteccao de gaps
    promptTemplate.ts          - Template de prompts + parsing LLM
    promptValidator.ts         - Validacao de qualidade de prompts
    characterParser.ts         - Extracao de personagens
    flowCommandBuilder.ts      - Builder de comandos Veo3
    time.ts                    - Conversoes de tempo (ms, us, SRT format)
    srt.ts                     - Parsing/geracao SRT
    constants.ts               - Constantes do app
    ipcWrapper.ts              - Wrapper tipado para IPC calls
  components/
    layout/                    - AppLayout, HomeScreen, PipelineWorkspace, TopBar, StageProgress, StatusBar
    shared/                    - Button, TextArea, Input, Select, Badge, Modal, Toast, ProgressBar, DataTable, SettingsModal
    timeline/                  - TimelinePanel, TimelineTrack, TimelineSegment, TimelineRuler
    stages/stage1/             - ScriptInput, BlocksPreview, Stage1Script
    stages/stage2/             - DraftSelector, AudioBlocksList, Stage2Audio
    stages/stage3/             - SyncPreview, Stage3Sync
    stages/stage4/             - DirectorStepper, DirectorConfigPanel, ScenePlannerPanel, PromptStudio, MediaImporter, InsertPanel, Stage4Director
    stages/stage5/             - Stage5Veo3, Veo3Browser, Veo3Toolbar, Veo3Sidepanel, Veo3AccountManager
    ai-tools/                  - Ai33ToolsPanel, Ai33TaskManager
    projects/                  - ProjectCard, ProjectDashboard, modais
    workspace/                 - WorkspaceCard, CreateModal

executions/
  main_bridge.py               - Entry point do processo Python (29 metodos)
  capcut_reader.py             - Leitura de draft_content.json
  capcut_writer.py             - Escrita de segmentos no CapCut
  metadata_sync.py             - Sync de metadata (draft_meta_info, root_meta_info)
  srt_generator.py             - Geracao de arquivos SRT
  sync_engine.py               - Sync engine (gap removal, Ken Burns animations)
  tts_generator.py             - Geracao TTS (Google Cloud, CapCut local)
  llm_director.py              - Planejamento de cenas com LLM
  media_matcher.py             - Matching de midias com cenas
  draft_io.py                  - I/O de arquivos draft
  debug_tools.py               - Ferramentas de debug/inspecao
  template_loader.py           - Loader de templates JSON do CapCut
  templates/                   - Templates JSON (text_material, text_segment, text_animation)
  requirements.txt             - Dependencias Python

directives/
  regras_do_projeto.md         - Visao estrategica, regras de negocio, playbook do projeto
```

## Convencoes

### Linguagem
- Comunicacao com o usuario: portugues brasileiro
- Codigo (variaveis, funcoes, comentarios): ingles
- Nomes de arquivos: ingles, camelCase para TS/TSX, snake_case para Python
- Sem emojis em nenhum lugar (codigo, UI, commits, comentarios)

### TypeScript / React
- Componentes: PascalCase, um componente por arquivo
- Hooks customizados: prefixo `use`, em `src/renderer/src/hooks/`
- Tipos centralizados em `src/renderer/src/types/` (source of truth unico)
- Stores Zustand em `src/renderer/src/stores/`
- Imports com alias `@/` -> `src/renderer/src/`
- Imports com alias `@main/` -> `src/main/`
- Sem default exports (usar named exports)
- Interfaces preferidas sobre types para objetos
- Icones via `lucide-react` (nunca unicode/emoji)

### Python
- Python 3.10+
- snake_case para funcoes e variaveis
- Docstrings em ingles
- Comunicacao com Node via stdin/stdout JSON-line protocol
- Cada resposta: `{"id": "...", "result": ...}` ou `{"id": "...", "error": {"message": "..."}}`
- Flush stdout apos cada write

### Estilo Visual
- Cor primaria: indigo-500 (#6366F1, azul-roxo)
- Primary hover: #4F46E5
- Primary light: #818CF8
- Background: #09090B (quase preto)
- Surface: #111113
- Border: #27272A
- Texto: #FAFAFA, muted: #A1A1AA
- Font base: 14px (compacto)
- Dark theme only
- Gradientes: gradient-primary (indigo->violet), gradient-card
- Sombras: shadow-glow (azul-roxo), shadow-glow-sm
- Animacoes: Framer Motion (AnimatePresence, motion.div, whileHover, whileTap)

### CapCut
- Unidade interna do CapCut: microsegundos (us)
- Unidade da API/UI do app: milissegundos (ms)
- Conversao: us = ms * 1000
- NUNCA reescrever draft_content.json inteiro - ler, modificar campos especificos, salvar
- SEMPRE chamar syncMetadata apos qualquer escrita no draft
- NUNCA alterar texto de legendas existentes durante sincronizacao
- NUNCA alterar segmentos de audio existentes durante insercao de midias
- Preservar todos os campos desconhecidos do JSON do CapCut
- draft_content.json pode ter 1-10MB+ - nunca ler com Read tool, usar Python

### IPC
- Renderer -> Main: ipcRenderer.invoke (async, promise-based)
- Main -> Renderer: webContents.send (eventos de progresso)
- Main -> Python: spawn + stdin/stdout JSON-line
- Canais IPC nomeados com namespace: "project:", "capcut:", "audio:", "file:", "workspace:", "ai33:", "tts:", "director:", "veo3:"

## Comandos

```bash
npm run dev            # Dev mode com HMR
npm run build          # Build de producao (com typecheck)
npm run build:win      # Build + empacotamento Windows
npm run build:unpack   # Build + electron-builder preview
npm run lint           # ESLint
npm run typecheck      # Typecheck completo (node + web)
npm run format         # Prettier
```

## Bugs Conhecidos

1. ~~**updateSubtitleTimings recebe IDs errados**~~ - CORRIGIDO. Agora usa textMaterialId no StoryBlock.
2. ~~**Insercao duplicada no Stage 4**~~ - CORRIGIDO. InsertPanel faz clear antes de reinsercao.
3. ~~**Reset incompleto do Sidebar**~~ - CORRIGIDO. TopBar.handleGoHome agora chama `resetProject()` + `reset()` + `setCurrentView('home')`.

## Paths Importantes

- Projetos CapCut: `C:/Users/ander/AppData/Local/CapCut/User Data/Projects/com.lveditor.draft/`
- draft_content.json: arquivo principal do projeto CapCut
- draft_meta_info.json: metadata do projeto (campo `"draft_timeline_materials_size_"` COM underscore)
- root_meta_info.json: metadata raiz (campo `"draft_timeline_materials_size"` SEM underscore)

## Documentacao

- `Agents.md` - Framework DOE (Directives, Orchestration, Executions) - governanca do projeto
- `directives/regras_do_projeto.md` - Regras de negocio, visao estrategica e playbook do projeto
- `spec.md` - Especificacao tecnica e roadmap de implementacao (ferramentas, dependencias, ordem de prioridade)
- `prd.md` - Documento de pesquisa completo (referencia bruta, nao filtrado)
