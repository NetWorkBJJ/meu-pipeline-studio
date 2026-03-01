# TODO - MEU PIPELINE STUDIO

## Legenda
- [ ] Pendente
- [x] Concluido
- P0 = Critico | P1 = Alta | P2 = Media | P3 = Baixa

---

## Infraestrutura & DX

### Auto-Updater (branch feat/auto-downloads) [P0]
- [ ] Configurar dev-app-update.yml (vazio atualmente)
- [ ] Testar fluxo de update end-to-end
- [ ] Adicionar logging no catch silencioso de updater.ts:12
- [ ] Configurar GitHub Actions para build + publish releases

### Python Bridge Hardening [P1]
- [ ] Timeout configuravel (default 30s) para chamadas ao bridge
- [ ] Restart automatico com backoff exponencial (max 3 tentativas) apos crash
- [ ] Health check periodico do processo Python

### Typed IPC [P2]
- [ ] Criar IpcChannelMap completo em src/renderer/src/types/ipc.ts
- [ ] Implementar typedInvoke helper no preload
- [ ] Migrar todos os ipcRenderer.invoke para usar tipagem

### Build & Deploy [P1]
- [ ] GitHub Actions workflow (build Windows + macOS)
- [ ] Semantic versioning (sincronizar package.json + git tags)
- [ ] Code signing para macOS (notarization)
- [ ] Testar build:mac end-to-end

### Persistencia de Estado [P1]
- [ ] Zustand persist middleware no useProjectStore (partialize dados essenciais)
- [ ] electron-store para config do main process (paths, prefs TTS, window bounds)
- [ ] Migrar localStorage manual para persist middleware

---

## UI & UX

### shadcn/ui Migration [P2]
- [ ] npx shadcn@latest init (configurar com nossas cores dark theme)
- [ ] Migrar Button, Input, Select, Dialog, Badge, Progress, Textarea
- [ ] Adicionar Tabs, Tooltip, Sheet, Command (Ctrl+K palette)
- [ ] Remover componentes shared/ substituidos

### Sonner Toast [P2]
- [ ] npm install sonner
- [ ] Substituir shared/Toast.tsx + useUIStore toast logic
- [ ] Adicionar Toaster no App.tsx

### Zustand Middleware [P3]
- [ ] Immer middleware para updates imutaveis simplificados
- [ ] Devtools middleware para debug (dev only)

### Command Palette [P3]
- [ ] npm install cmdk
- [ ] Ctrl+K para navegacao rapida entre stages, projetos, busca

### Drag & Drop [P3]
- [ ] npm install @dnd-kit/core @dnd-kit/sortable
- [ ] Reordenar blocos no Stage 1
- [ ] Reordenar cenas no Stage 4
- [ ] Drag de arquivos para MediaImporter

---

## TTS & Audio

### Edge TTS (Default Gratuito) [P1]
- [ ] pip install edge-tts
- [ ] Novo tab no Stage 2: "Edge TTS (Gratis)"
- [ ] Vozes PT-BR: AntonioNeural, FranciscaNeural, ThalitaNeural
- [ ] Gerar SRT word-level junto com audio
- [ ] Controle de velocidade, pitch, volume via SSML

### Audio Visualization [P2]
- [ ] npm install wavesurfer.js
- [ ] Waveform visual no Stage 3 (SyncPreview)
- [ ] Regions interativas para ajuste manual de timing
- [ ] Player integrado com timeline

---

## Processamento de Midia

### FFmpeg Integration [P2]
- [ ] npm install fluent-ffmpeg + ffmpeg-static-electron
- [ ] Extrair duracao/resolucao de videos importados
- [ ] Gerar thumbnails para preview
- [ ] Converter formatos audio (WAV -> MP3)

### Sharp (Image Processing) [P3]
- [ ] npm install sharp
- [ ] Thumbnails de imagens no MediaImporter
- [ ] Otimizar imagens antes de inserir no CapCut

---

## Stock Media & APIs

### Stock Media APIs [P2]
- [ ] Integrar Pexels API (primario, gratis, 3M+ videos/fotos)
- [ ] Integrar Unsplash API (secundario, fotos esteticas)
- [ ] Integrar Pixabay API (fallback, multimedia + musica)
- [ ] UI de busca no MediaImporter (Stage 4, sub-step 3)
- [ ] Download + cache local de midias

---

## Transcricao & NLP

### Transcricao de Audio [P2]
- [ ] Integrar faster-whisper ou WhisperX
- [ ] Gerar SRT word-level a partir de audio existente
- [ ] UI de transcricao no Stage 2 (tab "Transcrever Audio")

### NLP & Analise de Roteiro [P3]
- [ ] spaCy NER para entidades (pessoas, locais)
- [ ] Sentiment analysis por bloco (mood da cena)
- [ ] Keyword extraction automatica para Stage 4

---

## Geracao de Midia com IA

### Video Generation [P3]
- [ ] Integrar Runway Gen-4.5 API (text-to-video)
- [ ] Integrar Pika Video API via fal.ai
- [ ] UI de geracao no Stage 4 (sub-step Prompts)

### Image Generation [P3]
- [ ] DALL-E 3 / GPT Image 1 para capas e visuais
- [ ] Stable Diffusion local (ComfyUI) como alternativa gratis

### Music Generation [P3]
- [ ] Integrar Suno API (terceiros) para trilha sonora
- [ ] Integrar Udio para fundo musical por cena

---

## Testes

### Testes Python (pytest) [P1]
- [ ] Completar test/python/ (8 arquivos criados, validar cobertura)
- [ ] CI: rodar pytest no GitHub Actions

### Testes E2E (Playwright) [P1] -- EM ANDAMENTO (sessao paralela)
- [ ] Organizacao e fragmentacao sendo feita em sessao separada
- [ ] CI: rodar Playwright no GitHub Actions (pendente apos organizacao)

### Testes Unitarios (Vitest) [P2]
- [ ] Expandir cobertura dos 10 test files existentes
- [ ] Adicionar testes para flowCommandBuilder.ts
- [ ] Adicionar testes para characterParser.ts
- [ ] Adicionar testes para ipcWrapper.ts

---

## Documentacao & Organizacao

### Atualizar regras_do_projeto.md [P1]
- [ ] Pipeline de 6 stages -> 5 stages (com sub-steps do Stage 4)
- [ ] Documentar Stage 5 (Veo3)
- [ ] Documentar integracoes: ai33.pro, ClickUp, Veo3
- [ ] Adicionar regras cross-platform (paths, shell, executaveis)
- [ ] Adicionar namespaces IPC completos

### .claude/rules/ (Regras Condicionais) [P2]
- [ ] react-components.md (globs: components/**/*.tsx)
- [ ] python-bridge.md (globs: executions/**/*.py)
- [ ] capcut-safety.md (globs: capcut_*.py, capcut*.ts)

### Limpeza de Projeto [P2]
- [ ] Auditar componentes shared/ orfaos (definidos mas nao usados)
- [ ] Remover codigo morto residual
- [ ] Organizar test/ - separar screenshots das specs
- [ ] Mover screenshots de test (70+ PNGs) para test/screenshots/

---

## Seguranca

### Path Hardcoding [P1]
- [ ] Resolver paths hardcoded (directives/prd-dynamic-capcut-paths.md)
- [ ] Usar workspace config + dynamic fallback em todos os handlers

### Electron Security [P3]
- [ ] Validar todos os paths recebidos do renderer antes de usar no filesystem
- [ ] Avaliar sandbox: true quando possivel
- [ ] CSP audit no index.html
