# Regras do Projeto - MEU PIPELINE STUDIO

## Objetivo

MEU PIPELINE STUDIO e um aplicativo desktop de pre-edicao automatizada para CapCut.
Ele transforma um roteiro em texto puro em um projeto CapCut completo, com legendas
sincronizadas, audio posicionado e midias inseridas na timeline -- tudo sem abrir o CapCut.

O fluxo e um pipeline linear de 5 etapas (stages), onde a saida de cada etapa alimenta a proxima.

## Pipeline (5 Stages)

1. **Script** - O usuario cola um roteiro. O sistema divide em blocos de legenda usando regras de
   quebra natural (pontuacao, limite de palavras por linha).
2. **Audio** - TTS multi-provider (Google Cloud, ElevenLabs, MiniMax via ai33.pro) ou deteccao
   de blocos de audio ja existentes no projeto CapCut (duracoes, posicoes, IDs).
3. **Sync** - Sincroniza os blocos de texto (Stage 1) com os blocos de audio (Stage 2),
   gerando timings precisos para cada legenda. Remove gaps, alinha duracao audio-video-texto.
4. **Director** - Pipeline completo de direcao com 5 sub-steps:
   - **Config** - Configura chapters, scene grouping, modo de midia
   - **Planejamento** - Planeja cenas com LLM (Claude/GPT)
   - **Prompts** - Gera e refina prompts para cada cena
   - **Importacao** - Importa e associa midias as cenas (manual ou stock)
   - **Insercao** - Insere texto+video no CapCut (backup, clear, write, sync)
5. **Veo3** - Geracao de video com Google Veo3 via browser automation (CDP).
   Multi-tab, multi-conta, download tracking, queue de prompts automatica.

## Stack Tecnologica

- **Electron 39** (electron-vite 5) - app desktop com acesso ao filesystem
- **React 19** + **TypeScript 5.9** - renderer
- **Tailwind CSS v4** - estilizacao (CSS-first @theme, dark theme indigo)
- **Zustand 5** - 7 stores de estado global (project, stage, ui, log, workspace, veo3, veo3Automation)
- **Framer Motion 11** - animacoes e transicoes (AnimatePresence, motion.div)
- **Lucide React** - icones SVG
- **Python 3.10+** - manipulacao do draft_content.json do CapCut (processo filho, JSON-line protocol)

## Integracoes Externas

- **ai33.pro** - API wrapper para ElevenLabs TTS, MiniMax TTS, voice clone, dubbing, STT, SFX, image gen
- **ClickUp** - Importacao read-only de demandas, scripts e arquivos de personagens
- **Veo3** - Browser automation via Chrome DevTools Protocol (CDP) para geracao de video

## Regras de Negocio

### CapCut
- A unidade interna do CapCut e microsegundos (us). A API/UI do app usa milissegundos (ms).
- NUNCA reescrever o draft_content.json inteiro. Ler, modificar campos especificos, salvar.
- SEMPRE chamar syncMetadata apos qualquer escrita no draft.
- NUNCA alterar texto de legendas existentes durante sincronizacao.
- NUNCA alterar segmentos de audio existentes durante insercao de midias.
- Preservar todos os campos desconhecidos do JSON do CapCut (forward-compatibility).
- Backup automatico antes de cada escrita (.backups/, maximo 10 copias).

### Codigo
- Comunicacao com usuario: portugues brasileiro.
- Codigo (variaveis, funcoes, comentarios): ingles.
- Arquivos TypeScript: camelCase. Arquivos Python: snake_case.
- Sem emojis em nenhum lugar (codigo, UI, commits).
- Scripts Python devem ser deterministicos e seguir estritamente estas diretrizes.

### Arquitetura
- Python bridge: processo de longa duracao via stdin/stdout com JSON-line protocol.
- Cada request: `{"id": "uuid", "method": "nome", "params": {...}}`
- Cada response: `{"id": "uuid", "result": ...}` ou `{"id": "uuid", "error": {"message": "..."}}`
- IPC channels com namespace: "project:", "capcut:", "audio:", "file:", "workspace:", "ai33:", "tts:", "director:", "veo3:", "clickup:", "cdp:", "system:"

### Cross-Platform
- Plataformas suportadas: Windows + macOS
- SEMPRE usar path.join() no TypeScript e os.path.join() no Python
- NUNCA hardcodar separadores de path (/ ou \\)
- SEMPRE verificar process.platform antes de comandos shell platform-specific
- Python bridge: python/python3 (dev) ou resources/python/ (packaged)

## Estrutura DOE

Este projeto segue o Framework DOE:
- **Directives** (`/directives`) - Visao estrategica, regras de negocio, playbook.
- **Orchestration** - O agente orquestrador gerencia a criacao e logica baseado nas diretrizes.
- **Executions** (`/executions`) - Scripts Python operacionais, deterministicos, mao na massa.
