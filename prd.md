# PRD - MEU PIPELINE STUDIO

Documento de pesquisa e referencia. Acumulo maximo de informacoes para transformar o app em produto top de linha.

---

## Indice

1. [Visao do Produto](#1-visao-do-produto)
2. [Estado Atual do Projeto](#2-estado-atual-do-projeto)
3. [Ecossistema CapCut e Ferramentas](#3-ecossistema-capcut-e-ferramentas)
4. [Stack Frontend - UI/UX](#4-stack-frontend---uiux)
5. [Stack Electron - Desktop](#5-stack-electron---desktop)
6. [Text-to-Speech (TTS)](#6-text-to-speech-tts)
7. [IA e Analise de Cenas](#7-ia-e-analise-de-cenas)
8. [Processamento de Midia](#8-processamento-de-midia)
9. [Legendas e Transcricao](#9-legendas-e-transcricao)
10. [NLP e Analise de Roteiro](#10-nlp-e-analise-de-roteiro)
11. [Geracao de Midia com IA](#11-geracao-de-midia-com-ia)
12. [Geracao de Musica com IA](#12-geracao-de-musica-com-ia)
13. [APIs de Midia Stock](#13-apis-de-midia-stock)
14. [Gerenciamento de Assets](#14-gerenciamento-de-assets)
15. [Automacao e Filas de Tarefas](#15-automacao-e-filas-de-tarefas)
16. [Claude Code - CLAUDE.md, Skills, Hooks](#16-claude-code---claudemd-skills-hooks)
17. [MCP - Model Context Protocol](#17-mcp---model-context-protocol)
18. [Claude Agent SDK e Subagentes](#18-claude-agent-sdk-e-subagentes)
19. [Frameworks de Agentes IA](#19-frameworks-de-agentes-ia)
20. [Claude API - Features Avancadas](#20-claude-api---features-avancadas)
21. [Casos de Uso de Agentes no Projeto](#21-casos-de-uso-de-agentes-no-projeto)
22. [Testes e Qualidade](#22-testes-e-qualidade)
23. [Build, Distribuicao e Monitoramento](#23-build-distribuicao-e-monitoramento)
24. [Projetos e Competidores de Referencia](#24-projetos-e-competidores-de-referencia)
25. [Fontes e Links](#25-fontes-e-links)

---

## 1. Visao do Produto

**MEU PIPELINE STUDIO** e um studio de pre-edicao automatizada para CapCut. Transforma um roteiro em texto em um projeto CapCut completo com legendas sincronizadas, audio e midias posicionadas na timeline.

### Problema
Criadores de conteudo gastam horas montando projetos no CapCut manualmente: inserir legendas, sincronizar com audio, posicionar midias, ajustar timings. Esse processo e repetitivo e pode ser automatizado.

### Solucao
Pipeline de 6 estagios que automatiza todo o fluxo:
1. Script -> blocos de legenda (split inteligente)
2. Deteccao de audio do CapCut (TTS existente)
3. Sincronizacao texto + audio
4. Direcao de cena (agrupamento, keywords, tipos)
5. Selecao de midia (arquivo por cena)
6. Insercao no CapCut (texto + video + metadata)

### Publico-Alvo
- Criadores de conteudo que usam CapCut
- Produtores de video em escala (agencias)
- YouTubers, TikTokers, Reels creators

---

## 2. Estado Atual do Projeto

### Arquitetura
- **Electron 39** + electron-vite 5 (main process)
- **React 19** + TypeScript 5.9 (renderer)
- **Tailwind CSS v4** (CSS-first, @theme)
- **Zustand 5** (3 stores: project, stage, ui)
- **Python 3.10+** (bridge JSON-line protocol)

### O Que Funciona
- Todos os 6 estagios implementados e funcionais
- Build e typecheck passam limpos
- Python bridge + IPC conectados para texto e video
- UI basica com dark theme, sidebar, stage navigation

### Bugs Criticos Conhecidos
1. `updateSubtitleTimings` recebe IDs de audio ao inves de IDs de texto (Stage 3)
2. Stage 6 permite insercao duplicada (sem limpeza de segmentos anteriores)
3. Reset do Sidebar chama apenas `useStageStore.reset()` sem `resetProject()`

### Gaps Identificados
- Interfaces duplicadas em 5+ arquivos (StoryBlock, AudioBlock, Scene)
- Componentes shared definidos mas nao usados pelos stages
- Zero testes automatizados
- Sem persistencia de estado (perde tudo ao recarregar)
- Codigo morto: progress events, generate_srt, Character type, mediaPreset, settingsOpen, IpcChannels
- Python bridge sem timeout, restart, ou deteccao de python3
- Path do CapCut hardcoded para um unico usuario
- electron-builder.yml com valores do template (temp-scaffold)

---

## 3. Ecossistema CapCut e Ferramentas

### 3.1 Formato draft_content.json

O arquivo principal de projetos CapCut. Contem toda a timeline, materiais, efeitos, textos, etc.

**Caracteristicas:**
- Tamanho: 1-10MB+ (projetos complexos)
- Formato: JSON com estrutura profundamente aninhada
- Unidade de tempo: microsegundos (us)
- Localizacao: `C:/Users/<user>/AppData/Local/CapCut/User Data/Projects/com.lveditor.draft/<draft_id>/`

**Campos criticos:**
- `tracks[]` - Array de tracks (video, audio, text, sticker, effect)
- `materials.texts[]` - Materiais de texto (legendas)
- `materials.videos[]` - Materiais de video
- `materials.audios[]` - Materiais de audio
- `canvas_config` - Resolucao do projeto (width, height)

**Metadata:**
- `draft_meta_info.json` - Campo `"draft_timeline_materials_size_"` COM underscore final
- `root_meta_info.json` - Campo `"draft_timeline_materials_size"` SEM underscore

### 3.2 pyCapCut

- **URL:** https://github.com/GuanYixuan/pyCapCut
- **O que faz:** Biblioteca Python para leitura e manipulacao de projetos CapCut
- **Funcionalidades:** Leitura de draft_content.json, manipulacao de tracks, materiais
- **Relevancia:** Referencia direta para nosso capcut_reader.py e capcut_writer.py
- **Licenca:** MIT

### 3.3 CapCutAPI

- **URL:** https://github.com/gogelabs/capcutapi
- **O que faz:** API wrapper para interacao com CapCut
- **Relevancia:** Padroes de integracao e manipulacao de projetos
- **Status:** Projeto comunitario

### 3.4 capcut-srt-export

- **URL:** https://github.com/nickelghost/capcut-srt-export
- **O que faz:** Exporta legendas de projetos CapCut para formato SRT
- **Relevancia:** Referencia para nosso srt_generator.py
- **Linguagem:** Python
- **Licenca:** MIT

### 3.5 OpenTimelineIO (OTIO)

- **URL:** https://github.com/AcademySoftwareFoundation/OpenTimelineIO
- **O que faz:** API e formato aberto para troca de timelines entre editores de video
- **Mantido por:** Academy Software Foundation (Linux Foundation)
- **Formatos suportados:** EDL, AAF, FCP XML, Premiere Pro, DaVinci Resolve
- **Relevancia:** Possibilidade futura de exportar timeline para outros editores alem do CapCut
- **Linguagens:** Python (principal), C++ (core)
- **Licenca:** Apache 2.0

### 3.6 CapCut API Oficial

- **Status:** API oficial limitada, focada em templates e efeitos
- **Restricoes:** Nao permite manipulacao direta de draft_content.json via API
- **Abordagem do projeto:** Manipulacao direta do JSON no filesystem (mais poderoso)

### 3.7 CapCut Desktop - Observacoes Tecnicas

- CapCut nao trava arquivos JSON no Windows (pode ler/escrever enquanto CapCut esta aberto)
- CapCut NAO recarrega automaticamente o projeto apos modificacao externa
- Workflow: fechar projeto no CapCut -> modificar JSON -> reabrir
- Backup do draft_content.json antes de qualquer escrita e essencial

---

## 4. Stack Frontend - UI/UX

### 4.1 shadcn/ui

- **URL:** https://ui.shadcn.com/
- **O que e:** Colecao de componentes reutilizaveis construidos com Radix UI + Tailwind CSS
- **Diferencial:** Nao e uma biblioteca - os componentes sao copiados para o projeto, sem dependencia externa
- **Componentes disponiveis:** Button, Dialog, Dropdown, Select, Table, Tabs, Toast, Tooltip, Sheet, Command, Calendar, Form, etc.
- **Instalacao:** `npx shadcn@latest init` + `npx shadcn@latest add <component>`
- **Compatibilidade:** React 18/19, Tailwind CSS v4 (desde v2.3)
- **Temas:** Dark/light mode nativo, customizavel via CSS variables
- **Relevancia:** Substituiria nossos componentes shared com qualidade profissional
- **Licenca:** MIT

### 4.2 Radix UI Primitives

- **URL:** https://www.radix-ui.com/primitives
- **O que e:** Primitivos de UI sem estilo, acessiveis, composiveis
- **Componentes:** Dialog, DropdownMenu, Select, Tooltip, Popover, Accordion, Tabs, etc.
- **Acessibilidade:** WAI-ARIA compliant, keyboard navigation, screen reader support
- **Relevancia:** Base dos componentes shadcn/ui, pode ser usado diretamente tambem
- **Licenca:** MIT

### 4.3 Sonner (Toast)

- **URL:** https://sonner.emilkowal.dev/
- **O que e:** Biblioteca de toast/notificacao para React, opinionada e bonita
- **Features:** Stack de toasts, progress, actions, custom components, promise API
- **Instalacao:** `npm install sonner`
- **API:** `toast('Mensagem')`, `toast.success()`, `toast.error()`, `toast.promise()`
- **Relevancia:** Substituiria nosso Toast.tsx com UX muito superior
- **Tamanho:** ~5kb gzipped

### 4.4 cmdk (Command Palette)

- **URL:** https://cmdk.paco.me/
- **O que e:** Command palette (Ctrl+K) composivel, acessivel, rapido
- **Features:** Fuzzy search, grupos, loading states, dialog mode
- **Instalacao:** `npm install cmdk`
- **Relevancia:** Navegacao rapida entre stages, busca de projetos, atalhos
- **Usado por:** Vercel, Linear, Raycast

### 4.5 Motion (ex Framer Motion)

- **URL:** https://motion.dev/
- **O que e:** Biblioteca de animacao para React
- **Features:** Layout animations, gestures, scroll-triggered, exit animations, shared layout
- **Instalacao:** `npm install motion`
- **API:** `<motion.div animate={{ opacity: 1 }} />`
- **Relevancia:** Transicoes entre stages, feedback visual, animacoes de lista
- **Tamanho:** ~33kb gzipped (tree-shakeable)

### 4.6 TanStack Table (ex React Table)

- **URL:** https://tanstack.com/table/latest
- **O que e:** Headless table/datagrid para React
- **Features:** Sorting, filtering, pagination, column resizing, row selection, virtualization
- **Instalacao:** `npm install @tanstack/react-table`
- **Relevancia:** Substituiria nossas tabelas inline (BlocksPreview, AudioBlocksList, SyncPreview)
- **Performance:** Virtualiza 100k+ linhas sem lag

### 4.7 dnd-kit (Drag and Drop)

- **URL:** https://dndkit.com/
- **O que e:** Toolkit moderno de drag-and-drop para React
- **Features:** Sortable lists, grid, kanban, multi-container, collision detection, keyboard accessible
- **Instalacao:** `npm install @dnd-kit/core @dnd-kit/sortable`
- **Relevancia:** Reordenar blocos de texto, cenas, midias; drag de arquivos para o app
- **Performance:** Zero re-renders fora dos itens movidos

### 4.8 Lucide React (Icones)

- **URL:** https://lucide.dev/
- **O que e:** Colecao de 1500+ icones SVG consistentes
- **Instalacao:** `npm install lucide-react`
- **API:** `<Play size={16} />`, `<FileVideo />`, `<Music />`, etc.
- **Relevancia:** Substituiria nossos icones unicode (checkmark, X) com icones profissionais
- **Tamanho:** Tree-shakeable, ~200 bytes por icone

### 4.9 React Hook Form + Zod

- **URL:** https://react-hook-form.com/ + https://zod.dev/
- **O que e:** Gerenciamento de forms + validacao de schema
- **Relevancia:** Formularios de configuracao, settings, input de roteiro com validacao
- **Performance:** Minimal re-renders via uncontrolled components

### 4.10 Zustand Middleware

**Persist (persistencia de estado):**
```typescript
import { persist } from 'zustand/middleware'

const useProjectStore = create(
  persist(
    (set) => ({ ... }),
    { name: 'project-storage' } // localStorage key
  )
)
```

**Immer (atualizacao imutavel simplificada):**
```typescript
import { immer } from 'zustand/middleware/immer'

const useStore = create(immer((set) => ({
  storyBlocks: [],
  updateBlock: (id, changes) => set((state) => {
    const block = state.storyBlocks.find(b => b.id === id)
    if (block) Object.assign(block, changes)
  })
})))
```

**Devtools:**
```typescript
import { devtools } from 'zustand/middleware'
const useStore = create(devtools((set) => ({ ... }), { name: 'ProjectStore' }))
```

### 4.11 Tailwind CSS v4 - Patterns Avancados

- **Container queries:** `@container` para componentes responsivos
- **Animations:** `@keyframes` no CSS, `animate-*` nas classes
- **Custom variants:** `@variant` para estados customizados
- **Composicao:** `@apply` para extrair componentes
- **@theme:** Definicao de tokens no CSS (nosso padrao atual)

### 4.12 React 19 Features Relevantes

- **useActionState:** Gerenciamento de estado de forms/actions
- **useOptimistic:** UI otimista (feedback instantaneo antes do servidor responder)
- **use():** Ler promises e context diretamente no render
- **Compiler (React Forget):** Auto-memoizacao, elimina useMemo/useCallback manuais

---

## 5. Stack Electron - Desktop

### 5.1 electron-vite (nosso builder atual)

- **URL:** https://electron-vite.org/
- **O que e:** Build tool para Electron baseada no Vite
- **Features:** HMR para main/renderer/preload, path aliases, code splitting
- **Configuracao atual:** `electron.vite.config.ts` com aliases @/ e @main/

### 5.2 Electron IPC Patterns Avancados

**Typed IPC (type-safe channels):**
```typescript
// Definir mapa de canais tipados
interface IpcChannelMap {
  'project:select-draft': { args: []; return: string | null }
  'capcut:read-audio-blocks': { args: [string]; return: RawAudioBlock[] }
  'capcut:write-text-segments': { args: [string, unknown[]]; return: { count: number } }
}

// Helper tipado
function typedInvoke<K extends keyof IpcChannelMap>(
  channel: K,
  ...args: IpcChannelMap[K]['args']
): Promise<IpcChannelMap[K]['return']> {
  return ipcRenderer.invoke(channel, ...args)
}
```

**Progress events bidirecionais:**
```typescript
// Main -> Renderer (progresso de operacoes longas)
mainWindow.webContents.send('progress', { stage: 'writing', percent: 45 })

// Renderer escuta
window.api.onProgress((data) => updateProgressBar(data.percent))
```

### 5.3 Electron Security Best Practices

- `sandbox: true` quando possivel (nosso esta `false` - necessario para preload)
- `contextIsolation: true` (nosso esta correto)
- `nodeIntegration: false` (nosso esta correto)
- CSP restritivo no index.html (nosso tem `script-src 'self'` - correto)
- Validar paths recebidos do renderer antes de usar no filesystem
- Nunca expor `require` ou `process` ao renderer

### 5.4 electron-store (Persistencia de Configuracao)

- **URL:** https://github.com/sindresorhus/electron-store
- **O que e:** Armazenamento de configuracao simples para Electron
- **Features:** JSON storage, schema validation, migrations, encryption
- **Relevancia:** Salvar preferencias do usuario, paths recentes, configuracoes de TTS

### 5.5 electron-updater (Auto-Update)

- **URL:** https://www.electron.build/auto-update
- **O que e:** Auto-update nativo para apps Electron
- **Features:** Update diferencial, rollback, staging, code signing
- **Provedores:** GitHub Releases, S3, generic server
- **Relevancia:** Distribuicao de atualizacoes para usuarios

---

## 6. Text-to-Speech (TTS)

### Tabela Comparativa

| Servico | Preco | Qualidade | PT-BR | Voice Clone | Latencia | Offline |
|---------|-------|-----------|-------|-------------|----------|---------|
| **Edge TTS** | GRATIS | Boa | Sim (varios) | Nao | Baixa | Nao |
| **ElevenLabs** | $5-330/mes | Excelente | Sim | Sim (instant) | Baixa | Nao |
| **Google Gemini TTS** | $1-20/MTok | Alta | Sim | Limitado | Muito baixa | Nao |
| **Google Cloud TTS** | $4-30/M chars | Premium | Sim (WaveNet) | Nao | Baixa | Nao |
| **OpenAI TTS** | $15-30/M chars | Boa | Sim | Nao | Baixa | Nao |
| **Azure Speech** | Free tier + PAYG | Boa | Sim | Sim (custom) | Baixa | Nao |
| **XTTS v2** | GRATIS (open) | Excelente | Sim | Sim (6s audio) | Media | Sim |
| **Piper TTS** | GRATIS (open) | Boa | Sim | Nao | Muito baixa | Sim |
| **Coqui TTS** | GRATIS (open) | Boa | Sim | Sim | Media | Sim |
| **Bark** | GRATIS (open) | Excelente | Sim | Nao | Alta | Sim |

### 6.1 Edge TTS (Microsoft Edge)

- **URL:** https://github.com/rany2/edge-tts
- **Preco:** GRATIS - usa o servico TTS do Microsoft Edge
- **Instalacao Python:** `pip install edge-tts`
- **Instalacao Node.js:** `npm install edge-tts-universal` ou `npm install @andresaya/edge-tts` ou `npm install node-edge-tts`
- **Qualidade:** Boa, natural, comparavel a servicos pagos
- **Idiomas:** 70+ idiomas e vozes
- **PT-BR:** Sim, suporte extenso com vozes masculinas e femininas
- **Formatos de saida:** MP3, WAV, WebM, OGG, M4A, AAC
- **Bonus:** Gera legendas (SRT, VTT) junto com o audio
- **Sem autenticacao:** Nenhuma API key necessaria
- **Melhor custo-beneficio disponivel**

### 6.2 ElevenLabs

- **URL:** https://elevenlabs.io/
- **Docs:** https://elevenlabs.io/docs
- **Preco:** Starter $5/mes, Creator $22/mes, Pro $99/mes, Scale $330/mes
- **API:** $0.05/minuto (low-latency TTS)
- **Qualidade:** Uma das mais realistas do mercado (modelos v3)
- **PT-BR:** Sim, multiplas vozes portuguesas
- **Voice Cloning:** Instant (Starter tier), Professional (Creator tier)
- **Features:** Controle de emocao, estabilidade de voz, streaming
- **Use case:** Narracao profissional com identidade de voz consistente

### 6.3 Google Gemini TTS

- **URL:** https://ai.google.dev/gemini-api/docs
- **Preco:** Pro: $1 input, $20 output por MTok | Flash: $0.50 input, $10 output por MTok
- **Qualidade:** Alta, controle granular via prompts naturais sobre estilo, sotaque, emocao
- **PT-BR:** Sim, via prompts multilingues
- **Latencia:** Muito baixa com ritmo e cadencia naturais
- **Limite:** ~655 segundos por request, 4KB por campo de texto
- **Diferencial:** Controle de expressividade via linguagem natural

### 6.4 Google Cloud Text-to-Speech

- **URL:** https://cloud.google.com/text-to-speech
- **Preco:** Standard $4/M chars, WaveNet $16/M chars, Studio $30/M chars
- **Free tier:** 4M chars/mes Standard, 1M WaveNet
- **Qualidade:** Premium (WaveNet e state-of-the-art)
- **PT-BR:** Sim, multiplas vozes brasileiras
- **Features:** SSML support, controle de pitch/speed/volume
- **Idiomas:** 60+ idiomas

### 6.5 OpenAI TTS

- **URL:** https://platform.openai.com/docs/guides/text-to-speech
- **Preco:** $15/M chars (standard), $30/M chars (HD)
- **Vozes:** 13 vozes distintas (Alloy, Ash, Ballad, Coral, Echo, etc.)
- **Formatos:** MP3, Opus, AAC, FLAC, WAV, PCM
- **Diferencial:** "Steerability" - pode instruir tom e estilo de entrega via prompt
- **Streaming:** Sim, ~0.5s latencia

### 6.6 Azure Cognitive Services Speech

- **URL:** https://azure.microsoft.com/pricing/details/cognitive-services/speech-services/
- **Preco:** Free tier 0.5M chars/mes, depois PAYG
- **PT-BR:** Sim, com variantes de voz portuguesas
- **Voice training:** Custom neural voice (treinar voz propria)
- **Idiomas:** 70+ idiomas

### 6.7 XTTS v2 (Coqui - Voice Cloning Open Source)

- **URL:** https://huggingface.co/coqui/XTTS-v2
- **Preco:** GRATIS (open-source)
- **Instalacao:** `pip install TTS`
- **Qualidade:** Excelente - clona voz com apenas 6 segundos de audio
- **PT-BR:** Sim (17 idiomas suportados)
- **Features:** Cross-language voice cloning, transferencia de emocao/estilo
- **Hardware:** GPU recomendada para velocidade
- **MELHOR para consistencia de voz entre projetos**

### 6.8 Piper TTS (Local, Ultra-Rapido)

- **URL:** https://github.com/rhasspy/piper (original), https://github.com/OHF-Voice/piper1-gpl (fork ativo)
- **Preco:** GRATIS (GPL-3.0)
- **Instalacao:** `pip install piper-tts`
- **Velocidade:** 10x mais rapido que servicos cloud - tempo real em CPU
- **PT-BR:** Sim, modelos pre-treinados no Hugging Face
- **Arquitetura:** ONNX/VITS - leve e rapido
- **Hardware:** Funciona ate em Raspberry Pi
- **MELHOR para operacao local/offline com latencia minima**

### 6.9 Bark (Suno - Open Source)

- **URL:** https://github.com/suno-ai/bark
- **HuggingFace:** https://huggingface.co/suno/bark
- **Preco:** GRATIS (MIT)
- **Qualidade:** Excelente, altamente realista
- **Capacidades:** Fala, musica, efeitos sonoros, comunicacoes nao-verbais (risada, choro)
- **PT-BR:** Sim, 100+ presets de falante multilingue
- **Limitacao:** Sem voice cloning, limite de 13-14s por prompt
- **Diferencial:** Unico que gera efeitos sonoros alem de fala

### 6.10 Coqui TTS (Open Source)

- **URL:** https://github.com/coqui-ai/TTS
- **Preco:** GRATIS (open-source)
- **Instalacao:** `pip install coqui-tts` (requer PyTorch 2.2+, Python 3.10-3.15)
- **PT-BR:** Sim
- **Status:** Empresa fechou Dez 2025, comunidade mantém com atualizacoes trimestrais
- **Curva de aprendizado:** 2-4 semanas para competencia basica

### Estrategia TTS Recomendada

| Tier | Servico | Uso |
|------|---------|-----|
| **Gratis** | Edge TTS | Default para todos os projetos |
| **Voice Clone** | XTTS v2 | Quando precisa de voz consistente |
| **Offline** | Piper TTS | Quando sem internet |
| **Premium** | ElevenLabs | Producao profissional |

---

## 7. IA e Analise de Cenas

### 7.1 Google Gemini Vision API

- **URL:** https://ai.google.dev/gemini-api/docs/vision
- **Capacidades:** Image captioning, object detection, OCR, visual QA
- **Gemini 3 Flash:** Agentic Vision com loop Think-Act-Observe, code execution
- **Uso no projeto:** Analisar keyframes para sugerir tipo de midia necessaria
- **Integracao:** REST API, SDKs Python/TypeScript

### 7.2 OpenAI GPT-4V / GPT-4o Vision

- **URL:** https://platform.openai.com/docs/guides/vision
- **Capacidades:** Analise de fotos, identificacao de objetos, OCR, reasoning multimodal
- **Limites:** Max 10 imagens por request, formatos JPEG/PNG/GIF/WEBP
- **Uso no projeto:** Analise de contexto complexo combinando roteiro + frames

### 7.3 CLIP (OpenAI - Open Source)

- **URL:** https://github.com/openai/CLIP
- **O que faz:** Projeta imagens e texto no mesmo espaco latente (contrastive learning)
- **Treinamento:** 400M pares texto-imagem
- **Uso no projeto:** Busca semantica de midias - match keyword do roteiro com imagem da biblioteca local
- **Integracao:** Inferencia local ou via API
- **Complexidade:** Media - requer model loading e embedding computation

### 7.4 Ferramentas de Auto B-roll (Referencia)

Ferramentas existentes que fazem selecao automatica de B-roll:
- **Kapwing AI B-Roll Generator** - Gera B-roll baseado no conteudo
- **Submagic** - Entende transcricoes contextualmente
- **OpusClip** - Ranking ML por potencial de engajamento
- **AutoCut** - Imagens e footage gerados por IA
- **BigVU** - Insercao dinamica de B-roll
- **Economia:** 5-7 horas por video automatizando B-roll

### 7.5 Deteccao de Cena em Video (Referencia)

- **CutMagic** (quso.ai) - Deteccao automatica de mudanca de cena
- **Reelmind.ai** - Entendimento NLP de cena, deteccao de tom emocional
- **Azure Video Indexer** - Deteccao shot/scene/keyframe
- **Adobe Premiere Pro (Sensei)** - Deteccao nativa de cena

---

## 8. Processamento de Midia

### 8.1 FFmpeg Integracao com Node.js

**fluent-ffmpeg:**
- **URL:** https://github.com/fluent-ffmpeg/node-fluent-ffmpeg
- **NPM:** `npm install fluent-ffmpeg`
- **O que faz:** Abstrai linha de comando FFmpeg em API fluent Node.js
- **Features:** Conversao video/audio, thumbnail, metadata, streaming

**Electron + FFmpeg:**
- Desafio: binarios FFmpeg no asar archive
- Solucao: `ffmpeg-static-electron` ou `ffmpeg-static-electron-forge`
- Configurar path strings para `app.asar.unpacked`

**Pacotes otimizados para Electron:**
- `ffmpeg-static-electron-forge` - Integracao rapida electron-forge/webpack
- `fluent-ffmpeg-electron-react` - Modificado para Electron + React

### 8.2 Sharp (Processamento de Imagem)

- **URL:** https://sharp.pixelplumbing.com/
- **NPM:** `npm install sharp`
- **Performance:** 4-5x mais rapido que ImageMagick/GraphicsMagick
- **Formatos:** JPEG, PNG, WebP, GIF, AVIF, TIFF, SVG (leitura) | JPEG, PNG, WebP, GIF, AVIF, TIFF (escrita)
- **Operacoes:** Resize, rotate, extract, composite, gamma
- **Uso no projeto:** Thumbnails, otimizacao de imagens, extracao de frames

### 8.3 FFmpeg.wasm (Browser-Based)

- **URL:** https://github.com/ffmpegwasm/ffmpeg.wasm
- **O que faz:** Port WebAssembly/JavaScript do FFmpeg para processamento no browser
- **Vantagens:** Sem servidor, dados ficam no browser (privacidade), sem latencia de rede
- **Threading:** Single e multi-thread (web workers)
- **TypeScript:** Suporte completo
- **Uso no projeto:** Preview de midia sem servidor

### 8.4 Wavesurfer.js (Visualizacao de Audio)

- **URL:** https://wavesurfer.xyz/
- **Features:** Player interativo com waveform, regions, recording, minimap, timeline, espectrogramas
- **Formatos:** WAV, MP3, WebM, OGG
- **Wrappers React:** `react-audio-visualize`, `react-voice-visualizer`, `react-wavy-audio`, `ReactWaveform`
- **Uso no projeto:** Visualizar sincronizacao audio + texto, ajuste interativo de timing
- **BBC waveform-data.js:** https://github.com/bbc/waveform-data.js (representacoes zoomaveis)

### 8.5 Video Metadata

**fluent-ffmpeg.ffprobe:**
- Parte do pacote fluent-ffmpeg
- Metadata completa: duracao, resolucao, codec, bitrate, fps
- API callback com objeto FfprobeData

**Alternativas:**
- `fetch-video-metadata` (GraphQL API)
- `video-metadata-api` (HTTP endpoint)
- Remotion `getVideoMetadata()`

### 8.6 Analise de Audio

**pyAudioAnalysis:**
- **URL:** https://github.com/tyiannak/pyAudioAnalysis
- **Capacidades:** Deteccao de silencio, deteccao de batida, extracao de features
- **Uso:** Identificar silencios naturais para posicionar legendas, transicoes beat-synced

**Outras bibliotecas:**
- `rhasspy-silence` - Deteccao fala/silencio com webrtcvad
- `auditok` - Deteccao de atividade acustica baseada em energia
- `audio-slicer` - Deteccao de silencio com analise RMS frame-level

---

## 9. Legendas e Transcricao

### 9.1 WhisperX (Word-Level Timestamps)

- **URL:** https://github.com/m-bain/whisperX
- **Performance:** 70x realtime com large-v2
- **Feature principal:** Timestamps word-level precisos via alinhamento wav2vec2
- **Arquitetura:** VAD para segmentacao -> chunks ~30s -> transcricao paralela Whisper -> forced alignment
- **Speaker diarization:** Incluido
- **Uso no projeto:** CRITICO para gerar legendas SRT word-level para sincronizacao CapCut
- **Hardware:** GPU recomendada

### 9.2 Faster-Whisper

- **URL:** https://github.com/SYSTRAN/faster-whisper
- **Performance:** 4x mais rapido que OpenAI Whisper com mesma acuracia
- **Tecnologia:** CTranslate2 fast inference engine
- **Whisper Large V3 Turbo:** 5.4x speedup vs V2, RTFx de 216x (tempo real)
- **Modelos novos:** gpt-4o-transcribe, gpt-4o-mini-transcribe com WER melhorado
- **Uso no projeto:** Transcricao rapida como pre-processamento

### 9.3 stable-ts (Estabilizacao de Timestamps)

- **URL:** https://github.com/jianfch/stable-ts
- **O que faz:** Refina timestamps do Whisper para acuracia e ordenacao cronologica
- **Metodo:** Supressao de silencio e ajuste pos-inferencia
- **V2:** Ajuste pos-inferencia funciona com qualquer modelo ASR
- **Uso no projeto:** Polir output do WhisperX para legendas de qualidade producao
- **Instalacao:** `pip install stable-ts`

### 9.4 Formatos de Legenda

| Formato | Extensao | Features | Suporte CapCut |
|---------|----------|----------|----------------|
| SRT | .srt | Simples, amplamente suportado | Sim (import) |
| VTT | .vtt | Estilos, posicao, cue settings | Parcial |
| ASS/SSA | .ass/.ssa | Estilos avancados, efeitos, karaoke | Nao |

**Bibliotecas Python:** `pysrt` (SRT parsing/writing)
**Nosso lib:** `srt.ts` (blocksToSrt, parseSrt, msToSrtTime) + `srt_generator.py`

---

## 10. NLP e Analise de Roteiro

### 10.1 spaCy

- **URL:** https://spacy.io/
- **O que faz:** NLP industrial-strength em Python
- **NER:** Identifica pessoas, organizacoes, locais
- **Features:** Tokenizacao, POS tagging, dependency parsing, similarity
- **PT-BR:** Modelos disponiveis (`pt_core_news_sm`, `pt_core_news_lg`)
- **Uso no projeto:** Extrair entidades do roteiro para media search contextual

### 10.2 Hugging Face Transformers

- **URL:** https://huggingface.co/models
- **Capacidades:** Sentiment analysis, summarization, classification, translation, QA
- **Avancos 2025:** ModernFinBERT, quantizacao 8/4-bit, PEFT
- **Uso no projeto:**
  - Sentiment analysis para "mood" da cena -> selecionar tom de midia
  - Summarization para descricoes de cena
  - Classification para tipo de cena (dialogo, acao, montagem)

### 10.3 Extracao de Keywords

- **Algoritmos:** TF-IDF, TextRank, LDA, BERT embeddings
- **Avancos 2025:** Extracao multimodal (texto + imagens)
- **APIs:** NLP Cloud, ou local com spaCy/NLTK
- **Uso no projeto:** Extrair keywords do roteiro automaticamente para Stage 4 (media tags)

### 10.4 Pipeline NLP Recomendado para o Projeto

```
Roteiro (texto)
    |
    v
spaCy NER -> Entidades (pessoas, locais, objetos)
    |
    v
Sentiment Analysis -> Mood por bloco (positivo, negativo, neutro, dramatico)
    |
    v
Keyword Extraction -> Tags de midia por cena
    |
    v
Summarization -> Descricao compacta por cena
    |
    v
Scene Grouping -> Agrupar blocos por contexto semantico (nao apenas N blocos fixos)
```

---

## 11. Geracao de Midia com IA

### 11.1 Runway Gen-4.5

- **URL:** https://runwayml.com/api
- **Capacidades:** Text-to-video, image-to-video com consistencia de personagem
- **Features:** Precisao fisica, controle de iluminacao, transicoes suaves, composicao multi-elemento
- **Novas ferramentas (Jul 2025):**
  - **Aleph:** Edicao in-video sem regenerar (via text prompts)
  - **Act-Two:** Motion capture sem equipamento
- **Parceria Adobe:** Dez 2025 - integrado no Adobe Firefly
- **Uso no projeto:** Gerar B-roll ou transicoes de cena (opcao avancada)

### 11.2 Pika Video

- **URL:** https://pika.art/
- **API:** Via fal.ai (hosted API)
- **Modelos:** 2.2+ (Dez 2025), 2.5 para short-form (TikTok/Reels)
- **Pikaformance:** Anima imagens estaticas com expressoes faciais hiper-realistas sync com audio
- **Features:** Text-to-video, image-to-video, Pikascenes, Pikaframes
- **Uso no projeto:** Gerar aberturas ou transicoes de cena dinamicas

### 11.3 DALL-E 3 / GPT Image 1

- **URL:** https://openai.com/api/pricing/
- **Preco:** DALL-E 3: $0.04-0.12/imagem | GPT Image 1 Mini: $0.005-0.006 (low quality)
- **Resolucoes:** 1024x1024, 1024x1536, 1536x1024
- **Uso no projeto:** Gerar imagens de capa, visuais de cena customizados

### 11.4 Stable Diffusion (Local)

- **URL:** https://github.com/AUTOMATIC1111/stable-diffusion-webui (A1111), https://github.com/comfyanonymous/ComfyUI
- **Preco:** GRATIS (open-source)
- **Hardware:** 4GB VRAM minimo, 6-8GB pratico
- **Modelos 2025:** SD 3/XL em RTX 4090
- **Uso no projeto:** Controle total local, sem custo de API, privacidade

### 11.5 Midjourney

- **URL:** https://www.midjourney.com/
- **Modelo de video:** Lancado Jun 2025
- **Qualidade:** Referencia em estetica de imagem
- **API:** Limitada, via Discord ou web app
- **Uso no projeto:** Geracao de imagens de alta qualidade estetica

---

## 12. Geracao de Musica com IA

### 12.1 Suno V5

- **URL:** https://suno.com/
- **Status:** Sem API publica oficial; APIs de terceiros disponiveis
- **Versao:** V5 (Set 2025), melhorias significativas
- **ELO Score:** 1,293 (supera competidores)
- **Qualidade:** Eliminou artefatos roboticos/metalicos, vocais naturais e quentes
- **Features:** Text-to-music, geracao de letras, multiplos estilos/generos
- **Uso no projeto:** Gerar musica de fundo para cenas automaticamente

### 12.2 Udio

- **URL:** https://www.udio.com/
- **Criadores:** Ex-pesquisadores Google DeepMind
- **Preco:** Free (10 creditos/dia), Standard ($10/mes), Pro ($30/mes)
- **Capacidades:** Text-to-music, cancoes completas, vocais realistas, multilingual
- **Edicao:** Feature "Extend" para adicao de secoes (intro, verso, outro)
- **Rating 2025:** Melhor em phrasification e fluxo lirico
- **Uso no projeto:** Gerar trilhas sonoras ou fundo musical por cena

---

## 13. APIs de Midia Stock

### 13.1 Pexels API

- **URL:** https://www.pexels.com/api/
- **Preco:** GRATIS
- **Conteudo:** 3M+ fotos e videos hand-picked
- **Features:** Search, curated collections, sem atribuicao obrigatoria
- **Integracao:** REST API simples
- **Melhor para:** B-roll complementar gratuito

### 13.2 Unsplash API

- **URL:** https://unsplash.com/developers
- **Preco:** GRATIS
- **Conteudo:** Fotos alta resolucao esteticas de fotografos globais
- **Usado por:** Trello, Mailchimp, Google Slides, Zoom
- **Melhor para:** B-roll estetico de alta qualidade

### 13.3 Pixabay API

- **URL:** https://pixabay.com/api/docs/
- **Preco:** GRATIS
- **Conteudo:** 5M+ imagens e videos
- **Limites:** 100 requests/minuto
- **Cobertura:** Imagens, videos, vetores, musica
- **Melhor para:** Fonte multimidia completa com trilhas musicais

### Estrategia Stock Recomendada

```
Keyword da cena
    |
    v
Pexels API (primario) -> videos/fotos
    |
    v
Unsplash API (secundario) -> fotos esteticas
    |
    v
Pixabay API (fallback) -> multimedia + musica
    |
    v
AI Generation (premium) -> quando stock nao satisfaz
```

---

## 14. Gerenciamento de Assets

### 14.1 Chokidar (File Watching)

- **URL:** https://github.com/paulmillr/chokidar
- **NPM:** `npm install chokidar`
- **Adocao:** ~30M repositorios
- **V5 (Nov 2025):** ESM-only, Node.js v20+
- **Features:** Cross-platform, previne eventos duplicados, atomic writes, filtragem, recursive
- **Uso no projeto:** Monitorar pastas de midia do usuario para novos assets, auto-indexar e catalogar

### 14.2 Asset Management com IA

- **Tendencia 2025:** 75% das empresas usam IA para tagging de assets
- **Velocidade:** 90% mais rapido que tagging manual
- **Features:** Descricoes automaticas, taxonomias multi-nivel
- **Uso no projeto:** Tagging automatico de midia local para busca inteligente

### 14.3 Biblioteca de Midia Local

**Arquitetura sugerida:**
```
Pasta de midia do usuario
    |
    v (Chokidar watch)
Indexador
    |
    v
SQLite DB local (ou JSON index)
    ├── path, nome, tipo (video/imagem/audio)
    ├── duracao, resolucao, codec
    ├── tags IA (CLIP embeddings ou Vision API)
    ├── thumbnail (Sharp/FFmpeg)
    └── data de modificacao
    |
    v
Busca semantica (CLIP) ou keyword
    |
    v
Sugestoes de midia por cena
```

---

## 15. Automacao e Filas de Tarefas

### 15.1 BullMQ (Node.js Task Queue)

- **URL:** https://bullmq.io/
- **Tecnologia:** Node.js + Redis
- **Capacidades:** Jobs delayed/scheduled, retry com backoff exponencial, parent-child jobs, prioridades
- **Use cases:** Transcoding de video, pipelines IA, background jobs
- **Performance:** Milhoes de jobs em producao desde 2011
- **Uso no projeto:** Enfileirar TTS, processamento de video, escrita no CapCut como background jobs

### 15.2 n8n (Workflow Automation)

- **URL:** https://n8n.io/
- **Tipo:** Open-source, self-hosted
- **Features:** 350+ integracoes, logica multi-path, codigo custom (Node.js/Python)
- **Queue mode:** 220+ execucoes/sec em instancia unica
- **Stack:** Postgres + Redis
- **Uso no projeto:** Orquestrar pipeline completo como workflow visual (futuro)

### 15.3 Temporal (Distributed Workflows)

- **URL:** https://temporal.io/
- **Desenvolvido por:** Engenheiros Uber (criadores do Cadence)
- **Garantias:** Workflows sobrevivem crashes, resume exato, event sourcing
- **Uso no projeto:** Confiabilidade enterprise para automacao (quando escalar)

### 15.4 Patterns de Processamento

**Worker Threads (Node.js nativo):**
```typescript
import { Worker } from 'worker_threads'

const worker = new Worker('./processMedia.js', {
  workerData: { filePath, operation }
})

worker.on('message', (result) => {
  // resultado do processamento
})
```

**Progress Reporting:**
```typescript
// Pattern para operacoes longas com feedback
async function processWithProgress(items, onProgress) {
  for (let i = 0; i < items.length; i++) {
    await processItem(items[i])
    onProgress({ current: i + 1, total: items.length, percent: ((i + 1) / items.length) * 100 })
  }
}
```

---

## 16. Claude Code - CLAUDE.md, Skills, Hooks

### 16.1 CLAUDE.md - Best Practices

**O que e:** Arquivo de instrucoes do projeto que o Claude Code le automaticamente.

**Hierarquia de arquivos:**
1. `~/.claude/CLAUDE.md` - Instrucoes globais (todos os projetos)
2. `CLAUDE.md` na raiz do projeto - Instrucoes do projeto (commitado no repo)
3. `.claude/CLAUDE.md` - Instrucoes locais (gitignored, pessoal)

**O que incluir:**
- Stack tecnologico e convencoes
- Comandos de build/test/lint
- Estrutura de diretorios
- Padroes de codigo (naming, imports, exports)
- Regras de negocio criticas
- Paths importantes
- Restricoes e "nunca faca X"

**O que NAO incluir:**
- Informacoes que mudam frequentemente (estado do sprint, bugs atuais)
- Conteudo muito longo (>200 linhas dilui a atencao)
- Duplicacao de info que esta em docs/README

**Formato ideal:**
- Conciso e diretivo
- Bullets e listas (facil de escanear)
- Exemplos de codigo quando relevante
- Secoes claras com headers

### 16.2 .claude/rules/ - Regras Condicionais

**O que sao:** Regras que se aplicam apenas em contextos especificos.

**Formato:** Arquivos `.md` em `.claude/rules/` com frontmatter YAML:

```yaml
---
description: "Regras para componentes React"
globs: ["src/renderer/src/components/**/*.tsx"]
---

# Regras para Componentes

- Sempre usar named exports
- Um componente por arquivo
- Props interface definida inline ou importada de @/types
```

```yaml
---
description: "Regras para Python bridge"
globs: ["python/**/*.py"]
---

# Regras Python

- Docstrings em ingles
- snake_case para funcoes
- Flush stdout apos cada write
- JSON-line protocol
```

**Vantagem:** Regras especificas carregadas apenas quando editando arquivos relevantes, economiza contexto.

### 16.3 Skills (Custom)

**O que sao:** Capacidades especializadas que podem ser invocadas como slash commands.

**Localizacao:** `.claude/skills/SKILL_NAME.md`

**Estrutura de um skill:**
```markdown
---
name: "capcut-writer"
description: "Escreve segmentos no draft_content.json do CapCut"
---

# CapCut Writer Skill

## Contexto
Voce e um especialista em manipulacao do formato draft_content.json do CapCut.

## Regras
- NUNCA reescrever o JSON inteiro
- Sempre fazer backup antes de escrever
- Unidade interna: microsegundos (us = ms * 1000)
- Preservar campos desconhecidos

## Workflow
1. Ler draft_content.json atual
2. Identificar tracks relevantes
3. Modificar apenas campos necessarios
4. Salvar e chamar syncMetadata
```

**Invocacao:** `/capcut-writer` no Claude Code

### 16.4 Slash Commands (Custom)

**O que sao:** Comandos rapidos definidos como arquivos markdown.

**Localizacao:** `.claude/commands/COMMAND_NAME.md`

**Exemplo `.claude/commands/check-project.md`:**
```markdown
Verifique o estado do projeto MEU PIPELINE STUDIO:
1. Rode `npm run lint` e reporte erros
2. Rode `npx tsc --noEmit` e reporte erros de tipo
3. Verifique se todos os imports @/ e @main/ resolvem
4. Liste componentes shared que nao sao usados
5. Liste interfaces duplicadas
```

**Invocacao:** `/check-project` no Claude Code

### 16.5 Hooks (Lifecycle Callbacks)

**O que sao:** Comandos shell executados em resposta a eventos do Claude Code.

**Configuracao:** `.claude/settings.json`

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "echo 'Editando arquivo...'"
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "npx prettier --write $CLAUDE_FILE_PATH"
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "command": "echo $CLAUDE_NOTIFICATION >> ~/.claude/notifications.log"
      }
    ]
  }
}
```

**Eventos disponiveis:**
- `PreToolUse` - Antes de usar uma tool (pode bloquear)
- `PostToolUse` - Apos usar uma tool
- `Notification` - Quando Claude quer notificar algo
- `Stop` - Quando Claude para de executar

**Variaveis de ambiente:**
- `$CLAUDE_FILE_PATH` - Path do arquivo sendo editado
- `$CLAUDE_TOOL_NAME` - Nome da tool sendo usada
- `$CLAUDE_NOTIFICATION` - Texto da notificacao

**Uso no projeto:**
- Auto-format com Prettier apos cada edit
- Lint check apos cada escrita de arquivo TS
- Log de auditoria de mudancas
- Notificacao quando operacao longa termina

### 16.6 Memory (.claude/memory/)

**O que e:** Diretorio de memoria persistente entre conversas.

**Nosso atual:** `~/.claude/projects/c--Users-ander-Documents-MEU-PIPELINE-STUDIO/memory/MEMORY.md`

**Best practices:**
- `MEMORY.md` e sempre carregado no system prompt (limite ~200 linhas)
- Criar arquivos por topico (`debugging.md`, `patterns.md`) e linkar do MEMORY.md
- Atualizar quando descobrir padroes confirmados
- Remover memorias que provaram ser erradas

### 16.7 Permissions e Modos

**Modos disponiveis:**
- `default` - Pede permissao para tools perigosas
- `acceptEdits` - Auto-aceita Read/Write/Edit, pede para Bash
- `bypassPermissions` - Auto-aceita tudo (usar com cuidado)

**Configuracao por projeto:** `.claude/settings.json`
```json
{
  "permissions": {
    "allow": ["Read", "Write", "Edit", "Glob", "Grep"],
    "deny": [],
    "askForBash": true
  }
}
```

---

## 17. MCP - Model Context Protocol

### 17.1 O Que E

MCP (Model Context Protocol) e um protocolo aberto da Anthropic que padroniza como aplicacoes IA se conectam a fontes de dados e ferramentas externas. E o "USB-C da IA" - uma interface universal.

**Arquitetura:**
```
Claude Code (MCP Client)
    |
    v (JSON-RPC 2.0 sobre stdio ou SSE)
MCP Server (qualquer ferramenta)
    |
    v
Dados / APIs / Filesystem / DB / etc.
```

### 17.2 Configuracao no Claude Code

**Arquivo:** `.claude/settings.json` (projeto) ou `~/.claude/settings.json` (global)

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    },
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite", "/path/to/db.sqlite"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_..."
      }
    }
  }
}
```

### 17.3 Servidores MCP Oficiais (Anthropic/Reference)

| Servidor | Pacote NPM | O Que Faz |
|----------|------------|-----------|
| **Filesystem** | `@modelcontextprotocol/server-filesystem` | Leitura/escrita de arquivos com controle de acesso |
| **GitHub** | `@modelcontextprotocol/server-github` | Issues, PRs, repos, code search |
| **GitLab** | `@modelcontextprotocol/server-gitlab` | Issues, MRs, pipelines |
| **Google Drive** | `@modelcontextprotocol/server-gdrive` | Busca e leitura de docs/sheets |
| **PostgreSQL** | `@modelcontextprotocol/server-postgres` | Query e schema inspection |
| **SQLite** | `@modelcontextprotocol/server-sqlite` | Query, analise de business data |
| **Slack** | `@modelcontextprotocol/server-slack` | Canais, mensagens, busca |
| **Memory** | `@modelcontextprotocol/server-memory` | Knowledge graph persistente |
| **Puppeteer** | `@modelcontextprotocol/server-puppeteer` | Automacao de browser |
| **Brave Search** | `@modelcontextprotocol/server-brave-search` | Web search + local search |
| **Fetch** | `@modelcontextprotocol/server-fetch` | Fetch URLs, convert HTML to markdown |
| **Everything** | `@modelcontextprotocol/server-everything` | Demo/teste com todas as features |

### 17.4 Servidores MCP Comunitarios Relevantes

| Servidor | O Que Faz | Relevancia |
|----------|-----------|------------|
| **@playwright/mcp** | Browser automation, screenshots, navigation | Testar previews |
| **mcp-server-ffmpeg** | FFmpeg operations via MCP | Processamento de midia |
| **mcp-server-youtube** | YouTube data, transcripts | Pesquisa de conteudo |
| **mcp-server-figma** | Figma designs, components | UI reference |
| **mcp-obsidian** | Obsidian vault access | Knowledge management |
| **mcp-server-sqlite** | SQLite queries | Asset DB local |

### 17.5 Registries de MCP Servers

| Registry | URL | Descricao |
|----------|-----|-----------|
| **Smithery** | https://smithery.ai/ | Registry oficial, curado |
| **mcp.so** | https://mcp.so/ | Diretorio comunitario |
| **Glama** | https://glama.ai/mcp/servers | Catalogo com reviews |
| **PulseMCP** | https://www.pulsemcp.com/ | Diretorio com trending |
| **mcp-get** | https://mcp-get.com/ | Package manager para MCP |

### 17.6 Criando MCP Server Custom

**SDK TypeScript:**
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

const server = new Server({
  name: "capcut-mcp",
  version: "1.0.0"
}, {
  capabilities: { tools: {} }
})

// Definir tools
server.setRequestHandler("tools/list", async () => ({
  tools: [
    {
      name: "read_draft",
      description: "Le o draft_content.json de um projeto CapCut",
      inputSchema: {
        type: "object",
        properties: {
          draftPath: { type: "string", description: "Caminho para o draft_content.json" }
        },
        required: ["draftPath"]
      }
    },
    {
      name: "write_text_segments",
      description: "Escreve segmentos de texto no CapCut",
      inputSchema: {
        type: "object",
        properties: {
          draftPath: { type: "string" },
          segments: { type: "array" }
        },
        required: ["draftPath", "segments"]
      }
    }
  ]
}))

// Implementar tools
server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params

  switch (name) {
    case "read_draft":
      // Ler e retornar sumario do draft
      return { content: [{ type: "text", text: JSON.stringify(result) }] }
    case "write_text_segments":
      // Escrever segmentos
      return { content: [{ type: "text", text: `Escritos ${count} segmentos` }] }
  }
})

// Iniciar
const transport = new StdioServerTransport()
await server.connect(transport)
```

**SDK Python:**
```python
from mcp.server import Server
from mcp.server.stdio import stdio_server

app = Server("capcut-mcp")

@app.list_tools()
async def list_tools():
    return [
        {
            "name": "read_draft",
            "description": "Le o draft_content.json do CapCut",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "draftPath": {"type": "string"}
                },
                "required": ["draftPath"]
            }
        }
    ]

@app.call_tool()
async def call_tool(name, arguments):
    if name == "read_draft":
        # implementacao
        return [{"type": "text", "text": result}]

async def main():
    async with stdio_server() as streams:
        await app.run(streams[0], streams[1])
```

### 17.7 MCP no Contexto do Projeto

**Servidores MCP que usariamos:**

1. **capcut-mcp (custom)** - Expor operacoes CapCut como tools MCP
   - read_draft, write_text_segments, write_video_segments, sync_metadata
   - Substituiria nosso Python bridge custom com protocolo padronizado

2. **@modelcontextprotocol/server-filesystem** - Acesso controlado a pasta de midias

3. **mcp-server-sqlite** - Indice de assets local

4. **@playwright/mcp** - Automacao de browser para testes de preview

---

## 18. Claude Agent SDK e Subagentes

### 18.1 Claude Agent SDK

**O que e:** Biblioteca da Anthropic para construir agentes IA de producao. Mesmo motor do Claude Code, disponivel como SDK.

**Pacotes:**
- **TypeScript:** `npm install @anthropic-ai/claude-agent-sdk`
- **Python:** `pip install claude-agent-sdk`
- **Nota:** O pacote antigo `@anthropic-ai/claude-code` esta deprecated

**Autenticacao:**
- Anthropic API key
- AWS Bedrock
- Google Vertex AI
- Microsoft Azure

### 18.2 Agent Loop

O SDK implementa um loop autonomo: Entender Objetivo -> Planejar -> Chamar Tool -> Verificar Resultado -> Continuar

**Python:**
```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="Analise o roteiro e sugira midias para cada cena",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Edit", "Bash"],
        ),
    ):
        print(message)

asyncio.run(main())
```

**TypeScript:**
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk"

for await (const message of query({
  prompt: "Analise o roteiro e sugira midias para cada cena",
  options: { allowedTools: ["Read", "Edit", "Bash"] }
})) {
  console.log(message)
}
```

### 18.3 Tools Built-In do SDK

| Tool | Funcao |
|------|--------|
| **Read** | Ler qualquer arquivo |
| **Write** | Criar arquivos |
| **Edit** | Editar arquivos existentes |
| **Bash** | Comandos terminal, git |
| **Glob** | Buscar arquivos por pattern |
| **Grep** | Buscar conteudo com regex |
| **WebSearch** | Buscar na web |
| **WebFetch** | Fetch e parse de URLs |
| **AskUserQuestion** | Perguntas interativas |
| **Task** | Spawnar subagentes |

### 18.4 Subagentes (Definicao Custom)

```python
async for message in query(
    prompt="Use o agente code-reviewer para revisar o codebase",
    options=ClaudeAgentOptions(
        allowed_tools=["Read", "Glob", "Grep", "Task"],
        agents={
            "code-reviewer": AgentDefinition(
                description="Revisor de codigo especialista em qualidade e seguranca.",
                prompt="Analise qualidade e sugira melhorias.",
                tools=["Read", "Glob", "Grep"],
            )
        },
    ),
):
    print(message)
```

### 18.5 Sessions (Persistencia de Contexto)

```python
# Primeira query: capturar session ID
async for message in query(
    prompt="Leia o modulo de autenticacao",
    options=ClaudeAgentOptions(allowed_tools=["Read", "Glob"]),
):
    if hasattr(message, "subtype") and message.subtype == "init":
        session_id = message.session_id

# Retomar depois com contexto completo
async for message in query(
    prompt="Agora encontre todos os lugares que chamam ele",
    options=ClaudeAgentOptions(resume=session_id),
):
    print(message)
```

### 18.6 Hooks no SDK

```python
async def log_file_change(input_data, tool_use_id, context):
    file_path = input_data.get("tool_input", {}).get("file_path", "unknown")
    with open("./audit.log", "a") as f:
        f.write(f"{datetime.now()}: modified {file_path}\n")
    return {}

async for message in query(
    prompt="Refatore utils.py",
    options=ClaudeAgentOptions(
        permission_mode="acceptEdits",
        hooks={
            "PostToolUse": [
                HookMatcher(matcher="Edit|Write", hooks=[log_file_change])
            ]
        },
    ),
):
    print(message)
```

### 18.7 MCP no Agent SDK

```typescript
for await (const message of query({
  prompt: "Abra example.com e descreva o que ve",
  options: {
    mcpServers: {
      playwright: {
        command: "npx",
        args: ["@playwright/mcp@latest"]
      }
    }
  }
})) {
  console.log(message)
}
```

### 18.8 Controle de Permissoes

```python
# Agente somente leitura
ClaudeAgentOptions(
    allowed_tools=["Read", "Glob", "Grep"],  # Sem Write/Edit
    permission_mode="bypassPermissions"
)
```

### 18.9 Subagent Patterns - Quando Usar

**Subagentes superam agente unico em 3 cenarios (pesquisa Anthropic):**
1. **Exploracao breadth-first** - Multiplas direcoes independentes
2. **Especializacao** - Agentes diferentes para dominios diferentes
3. **Processamento paralelo** - Operacoes batch time-critical

**Para maioria das tarefas, agente unico de alta qualidade e mais eficiente.**

### 18.10 Orchestrator-Worker Pattern (Recomendado)

```
Lead Agent (Claude Opus 4.6)
  - Coordenador, tomador de decisao, sintetizador
  |
  +-- Sonnet Agent 1 (Pesquisa)
  +-- Sonnet Agent 2 (Escritor)
  +-- Sonnet Agent 3 (Analista)
  +-- Sonnet Agent 4 (Revisor)
```

**Performance:** Lead Opus + Sonnet subagentes superou Opus 4 solo em 90.2% na avaliacao de pesquisa da Anthropic.

### 18.11 Selecao de Modelo por Custo

| Modelo | Input/MTok | Output/MTok | Batch (50% off) | Uso |
|--------|------------|-------------|------------------|-----|
| **Opus 4.6** | $15 | $75 | $7.50 / $37.50 | Coordenacao complexa |
| **Sonnet 4.6** | $3 | $15 | $1.50 / $7.50 | Subagentes, tarefas focadas |
| **Haiku 4.5** | $0.80 | $4 | $0.40 / $2 | Batch QA, verificacoes simples |

### 18.12 Links Agent SDK

- **Overview:** https://platform.claude.com/docs/en/agent-sdk/overview
- **Quickstart:** https://platform.claude.com/docs/en/agent-sdk/quickstart
- **TypeScript API:** https://platform.claude.com/docs/en/agent-sdk/typescript
- **Python API:** https://platform.claude.com/docs/en/agent-sdk/python
- **Exemplos:** https://github.com/anthropics/claude-agent-sdk-demos
- **NPM:** https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk
- **Subagentes:** https://code.claude.com/docs/en/sub-agents
- **Multi-Agent Research:** https://www.anthropic.com/engineering/multi-agent-research-system
- **Quando usar multi-agent:** https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them

---

## 19. Frameworks de Agentes IA

### Tabela Comparativa Rapida

| Framework | Linguagem | Modelos | Melhor Para | Curva | Maturidade |
|-----------|-----------|---------|-------------|-------|------------|
| **Claude Agent SDK** | TS/Python | Claude only | Producao com Claude | Facil | Novo (2024) |
| **LangGraph** | Python/TS | 40+ providers | Workflows complexos | Dificil | Maduro (2023+) |
| **CrewAI** | Python first | Muitos | Prototipacao rapida | Facil | Crescendo (2024+) |
| **AutoGen** | Python | Muitos | Sistemas enterprise | Media | Maduro |
| **Semantic Kernel** | Python/.NET | Qualquer | Orquestracao enterprise | Dificil | Maduro |
| **Vercel AI SDK** | TypeScript | Muitos | Web/Next.js apps | Facil | Novo (2024) |
| **Mastra** | TypeScript | 40+ | Apps TS modernos | Facil | Muito novo (2025) |

### 19.1 LangGraph (LangChain)

- **URL:** https://www.langchain.com/langgraph
- **GitHub Python:** https://github.com/langchain-ai/langgraph
- **GitHub JS:** https://github.com/langchain-ai/langgraphjs
- **O que e:** Framework graph-based para workflows de agentes resilientes
- **Arquitetura:** State Node -> Tool Execute -> State Node -> Tool Execute -> End
- **Forcas:** Workflows visuais, checkpointing robusto, human-in-the-loop, 40+ integracoes
- **Fraquezas:** Mais boilerplate, curva de aprendizado ingreme
- **Suporte Claude:** Sim via `langchain_anthropic`

### 19.2 CrewAI

- **URL:** https://www.crewai.com/
- **GitHub:** https://github.com/crewAIInc/crewAI
- **Docs:** https://docs.crewai.com/
- **O que e:** Framework multi-agente role-based (como equipes humanas)
- **Filosofia:** "Python trains, TypeScript ships"
- **Forcas:** Design intuitivo, documentacao excelente, prototipagem rapida
- **Fraquezas:** Primariamente Python, memoria menos sofisticada
- **Comunidade:** 20,000+ GitHub stars, 100,000+ devs certificados
- **Suporte Claude:** Sim

### 19.3 AutoGen (Microsoft)

- **URL:** https://github.com/microsoft/autogen
- **O que e:** Framework multi-agente conversacional (agent-to-agent dialogue)
- **Forcas:** Enterprise-grade, forte human-in-the-loop, WebSocket real-time
- **Fraquezas:** Mais complexo de setup, curva de aprendizado
- **Novo:** Microsoft Agent Framework (AutoGen + Semantic Kernel)
- **Docs:** https://learn.microsoft.com/en-us/agent-framework/

### 19.4 Semantic Kernel (Microsoft)

- **URL:** https://learn.microsoft.com/en-us/semantic-kernel/
- **GitHub:** https://github.com/microsoft/semantic-kernel
- **O que e:** SDK model-agnostic para orquestracao de agentes IA
- **Patterns:** Sequential, Concurrent, Custom agent orchestration
- **Forcas:** Model-agnostic, production-ready, plugin system
- **Fraquezas:** Comunidade menor que LangChain

### 19.5 Vercel AI SDK

- **URL:** https://ai-sdk.dev/
- **Blog:** https://vercel.com/blog/ai-sdk-6
- **O que e:** SDK TypeScript-focused com agents, streaming, tool calling
- **Features:** ToolLoopAgent, Zod schemas, SSE streaming, React/Next.js integration
- **Forcas:** Integracao Next.js, design simples, streaming built-in
- **Fraquezas:** Ecossistema Vercel-centric

```typescript
import { ToolLoopAgent, tool } from "ai/agents"
import { z } from "zod"

const agent = new ToolLoopAgent({
  model: anthropic("claude-opus-4-6"),
  tools: [myTool],
  systemPrompt: "Voce e um assistente de edicao de video"
})

const result = await agent.run("Analise esta timeline")
```

### 19.6 Mastra (Novo - Time do Gatsby)

- **URL:** https://mastra.ai/
- **GitHub:** https://github.com/mastra-ai/mastra
- **O que e:** Framework IA TypeScript-first com foco em DX
- **Features:** Agents, workflows, RAG, memory, tools, MCP, playground interativo, observability, evaluations, security guardrails
- **Forcas:** DX moderno, TypeScript-first, 40+ model providers, open source (Apache 2.0)
- **Fraquezas:** Muito novo, comunidade menor

### 19.7 Recomendacao para o Projeto

| Prazo | Framework | Motivo |
|-------|-----------|--------|
| **Curto** | Claude Agent SDK | Integracao simples no Python bridge, controle direto |
| **Medio** | Mastra | Melhor integracao React/Electron, TypeScript nativo |
| **Longo** | LangGraph | Se workflows ficarem muito complexos |

---

## 20. Claude API - Features Avancadas

### 20.1 Extended Thinking (Chain-of-Thought)

**O que e:** Claude raciocina passo-a-passo, mostrando pensamento interno.

**Tipos:**
- **Extended Thinking** - Raciocinio profundo e visivel (mais lento)
- **Adaptive Thinking (novo)** - Claude decide automaticamente quando pensar profundamente

```python
from anthropic import Anthropic

client = Anthropic()

response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=16000,
    thinking={
        "type": "enabled",
        "budget_tokens": 10000  # Max pensamento interno
    },
    messages=[{"role": "user", "content": "Resolva este problema complexo..."}]
)

for block in response.content:
    if block.type == "thinking":
        print("Raciocinio:", block.thinking)
    elif block.type == "text":
        print("Resposta:", block.text)
```

**Docs:**
- https://platform.claude.com/docs/en/build-with-claude/extended-thinking
- https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking

### 20.2 Vision (Analise de Imagem)

**Formatos:** JPEG, PNG, GIF, WebP
**Limites:** 100 imagens por request, 32MB total

**Metodos de envio:**
1. Base64 encoding
2. URL reference
3. Files API (imagens reutilizaveis)

```python
# Base64
response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {
                "type": "image",
                "source": {"type": "base64", "media_type": "image/png", "data": image_b64}
            },
            {"type": "text", "text": "O que tem nesta imagem?"}
        ]
    }]
)
```

**Uso no projeto:**
- Analisar frames de video para detectar mudanca de cena
- Reconhecer objetos/atores em frames
- Validar output do CapCut visualmente

**Docs:** https://platform.claude.com/docs/en/build-with-claude/vision

### 20.3 Computer Use

**O que e:** Claude interage com tela do computador como humano - clica, digita, scrolla.
**Performance:** 61.4% no OSWorld benchmark (competidores: 7.8%)
**Capacidades:** Ver tela, clicar mouse em coordenadas, digitar, zoom
**Status:** Beta limitado

**Uso potencial:** Automatizar GUI do CapCut diretamente (sem manipulacao JSON)

**Docs:** https://platform.claude.com/docs/en/build-with-claude/computer-use

### 20.4 Prompt Caching

**O que e:** Armazenar e reutilizar prefixos de prompt processados entre requests.
**Economia:** Ate 90% reducao de custo, ate 85% reducao de latencia

```python
response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    system=[{
        "type": "text",
        "text": "Voce e um revisor de codigo Python...",
        "cache_control": {"type": "ephemeral"}
    }],
    messages=[{"role": "user", "content": "Revise este arquivo..."}]
)

# Usage info
print(response.usage.cache_creation_input_tokens)
print(response.usage.cache_read_input_tokens)
```

**Minimo cache:** 1024 tokens (Opus/Sonnet), 2048 tokens (Haiku 3)

**Docs:** https://platform.claude.com/docs/en/build-with-claude/prompt-caching

### 20.5 Batch API

**O que e:** Processamento assincrono em lote com 50% desconto.

| Modelo | Standard | Batch |
|--------|----------|-------|
| Opus 4.6 | $15/$75 MTok | $7.50/$37.50 MTok |
| Sonnet 4.6 | $3/$15 MTok | $1.50/$7.50 MTok |
| Haiku 4.5 | $0.80/$4 MTok | $0.40/$2 MTok |

**Processamento:** Maioria < 1 hora, timeout 24h

**Uso no projeto:**
- Analise em lote de catalogos de video
- Processamento massivo de metadata CapCut
- Jobs noturnos de analise de roteiro

**Docs:** https://platform.claude.com/docs/en/build-with-claude/batch-processing

### 20.6 Tool Use / Function Calling

```python
tools = [{
    "name": "detect_scenes",
    "description": "Detecta limites de cena em arquivo de video",
    "input_schema": {
        "type": "object",
        "properties": {
            "video_path": {"type": "string"},
            "sensitivity": {"type": "number"}
        },
        "required": ["video_path"]
    }
}]

response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    tools=tools,
    messages=[{"role": "user", "content": "Analise o video e identifique cenas"}]
)

for block in response.content:
    if block.type == "tool_use":
        # Claude quer usar a tool - executar e retornar resultado
        print(f"Tool: {block.name}, Input: {block.input}")
```

**Docs:** https://platform.claude.com/docs/en/build-with-claude/tool-use

### 20.7 Streaming

Reduz latencia percebida mostrando respostas conforme sao geradas.

```typescript
const stream = await client.messages.stream({
  model: "claude-opus-4-6",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Analise este roteiro" }]
})

for await (const chunk of stream) {
  if (chunk.type === "content_block_delta") {
    process.stdout.write(chunk.delta.text)
  }
}
```

### 20.8 Anthropic SDK

**TypeScript:**
- **NPM:** `npm install @anthropic-ai/sdk`
- **GitHub:** https://github.com/anthropics/anthropic-sdk-typescript
- **NPM page:** https://www.npmjs.com/package/@anthropic-ai/sdk

**Python:**
- **PyPI:** `pip install anthropic`
- **GitHub:** https://github.com/anthropics/anthropic-sdk-python

---

## 21. Casos de Uso de Agentes no Projeto

### 21.1 Script Analysis Agent

**Objetivo:** Parsear roteiro, detectar cenas, sugerir keywords de midia

```
Stage 1 -> Agent analisa roteiro
           |-- Detecta transicoes de cena
           |-- Identifica personagens/objetos
           |-- Sugere keywords de musica
           |-- Recomenda efeitos visuais
           |-- Auto-classifica tipos de cena
```

### 21.2 Vision-Based Scene Detection Agent

**Objetivo:** Analisar frames exportados do CapCut para validar limites de cena

```
Extrair frames do CapCut
    |
    v
Vision Agent
    |-- Detectar mudancas de shot
    |-- Identificar atores/objetos
    |-- Extrair temas visuais
    |-- Quality check (blur, escuro?)
    |-- Recomendar cortes
```

### 21.3 Batch QA Agent

**Objetivo:** Verificar todos os 6 stages completaram com sucesso

```
Projeto CapCut final
    |
    v
QA Agent
    |-- Validar sync texto
    |-- Checar niveis de audio
    |-- Verificar posicao de midia
    |-- Confirmar integridade da timeline
    |-- Auditar metadata
    |-- Gerar relatorio QA
```

### 21.4 Media Suggestion Agent (Orchestrator-Worker)

**Objetivo:** Para cada cena, sugerir midias apropriadas

```
Cena: "Garota dancando no parque ao por do sol"
    |
    v
Lead Agent (Opus - orquestrador)
    |-- [Sonnet] Buscar clips de danca
    |-- [Sonnet] Encontrar B-roll de por do sol
    |-- [Sonnet] Buscar ambience de parque
    |-- [Sonnet] Encontrar transicoes
    |-- [Opus] Sintetizar melhores recomendacoes
```

### 21.5 Conversational Editing Assistant

**Objetivo:** Agente interativo dentro do app Electron para ajuda em tempo real

```
Usuario: "A musica esta muito alta aqui"
    |
    v
Assistant Agent (Sonnet 4.6)
    |-- Pergunta: "Qual timestamp?"
    |-- Sugere: "Reduzir 3dB?"
    |-- Executa: Modifica CapCut via Python bridge
    |-- Preview: "Assim ficou"
    |-- Confirma: "Bom? Salvar?"
```

### 21.6 Arquitetura Multi-Agent Recomendada

```
Main Orchestrator (Claude Opus 4.6)
  - Roteia requests para subagentes
  - Gerencia estado do workflow
  - Sintetiza resultados finais
  |
  +-- Script Parser (Sonnet) - Stage 1
  +-- Scene Detector (Sonnet) - Stage 2
  +-- Media Agent (Sonnet) - Stage 5
  +-- Audio Agent (Sonnet) - Stage 2
  +-- Quality Check (Haiku) - Stage 6
```

---

## 22. Testes e Qualidade

### 22.1 Vitest

- **URL:** https://vitest.dev/
- **O que e:** Framework de testes unitarios nativo Vite (nosso builder)
- **Features:** HMR para testes, ESM nativo, TypeScript nativo, coverage
- **Instalacao:** `npm install -D vitest`
- **Configuracao:** Integra com `vite.config.ts` automaticamente
- **Relevancia:** Testes para stores Zustand, lib functions, utilities

### 22.2 Playwright

- **URL:** https://playwright.dev/
- **O que e:** Framework de testes E2E cross-browser da Microsoft
- **Features:** Auto-wait, web-first assertions, tracing, screenshots
- **Electron:** `npm install -D @playwright/test electron`
- **Relevancia:** Testes de integracao do app Electron completo

### 22.3 Testing Library

- **URL:** https://testing-library.com/
- **O que e:** Utilitarios de teste focados em acessibilidade
- **React:** `@testing-library/react`
- **Relevancia:** Testar componentes React isolados

### 22.4 Estrategia de Testes Recomendada

| Nivel | Framework | O Que Testar |
|-------|-----------|--------------|
| **Unit** | Vitest | scriptSplitter, syncEngine, sceneGrouper, time.ts, srt.ts |
| **Component** | Vitest + Testing Library | Componentes shared, stage components |
| **Integration** | Vitest | Stores Zustand, IPC handlers (mock) |
| **E2E** | Playwright | Fluxo completo dos 6 stages |
| **Python** | pytest | capcut_reader, capcut_writer, metadata_sync |

---

## 23. Build, Distribuicao e Monitoramento

### 23.1 electron-builder (nosso atual)

- **URL:** https://www.electron.build/
- **Configuracao:** `electron-builder.yml`
- **Problema atual:** appId/productName ainda sao "temp-scaffold"
- **Targets:** NSIS (Windows), DMG (macOS), AppImage (Linux)

### 23.2 electron-updater

- **URL:** https://www.electron.build/auto-update
- **Features:** Auto-update diferencial, rollback, staging, code signing
- **Provedores:** GitHub Releases, S3, generic HTTP
- **Relevancia:** Distribuir atualizacoes OTA

### 23.3 Sentry (Error Monitoring)

- **URL:** https://sentry.io/
- **SDK Electron:** `@sentry/electron`
- **Features:** Crash reporting, performance monitoring, session replay
- **Free tier:** 5K erros/mes, 10K sessoes performance
- **Relevancia:** Monitorar erros em producao, especialmente falhas do Python bridge

### 23.4 Code Signing

- **Windows:** Certificado code signing (EV ou standard)
- **macOS:** Apple Developer ID
- **Relevancia:** Necessario para distribuicao sem warnings de seguranca

### 23.5 Analytics

- **Plausible:** https://plausible.io/ - Privacy-focused, self-hostable
- **PostHog:** https://posthog.com/ - Product analytics, feature flags
- **Relevancia:** Entender uso do app, quais stages sao mais usados

---

## 24. Projetos e Competidores de Referencia

### 24.1 Ferramentas Similares

| Ferramenta | O Que Faz | Relevancia |
|------------|-----------|------------|
| **Descript** | Edicao de video baseada em script | Referencia de UX |
| **Kapwing** | Editor de video online com IA | Auto B-roll, legendas |
| **Submagic** | Legendas automaticas com IA | Word-level timing |
| **OpusClip** | Corte automatico de videos longos | Scene detection |
| **Remotion** | Video programatico em React | Referencia tecnica |
| **Shotstack** | API de video para automacao | API patterns |
| **AutoCut** | IA para edicao automatica | Workflow reference |
| **Prescene** | Analise de roteiro com IA | Script parsing |
| **Filmustage** | Breakdown automatico de roteiro | NER, scene detection |

### 24.2 Projetos Open Source de Referencia

| Projeto | GitHub | Relevancia |
|---------|--------|------------|
| **pyCapCut** | https://github.com/GuanYixuan/pyCapCut | Manipulacao CapCut |
| **capcutapi** | https://github.com/gogelabs/capcutapi | API wrapper |
| **capcut-srt-export** | https://github.com/nickelghost/capcut-srt-export | SRT export |
| **OpenTimelineIO** | https://github.com/AcademySoftwareFoundation/OpenTimelineIO | Timeline interchange |
| **WhisperX** | https://github.com/m-bain/whisperX | Transcricao word-level |
| **faster-whisper** | https://github.com/SYSTRAN/faster-whisper | Transcricao rapida |
| **stable-ts** | https://github.com/jianfch/stable-ts | Timestamp refinement |
| **edge-tts** | https://github.com/rany2/edge-tts | TTS gratis |
| **Piper** | https://github.com/rhasspy/piper | TTS local rapido |
| **XTTS v2** | https://huggingface.co/coqui/XTTS-v2 | Voice cloning |
| **Bark** | https://github.com/suno-ai/bark | TTS com efeitos |
| **CLIP** | https://github.com/openai/CLIP | Image-text matching |
| **Wavesurfer.js** | https://wavesurfer.xyz/ | Audio visualization |

### 24.3 Frameworks de Video Programatico

| Framework | URL | O Que Faz |
|-----------|-----|-----------|
| **Remotion** | https://remotion.dev/ | Criar videos com React |
| **Shotstack** | https://shotstack.io/ | API de edicao de video |
| **Creatomate** | https://creatomate.com/ | API para geracao de video |
| **FFCreator** | https://github.com/tnfe/FFCreator | Node.js video creation |

---

## 25. Fontes e Links

### Claude / Anthropic
- Claude Agent SDK Overview: https://platform.claude.com/docs/en/agent-sdk/overview
- Claude Agent SDK Quickstart: https://platform.claude.com/docs/en/agent-sdk/quickstart
- Claude Agent SDK TypeScript: https://platform.claude.com/docs/en/agent-sdk/typescript
- Claude Agent SDK Python: https://platform.claude.com/docs/en/agent-sdk/python
- Claude Agent SDK Demos: https://github.com/anthropics/claude-agent-sdk-demos
- Claude Agent SDK NPM: https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk
- Anthropic SDK TypeScript: https://github.com/anthropics/anthropic-sdk-typescript
- Anthropic SDK NPM: https://www.npmjs.com/package/@anthropic-ai/sdk
- Custom Subagents: https://code.claude.com/docs/en/sub-agents
- Multi-Agent Research: https://www.anthropic.com/engineering/multi-agent-research-system
- When Multi-Agent: https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them
- Extended Thinking: https://platform.claude.com/docs/en/build-with-claude/extended-thinking
- Adaptive Thinking: https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking
- Vision: https://platform.claude.com/docs/en/build-with-claude/vision
- Computer Use: https://platform.claude.com/docs/en/build-with-claude/computer-use
- Prompt Caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Batch API: https://platform.claude.com/docs/en/build-with-claude/batch-processing
- Tool Use: https://platform.claude.com/docs/en/build-with-claude/tool-use
- Pricing: https://platform.claude.com/docs/en/about-claude/pricing

### MCP
- Spec: https://modelcontextprotocol.io/
- Smithery Registry: https://smithery.ai/
- mcp.so: https://mcp.so/
- Glama: https://glama.ai/mcp/servers
- PulseMCP: https://www.pulsemcp.com/
- mcp-get: https://mcp-get.com/

### Frameworks de Agentes
- LangGraph: https://www.langchain.com/langgraph
- LangGraph GitHub: https://github.com/langchain-ai/langgraph
- LangGraphJS: https://github.com/langchain-ai/langgraphjs
- CrewAI: https://www.crewai.com/
- CrewAI GitHub: https://github.com/crewAIInc/crewAI
- CrewAI Docs: https://docs.crewai.com/
- AutoGen: https://github.com/microsoft/autogen
- Semantic Kernel: https://learn.microsoft.com/en-us/semantic-kernel/
- Semantic Kernel GitHub: https://github.com/microsoft/semantic-kernel
- Vercel AI SDK: https://ai-sdk.dev/
- Vercel AI SDK Blog: https://vercel.com/blog/ai-sdk-6
- Mastra: https://mastra.ai/
- Mastra GitHub: https://github.com/mastra-ai/mastra

### TTS
- Edge TTS: https://github.com/rany2/edge-tts
- ElevenLabs: https://elevenlabs.io/
- ElevenLabs Pricing: https://elevenlabs.io/pricing
- Google Gemini API: https://ai.google.dev/gemini-api/docs
- Google Cloud TTS: https://cloud.google.com/text-to-speech
- OpenAI TTS: https://platform.openai.com/docs/guides/text-to-speech
- Azure Speech: https://azure.microsoft.com/pricing/details/cognitive-services/speech-services/
- XTTS v2: https://huggingface.co/coqui/XTTS-v2
- Piper: https://github.com/rhasspy/piper
- Piper Fork: https://github.com/OHF-Voice/piper1-gpl
- Coqui TTS: https://github.com/coqui-ai/TTS
- Bark: https://github.com/suno-ai/bark

### Midia e Processamento
- fluent-ffmpeg: https://github.com/fluent-ffmpeg/node-fluent-ffmpeg
- Sharp: https://sharp.pixelplumbing.com/
- FFmpeg.wasm: https://github.com/ffmpegwasm/ffmpeg.wasm
- Wavesurfer.js: https://wavesurfer.xyz/
- BBC waveform-data.js: https://github.com/bbc/waveform-data.js
- pyAudioAnalysis: https://github.com/tyiannak/pyAudioAnalysis

### Legendas e Transcricao
- WhisperX: https://github.com/m-bain/whisperX
- Faster-Whisper: https://github.com/SYSTRAN/faster-whisper
- stable-ts: https://github.com/jianfch/stable-ts

### NLP
- spaCy: https://spacy.io/
- Hugging Face: https://huggingface.co/models

### IA Generativa
- Runway: https://runwayml.com/api
- Pika: https://pika.art/
- DALL-E / OpenAI: https://openai.com/api/pricing/
- Stable Diffusion WebUI: https://github.com/AUTOMATIC1111/stable-diffusion-webui
- ComfyUI: https://github.com/comfyanonymous/ComfyUI
- CLIP: https://github.com/openai/CLIP
- Suno: https://suno.com/
- Udio: https://www.udio.com/
- Midjourney: https://www.midjourney.com/

### Stock Media APIs
- Pexels: https://www.pexels.com/api/
- Unsplash: https://unsplash.com/developers
- Pixabay: https://pixabay.com/api/docs/

### UI/UX
- shadcn/ui: https://ui.shadcn.com/
- Radix UI: https://www.radix-ui.com/primitives
- Sonner: https://sonner.emilkowal.dev/
- cmdk: https://cmdk.paco.me/
- Motion: https://motion.dev/
- TanStack Table: https://tanstack.com/table/latest
- dnd-kit: https://dndkit.com/
- Lucide: https://lucide.dev/
- React Hook Form: https://react-hook-form.com/
- Zod: https://zod.dev/

### Desktop / Electron
- electron-vite: https://electron-vite.org/
- electron-builder: https://www.electron.build/
- electron-updater: https://www.electron.build/auto-update
- electron-store: https://github.com/sindresorhus/electron-store
- Chokidar: https://github.com/paulmillr/chokidar

### Testes
- Vitest: https://vitest.dev/
- Playwright: https://playwright.dev/
- Testing Library: https://testing-library.com/

### Monitoramento
- Sentry: https://sentry.io/
- Plausible: https://plausible.io/
- PostHog: https://posthog.com/

### CapCut
- pyCapCut: https://github.com/GuanYixuan/pyCapCut
- capcutapi: https://github.com/gogelabs/capcutapi
- capcut-srt-export: https://github.com/nickelghost/capcut-srt-export

### Timeline / Video
- OpenTimelineIO: https://github.com/AcademySoftwareFoundation/OpenTimelineIO
- Remotion: https://remotion.dev/
- Shotstack: https://shotstack.io/

### Automacao
- BullMQ: https://bullmq.io/
- n8n: https://n8n.io/
- Temporal: https://temporal.io/

### Comparativos e Tutoriais
- CrewAI vs LangGraph vs AutoGen: https://www.datacamp.com/tutorial/crewai-vs-langgraph-vs-autogen
- Claude Agent SDK Tutorial: https://www.datacamp.com/tutorial/how-to-use-claude-agent-sdk
- Building Agents Guide: https://nader.substack.com/p/the-complete-guide-to-building-agents
- Electron + Claude: https://www.stephanmiller.com/electron-project-from-scratch-with-claude-code/
