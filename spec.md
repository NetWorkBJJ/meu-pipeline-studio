# SPEC - MEU PIPELINE STUDIO

Especificacao tecnica filtrada. Apenas itens acionaveis com impacto real no projeto.

---

## 1. Bugs Criticos (Corrigir Primeiro)

### 1.1 updateSubtitleTimings recebe IDs errados (Stage 3)

**Problema:** `updateSubtitleTimings` recebe IDs de audio ao inves de IDs de texto.
**Impacto:** Sincronizacao texto+audio falha silenciosamente.
**Correcao:** Mapear corretamente storyBlock IDs ao chamar a funcao.

### 1.2 Insercao duplicada no Stage 6

**Problema:** Stage 6 permite inserir segmentos multiplas vezes sem limpar os anteriores.
**Impacto:** Timeline do CapCut acumula segmentos duplicados.
**Correcao:** Verificar se segmentos ja existem antes de inserir, ou limpar track antes de escrever.

### 1.3 Reset incompleto do Sidebar

**Problema:** Reset do Sidebar chama apenas `useStageStore.reset()` sem chamar `resetProject()`.
**Impacto:** Estado do projeto permanece stale apos "novo projeto".
**Correcao:** Chamar reset de todas as 3 stores (project, stage, ui).

---

## 2. Refactoring Urgente

### 2.1 Tipos duplicados

**Problema:** Interfaces `StoryBlock`, `AudioBlock`, `Scene` definidas em 5+ arquivos.
**Acao:** Consolidar todas em `src/renderer/src/types/`. Um unico source of truth.

### 2.2 Codigo morto

**Remover:**
- Progress events nao conectados
- `generate_srt` no Python (nao chamado)
- `Character` type (nao usado)
- `mediaPreset` (nao usado)
- `settingsOpen` no useUIStore (nao usado)
- `IpcChannels` enum (nao usado)

### 2.3 Componentes shared orfaos

**Problema:** Componentes em `shared/` definidos mas nao importados por nenhum stage.
**Acao:** Auditar e integrar nos stages ou remover.

### 2.4 Python bridge hardening

**Problemas atuais:**
- Sem timeout (processo pode travar indefinidamente)
- Sem restart automatico apos crash
- Sem deteccao de `python3` vs `python`
- Path do CapCut hardcoded para um unico usuario

**Correcoes:**
- Adicionar timeout configuravel (default 30s)
- Retry com backoff exponencial (max 3 tentativas)
- Detectar python: tentar `python3` primeiro, fallback `python`
- Path do CapCut: detectar automaticamente ou permitir configuracao

---

## 3. UI Overhaul - shadcn/ui + Lucide + Sonner

### 3.1 shadcn/ui

- **URL:** https://ui.shadcn.com/
- **O que e:** Componentes copiados para o projeto (sem dependencia externa), construidos com Radix UI + Tailwind CSS
- **Compatibilidade:** React 19, Tailwind CSS v4 (desde v2.3)
- **Instalacao:** `npx shadcn@latest init` + `npx shadcn@latest add <component>`

**Componentes a adotar:**

| shadcn Component | Substitui | Usado Em |
|------------------|-----------|----------|
| Button | `shared/Button.tsx` | Todos os stages |
| Input | `shared/Input.tsx` | Stage 1, configs |
| Select | `shared/Select.tsx` | Stage 4 (tipo de cena) |
| Dialog | `shared/Modal.tsx` | Confirmacoes, settings |
| Table | `shared/DataTable.tsx` | Stages 2, 3, 4 |
| Badge | `shared/Badge.tsx` | Status, tags |
| Progress | `shared/ProgressBar.tsx` | Stage 6, operacoes |
| Textarea | `shared/TextArea.tsx` | Stage 1 (roteiro) |
| Tabs | - | Navegacao entre views |
| Tooltip | - | Hints de UI |
| Sheet | - | Paineis laterais |
| Command | - | Paleta de comandos (Ctrl+K) |

**Tema:** Dark theme customizado com nossas cores:
```css
/* Mapear para CSS variables do shadcn */
--background: #1a1a1a;
--card: #242424;
--border: #3a3a3a;
--foreground: #f5f5f5;
--muted-foreground: #a3a3a3;
--primary: #f97316; /* orange-500 */
```

### 3.2 Lucide React

- **URL:** https://lucide.dev/
- **Instalacao:** `npm install lucide-react`
- **Tamanho:** ~200 bytes por icone (tree-shakeable)
- **Uso:** `<Play size={16} />`, `<FileVideo />`, `<Music />`
- **Acao:** Substituir todos os icones unicode (checkmark, X, setas) por icones SVG consistentes

### 3.3 Sonner (Toast)

- **URL:** https://sonner.emilkowal.dev/
- **Instalacao:** `npm install sonner`
- **Tamanho:** ~5kb gzipped
- **API:** `toast('Mensagem')`, `toast.success()`, `toast.error()`, `toast.promise()`
- **Acao:** Substituir `shared/Toast.tsx` por Sonner. Adicionar `<Toaster />` no App.tsx.

---

## 4. State Management - Zustand Upgrades

### 4.1 Persist (resolver perda de estado)

**Problema critico:** App perde todo o estado ao recarregar.

```typescript
import { persist } from 'zustand/middleware'

export const useProjectStore = create(
  persist(
    (set) => ({
      // ... state atual
    }),
    {
      name: 'mps-project',  // chave no localStorage
      partialize: (state) => ({
        // Persistir apenas dados essenciais, nao UI state
        draftPath: state.draftPath,
        projectName: state.projectName,
        storyBlocks: state.storyBlocks,
        audioBlocks: state.audioBlocks,
        syncedBlocks: state.syncedBlocks,
        scenes: state.scenes,
      }),
    }
  )
)
```

### 4.2 Immer (atualizacoes imutaveis simplificadas)

```typescript
import { immer } from 'zustand/middleware/immer'

// Antes (spread manual, propenso a erros):
updateBlock: (id, changes) => set((state) => ({
  storyBlocks: state.storyBlocks.map(b => b.id === id ? { ...b, ...changes } : b)
}))

// Depois (mutacao direta, Immer cuida da imutabilidade):
updateBlock: (id, changes) => set((state) => {
  const block = state.storyBlocks.find(b => b.id === id)
  if (block) Object.assign(block, changes)
})
```

### 4.3 Devtools

```typescript
import { devtools } from 'zustand/middleware'

export const useProjectStore = create(
  devtools(
    persist(
      immer((set) => ({ /* ... */ })),
      { name: 'mps-project' }
    ),
    { name: 'ProjectStore' }
  )
)
```

---

## 5. Typed IPC

**Problema:** Canais IPC sao strings sem type safety. Erros de typo ou argumentos errados sao silenciosos.

### Implementacao

```typescript
// src/renderer/src/types/ipc.ts
interface IpcChannelMap {
  'project:select-draft': { args: []; return: string | null }
  'project:get-recent': { args: []; return: string[] }
  'capcut:read-audio-blocks': { args: [string]; return: RawAudioBlock[] }
  'capcut:write-text-segments': { args: [string, TextSegment[]]; return: { count: number } }
  'capcut:write-video-segments': { args: [string, VideoSegment[]]; return: { count: number } }
  'capcut:sync-metadata': { args: [string]; return: { success: boolean } }
  'audio:detect-blocks': { args: [string]; return: AudioBlock[] }
  'file:select-media': { args: [string[]]; return: string[] }
}

// src/preload/index.ts
function typedInvoke<K extends keyof IpcChannelMap>(
  channel: K,
  ...args: IpcChannelMap[K]['args']
): Promise<IpcChannelMap[K]['return']> {
  return ipcRenderer.invoke(channel, ...args)
}
```

---

## 6. Persistencia de Configuracao - electron-store

- **URL:** https://github.com/sindresorhus/electron-store
- **Instalacao:** `npm install electron-store`

**Dados a persistir:**
- Ultimo draft path aberto
- Paths recentes (lista dos ultimos 5-10 projetos)
- Preferencias de TTS (voz, velocidade)
- Path customizado do CapCut (se nao for default)
- Configuracoes de janela (tamanho, posicao)

```typescript
// src/main/config.ts
import Store from 'electron-store'

interface AppConfig {
  recentDrafts: string[]
  capcutBasePath: string
  ttsVoice: string
  ttsSpeed: number
  windowBounds: { width: number; height: number; x: number; y: number }
}

export const config = new Store<AppConfig>({
  defaults: {
    recentDrafts: [],
    capcutBasePath: 'C:/Users/{username}/AppData/Local/CapCut/User Data/Projects/com.lveditor.draft/',
    ttsVoice: 'pt-BR-AntonioNeural',
    ttsSpeed: 1.0,
    windowBounds: { width: 1200, height: 800, x: 0, y: 0 },
  },
})
```

---

## 7. TTS - Edge TTS (Default Gratuito)

- **URL:** https://github.com/rany2/edge-tts
- **Preco:** GRATIS (usa servico TTS do Microsoft Edge)
- **Qualidade:** Boa, natural, comparavel a servicos pagos
- **PT-BR:** Sim, multiplas vozes masculinas e femininas
- **Sem autenticacao:** Nenhuma API key necessaria

**Instalacao Python:** `pip install edge-tts`
**Instalacao Node.js:** `npm install edge-tts-universal`

**Vozes PT-BR disponiveis:**
- `pt-BR-AntonioNeural` (masculina)
- `pt-BR-FranciscaNeural` (feminina)
- `pt-BR-ThalitaNeural` (feminina)

**Funcionalidades:**
- Gera audio MP3/WAV
- Gera legendas SRT/VTT junto com o audio (word-level timestamps)
- Controle de velocidade, pitch, volume via SSML

**Integracao no pipeline:**
```
Stage 1 (roteiro) -> Edge TTS -> audio + SRT word-level -> Stage 2 (detectar) -> Stage 3 (sync)
```

**Opcao premium (referencia):** ElevenLabs ($5-99/mes) para narracao profissional com voice cloning.

---

## 8. Processamento de Midia

### 8.1 fluent-ffmpeg

- **URL:** https://github.com/fluent-ffmpeg/node-fluent-ffmpeg
- **Instalacao:** `npm install fluent-ffmpeg`

**Uso no projeto:**
- Extrair duracao/resolucao de videos
- Gerar thumbnails para preview
- Converter formatos de audio (WAV -> MP3)
- Extrair audio de video para transcricao

**Electron:** Usar `ffmpeg-static-electron` para binarios empacotados.

### 8.2 Sharp

- **URL:** https://sharp.pixelplumbing.com/
- **Instalacao:** `npm install sharp`
- **Performance:** 4-5x mais rapido que ImageMagick

**Uso no projeto:**
- Gerar thumbnails de imagens
- Redimensionar/otimizar imagens antes de inserir no CapCut
- Extrair metadata de imagens (resolucao, formato)

### 8.3 Wavesurfer.js (Audio Visualization)

- **URL:** https://wavesurfer.xyz/
- **Wrappers React:** `react-audio-visualize`

**Uso no projeto (Stage 3):**
- Visualizar waveform do audio na interface de sincronizacao
- Regions interativas para ajuste manual de timing
- Player integrado com timeline visual

---

## 9. Stock Media APIs (Stage 5)

### Estrategia: 3 APIs gratuitas em cascata

| API | Conteudo | Limite | Melhor Para |
|-----|----------|--------|-------------|
| **Pexels** | 3M+ fotos/videos | Sem limite publico | B-roll video |
| **Unsplash** | Fotos HD esteticas | 50 req/hora | Fotos de alta qualidade |
| **Pixabay** | 5M+ multimedia | 100 req/min | Fallback geral + musica |

**URLs:**
- Pexels: https://www.pexels.com/api/
- Unsplash: https://unsplash.com/developers
- Pixabay: https://pixabay.com/api/docs/

**Pipeline de busca:**
```
Keyword da cena (Stage 4)
    |
    v
Pexels API (primario) -> videos/fotos
    |
    v (se nao encontrar)
Unsplash API -> fotos esteticas
    |
    v (se nao encontrar)
Pixabay API -> multimedia geral
```

**Todas gratuitas, sem custo de API.**

---

## 10. Transcricao - WhisperX + faster-whisper

### 10.1 WhisperX (word-level timestamps)

- **URL:** https://github.com/m-bain/whisperX
- **Performance:** 70x realtime com large-v2
- **Feature:** Timestamps word-level via alinhamento wav2vec2
- **Speaker diarization:** Incluido

**Uso:** Gerar legendas SRT word-level para sincronizacao precisa no CapCut.

### 10.2 faster-whisper

- **URL:** https://github.com/SYSTRAN/faster-whisper
- **Performance:** 4x mais rapido que OpenAI Whisper, mesma acuracia
- **Tecnologia:** CTranslate2 fast inference engine

**Uso:** Transcricao rapida como alternativa mais leve ao WhisperX.

### 10.3 stable-ts (refinamento)

- **URL:** https://github.com/jianfch/stable-ts
- **Instalacao:** `pip install stable-ts`
- **Uso:** Refinar timestamps do Whisper para acuracia de producao.

---

## 11. Tabelas Profissionais - TanStack Table

- **URL:** https://tanstack.com/table/latest
- **Instalacao:** `npm install @tanstack/react-table`
- **Performance:** Virtualiza 100k+ linhas

**Substituicoes:**

| Componente Atual | TanStack Table Feature |
|------------------|----------------------|
| BlocksPreview (Stage 1) | Sorting, filtering por texto |
| AudioBlocksList (Stage 2) | Sorting por duracao, filtragem |
| SyncPreview (Stage 3) | Row selection, inline editing |
| SceneList (Stage 4) | Grouping, expand/collapse |
| MediaList (Stage 5) | Filtering, status badges |

---

## 12. Validacao - React Hook Form + Zod

- **React Hook Form:** https://react-hook-form.com/
- **Zod:** https://zod.dev/
- **Instalacao:** `npm install react-hook-form zod @hookform/resolvers`

**Uso:**
- Stage 1: Validar roteiro nao vazio, tamanho minimo
- Settings: Validar paths, URLs, numeros
- Configuracao de TTS: Validar velocidade (0.5-2.0), volume (0-100)

---

## 13. Testes - Vitest

- **URL:** https://vitest.dev/
- **Instalacao:** `npm install -D vitest`
- **Integracao:** Nativa com vite (nosso builder)

**Prioridade de testes (por impacto):**

| Modulo | Tipo | Prioridade |
|--------|------|------------|
| `scriptSplitter.ts` | Unit | ALTA - core do Stage 1 |
| `syncEngine.ts` | Unit | ALTA - core do Stage 3 |
| `sceneGrouper.ts` | Unit | ALTA - core do Stage 4 |
| `time.ts` | Unit | ALTA - conversoes de tempo |
| `srt.ts` | Unit | ALTA - parsing/geracao SRT |
| Zustand stores | Integration | MEDIA - logica de estado |
| `capcut_reader.py` | Unit (pytest) | MEDIA - leitura de JSON |
| `capcut_writer.py` | Unit (pytest) | MEDIA - escrita de JSON |
| `metadata_sync.py` | Unit (pytest) | MEDIA - sync de metadata |

---

## 14. Build Config

### electron-builder.yml

**Correcoes necessarias:**
- `appId`: Trocar de "temp-scaffold" para `com.meupipeline.studio`
- `productName`: Trocar para `MEU PIPELINE STUDIO`
- `directories.output`: Verificar se esta correto
- `files`: Incluir pasta `python/` no build
- `extraResources`: Incluir binarios Python se necessario

---

## 15. Claude Code - Setup de Desenvolvimento

### 15.1 .claude/rules/ (regras condicionais)

Criar regras que se aplicam apenas a arquivos especificos:

**`.claude/rules/react-components.md`:**
```yaml
---
description: "Regras para componentes React"
globs: ["src/renderer/src/components/**/*.tsx"]
---
- Named exports apenas (sem default export)
- Um componente por arquivo
- Props interface definida inline ou importada de @/types
- Usar shadcn/ui components quando disponivel
- Icones via Lucide React, nunca unicode
```

**`.claude/rules/python-bridge.md`:**
```yaml
---
description: "Regras para Python bridge"
globs: ["python/**/*.py"]
---
- Docstrings em ingles
- snake_case para funcoes e variaveis
- Flush stdout apos cada write
- JSON-line protocol: {"id": "...", "result": ...} ou {"id": "...", "error": {"message": "..."}}
- NUNCA ler draft_content.json inteiro na memoria do Claude (1-10MB+)
```

**`.claude/rules/capcut-safety.md`:**
```yaml
---
description: "Regras para manipulacao CapCut"
globs: ["python/capcut_*.py", "src/main/ipc/capcut*.ts"]
---
- NUNCA reescrever draft_content.json inteiro
- SEMPRE chamar syncMetadata apos qualquer escrita
- NUNCA alterar texto de legendas existentes durante sincronizacao
- NUNCA alterar segmentos de audio existentes durante insercao de midias
- Preservar todos os campos desconhecidos do JSON
- Unidade interna: microsegundos (us = ms * 1000)
- draft_meta_info.json: campo "draft_timeline_materials_size_" COM underscore
- root_meta_info.json: campo "draft_timeline_materials_size" SEM underscore
```

### 15.2 Hooks (auto-format)

**`.claude/settings.json`:**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "npx prettier --write $CLAUDE_FILE_PATH 2>/dev/null || true"
      }
    ]
  }
}
```

### 15.3 Custom Commands

**`.claude/commands/check.md`:**
```markdown
Verifique o estado do projeto:
1. Rode `npm run lint` e reporte erros
2. Rode `npx tsc --noEmit` e reporte erros de tipo
3. Liste imports quebrados
```

**`.claude/commands/test.md`:**
```markdown
Rode os testes do projeto:
1. `npx vitest run` para testes TypeScript
2. `python -m pytest python/` para testes Python
3. Reporte falhas com contexto
```

---

## 16. CapCut - Referencia Tecnica

### Formato draft_content.json

- Tamanho: 1-10MB+
- Unidade de tempo: microsegundos (us)
- Path: `C:/Users/<user>/AppData/Local/CapCut/User Data/Projects/com.lveditor.draft/<draft_id>/`

**Campos criticos:**
- `tracks[]` - Array de tracks (video, audio, text, sticker, effect)
- `materials.texts[]` - Materiais de texto (legendas)
- `materials.videos[]` - Materiais de video
- `materials.audios[]` - Materiais de audio
- `canvas_config` - Resolucao (width, height)

**Metadata:**
- `draft_meta_info.json` -> `"draft_timeline_materials_size_"` (COM underscore)
- `root_meta_info.json` -> `"draft_timeline_materials_size"` (SEM underscore)

**Observacoes:**
- CapCut nao trava arquivos JSON no Windows
- CapCut NAO recarrega automaticamente apos modificacao externa
- Workflow: fechar projeto -> modificar JSON -> reabrir
- Backup antes de qualquer escrita e essencial

### Projetos de referencia

| Projeto | URL | Uso |
|---------|-----|-----|
| pyCapCut | https://github.com/GuanYixuan/pyCapCut | Referencia para reader/writer |
| capcut-srt-export | https://github.com/nickelghost/capcut-srt-export | Referencia para SRT |

---

## 17. Dependencias a Instalar

### NPM (renderer/main)

```bash
# UI
npx shadcn@latest init
npm install lucide-react sonner

# State
npm install immer zustand  # zustand ja instalado, immer e novo

# Data/Forms
npm install @tanstack/react-table react-hook-form zod @hookform/resolvers

# Config (main process)
npm install electron-store

# Media (main process)
npm install fluent-ffmpeg sharp

# Audio viz
npm install wavesurfer.js

# Dev
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

### Python

```bash
pip install edge-tts
pip install faster-whisper  # ou whisperx (requer GPU)
pip install stable-ts
pip install pytest
```

---

## 18. Ordem de Implementacao Sugerida

| Fase | Itens | Impacto |
|------|-------|---------|
| **1. Estabilizar** | Bugs criticos (1.1-1.3), tipos duplicados (2.1), codigo morto (2.2) | Correcao |
| **2. Persistencia** | Zustand persist (4.1), electron-store (6) | UX critico |
| **3. UI** | shadcn/ui (3.1), Lucide (3.2), Sonner (3.3) | Visual |
| **4. Type safety** | Typed IPC (5), Zustand immer (4.2) | DX |
| **5. Testes** | Vitest setup, testes unitarios das libs (13) | Qualidade |
| **6. TTS** | Edge TTS integracao (7) | Feature |
| **7. Media** | fluent-ffmpeg, Sharp, Wavesurfer.js (8) | Feature |
| **8. Stock APIs** | Pexels, Unsplash, Pixabay (9) | Feature |
| **9. Transcricao** | WhisperX / faster-whisper (10) | Feature |
| **10. Polish** | TanStack Table (11), Forms (12), Build config (14) | Polish |
