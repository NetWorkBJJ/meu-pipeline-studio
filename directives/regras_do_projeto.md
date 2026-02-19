# Regras do Projeto - MEU PIPELINE STUDIO

## Objetivo

MEU PIPELINE STUDIO e um aplicativo desktop de pre-edicao automatizada para CapCut.
Ele transforma um roteiro em texto puro em um projeto CapCut completo, com legendas
sincronizadas, audio posicionado e midias inseridas na timeline -- tudo sem abrir o CapCut.

O fluxo e um pipeline linear de 6 etapas (stages), onde a saida de cada etapa alimenta a proxima.

## Pipeline (6 Stages)

1. **Script** - O usuario cola um roteiro. O sistema divide em blocos de legenda usando regras de
   quebra natural (pontuacao, limite de palavras por linha).
2. **Audio** - O sistema le o projeto CapCut selecionado e detecta os blocos de audio ja
   existentes na timeline (duracoes, posicoes, IDs).
3. **Sync** - Sincroniza os blocos de texto (Stage 1) com os blocos de audio (Stage 2),
   gerando timings precisos para cada legenda. Remove gaps, alinha duracao audio-video-texto.
4. **Director** - Agrupa as legendas sincronizadas em cenas, atribui keywords e tipos de midia
   sugeridos para cada cena (B-roll, talking head, etc).
5. **Media** - O usuario seleciona arquivos de midia (imagens/videos) para cada cena. Suporta
   importacao em lote com duracao configuravel para imagens.
6. **Insert** - Escreve tudo no draft_content.json do CapCut: segmentos de texto (legendas),
   segmentos de video (midias), e sincroniza os metadados do projeto. Faz backup automatico
   antes de cada escrita.

## Stack Tecnologica

- **Electron + React + TypeScript** - Interface desktop com acesso ao filesystem
- **Tailwind CSS v4** - Estilizacao (dark theme, tema azul-roxo indigo)
- **Zustand** - 4 stores de estado global (project, stage, ui, log)
- **Framer Motion** - Animacoes e transicoes de UI
- **Python 3.10+** - Manipulacao do draft_content.json do CapCut (processo filho, JSON-line protocol)

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
- IPC channels com namespace: "project:", "capcut:", "audio:", "file:"

## Estrutura DOE

Este projeto segue o Framework DOE:
- **Directives** (`/directives`) - Visao estrategica, regras de negocio, playbook.
- **Orchestration** - O agente orquestrador gerencia a criacao e logica baseado nas diretrizes.
- **Executions** (`/executions`) - Scripts Python operacionais, deterministicos, mao na massa.
