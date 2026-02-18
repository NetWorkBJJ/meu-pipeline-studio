# MEU PIPELINE STUDIO

Studio de pre-edicao automatizada para CapCut. Transforma um roteiro em texto em um projeto CapCut completo com legendas sincronizadas, audio e midias posicionadas na timeline.

## Stack

- **Electron** (electron-vite) - app desktop com acesso ao filesystem
- **React 19 + TypeScript** - renderer
- **Tailwind CSS v4** - estilizacao (CSS-first, sem tailwind.config.js)
- **Zustand** - estado global (3 stores: project, stage, ui)
- **Python** - manipulacao do draft_content.json do CapCut (via child_process, JSON-line protocol)
- **Google Gemini API** - TTS e analise de cenas com IA

## Estrutura do Projeto

```
src/main/          - Electron main process (Node.js)
src/preload/       - Bridge Electron <-> React (contextBridge)
src/renderer/src/  - React app
python/            - Scripts Python para manipulacao CapCut
resources/         - Assets estaticos (icone)
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
- Tipos centralizados em `src/renderer/src/types/`
- Stores Zustand em `src/renderer/src/stores/`
- Imports com alias `@/` apontando para `src/renderer/src/`
- Imports com alias `@main/` apontando para `src/main/`
- Sem default exports (usar named exports)
- Interfaces preferidas sobre types para objetos

### Python
- Python 3.10+
- snake_case para funcoes e variaveis
- Docstrings em ingles
- Comunicacao com Node via stdin/stdout JSON-line protocol
- Cada resposta: `{"id": "...", "result": ...}` ou `{"id": "...", "error": {"message": "..."}}`
- Flush stdout apos cada write

### Estilo Visual
- Cor primaria: orange-500 (#f97316)
- Background: #1a1a1a
- Surface: #242424
- Border: #3a3a3a
- Texto: #f5f5f5, muted: #a3a3a3
- Font base: 14px (compacto)
- Dark theme only

### CapCut
- Unidade interna do CapCut: microsegundos (us)
- Unidade da API/UI do app: milissegundos (ms)
- Conversao: us = ms * 1000
- NUNCA reescrever draft_content.json inteiro - ler, modificar campos especificos, salvar
- SEMPRE chamar syncMetadata apos qualquer escrita no draft
- NUNCA alterar texto de legendas existentes durante sincronizacao
- NUNCA alterar segmentos de audio existentes durante insercao de midias
- Preservar todos os campos desconhecidos do JSON do CapCut

### IPC
- Renderer -> Main: ipcRenderer.invoke (async, promise-based)
- Main -> Renderer: webContents.send (eventos de progresso)
- Main -> Python: spawn + stdin/stdout JSON-line
- Canais IPC nomeados com namespace: "project:", "capcut:", "audio:", "file:"

## Comandos

```bash
npm run dev        # Dev mode com HMR
npm run build      # Build de producao
npm run lint       # ESLint
```

## Paths Importantes

- Projetos CapCut: `C:/Users/ander/AppData/Local/CapCut/User Data/Projects/com.lveditor.draft/`
- draft_content.json: arquivo principal do projeto CapCut (pode ter 1-10MB+)
- draft_meta_info.json: metadata do projeto (campo "draft_timeline_materials_size_" COM underscore)
- root_meta_info.json: metadata raiz (campo "draft_timeline_materials_size" SEM underscore)
