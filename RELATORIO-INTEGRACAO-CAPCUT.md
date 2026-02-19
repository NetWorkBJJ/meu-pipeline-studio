# Relatório Técnico Completo: Integração NardotoStudio <-> CapCut

**Versão:** 1.0
**Data:** 19 de Fevereiro de 2026
**Autor:** Documentação técnica interna - NardotoStudio

---

## Sumário

1. [Introdução e Contexto Geral](#1-introdução-e-contexto-geral)
2. [Arquitetura da Comunicação](#2-arquitetura-da-comunicação)
3. [O Formato de Projeto do CapCut (Engenharia Reversa)](#3-o-formato-de-projeto-do-capcut-engenharia-reversa)
4. [Criação de Projetos](#4-criação-de-projetos)
5. [Detecção e Vinculação de Projetos Existentes](#5-detecção-e-vinculação-de-projetos-existentes)
6. [Inserção de Áudio](#6-inserção-de-áudio)
7. [Sincronização de Timeline (Sync Engine)](#7-sincronização-de-timeline-sync-engine)
8. [Inserção de Legendas (SRT)](#8-inserção-de-legendas-srt)
9. [Inserção de Mídias (Imagens e Vídeos)](#9-inserção-de-mídias-imagens-e-vídeos)
10. [Loop (Repetição de Elementos)](#10-loop-repetição-de-elementos)
11. [Merge (Mesclagem de Projetos)](#11-merge-mesclagem-de-projetos)
12. [Sincronização de Metadados (syncCapCutMetadata)](#12-sincronização-de-metadados-synccapcutmetadata)
13. [Sistema de Backup e Undo](#13-sistema-de-backup-e-undo)
14. [Watcher de Projeto (Monitoramento de Mudanças)](#14-watcher-de-projeto-monitoramento-de-mudanças)
15. [Extension Bridge (WebSocket)](#15-extension-bridge-websocket)
16. [CapCutProject - API Python de Alto Nível](#16-capcutproject---api-python-de-alto-nível)
17. [Ponte IPC (preload.js)](#17-ponte-ipc-preloadjs)
18. [Ponte JavaScript-Python (runPython)](#18-ponte-javascript-python-runpython)
19. [Comparação entre os Caminhos de Inserção](#19-comparação-entre-os-caminhos-de-inserção)
20. [Fluxos Completos Passo a Passo](#20-fluxos-completos-passo-a-passo)
21. [Resumo dos Princípios Fundamentais](#21-resumo-dos-princípios-fundamentais)
22. [Mapa de Arquivos Críticos](#22-mapa-de-arquivos-críticos)

---

## 1. Introdução e Contexto Geral

### 1.1 O que é o NardotoStudio

O NardotoStudio é uma aplicação desktop construída com Electron, React e TypeScript. Ele funciona como um **editor de vídeo inteligente** que automatiza o CapCut Desktop. Em vez de o editor humano precisar fazer cada operação manualmente dentro do CapCut (arrastar áudios, posicionar legendas, sincronizar vídeos com áudios, repetir elementos), o NardotoStudio faz tudo isso automaticamente.

### 1.2 O Problema que Resolve

O CapCut Desktop não possui API pública. Não existe nenhum endpoint, SDK, CLI, plugin, ou qualquer mecanismo oficial para que programas externos controlem o CapCut. Um editor de vídeo que precisa, por exemplo, inserir 200 legendas em um projeto teria que fazer isso uma por uma, manualmente.

### 1.3 A Solução: Engenharia Reversa

Todo projeto do CapCut é, na verdade, uma **pasta contendo arquivos JSON** no disco do computador. O NardotoStudio foi construído através de engenharia reversa desse formato JSON. Ele lê, modifica e cria esses arquivos diretamente. Quando o CapCut abre o projeto, ele lê os mesmos arquivos e mostra o resultado na tela.

Ou seja: **a "conversa" entre o NardotoStudio e o CapCut acontece através do sistema de arquivos**. Não existe comunicação em tempo real, não existe socket, não existe API. O Studio escreve no disco, o CapCut lê do disco.

### 1.4 Analogia Simples

Imagine que o CapCut é uma pessoa que lê um caderno. O NardotoStudio é outra pessoa que escreve nesse mesmo caderno. Quando o CapCut abre o caderno (o projeto), ele lê o que está escrito e mostra na tela. O NardotoStudio pode escrever novas páginas, editar páginas existentes, ou reorganizar a ordem das páginas. Na próxima vez que o CapCut abrir o caderno, ele verá todas as mudanças.

---

## 2. Arquitetura da Comunicação

### 2.1 Visão Geral do Fluxo

O fluxo de dados segue esta ordem:

```
Usuário (clica um botão no Studio)
    |
    v
React (componente no navegador do Electron)
    |
    | ipcRenderer.invoke('nome-do-canal', parametros)
    |
    v
preload.js (verifica se o canal é permitido na allowlist)
    |
    v
Electron main.js (processa o comando)
    |
    |-- [Caminho A] Manipula JSON diretamente (JavaScript puro)
    |-- [Caminho B] Chama runPython() --> sync_engine.py (Python via spawnSync)
    |-- [Caminho C] Chama runPython() --> capcut_editor.py (Python OOP via CLI)
    |
    v
Sistema de Arquivos (lê/escreve draft_content.json e metadados)
    |
    v
CapCut Desktop (lê os mesmos arquivos ao abrir/recarregar o projeto)
```

### 2.2 As Três Camadas de Manipulação

O NardotoStudio possui três formas diferentes de modificar os arquivos do CapCut. Cada uma tem suas vantagens:

**Camada 1 -- JavaScript Direto (main.js)**

O código JavaScript no processo principal do Electron lê o `draft_content.json`, modifica o objeto em memória e salva de volta. Isso é rápido e simples, mas os materiais criados são mais simples (menos campos, sem materiais auxiliares).

Usado para: inserção rápida de mídia, criação de projetos, merge de projetos, inserção de cenas do Director Mode.

**Camada 2 -- Python via sync_engine.py**

Um script Python que é executado como processo filho pelo `runPython()`. Ele recebe um comando JSON, processa e retorna resultado JSON. Cria materiais mais completos, com todos os campos auxiliares que o CapCut Desktop espera (speed, canvas, placeholder, etc.).

Usado para: sincronização, inserção de SRT, loop, inserção de mídia com materiais completos.

**Camada 3 -- Python via capcut_editor.py**

Uma classe Python orientada a objetos (`CapCutProject`) que encapsula toda a lógica de manipulação de projetos. Oferece métodos como `add_text()`, `import_video()`, `import_audio()`.

Usado para: context analyzer (inserção de cenas via IA), operações de alto nível.

### 2.3 Por que Três Camadas

A razão histórica é que o projeto evoluiu organicamente:

- O JavaScript direto foi o primeiro a ser implementado, pois é mais simples de manter junto ao Electron.
- O Python via sync_engine.py foi adicionado para operações mais complexas que precisam de materiais completos e templates JSON reais extraídos do CapCut.
- O capcut_editor.py foi criado para ter uma API limpa e reutilizável, usada principalmente pelo context analyzer.

As três camadas coexistem e cada uma é usada onde faz mais sentido.

---

## 3. O Formato de Projeto do CapCut (Engenharia Reversa)

### 3.1 Onde os Projetos Ficam no Disco

No Windows, o CapCut armazena projetos em duas pastas:

**Pasta 1 -- Projetos locais:**
```
C:\Users\{usuario}\AppData\Local\CapCut\User Data\Projects\com.lveditor.draft\
```

**Pasta 2 -- Projetos da nuvem (importados):**
```
C:\Users\{usuario}\AppData\Local\CapCut Drafts\
```

Cada projeto é uma subpasta dentro de uma dessas pastas. Por exemplo:
```
com.lveditor.draft\
  |-- 001\                         <-- Projeto "001"
  |   |-- draft_content.json       <-- A timeline completa
  |   |-- draft_info.json          <-- Informações do draft
  |   |-- draft_meta_info.json     <-- Metadados para o CapCut
  |
  |-- MeuVideo\                    <-- Projeto "MeuVideo"
  |   |-- draft_content.json
  |   |-- draft_info.json
  |   |-- draft_meta_info.json
  |
  |-- root_meta_info.json          <-- ÍNDICE GLOBAL de todos os projetos
```

### 3.2 Os 4 Arquivos que Compõem um Projeto

Cada projeto CapCut é definido por **4 arquivos JSON**. Para que o projeto funcione corretamente, todos devem estar consistentes entre si.

#### 3.2.1 draft_content.json -- O Coração do Projeto

Este é o arquivo mais importante. Ele contém toda a timeline do vídeo: quais mídias estão no projeto, onde estão posicionadas, suas durações, efeitos, textos, etc.

Estrutura completa:

```json
{
  "id": "A1B2C3D4-E5F6-7890-ABCD-EF1234567890",
  "name": "MeuProjeto",
  "duration": 60000000,
  "create_time": 1708300000,
  "update_time": 1708300000,
  "fps": 30.0,
  "canvas_config": {
    "width": 1920,
    "height": 1080,
    "ratio": "16:9"
  },
  "tracks": [],
  "materials": {
    "videos": [],
    "audios": [],
    "texts": [],
    "material_animations": [],
    "speeds": [],
    "canvases": [],
    "sound_channel_mappings": [],
    "vocal_separations": [],
    "placeholder_infos": [],
    "beats": [],
    "effects": [],
    "filters": [],
    "transitions": [],
    "stickers": [],
    "material_colors": [],
    "audio_fades": [],
    "audio_effects": [],
    "loudnesses": [],
    "drafts": [],
    "text_templates": [],
    "ai_translates": [],
    "audio_balances": [],
    "audio_track_indexes": [],
    "chromas": [],
    "color_curves": [],
    "digital_humans": [],
    "flowers": [],
    "green_screens": [],
    "handwrites": [],
    "hsl": [],
    "images": [],
    "log_color_wheels": [],
    "manual_deformations": [],
    "masks": [],
    "multi_language_refs": [],
    "placeholders": [],
    "plugin_effects": [],
    "primary_color_wheels": [],
    "realtime_denoises": [],
    "shapes": [],
    "smart_crops": [],
    "smart_relights": [],
    "tail_leaders": [],
    "time_marks": [],
    "video_effects": [],
    "video_trackings": []
  },
  "keyframes": {
    "adjusts": [],
    "audios": [],
    "effects": [],
    "filters": [],
    "handwrites": [],
    "stickers": [],
    "texts": [],
    "videos": []
  },
  "relationships": [],
  "new_version": "113.0.0",
  "version": 360000,
  "color_space": 0,
  "source": "default",
  "render_index_track_mode_on": false,
  "free_render_index_mode_on": false,
  "platform": {
    "app_id": 359289,
    "app_source": "cc",
    "app_version": "4.0.0",
    "device_id": "",
    "hard_disk_id": "",
    "mac_address": "",
    "os": "windows",
    "os_version": "10.0.22631"
  },
  "last_modified_platform": {
    "app_id": 359289,
    "app_source": "cc",
    "app_version": "4.0.0",
    "os": "windows",
    "os_version": "10.0.22631"
  },
  "config": {
    "adjust_max_index": 0,
    "attachment_info": [],
    "combination_max_index": 0,
    "export_range": null,
    "extract_audio_last_index": 0,
    "lyrics_recognition_id": "",
    "lyrics_sync": false,
    "maintrack_adsorb": true,
    "material_save_mode": 0,
    "original_sound_last_index": 0,
    "record_audio_last_index": 0,
    "sticker_max_index": 0,
    "subtitle_recognition_id": "",
    "subtitle_sync": true,
    "system_font_list": [],
    "video_mute": false,
    "zoom_info_params": null
  }
}
```

#### 3.2.2 draft_info.json -- Informações do Draft

Contém informações de identificação do projeto. Esse arquivo é usado pelo CapCut para exibir dados básicos na lista de projetos.

```json
{
  "draft_cloud_capcut_purchase_info": null,
  "draft_cloud_purchase_info": null,
  "draft_cloud_template_id": "",
  "draft_cloud_tutorial_info": null,
  "draft_cloud_videocut_purchase_info": null,
  "draft_cover": "",
  "draft_deeplink_url": "",
  "draft_enterprise_info": null,
  "draft_fold_path": "C:/Users/ander/AppData/Local/CapCut/User Data/Projects/com.lveditor.draft/MeuProjeto",
  "draft_id": "A1B2C3D4-E5F6-7890-ABCD-EF1234567890",
  "draft_is_ai_shorts": false,
  "draft_is_article_video_draft": false,
  "draft_is_from_deeplink": false,
  "draft_is_invisible": false,
  "draft_materials_copied": false,
  "draft_materials_copied_path": null,
  "draft_name": "MeuProjeto",
  "draft_new_version": "",
  "draft_removable_storage_device": "",
  "draft_root_path": "C:/Users/ander/AppData/Local/CapCut/User Data/Projects/com.lveditor.draft",
  "draft_segment_extra_info": null,
  "draft_timeline_materials_size": 0,
  "draft_type": "normal",
  "tm_draft_cloud_completed": null,
  "tm_draft_cloud_modified": 0,
  "tm_draft_create": 1708300000,
  "tm_draft_modified": 1708300000,
  "tm_draft_removed": 0
}
```

#### 3.2.3 draft_meta_info.json -- Metadados para o CapCut

Este arquivo é **crítico** para o CapCut reconhecer o projeto. Sem ele, o projeto não aparece na lista do CapCut mesmo que o `draft_content.json` exista.

```json
{
  "cloud_draft_cover": true,
  "cloud_draft_sync": false,
  "draft_cloud_last_action_download": false,
  "draft_cloud_purchase_info": "",
  "draft_cloud_template_id": "",
  "draft_cloud_tutorial_info": "",
  "draft_cloud_videocut_purchase_info": "",
  "draft_cover": "",
  "draft_enterprise_info": {
    "draft_enterprise_extra": "",
    "draft_enterprise_id": "",
    "draft_enterprise_name": "",
    "enterprise_material": []
  },
  "draft_fold_path": "C:/Users/ander/AppData/Local/.../MeuProjeto",
  "draft_id": "A1B2C3D4-E5F6-7890-ABCD-EF1234567890",
  "draft_is_ai_shorts": false,
  "draft_is_article_video_draft": false,
  "draft_is_cloud_temp_draft": false,
  "draft_is_from_deeplink": "false",
  "draft_is_invisible": false,
  "draft_is_web_article_video": false,
  "draft_materials": [
    { "type": 0, "value": [] },
    { "type": 1, "value": [] },
    { "type": 2, "value": [] },
    { "type": 3, "value": [] },
    { "type": 6, "value": [] },
    { "type": 7, "value": [] },
    { "type": 8, "value": [] }
  ],
  "draft_materials_copied_info": [],
  "draft_name": "MeuProjeto",
  "draft_need_rename_folder": false,
  "draft_new_version": "",
  "draft_removable_storage_device": "",
  "draft_root_path": "C:/Users/ander/AppData/Local/.../com.lveditor.draft",
  "draft_segment_extra_info": [],
  "draft_timeline_materials_size_": 12345,
  "draft_type": "",
  "tm_draft_create": 1708300000000000,
  "tm_draft_modified": 1708300000000000,
  "tm_draft_removed": 0,
  "tm_duration": 60000000
}
```

**Detalhe extremamente importante**: O campo `draft_timeline_materials_size_` neste arquivo tem um **underscore no final** do nome. Isso é diferente do root_meta_info.json, onde o mesmo campo NÃO tem underscore. Essa inconsistência faz parte do formato real do CapCut e deve ser respeitada.

#### 3.2.4 root_meta_info.json -- Índice Global

Este arquivo fica na **raiz** da pasta de drafts (não dentro de nenhum projeto específico). Ele é um índice que lista TODOS os projetos que o CapCut conhece. Se um projeto não estiver listado aqui, ele não aparecerá na interface do CapCut.

```json
{
  "all_draft_store": [
    {
      "cloud_draft_cover": true,
      "cloud_draft_sync": false,
      "draft_cloud_last_action_download": false,
      "draft_cloud_purchase_info": "",
      "draft_cloud_template_id": "",
      "draft_cloud_tutorial_info": "",
      "draft_cloud_videocut_purchase_info": "",
      "draft_cover": "",
      "draft_fold_path": "C:/Users/ander/AppData/Local/.../MeuProjeto",
      "draft_id": "A1B2C3D4-E5F6-7890-ABCD-EF1234567890",
      "draft_is_ai_shorts": false,
      "draft_is_cloud_temp_draft": false,
      "draft_is_invisible": false,
      "draft_is_web_article_video": false,
      "draft_json_file": "C:/Users/ander/AppData/Local/.../MeuProjeto/draft_content.json",
      "draft_name": "MeuProjeto",
      "draft_new_version": "",
      "draft_root_path": "C:/Users/ander/AppData/Local/.../com.lveditor.draft",
      "draft_timeline_materials_size": 12345,
      "draft_type": "",
      "draft_web_article_video_enter_from": "",
      "streaming_edit_draft_ready": true,
      "tm_draft_cloud_completed": "",
      "tm_draft_cloud_entry_id": -1,
      "tm_draft_cloud_modified": 0,
      "tm_draft_cloud_parent_entry_id": -1,
      "tm_draft_cloud_space_id": -1,
      "tm_draft_cloud_user_id": -1,
      "tm_draft_create": 1708300000000000,
      "tm_draft_modified": 1708300000000000,
      "tm_draft_removed": 0,
      "tm_duration": 60000000
    }
  ],
  "draft_ids": 5,
  "root_path": "C:/Users/ander/AppData/Local/.../com.lveditor.draft"
}
```

**Detalhe extremamente importante**: Aqui o campo é `draft_timeline_materials_size` **sem underscore** no final. Essa diferença em relação ao `draft_meta_info.json` (que tem underscore) é real e deve ser mantida exatamente assim.

### 3.3 A Hierarquia Track > Segment > Material

Dentro do `draft_content.json`, a timeline é organizada em três níveis hierárquicos. Entender essa hierarquia é fundamental para entender como qualquer elemento é inserido no CapCut.

#### 3.3.1 Track (Pista)

Uma Track é uma pista na timeline. Pense nela como uma "linha" na timeline do CapCut onde elementos ficam posicionados um ao lado do outro. Existem três tipos de track:

- `"video"` -- para vídeos E imagens (fotos)
- `"audio"` -- para áudios
- `"text"` -- para textos e legendas

Estrutura de uma track:

```json
{
  "attribute": 0,
  "flag": 0,
  "id": "UUID-DA-TRACK",
  "is_default_name": true,
  "name": "",
  "segments": [],
  "type": "video"
}
```

O campo `flag` tem um significado especial: para tracks de texto, ele deve ser `1`. Para vídeo e áudio, deve ser `0`.

**Regra crítica**: O tipo de track para texto deve ser `"text"`, NUNCA `"subtitle"`. Mesmo que o conteúdo seja uma legenda, o CapCut só reconhece os tipos `"video"`, `"audio"` e `"text"`.

#### 3.3.2 Segment (Clip)

Um Segment é um clip individual dentro de uma track. Por exemplo, se você tem 3 vídeos na mesma track, existem 3 segments. Cada segment define:

- **Onde** o clip aparece na timeline (`target_timerange`)
- **Qual trecho** do arquivo original é usado (`source_timerange`)
- **Qual material** ele referencia (`material_id`)
- **Propriedades visuais** (alpha, scale, transform, rotation)

Estrutura de um segment:

```json
{
  "id": "UUID-DO-SEGMENT",
  "material_id": "UUID-DO-MATERIAL",
  "target_timerange": {
    "start": 0,
    "duration": 5000000
  },
  "source_timerange": {
    "start": 0,
    "duration": 5000000
  },
  "extra_material_refs": ["UUID-SPEED", "UUID-CANVAS"],
  "clip": {
    "alpha": 1.0,
    "scale": { "x": 1.0, "y": 1.0 },
    "transform": { "x": 0.0, "y": 0.0 },
    "rotation": 0.0,
    "flip": { "horizontal": false, "vertical": false }
  },
  "volume": 1.0,
  "speed": 1.0,
  "visible": true,
  "reverse": false,
  "render_index": 0,
  "track_render_index": 0,
  "source_type": 0
}
```

Explicação dos campos importantes:

- `target_timerange.start`: posição em microssegundos onde o clip começa na timeline. Se o valor é `10000000`, o clip começa aos 10 segundos do vídeo final.
- `target_timerange.duration`: duração em microssegundos do clip na timeline.
- `source_timerange.start`: ponto inicial no arquivo original. Se o valor é `5000000`, o clip começa a reproduzir a partir dos 5 segundos do arquivo de mídia.
- `source_timerange.duration`: quanto do arquivo original é usado.
- `material_id`: UUID que aponta para um material no pool `materials` do projeto. É assim que o segment sabe qual arquivo de mídia usar.
- `extra_material_refs`: array de UUIDs de materiais auxiliares (velocidade, canvas, etc.).
- `clip.transform`: posição visual. `x` e `y` vão de -1.0 a 1.0, onde 0.0 é o centro.
- `render_index`: define a ordem de renderização (camada). Valores maiores ficam na frente.

**Diferença importante para texto**: Segments de texto têm `source_timerange: null` (porque texto não tem arquivo de origem).

#### 3.3.3 Material (Recurso)

Um Material é a definição de um recurso (arquivo) usado pelo projeto. Materiais ficam no pool `materials` do `draft_content.json`. Cada segment referencia um material pelo `material_id`.

Existem vários tipos de material, mas os principais são:

**Material de vídeo/imagem** (fica em `materials.videos`):
```json
{
  "id": "UUID-DO-MATERIAL",
  "type": "video",
  "path": "C:/caminho/para/arquivo.mp4",
  "name": "arquivo.mp4",
  "duration": 5000000,
  "width": 1920,
  "height": 1080,
  "create_time": 1708300000000,
  "local_material_id": "UUID-DO-MATERIAL"
}
```

**Observação extremamente importante**: Imagens (fotos) são armazenadas em `materials.videos` com `type: "photo"`. Elas NÃO vão para `materials.images`. O CapCut trata imagens como "vídeos parados" internamente.

**Material de áudio** (fica em `materials.audios`):
```json
{
  "id": "UUID-DO-MATERIAL",
  "type": "audio",
  "path": "C:/caminho/para/audio.mp3",
  "name": "audio.mp3",
  "duration": 30000000
}
```

**Material de texto** (fica em `materials.texts`):
```json
{
  "id": "UUID-DO-MATERIAL",
  "type": "subtitle",
  "content": "Texto da legenda",
  "font_size": 5.0,
  "text_color": "#FFFFFF"
}
```

#### 3.3.4 Materiais Auxiliares

Além dos materiais principais, o CapCut usa materiais auxiliares que controlam propriedades específicas. Esses materiais ficam em arrays separados dentro de `materials` e são referenciados pelo `extra_material_refs` do segment.

| Material Auxiliar | Array no materials | Função |
|---|---|---|
| Speed | `materials.speeds` | Controle de velocidade do clip |
| Canvas | `materials.canvases` | Configuração de fundo/canvas |
| Placeholder Info | `materials.placeholder_infos` | Metadados placeholder |
| Sound Channel Mapping | `materials.sound_channel_mappings` | Mapeamento de canais de áudio |
| Vocal Separation | `materials.vocal_separations` | Separação vocal |
| Beat | `materials.beats` | Informações de batida de áudio |
| Material Color | `materials.material_colors` | Configurações de cor |
| Material Animation | `materials.material_animations` | Animações (usado por texto) |

Cada um desses materiais auxiliares tem uma estrutura própria. Exemplo de material de velocidade:

```json
{
  "id": "UUID-SPEED",
  "mode": 0,
  "speed": 1.0,
  "type": "speed"
}
```

### 3.4 Unidade de Tempo: Microssegundos

**Todas** as unidades de tempo nos JSONs do CapCut são em **microssegundos**. Um microssegundo é um milionésimo de segundo.

Tabela de conversão:

| Tempo real | Microssegundos |
|---|---|
| 1 segundo | 1.000.000 |
| 5 segundos | 5.000.000 |
| 30 segundos | 30.000.000 |
| 1 minuto | 60.000.000 |
| 5 minutos | 300.000.000 |
| 1 hora | 3.600.000.000 |

Então, se um segment tem `target_timerange: { start: 10000000, duration: 5000000 }`, isso significa que ele começa aos **10 segundos** e dura **5 segundos** na timeline.

**Exceção**: Os timestamps de criação/modificação (`tm_draft_create`, `tm_draft_modified`) no `draft_meta_info.json` e `root_meta_info.json` são em **microssegundos desde a epoch** (1 de janeiro de 1970). Já no `draft_content.json` e `draft_info.json`, `create_time` e `update_time` são em **segundos** desde a epoch.

### 3.5 Geração de IDs

Todos os IDs usados pelo CapCut são UUIDs v4 (identificadores únicos universais) em **letras maiúsculas**, no formato com hífens:

```
A1B2C3D4-E5F6-7890-ABCD-EF1234567890
```

No JavaScript (main.js), os IDs são gerados assim:
```javascript
require('crypto').randomUUID().toUpperCase()
```

No Python (sync_engine.py e capcut_editor.py):
```python
str(uuid.uuid4()).upper()
```

Cada entidade precisa de um ID único: cada track, cada segment, cada material, cada material auxiliar. Nunca dois elementos podem ter o mesmo ID.

### 3.6 Caminhos de Arquivo

Os caminhos de arquivo dentro dos JSONs do CapCut usam **barras normais** (forward slashes), não barras invertidas (backslashes), mesmo no Windows:

- Correto: `"C:/Users/ander/AppData/Local/CapCut/..."`
- Errado: `"C:\\Users\\ander\\AppData\\Local\\CapCut\\..."`

O NardotoStudio converte os caminhos com `.replace(/\\/g, '/')` ao salvar.

---

## 4. Criação de Projetos

### 4.1 Visão Geral

Quando o usuário cria um novo projeto no NardotoStudio, o Studio precisa criar uma pasta com todos os 4 arquivos JSON necessários para que o CapCut reconheça o projeto.

**Canal IPC**: `create-new-project`
**Arquivo**: `src/main.js` linha 5491

### 4.2 Passo a Passo Detalhado

#### Passo 1 -- Rate Limit

Antes de qualquer coisa, o Studio verifica se não houve outra criação de projeto muito recentemente (proteção contra loops acidentais):

```javascript
if (now - lastProjectCreationTime < MIN_PROJECT_INTERVAL_MS) {
    return { error: `Aguarde ${waitTime} segundos antes de criar outro projeto` };
}
```

#### Passo 2 -- Verificar Pasta do CapCut

O Studio verifica se a pasta padrão do CapCut existe. Se não existir, ele a cria:

```javascript
const capCutDrafts = path.join(
    app.getPath('appData'), '..', 'Local',
    'CapCut', 'User Data', 'Projects', 'com.lveditor.draft'
);
if (!fs.existsSync(capCutDrafts)) {
    fs.mkdirSync(capCutDrafts, { recursive: true });
}
```

Isso garante que o Studio funcione mesmo que o CapCut nunca tenha sido aberto (a pasta pode ainda não existir).

#### Passo 3 -- Determinar Nome do Projeto

O usuário pode fornecer um nome customizado ou deixar o Studio gerar automaticamente:

- **Nome customizado**: O texto é sanitizado removendo caracteres inválidos para nomes de pasta: `<>:"/\|?*` são substituídos por `_`.
- **Nome automático**: O Studio escaneia as pastas existentes que tenham nomes numéricos de 3 dígitos (001, 002, etc.), encontra o maior número e incrementa. Se não existir nenhuma, começa em 001.

```javascript
const existingFolders = fs.readdirSync(capCutDrafts)
    .filter(f => /^\d{3}$/.test(f));
const nextNumber = Math.max(...existingNumbers) + 1;
projectName = String(nextNumber).padStart(3, '0'); // "001", "002", etc.
```

#### Passo 4 -- Verificar Duplicata

Se já existir uma pasta com o nome escolhido, retorna erro:

```javascript
if (fs.existsSync(projectPath)) {
    return { error: `Já existe um projeto com o nome "${projectName}"` };
}
```

#### Passo 5 -- Gerar ID e Timestamps

```javascript
const draftId = generateUUID(); // UUID v4 em maiúsculo
const timestamp = Date.now(); // milissegundos desde epoch
const microTimestamp = timestamp * 1000 + Math.floor(Math.random() * 1000);
// microTimestamp = microssegundos com variação aleatória
```

O `microTimestamp` é usado nos metadados do CapCut. A variação aleatória de 0-999 microssegundos extras evita colisões quando dois projetos são criados no mesmo milissegundo.

#### Passo 6 -- Criar Pasta do Projeto

```javascript
fs.mkdirSync(projectPath, { recursive: true });
```

Isso cria a pasta `com.lveditor.draft/MeuProjeto/`.

#### Passo 7 -- Escrever draft_content.json

O Studio cria um objeto JavaScript com toda a estrutura do projeto vazio e salva como JSON:

```javascript
const draftContent = {
    canvas_config: { height: 1080, width: 1920, ratio: "16:9" },
    duration: 0,
    fps: 30.0,
    id: draftId,
    name: projectName,
    tracks: [],
    materials: { videos: [], audios: [], texts: [], /* ... ~50 arrays vazios */ },
    version: 360000,
    new_version: "113.0.0",
    // ... outros campos
};
fs.writeFileSync(draftPath, JSON.stringify(draftContent, null, 2));
```

O projeto é criado com `duration: 0` e `tracks: []` -- uma timeline completamente vazia.

#### Passo 8 -- Escrever draft_info.json

```javascript
const draftInfo = {
    draft_fold_path: projectPath,
    draft_id: draftId,
    draft_name: projectName,
    draft_root_path: capCutDrafts,
    draft_type: "normal",
    tm_draft_create: Math.floor(timestamp / 1000),
    tm_draft_modified: Math.floor(timestamp / 1000),
    // ... outros campos
};
fs.writeFileSync(path.join(projectPath, 'draft_info.json'), JSON.stringify(draftInfo, null, 2));
```

#### Passo 9 -- Escrever draft_meta_info.json

Este é o arquivo que faz o projeto aparecer na lista do CapCut:

```javascript
const draftMetaInfo = {
    draft_fold_path: projectPath.replace(/\\/g, '/'),
    draft_id: draftId,
    draft_name: projectName,
    draft_timeline_materials_size_: 0,  // COM underscore final
    tm_draft_create: microTimestamp,
    tm_draft_modified: microTimestamp,
    tm_duration: 0,
    cloud_draft_sync: true,
    draft_materials: [
        { type: 0, value: [] },  // vídeos/fotos
        { type: 1, value: [] },  // imagens
        { type: 2, value: [] },  // texto/legendas
        { type: 3, value: [] },
        { type: 6, value: [] },  // áudio
        { type: 7, value: [] },
        { type: 8, value: [] }
    ],
    // ... outros campos
};
fs.writeFileSync(path.join(projectPath, 'draft_meta_info.json'), JSON.stringify(draftMetaInfo));
```

#### Passo 10 -- Registrar no root_meta_info.json

Este passo é **crucial**. O `root_meta_info.json` é o índice global. Se o projeto não estiver nele, o CapCut não o mostrará:

```javascript
const rootMetaPath = path.join(capCutDrafts, 'root_meta_info.json');
let rootMeta = { all_draft_store: [], draft_ids: 0, root_path: capCutDrafts.replace(/\\/g, '/') };

// Se o arquivo já existe, lê ele
if (fs.existsSync(rootMetaPath)) {
    rootMeta = JSON.parse(fs.readFileSync(rootMetaPath, 'utf-8'));
}

// Cria a entrada do novo projeto
const newDraftEntry = {
    draft_fold_path: projectPath.replace(/\\/g, '/'),
    draft_id: draftId,
    draft_json_file: projectPath.replace(/\\/g, '/') + '/draft_content.json',
    draft_name: projectName,
    draft_timeline_materials_size: 0,  // SEM underscore final
    tm_draft_create: microTimestamp,
    tm_draft_modified: microTimestamp,
    tm_duration: 0,
    // ... outros campos
};

// Insere no INÍCIO do array (projetos mais recentes primeiro)
rootMeta.all_draft_store.unshift(newDraftEntry);
rootMeta.draft_ids += 1;

fs.writeFileSync(rootMetaPath, JSON.stringify(rootMeta));
```

O uso de `unshift()` (inserir no início) faz com que o novo projeto apareça como o primeiro da lista no CapCut.

#### Passo 11 -- Garantir Consistência de IDs

```javascript
ensureConsistentDraftId(projectPath, capCutDrafts);
```

Esta função verifica que o `draft_id` é exatamente o mesmo nos 4 arquivos. Se algum estiver diferente, corrige.

#### Passo 12 -- Vincular ao Workspace (opcional)

Se o projeto foi criado dentro de um workspace do NardotoStudio, ele é vinculado:

**Sistema novo**: Cria uma pasta no workspace e um arquivo `project-link.json`:
```javascript
fs.writeFileSync(path.join(projectLocalPath, 'project-link.json'), JSON.stringify({
    capCutPath: projectPath,
    projectName: projectName,
    createdAt: new Date().toISOString()
}, null, 2));
```

**Sistema legado**: Cria uma pasta `.nardoto/` dentro da pasta do CapCut:
```javascript
fs.writeFileSync(path.join(nardotoDir, 'workspace.json'), JSON.stringify({
    workspaceId: options.workspaceId,
    linkedAt: new Date().toISOString()
}, null, 2));
```

### 4.3 Resultado

Após todos esses passos, o projeto existe no disco com todos os arquivos necessários. Na próxima vez que o CapCut for aberto (ou se já estiver aberto, ao navegar para a lista de projetos), o projeto aparecerá com o nome correto, pronto para ser editado.

---

## 5. Detecção e Vinculação de Projetos Existentes

### 5.1 Scan de Projetos

**Canal IPC**: `detect-capcut-folder`
**Arquivo**: `src/main.js` linha 8658

Quando o NardotoStudio precisa listar os projetos disponíveis, ele escaneia as pastas do CapCut.

#### 5.1.1 Pastas Escaneadas

O Studio escaneia **duas** pastas:

```javascript
// Projetos importados da nuvem
const draftsPath = path.join(homeDir, 'AppData', 'Local', 'CapCut Drafts');

// Projetos criados localmente
const userDataPath = path.join(homeDir, 'AppData', 'Local', 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');
```

Cada pasta pode conter projetos independentes.

#### 5.1.2 Lógica de Scan

A função `scanProjectsInFolder()` (main.js:8422) funciona assim:

1. Lista todos os itens na pasta com `fs.readdirSync()`
2. Para cada item, verifica:
   - É um diretório?
   - Contém um arquivo `draft_content.json`?
3. Se sim, lê as informações básicas:
   - Nome: nome da pasta
   - Caminho: caminho completo da pasta
   - Data de modificação: `fs.statSync().mtime` do `draft_content.json`
   - Duração: lê `duration` do `draft_content.json`

```javascript
function scanProjectsInFolder(folderPath) {
    const items = fs.readdirSync(folderPath);
    const projects = [];
    for (const item of items) {
        const itemPath = path.join(folderPath, item);
        const draftPath = path.join(itemPath, 'draft_content.json');
        if (fs.statSync(itemPath).isDirectory() && fs.existsSync(draftPath)) {
            const stats = fs.statSync(draftPath);
            const draftContent = JSON.parse(fs.readFileSync(draftPath, 'utf-8'));
            projects.push({
                name: item,
                path: itemPath,
                draftPath: draftPath,
                modifiedAt: stats.mtime.toISOString(),
                duration: draftContent.duration || 0
            });
        }
    }
    return projects;
}
```

#### 5.1.3 Ordenação

Os projetos de ambas as pastas são combinados e ordenados por data de modificação (mais recente primeiro):

```javascript
allProjects.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
```

### 5.2 Sistema de Workspace

#### 5.2.1 O que é um Workspace

Um workspace é uma pasta local no computador do usuário onde o NardotoStudio armazena dados adicionais dos projetos (análises, chat history, mídias geradas, etc.). Os projetos do CapCut ficam na pasta do CapCut, mas os dados extras do Studio ficam no workspace.

#### 5.2.2 Vinculação

Quando um projeto é "vinculado" a um workspace, é criado um mapeamento bidirecional:

**No workspace** (`workspace/projetos/MeuProjeto/project-link.json`):
```json
{
    "capCutPath": "C:/Users/.../CapCut/.../MeuProjeto",
    "projectName": "MeuProjeto",
    "createdAt": "2026-02-19T14:30:00.000Z"
}
```

**No workspace.json** (índice do workspace):
```json
{
    "projects": [
        {
            "name": "MeuProjeto",
            "capCutPath": "C:/Users/.../CapCut/.../MeuProjeto",
            "localPath": "C:/Users/.../workspace/projetos/MeuProjeto",
            "linkedAt": "2026-02-19T14:30:00.000Z"
        }
    ]
}
```

#### 5.2.3 Mapeamento em Memória

O Studio mantém um `Map` global (`projectPathMapping`) que mapeia caminhos do CapCut para caminhos locais do workspace. Isso permite resolver rapidamente o caminho local de qualquer projeto:

```javascript
const projectPathMapping = new Map();
// chave: "C:/Users/.../CapCut/.../MeuProjeto" (normalizado)
// valor: "C:/Users/.../workspace/projetos/MeuProjeto"
```

#### 5.2.4 Migração de Projetos Legados

Projetos antigos usavam um sistema diferente: os dados do Studio ficavam dentro da própria pasta do CapCut, em `MeuProjeto/NardotoStudio/`. A função `migrateProjectToWorkspace()` (main.js:8501) migra esses projetos:

1. Verifica se existe pasta `NardotoStudio/` dentro do projeto CapCut
2. Copia recursivamente para `workspace/projetos/NomeProjeto/`
3. Cria `project-link.json`
4. Registra no `workspace.json`
5. Remove a pasta antiga do CapCut
6. Remove `.nardoto/` se existir

#### 5.2.5 Filtro por Workspace

Quando o usuário está em um workspace específico, os projetos podem ser filtrados:

- **Workspace padrão**: mostra TODOS os projetos, enriquecidos com informação de qual workspace pertencem
- **Workspace específico**: mostra apenas projetos vinculados àquele workspace

---

## 6. Inserção de Áudio

### 6.1 Os Três Caminhos

O NardotoStudio pode inserir áudio de três formas diferentes:

#### Caminho A -- JavaScript Direto

**Canal IPC**: `insert-media-batch`
**Arquivo**: `src/main.js` linha 1217

Usado quando o usuário seleciona arquivos de mídia para inserir. Detecta áudios pela extensão (`.mp3, .wav, .aac, .m4a, .ogg, .flac, .wma`).

Cria materiais simplificados (campos mínimos):
```json
{
    "id": "UUID-MATERIAL",
    "type": "audio",
    "path": "C:/caminho/audio.mp3",
    "name": "audio.mp3",
    "duration": 30000000,
    "create_time": 1708300000000,
    "local_material_id": "UUID-MATERIAL"
}
```

E segments simples:
```json
{
    "id": "UUID-SEGMENT",
    "material_id": "UUID-MATERIAL",
    "target_timerange": { "start": 0, "duration": 30000000 },
    "source_timerange": { "start": 0, "duration": 30000000 },
    "extra_material_refs": [],
    "volume": 1,
    "speed": 1,
    "visible": true
}
```

Repare que `extra_material_refs` está vazio -- nenhum material auxiliar é criado.

#### Caminho B -- Python sync_engine.py

**Ação**: `insert_audio`
**Arquivo**: `python_src/sync_engine.py` linha 1299

Cria materiais **completos** com todos os campos que o CapCut Desktop espera:

```json
{
    "category_name": "local",
    "check_flag": 1,
    "duration": 30000000,
    "id": "UUID",
    "local_material_id": "uuid-lowercase",
    "music_id": "uuid-lowercase",
    "name": "audio.mp3",
    "path": "C:/caminho/audio.mp3",
    "source_platform": 0,
    "type": "extract_music",
    "wave_points": []
}
```

E cria **5 materiais auxiliares** por áudio (função `criar_materiais_auxiliares_audio()`, linha 1263):

1. **Speed** (em `materials.speeds`):
```json
{ "id": "UUID", "mode": 0, "speed": 1.0, "type": "speed" }
```

2. **Placeholder Info** (em `materials.placeholder_infos`):
```json
{ "id": "UUID", "meta_type": "none", "type": "placeholder_info" }
```

3. **Beat** (em `materials.beats`):
```json
{ "id": "UUID", "gear": 404, "mode": 404, "type": "beats" }
```

4. **Sound Channel Mapping** (em `materials.sound_channel_mappings`):
```json
{ "id": "UUID", "audio_channel_mapping": 0, "type": "none" }
```

5. **Vocal Separation** (em `materials.vocal_separations`):
```json
{ "id": "UUID", "choice": 0, "type": "vocal_separation" }
```

O segment referencia todos esses auxiliares:
```json
{
    "extra_material_refs": ["speed_id", "placeholder_id", "beat_id", "channel_id", "vocal_id"]
}
```

#### Caminho C -- Python capcut_editor.py

**Canal IPC**: `capcut:insert-sound`
**Arquivo**: `python_src/context_analyzer.py` linha 88

Usa o método `CapCutProject.import_audio()` que cria um material intermediário sem materiais auxiliares. Usado pelo context analyzer para inserir sons em cenas específicas.

### 6.2 Obtenção de Duração

Para saber a duração de um áudio, o Studio usa `ffprobe` (do FFmpeg) via a função `getMediaMetadata()`:

```javascript
const result = spawnSync('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath
]);
const metadata = JSON.parse(result.stdout);
const duration = Math.round(parseFloat(metadata.format.duration) * 1000000); // para microssegundos
```

---

## 7. Sincronização de Timeline (Sync Engine)

### 7.1 O que é a Sincronização

A sincronização é a operação mais complexa do NardotoStudio. Ela pega áudios e vídeos que estão no projeto e **alinha** os vídeos com os áudios na timeline. Ou seja: o primeiro vídeo fica com o mesmo timing do primeiro áudio, o segundo vídeo com o segundo áudio, e assim por diante.

**Canal IPC**: `sync-project`
**Arquivo JS**: `src/main.js` linha 6358
**Arquivo Python**: `python_src/sync_engine.py` linha 272

### 7.2 Parâmetros

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `draftPath` | string | Caminho do `draft_content.json` |
| `audioTrackIndex` | number | Índice da track de áudio a usar como referência (0 = primeira) |
| `mode` | string | `'audio'` (alinhar com áudio) ou `'subtitle'` (alinhar com legendas) |
| `syncSubtitles` | boolean | Se `true`, legendas são reposicionadas junto com os vídeos |
| `applyAnimations` | boolean | Se `true`, imagens recebem keyframes de animação |

### 7.3 Fluxo Modo 'audio' -- Passo a Passo

#### Passo 1 -- Backup Automático

Antes de qualquer modificação, um backup é criado:

```python
backup_path = create_backup(draft_path)
# Resultado: draft_content_backup_20260219_143025.json
```

Isso garante que o usuário pode reverter qualquer mudança.

#### Passo 2 -- Ler o Projeto

```python
with open(draft_path, 'r', encoding='utf-8') as f:
    projeto = json.load(f)
```

#### Passo 3 -- Coletar Áudios

O script percorre todas as tracks de áudio e coleta todos os segments:

```python
audio_segments = []
for track in projeto['tracks']:
    if track['type'] == 'audio':
        for seg in track['segments']:
            audio_segments.append(seg)
```

#### Passo 4 -- Ordenar por Posição

```python
audio_segments.sort(key=lambda s: s['target_timerange']['start'])
```

Isso garante que os áudios são processados na ordem em que aparecem na timeline.

#### Passo 5 -- Remover Gaps

Os áudios são reposicionados sequencialmente, eliminando espaços vazios entre eles:

```python
current_position = 0
for seg in audio_segments:
    seg['target_timerange']['start'] = current_position
    current_position += seg['target_timerange']['duration']
```

Ou seja: o primeiro áudio começa em 0, o segundo começa exatamente onde o primeiro termina, e assim por diante.

#### Passo 6 -- Sincronizar Vídeos

Para cada vídeo na posição N, aplica o timing do áudio N:

```python
for i, video_seg in enumerate(video_segments):
    if i < len(audio_segments):
        video_seg['target_timerange']['start'] = audio_segments[i]['target_timerange']['start']
        video_seg['target_timerange']['duration'] = audio_segments[i]['target_timerange']['duration']
```

Isso faz com que o primeiro vídeo comece e termine exatamente junto com o primeiro áudio, o segundo vídeo com o segundo áudio, etc.

#### Passo 7 -- Sincronizar Legendas (se habilitado)

Se `syncSubtitles=True`, o mesmo processo é aplicado às tracks de texto.

#### Passo 8 -- Aplicar Animações (se habilitado)

Se `applyAnimations=True`, imagens (materiais com `type: "photo"`) recebem keyframes de animação aleatórios. Exemplos: zoom in lento, pan para baixo, zoom out. Isso dá vida a imagens estáticas.

A função `apply_animations_to_images()` (sync_engine.py:552) cria keyframes no formato do CapCut:

```json
{
    "keyframe_list": [
        { "curveType": "Line", "graphID": "", "id": "UUID", "property_type": "KFTypePositionY", "time_offset": 0, "values": [0.0] },
        { "curveType": "Line", "graphID": "", "id": "UUID", "property_type": "KFTypePositionY", "time_offset": 5000000, "values": [-0.1] }
    ]
}
```

#### Passo 9 -- Recalcular Duração

```python
max_duration = 0
for track in projeto['tracks']:
    for seg in track['segments']:
        end = seg['target_timerange']['start'] + seg['target_timerange']['duration']
        if end > max_duration:
            max_duration = end
projeto['duration'] = max_duration
```

#### Passo 10 -- Salvar

```python
with open(draft_path, 'w', encoding='utf-8') as f:
    json.dump(projeto, f, indent=2, ensure_ascii=False)
```

#### Passo 11 -- Sync Metadados (no JavaScript)

Após o Python retornar, o JavaScript chama `syncCapCutMetadata()` para atualizar os arquivos de índice (detalhado na seção 12).

### 7.4 Flatten Audio Tracks

Função auxiliar: `flatten_audio_tracks()` (sync_engine.py:475)

Quando existem múltiplas tracks de áudio, essa função consolida tudo em uma única track:

1. Coleta todos os segments de todas as tracks de áudio
2. Ordena por posição na timeline
3. Reposiciona sequencialmente (sem sobreposição)
4. Remove tracks de áudio extras (mantém apenas a primeira)
5. Coloca todos os segments na track restante

---

## 8. Inserção de Legendas (SRT)

### 8.1 O Formato SRT

Arquivos SRT são simples:

```
1
00:00:01,000 --> 00:00:03,500
Esta é a primeira legenda.

2
00:00:04,000 --> 00:00:06,000
Esta é a segunda legenda.
```

### 8.2 Parsing de SRT

Função: `parse_srt()` (sync_engine.py:149)

O Studio converte SRT para estrutura interna usando regex:

```python
pattern = r'(\d+)\s*\n(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*\n([\s\S]*?)(?=\n\n|\n\d+\s*\n|$)'
```

Cada legenda é convertida para:
```python
{
    "start": 1000000,       # 1 segundo em microssegundos
    "duration": 2500000,    # 2.5 segundos em microssegundos
    "text": "Esta é a primeira legenda."
}
```

Conversão: `(horas * 3600 + minutos * 60 + segundos) * 1000000 + milissegundos * 1000`

### 8.3 Templates de Texto

O CapCut usa estruturas JSON muito complexas para representar texto. Um material de texto tem cerca de **160 campos**. Para garantir compatibilidade, o Studio usa templates JSON reais extraídos do CapCut:

- `python_src/templates/text_material_template.json` -- Template do material
- `python_src/templates/text_segment_template.json` -- Template do segment
- `python_src/templates/text_animation_template.json` -- Template de animação

Esses templates são carregados do disco e preenchidos com os dados da legenda. Isso evita ter que replicar manualmente todos os 160 campos.

### 8.4 Criação de Material de Texto

Função: `criar_material_texto()` (sync_engine.py:210)

```python
mat_id = str(uuid.uuid4()).upper()
template = _load_template("text_material_template")
template["id"] = mat_id
template["content"] = texto           # "Esta é a primeira legenda."
template["group_id"] = group_id
template["font_size"] = font_size     # 5.0 para legendas, 7.0 para títulos
template["type"] = "subtitle"         # ou "text" para texto normal
```

O material é adicionado ao array `materials.texts` do projeto.

### 8.5 Criação de Segment de Texto

Função: `criar_segmento_texto()` (sync_engine.py:224)

```python
seg_id = str(uuid.uuid4()).upper()
template = _load_template("text_segment_template")
template["id"] = seg_id
template["material_id"] = mat_id
template["target_timerange"] = {"start": start_us, "duration": duration_us}
template["source_timerange"] = None   # Texto NÃO tem source_timerange
template["clip"]["transform"]["y"] = -0.75  # Posição vertical (inferior da tela)
template["render_index"] = 14000     # Camada alta (fica na frente)
template["extra_material_refs"] = [anim_id]  # Referência à animação
```

**Detalhes críticos**:
- `source_timerange` é `null` para texto (diferente de vídeo/áudio que apontam para um arquivo)
- `render_index: 14000` garante que o texto fica na camada mais alta (na frente de tudo)
- `clip.transform.y = -0.75` posiciona a legenda na parte inferior da tela (o centro é 0.0, o topo é 1.0, o fundo é -1.0)
- Para títulos, a posição é `y = -0.85` (mais baixo ainda)

### 8.6 Animação de Texto

Para cada legenda, uma animação é criada:

```json
{
    "animations": [],
    "id": "UUID",
    "multi_language_current": "none",
    "type": "sticker_animation"
}
```

Essa animação é adicionada em `materials.material_animations` e referenciada pelo `extra_material_refs` do segment.

### 8.7 insert-srt -- Match com Áudio

**Canal IPC**: `insert-srt`
**Arquivo**: `python_src/sync_engine.py` linha 717

Este modo faz match entre nomes de arquivos de áudio e SRT. Exemplo:

```
Áudio: "narração_parte1.mp3"
SRT:   "narração_parte1.srt"
```

Fluxo detalhado:

1. Lê todos os materiais de áudio do projeto (`materials.audios`)
2. Coleta segments de áudio das tracks para obter timing (quando cada áudio começa)
3. Para cada áudio, busca SRT com o mesmo nome base (sem extensão)
4. **Título** (se `create_title=True`):
   - Cria texto com o nome do áudio
   - Duração = duração total do áudio
   - Posição y = -0.85, font_size = 7.0
5. **Legendas**: para cada entrada do SRT:
   - Posição absoluta na timeline = `audio.start + legenda.start`
   - Duração = `legenda.duration`
   - Só inclui se a legenda cabe dentro do áudio: `legenda.start + legenda.duration <= audio.duration`
   - Posição y = -0.75, font_size = 5.0
6. Se `separate_tracks=True`: cria uma track separada para cada áudio
7. Adiciona todos os materiais e animações aos arrays do projeto

### 8.8 insert-srt-batch -- Sequencial

**Canal IPC**: `insert-srt-batch`
**Arquivo**: `python_src/sync_engine.py` linha 858

Insere múltiplos SRTs sequencialmente, um após o outro, com gap configurável:

```python
current_time = 0
for srt_file in srt_files:
    legendas = parse_srt(srt_file)
    block_duration = max(leg.start + leg.duration for leg in legendas)

    for leg in legendas:
        # Posiciona legenda na timeline global
        position = current_time + leg.start
        criar_material_texto(leg.text, ...)
        criar_segmento_texto(position, leg.duration, ...)

    current_time += block_duration + gap_ms
```

Se não existe track de vídeo no projeto, cria uma vazia (o CapCut precisa de pelo menos uma track de vídeo para renderizar).

---

## 9. Inserção de Mídias (Imagens e Vídeos)

### 9.1 insert-media-batch -- O Caminho Principal

**Canal IPC**: `insert-media-batch`
**Arquivo**: `src/main.js` linha 1217

Este é o handler mais usado para inserir mídias. Aceita vídeos, imagens e áudios no mesmo lote.

### 9.2 Parâmetros

| Parâmetro | Tipo | Default | Descrição |
|---|---|---|---|
| `draftPath` | string | - | Caminho do draft_content.json |
| `files` | string[] | - | Array de caminhos de arquivo |
| `filesWithDuration` | object[] | null | Durações individuais para cada arquivo |
| `imageDuration` | number | 5000000 | Duração padrão para imagens (5 segundos) |
| `insertMode` | string | 'end' | `'end'` (após último), `'start'` (no início), `'replace'` (substituir tudo) |
| `audioTrackMode` | string | 'same' | `'same'` (mesma track) ou `'separate'` (track separada por áudio) |

### 9.3 Detecção de Tipo

O tipo é detectado pela extensão do arquivo:

```javascript
const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.m4v', '.flv'].includes(ext);
const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'].includes(ext);
const isAudio = ['.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac', '.wma'].includes(ext);
```

### 9.4 Fluxo Detalhado

#### Passo 1 -- Ler Projeto

```javascript
const content = fs.readFileSync(draftFilePath, 'utf-8');
const project = JSON.parse(content);
```

#### Passo 2 -- Garantir Estrutura Básica

```javascript
if (!project.materials) project.materials = {};
if (!project.materials.videos) project.materials.videos = [];
if (!project.materials.audios) project.materials.audios = [];
if (!project.tracks) project.tracks = [];
```

#### Passo 3 -- Encontrar ou Criar Tracks

```javascript
let videoTrack = project.tracks.find(t => t.type === 'video');
if (!videoTrack) {
    videoTrack = {
        attribute: 0,
        flag: 0,
        id: require('crypto').randomUUID().toUpperCase(),
        is_default_name: true,
        name: '',
        segments: [],
        type: 'video'
    };
    project.tracks.push(videoTrack);
}
// Mesmo para audioTrack
```

#### Passo 4 -- Calcular Posição Inicial

```javascript
if (insertMode === 'end') {
    // Encontra onde o último segment termina
    const lastSegment = videoTrack.segments[videoTrack.segments.length - 1];
    currentVideoPosition = lastSegment.start + lastSegment.duration;
} else if (insertMode === 'replace') {
    videoTrack.segments = []; // Limpa tudo
} else if (insertMode === 'start') {
    currentVideoPosition = 0; // Empurra existentes para frente
}
```

#### Passo 5 -- Obter Metadados

Em batches de 20 para paralelismo:

```javascript
const metadata = await getMediaMetadata(filePath);
// Retorna: { duration, width, height, codec, fps, ... }
```

Usa `ffprobe` internamente.

#### Passo 6 -- Criar Material e Segment

Para cada arquivo:

```javascript
const materialId = require('crypto').randomUUID().toUpperCase();
const segmentId = require('crypto').randomUUID().toUpperCase();

// Material
const material = {
    id: materialId,
    type: isVideo ? 'video' : 'photo',
    path: filePath,
    name: fileName,
    duration: duration,
    width: metadata.width,
    height: metadata.height,
    create_time: Date.now(),
    local_material_id: materialId
};
project.materials.videos.push(material);

// Segment
const segment = {
    id: segmentId,
    material_id: materialId,
    target_timerange: { start: currentPosition, duration: duration },
    source_timerange: { start: 0, duration: duration },
    extra_material_refs: [],
    clip: { alpha: 1.0, scale: { x: 1.0, y: 1.0 }, transform: { x: 0, y: 0 }, rotation: 0 },
    volume: isVideo ? 1.0 : 0.0,
    speed: 1.0,
    visible: true
};
videoTrack.segments.push(segment);

currentPosition += duration;
```

#### Passo 7 -- Salvar

```javascript
fs.writeFileSync(draftFilePath, JSON.stringify(project, null, 2));
```

### 9.5 insert-director-scenes

**Canal IPC**: `insert-director-scenes`
**Arquivo**: `src/main.js` linha 1530

Inserção especial para cenas geradas pelo Director Mode (Analisador de Contexto). As cenas vêm com timing preciso e precisam respeitar a duração nativa do arquivo.

Diferenças do insert-media-batch:
- Cria uma **nova track** exclusiva (não reutiliza a existente)
- Usa `effectiveDuration = min(cena.duration_us, arquivo.duração_nativa)` para fazer trim
- O material armazena a duração total do arquivo; o segment usa a duração efetiva

---

## 10. Loop (Repetição de Elementos)

### 10.1 Loop de Vídeo

**Canal IPC**: `loop-video`
**Arquivo**: `python_src/sync_engine.py` linha 641

Repete os vídeos ciclicamente até cobrir toda a duração do áudio.

#### Algoritmo Detalhado

1. Calcula duração total do áudio: soma de todas as durações dos segments de áudio na track especificada
2. Copia a lista de segments de vídeo originais
3. Loop principal:

```python
current_position = 0
novos_segments = []

while current_position < duracao_total_audio:
    # Copia a lista de segments originais
    segments_copy = list(original_segments)

    # Se ordem aleatória, embaralha
    if order == 'random':
        random.shuffle(segments_copy)

    # Para cada segment original
    for original in segments_copy:
        # Deep clone (cria cópia completamente independente)
        novo = json.loads(json.dumps(original))
        # Novo ID único
        novo['id'] = str(uuid.uuid4()).upper()
        # Posiciona na timeline
        novo['target_timerange']['start'] = current_position
        # Avança posição
        current_position += novo['target_timerange']['duration']
        novos_segments.append(novo)
```

4. Substitui os segments da track de vídeo pelos novos
5. Salva o projeto

**Resultado**: Se o áudio tem 5 minutos e os vídeos originais somam 1 minuto, eles serão repetidos 5 vezes. Com `order='random'`, a cada ciclo a ordem dos vídeos é diferente.

### 10.2 Loop de Áudio

**Canal IPC**: `loop-audio`
**Arquivo**: `python_src/sync_engine.py` linha 686

Idêntico ao loop de vídeo, mas para áudio. Repete os áudios até atingir uma duração alvo (`targetDuration`).

Diferença: sempre usa ordem sequencial (não tem opção de embaralhar).

---

## 11. Merge (Mesclagem de Projetos)

### 11.1 Visão Geral

**Canal IPC**: `merge-projects`
**Arquivo**: `src/main.js` linha 9231

O merge combina múltiplos projetos CapCut em um único projeto. Existem dois modos: flat e groups.

### 11.2 Modo Flat -- Concatenação Sequencial

Este é o modo principal. Os projetos são colocados um após o outro na timeline, como se fossem capítulos de um livro.

#### Algoritmo Detalhado

**Passo 1 -- Criar projeto vazio**:
```javascript
const mergedProject = {
    canvas_config: { width: 1920, height: 1080, ratio: "16:9" },
    tracks: [],
    materials: { videos: [], audios: [], texts: [], /* ... todos os arrays vazios */ },
    duration: 0,
    // ...
};
```

**Passo 2 -- Para cada projeto fonte**:

a) **Copiar materiais com novos IDs**:

```javascript
const idMapping = {}; // mapa de IDs antigos -> novos

for (const material of sourceProject.materials.videos) {
    const newId = generateUUID();
    idMapping[material.id] = newId;
    const clonedMaterial = JSON.parse(JSON.stringify(material));
    clonedMaterial.id = newId;
    mergedProject.materials.videos.push(clonedMaterial);
}
// Repete para audios, texts, speeds, canvases, etc. (~20 categorias)
```

Isso é feito para cada categoria de material: videos, audios, texts, text_templates, effects, filters, transitions, stickers, canvases, speeds, sound_channel_mappings, vocal_separations, material_colors, placeholder_infos, beats, audio_fades, audio_effects, loudnesses, material_animations.

b) **Copiar tracks com offset temporal**:

```javascript
for (const sourceTrack of sourceProject.tracks) {
    // Encontrar ou criar track do mesmo tipo no merged
    let targetTrack = mergedProject.tracks.find(t => t.type === sourceTrack.type);
    if (!targetTrack) {
        targetTrack = { type: sourceTrack.type, segments: [], /* ... */ };
        mergedProject.tracks.push(targetTrack);
    }

    for (const segment of sourceTrack.segments) {
        const clonedSegment = JSON.parse(JSON.stringify(segment));
        clonedSegment.id = generateUUID();

        // OFFSET: empurra para frente pela duração acumulada
        clonedSegment.target_timerange.start += currentTimeOffset;

        // REMAPEAR IDs
        clonedSegment.material_id = idMapping[clonedSegment.material_id] || clonedSegment.material_id;
        clonedSegment.extra_material_refs = clonedSegment.extra_material_refs.map(
            ref => idMapping[ref] || ref
        );

        targetTrack.segments.push(clonedSegment);
    }
}
```

c) **Avançar offset**:
```javascript
currentTimeOffset += sourceProject.duration;
```

**Passo 3 -- Copiar arquivos de mídia**:

Os arquivos de mídia referenciados pelos materiais são copiados para a pasta do projeto merged.

**Passo 4 -- Criar os 4 arquivos**:

Cria `draft_content.json`, `draft_info.json`, `draft_meta_info.json` e registra no `root_meta_info.json`.

### 11.3 Detalhe Importante: Ordem de Campos no Texto

Antes de mesclar materiais de texto, o código reordena o JSON para que `styles` venha antes de `text`. Isso porque o CapCut espera essa ordem específica. Se `text` vier primeiro, o CapCut encapsula em outra camada e o texto fica duplicado.

### 11.4 Modo Groups (Composite Clips)

Neste modo, cada projeto fonte vira um "composite clip" (sub-draft) dentro do projeto merged:

1. Cria pasta `subdraft/` no projeto merged
2. Para cada fonte: copia o `draft_content.json` inteiro para `subdraft/{subdraftId}/`
3. Cria um material de vídeo virtual que referencia o subdraft
4. Cria um segment na track principal que aponta para o subdraft

---

## 12. Sincronização de Metadados (syncCapCutMetadata)

### 12.1 Por que é Necessária

Quando o Studio modifica o `draft_content.json`, os arquivos de metadados (`draft_meta_info.json` e `root_meta_info.json`) ficam desatualizados. Se eles não forem atualizados:

- O CapCut pode mostrar duração errada na lista de projetos
- O CapCut pode tentar baixar uma versão da nuvem e sobrescrever as modificações locais
- O CapCut pode não detectar que o projeto foi modificado

### 12.2 Quando é Chamada

A função `syncCapCutMetadata()` (main.js:604) é chamada **após cada operação** que modifica o projeto:

- Após `sync-project` (sincronização)
- Após `loop-video` e `loop-audio` (repetição)
- Após `insert-srt` e `insert-srt-batch` (legendas)
- Após `insert-media-batch` (mídias)
- Após `insert-director-scenes` (cenas do Director)
- Após operações do context analyzer
- Após merge de projetos

### 12.3 O que Faz -- Passo a Passo

#### Passo 1 -- Resolver Caminho

```javascript
draftPath = ensureDraftContentPath(draftPath);
// Se draftPath for um diretório, resolve para draft_content.json dentro dele
```

#### Passo 2 -- Gerar Timestamp

```javascript
const timestamp = Date.now() * 1000; // Converte milissegundos para microssegundos
```

#### Passo 3 -- Ler Duração e Tamanho

```javascript
const draftSize = fs.statSync(draftPath).size; // Tamanho em bytes
const draft = JSON.parse(fs.readFileSync(draftPath, 'utf-8'));
let duration = draft.duration || 0;

// Se duração não está definida, calcula dos tracks
if (!duration) {
    for (const track of (draft.tracks || [])) {
        for (const seg of (track.segments || [])) {
            const end = seg.target_timerange.start + seg.target_timerange.duration;
            if (end > duration) duration = end;
        }
    }
}
```

#### Passo 4 -- Atualizar draft_meta_info.json

```javascript
const meta = JSON.parse(fs.readFileSync(metaInfoPath, 'utf-8'));
meta.tm_draft_modified = timestamp;                  // Quando foi modificado
meta.tm_duration = duration;                          // Duração do projeto
meta.draft_timeline_materials_size_ = draftSize;      // Tamanho do JSON (COM underscore)
meta.cloud_draft_sync = false;                        // DESATIVA sync de nuvem
fs.writeFileSync(metaInfoPath, JSON.stringify(meta));
```

#### Passo 5 -- Atualizar root_meta_info.json

```javascript
const rootMeta = JSON.parse(fs.readFileSync(rootMetaPath, 'utf-8'));
for (const draft of rootMeta.all_draft_store) {
    if (draft.draft_fold_path === projectFolderForward) {
        draft.tm_draft_modified = timestamp;
        draft.tm_duration = duration;
        draft.draft_timeline_materials_size = draftSize;  // SEM underscore
        draft.cloud_draft_sync = false;
        break;
    }
}
fs.writeFileSync(rootMetaPath, JSON.stringify(rootMeta));
```

A busca é feita pelo `draft_fold_path` (caminho da pasta do projeto com barras normais).

### 12.4 Por que Desativar Cloud Sync

O campo `cloud_draft_sync: false` é **essencial**. Sem ele, quando o usuário abrir o CapCut:

1. O CapCut detecta que o projeto tem sync ativado
2. O CapCut verifica a versão na nuvem
3. Se a versão na nuvem for mais recente (o que acontece porque nossas modificações locais não foram para a nuvem), o CapCut **sobrescreve** o `draft_content.json` local com a versão da nuvem
4. Todas as modificações feitas pelo Studio são perdidas

Desativando o cloud sync, o CapCut usa a versão local, que é a modificada pelo Studio.

### 12.5 O Bug do Underscore

O campo que armazena o tamanho do arquivo tem nomes **ligeiramente diferentes** em cada arquivo:

- No `draft_meta_info.json`: `draft_timeline_materials_size_` (COM underscore final)
- No `root_meta_info.json`: `draft_timeline_materials_size` (SEM underscore final)

Essa inconsistência é do próprio CapCut. O Studio deve respeitar essa diferença, caso contrário o CapCut pode não ler os metadados corretamente.

---

## 13. Sistema de Backup e Undo

### 13.1 Backup Automático (Python)

Função: `create_backup()` (sync_engine.py:138)

Toda operação Python cria um backup **antes** de modificar o projeto:

```python
def create_backup(file_path):
    if os.path.isdir(file_path):
        file_path = os.path.join(file_path, 'draft_content.json')
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = file_path.replace('.json', f'_backup_{timestamp}.json')
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write(content)
    return backup_path
```

O nome do backup segue o padrão: `draft_content_backup_YYYYMMDD_HHMMSS.json`

Exemplo: `draft_content_backup_20260219_143025.json`

### 13.2 Backup no JavaScript

Algumas operações JavaScript também criam backups:

```javascript
fs.writeFileSync(draftFilePath + '.backup', content, 'utf-8');
```

### 13.3 Restauração (Undo)

**Canal IPC**: `undo-changes`
**Arquivo**: `src/main.js` linha 8352

```javascript
ipcMain.handle('undo-changes', async (_, draftPath, backupFilename) => {
    if (backupFilename) {
        // Restaurar backup específico
        backupPath = path.join(dir, backupFilename);
    } else {
        // Encontrar o backup mais recente
        const backups = files
            .filter(f => f.startsWith(baseName + '_backup_') && f.endsWith('.json'))
            .sort()
            .reverse();
        backupPath = path.join(dir, backups[0]);
    }

    // Copiar conteúdo do backup para o arquivo principal
    const backupContent = fs.readFileSync(backupPath, 'utf-8');
    fs.writeFileSync(draftPath, backupContent);
});
```

### 13.4 Lista de Backups

**Canal IPC**: `list-backups`
**Arquivo**: `src/main.js` linha 8259

O usuário pode ver todos os backups de um projeto, com:
- Nome do arquivo
- Data e hora
- Tamanho
- Descrição opcional (se o usuário adicionou uma)

Os backups podem ter descrições salvas em um arquivo `backup_descriptions.json` separado.

---

## 14. Watcher de Projeto (Monitoramento de Mudanças)

### 14.1 O que é

O watcher monitora mudanças no `draft_content.json` feitas **por qualquer programa**, incluindo o próprio CapCut. Isso permite que o Studio detecte quando o usuário fez uma edição manual no CapCut.

### 14.2 Como Funciona

**Canal IPC**: `watch-project`
**Arquivo**: `src/main.js` linha 1961

```javascript
projectWatcher = fs.watch(draftPath, { persistent: false }, (eventType) => {
    // Debounce de 500ms para evitar múltiplos eventos
    if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
    watchDebounceTimer = setTimeout(() => {
        mainWindow.webContents.send('project-file-changed', { draftPath, eventType });
    }, 500);
});
```

Quando o arquivo muda, o React recebe o evento `project-file-changed` e pode atualizar a interface.

### 14.3 Debounce

O debounce de 500ms é necessário porque uma única operação de salvamento pode gerar múltiplos eventos do sistema de arquivos (por exemplo, o CapCut pode primeiro limpar o arquivo e depois escrever o conteúdo novo, gerando dois eventos).

---

## 15. Extension Bridge (WebSocket)

### 15.1 O que é

O Extension Bridge é um servidor WebSocket que roda na porta 9876 dentro do processo Electron. Ele permite que extensões do Chrome (como o "Nardoto Labs") se comuniquem com o NardotoStudio.

**Arquivo**: `src/services/extensionBridge.js`

### 15.2 Para que Serve

A extensão do Chrome pode:
- Gerar imagens via Google Whisk
- Gerar vídeos via VEO3
- Gerar áudio via TTS
- Enviar prompts para Claude

Quando a extensão gera um arquivo, ela o envia via WebSocket para o Studio, que salva no disco.

### 15.3 Autenticação

Para evitar que qualquer programa se conecte ao WebSocket, existe um sistema de autenticação:

1. Ao iniciar, o Studio gera um token aleatório de 32 bytes:
```javascript
bridgeToken = crypto.randomBytes(32).toString('hex');
```

2. Salva o token em arquivo no diretório home:
```javascript
const tokenPath = path.join(os.homedir(), '.nardoto-bridge-token');
fs.writeFileSync(tokenPath, bridgeToken);
```

3. A extensão do Chrome lê esse arquivo e envia o token como primeira mensagem:
```json
{ "type": "auth", "token": "abc123..." }
```

4. Se o token estiver correto, a conexão é autenticada. Caso contrário, é fechada.

5. Timeout de 5 segundos para autenticar. Se não autenticar nesse tempo, a conexão é fechada.

### 15.4 Recepção de Arquivos

Quando a extensão gera uma mídia (`file:generated`):

```javascript
async function handleFileGenerated(ws, message) {
    // Determina pasta de destino
    if (global.currentProjectPath) {
        // Se tem projeto aberto, salva dentro dele
        const mediaType = moduleName === 'whisk' ? 'images' :
                         moduleName === 'veo3' ? 'videos' :
                         moduleName === 'tts' ? 'audio' : 'files';
        saveDir = path.join(global.currentProjectPath, 'media', mediaType);
    } else {
        // Senão, salva em Downloads
        saveDir = path.join(app.getPath('downloads'), 'Nardoto Studio', moduleName);
    }

    // Decodifica dados
    if (fileData.startsWith('data:')) {
        // Base64 data URL
        buffer = Buffer.from(fileData.split(',')[1], 'base64');
    } else if (fileData.startsWith('http')) {
        // URL - baixa o arquivo
        await downloadFile(fileData, filePath);
    } else {
        // Base64 puro
        buffer = Buffer.from(fileData, 'base64');
    }

    fs.writeFileSync(filePath, buffer);

    // Notifica o React
    notifyRenderer('bridge:file-received', { module, type, filename, path: filePath });
}
```

### 15.5 Comandos de Geração

O Studio pode enviar comandos para a extensão gerar conteúdo:

```javascript
// Gerar imagens
function generateImages(prompts, options) {
    broadcast({
        type: 'command:whisk:generate',
        requestId: `img-${Date.now()}`,
        prompts: prompts,
        options: { style: 'default', ratio: '16:9', count: 1 }
    });
}

// Gerar vídeos
function generateVideos(prompts, options) {
    broadcast({
        type: 'command:veo3:generate',
        requestId: `vid-${Date.now()}`,
        prompts: prompts,
        options: { duration: 5, style: 'cinematic', resolution: '1080p' }
    });
}

// Gerar áudio TTS
function generateAudio(text, options) {
    broadcast({
        type: 'command:tts:generate',
        requestId: `aud-${Date.now()}`,
        text: text,
        options: { voice: 'Puck', speed: 1.0 }
    });
}
```

---

## 16. CapCutProject -- API Python de Alto Nível

### 16.1 O que é

O `capcut_editor.py` fornece uma classe orientada a objetos (`CapCutProject`) que encapsula toda a complexidade de manipular JSONs do CapCut. É a camada mais limpa e reutilizável.

**Arquivo**: `python_src/capcut_editor.py`

### 16.2 Abertura de Projeto

```python
from capcut_editor import CapCutProject

projeto = CapCutProject.open("MeuProjeto")
# Busca automaticamente na pasta padrão do CapCut:
# %LOCALAPPDATA%\CapCut\User Data\Projects\com.lveditor.draft\MeuProjeto
```

### 16.3 Métodos Disponíveis

| Método | Linha | Descrição |
|---|---|---|
| `CapCutProject.open(nome)` | 249 | Abre projeto por nome |
| `add_text(text, position, duration)` | 580 | Adiciona texto/legenda |
| `add_text_to_track(track_idx, text, position, duration)` | 702 | Adiciona texto em track específica |
| `insert_srt_stems(stems_data)` | 772 | Insere SRT com stems |
| `import_video(path, position, duration)` | 865 | Importa vídeo na timeline |
| `import_audio(path, position, duration)` | 908 | Importa áudio na timeline |
| `import_image(path, position, duration)` | 937 | Importa imagem na timeline |
| `save()` | - | Salva projeto no disco |

### 16.4 Uso pelo Context Analyzer

O `context_analyzer.py` usa essa API para operações do Analisador de Contexto:

```python
# Inserir som em cena
def insert_sound_to_project(draft_path, audio_path, start_us, duration_us):
    projeto = CapCutProject.open_from_path(draft_path)
    projeto.import_audio(audio_path, position=start_us, duration=duration_us)
    projeto.save()

# Inserir legendas
def insert_subtitles_to_project(draft_path, subtitles):
    projeto = CapCutProject.open_from_path(draft_path)
    for sub in subtitles:
        projeto.add_text(sub.text, position=sub.start_us, duration=sub.duration_us)
    projeto.save()

# Inserir imagem
def insert_image_to_project(draft_path, image_path, start_us, duration_us):
    projeto = CapCutProject.open_from_path(draft_path)
    projeto.import_image(image_path, position=start_us, duration=duration_us)
    projeto.save()
```

### 16.5 Backup Automático

O `CapCutProject` usa a mesma pasta de templates e cria backups com `MAX_BACKUPS = 10`:

```python
BACKUP_FOLDER = ".backups"
MAX_BACKUPS = 10
```

---

## 17. Ponte IPC (preload.js)

### 17.1 O que é

O `preload.js` é um script que roda antes do React ser carregado. Ele cria uma ponte segura entre o mundo do navegador (React) e o mundo do Node.js (Electron). No Electron, o renderer (React) não pode acessar APIs do Node.js diretamente por segurança. O `preload.js` expõe apenas os canais IPC permitidos.

**Arquivo**: `src/preload.js`

### 17.2 Allowlist de Canais

O `preload.js` define duas listas:

**ALLOWED_INVOKE_CHANNELS** (~250 canais): Canais que o React pode chamar via `ipcRenderer.invoke()`. Exemplos:
```javascript
'create-new-project', 'insert-media-batch', 'insert-srt',
'sync-project', 'loop-video', 'loop-audio', 'merge-projects',
'detect-capcut-folder', 'undo-changes', 'list-backups',
'analyze-project', 'render-start', ...
```

**ALLOWED_LISTEN_CHANNELS** (~30 canais): Canais que o React pode escutar via `ipcRenderer.on()`. Exemplos:
```javascript
'project-file-changed', 'bridge:file-received',
'bridge:client-connected', 'render-complete',
'download-progress', ...
```

### 17.3 API Exposta

```javascript
contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        invoke: (channel, ...args) => {
            if (ALLOWED_INVOKE_CHANNELS.includes(channel)) {
                return ipcRenderer.invoke(channel, ...args);
            }
            return Promise.reject(new Error(`Canal IPC não permitido: ${channel}`));
        },
        on: (channel, callback) => {
            if (ALLOWED_LISTEN_CHANNELS.includes(channel)) {
                ipcRenderer.on(channel, (_event, ...args) => callback(...args));
            }
        }
    }
});
```

No React, o código acessa via:
```typescript
window.electron.ipcRenderer.invoke('insert-media-batch', { ... });
```

---

## 18. Ponte JavaScript-Python (runPython)

### 18.1 O que é

A função `runPython()` (main.js:483) é a ponte entre o mundo JavaScript (Electron) e o mundo Python (sync_engine.py). Ela serializa um comando, executa o Python como processo filho e retorna o resultado.

### 18.2 Fluxo Detalhado

#### Passo 1 -- Determinar Executável

```javascript
if (app.isPackaged) {
    // Produção: usa .exe compilado com Nuitka
    executable = path.join(process.resourcesPath, 'python', 'sync_engine.exe');
} else {
    // Desenvolvimento: usa Python do sistema
    executable = getPythonCmd(); // 'python' ou 'python3'
    script = path.join(process.cwd(), 'python_src', 'sync_engine.py');
}
```

#### Passo 2 -- Serializar Comando

```javascript
const cmdJson = JSON.stringify(command);
// Exemplo: {"action":"sync","draft_path":"C:/...","audio_track_index":0,"mode":"audio"}
```

#### Passo 3 -- Verificar Tamanho

Se o JSON for maior que 7000 caracteres, ele é salvo em arquivo temporário para evitar problemas com o limite de argumentos de linha de comando:

```javascript
if (cmdJson.length > 7000) {
    const tempFile = path.join(os.tmpdir(), `capcut_cmd_${Date.now()}.json`);
    fs.writeFileSync(tempFile, cmdJson);
    args = [script, '--file', tempFile];
} else {
    args = [script, cmdJson];
}
```

#### Passo 4 -- Executar

```javascript
const result = spawnSync(executable, args, {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024, // 50MB de output máximo
    timeout: 60000               // 60 segundos de timeout
});
```

`spawnSync` é síncrono: o JavaScript **bloqueia** até o Python terminar.

#### Passo 5 -- Processar Resultado

- **stdout**: JSON com o resultado (parseado e retornado)
- **stderr**: Mensagens de debug (logadas no console)
- **status**: Código de saída (0 = sucesso)

```javascript
if (result.status !== 0) {
    return { error: `Python exited with code ${result.status}` };
}
return JSON.parse(result.stdout);
```

#### Passo 6 -- Limpeza

Se um arquivo temporário foi usado, ele é removido:
```javascript
if (tempFile) {
    try { fs.unlinkSync(tempFile); } catch { }
}
```

---

## 19. Comparação entre os Caminhos de Inserção

| Aspecto | JavaScript (main.js) | Python (sync_engine.py) | Python (capcut_editor.py) |
|---|---|---|---|
| **Materiais auxiliares** | NÃO cria (extra_material_refs vazio) | Cria 5-6 auxiliares completos | NÃO cria auxiliares |
| **IDs** | `crypto.randomUUID().toUpperCase()` | `str(uuid.uuid4()).upper()` | `str(uuid.uuid4()).upper()` |
| **Campos do material** | Mínimos (~8 campos) | Completos (~25 campos com crop, matting, stable) | Intermediários (~12 campos) |
| **Templates** | Inline no código JS | Templates JSON do disco | Templates JSON do disco |
| **Execução** | Direta (mesmo processo) | Processo filho (spawnSync) | Processo filho (spawnSync) |
| **Velocidade** | Mais rápido | Mais lento (spawn) | Mais lento (spawn) |
| **Compatibilidade** | Funciona para maioria dos casos | Máxima compatibilidade com CapCut | Boa compatibilidade |
| **Quando usar** | insert-media-batch, insert-director-scenes, merge | Sync, SRT, Loop, Insert media avançado | Context analyzer (IA) |
| **Ponto forte** | Leitura paralela de metadados, velocidade | Materiais "CapCut-compatible" completos | API limpa e orientada a objetos |

---

## 20. Fluxos Completos Passo a Passo

### 20.1 Criar Projeto e Inserir Vídeo

```
1. Usuário abre NardotoStudio
2. Clica em "Novo Projeto"
3. React chama: ipcRenderer.invoke('create-new-project', { name: 'MeuVideo' })
4. preload.js valida o canal na allowlist
5. main.js recebe o comando:
   a. Verifica rate limit
   b. Encontra pasta do CapCut: %LOCALAPPDATA%\CapCut\...\com.lveditor.draft\
   c. Cria pasta MeuVideo/
   d. Gera UUID: "A1B2C3D4-..."
   e. Escreve draft_content.json (projeto vazio)
   f. Escreve draft_info.json
   g. Escreve draft_meta_info.json
   h. Registra no root_meta_info.json (unshift no array)
   i. Garante consistência de IDs
6. Retorna: { success: true, path: "...", draftPath: "..." }
7. React mostra o projeto criado
8. Usuário clica em "Inserir Mídia"
9. Seleciona um arquivo de vídeo
10. React chama: ipcRenderer.invoke('insert-media-batch', { draftPath, files: ['C:/video.mp4'] })
11. main.js:
    a. Lê draft_content.json
    b. Encontra/cria video track
    c. Executa ffprobe para obter duração (ex: 15 segundos = 15000000 us)
    d. Gera materialId e segmentId
    e. Cria material: { type: "video", path: "C:/video.mp4", duration: 15000000, ... }
    f. Cria segment: { target_timerange: { start: 0, duration: 15000000 }, ... }
    g. Adiciona material em materials.videos
    h. Adiciona segment na video track
    i. Salva draft_content.json
    j. Chama syncCapCutMetadata():
       - Atualiza draft_meta_info.json (timestamp, duração, tamanho, cloud_sync=false)
       - Atualiza root_meta_info.json (mesmos campos)
12. Retorna resultado
13. Quando o CapCut abrir MeuVideo: o vídeo aparece na timeline, com 15 segundos de duração
```

### 20.2 Sincronizar 3 Áudios com 3 Vídeos

```
Estado inicial no projeto:
- Track de vídeo: [Video1 (10s)][Video2 (8s)][Video3 (12s)]
- Track de áudio: [Audio1 (15s)]...[Audio2 (20s)]...[Audio3 (10s)]
  (com gaps entre os áudios)

1. Usuário clica "Sincronizar"
2. React chama: ipcRenderer.invoke('sync-project', { draftPath, audioTrackIndex: 0, mode: 'audio' })
3. main.js chama runPython({ action: 'sync', ... })
4. runPython serializa JSON e executa sync_engine.py
5. sync_engine.py:
   a. Cria backup: draft_content_backup_20260219_150000.json
   b. Lê o projeto
   c. Coleta áudios: Audio1(15s), Audio2(20s), Audio3(10s)
   d. Ordena por posição
   e. Remove gaps e reposiciona:
      Audio1: start=0, duration=15s
      Audio2: start=15s, duration=20s
      Audio3: start=35s, duration=10s
   f. Sincroniza vídeos com áudios:
      Video1: start=0, duration=15s (antes era 10s, agora esticado para 15s)
      Video2: start=15s, duration=20s (antes era 8s, agora esticado para 20s)
      Video3: start=35s, duration=10s (antes era 12s, agora encolhido para 10s)
   g. Recalcula duração: 35s + 10s = 45s
   h. Salva draft_content.json
6. main.js chama syncCapCutMetadata()
7. Retorna resultado

Estado final:
- Track de vídeo: [Video1 (15s)][Video2 (20s)][Video3 (10s)]
- Track de áudio: [Audio1 (15s)][Audio2 (20s)][Audio3 (10s)]
  (perfeitamente alinhados, sem gaps)
```

### 20.3 Inserir Legendas de um SRT

```
Arquivo: narração.srt
1
00:00:01,000 --> 00:00:03,500
Primeira legenda

2
00:00:04,000 --> 00:00:06,500
Segunda legenda

1. Usuário clica "Inserir SRT"
2. React chama: ipcRenderer.invoke('insert-srt-batch', { draftPath, srtFiles: ['narração.srt'] })
3. main.js chama runPython({ action: 'insert_srt_batch', ... })
4. sync_engine.py:
   a. Cria backup
   b. Faz parse do SRT:
      Legenda 1: { start: 1000000, duration: 2500000, text: "Primeira legenda" }
      Legenda 2: { start: 4000000, duration: 2500000, text: "Segunda legenda" }
   c. Para legenda 1:
      - Carrega text_material_template.json
      - Preenche: content="Primeira legenda", font_size=5.0, type="subtitle"
      - Gera UUID para material
      - Carrega text_segment_template.json
      - Preenche: start=1000000, duration=2500000, y=-0.75, render_index=14000
      - Gera UUID para segment
      - Carrega text_animation_template.json
      - Gera UUID para animação
   d. Repete para legenda 2
   e. Cria track de texto: { type: "text", flag: 1, segments: [...] }
   f. Adiciona materiais em materials.texts
   g. Adiciona animações em materials.material_animations
   h. Adiciona track ao projeto
   i. Salva
5. Retorna resultado

Resultado no CapCut: duas legendas aparecem na parte inferior da tela,
a primeira de 1s a 3.5s, a segunda de 4s a 6.5s
```

---

## 21. Resumo dos Princípios Fundamentais

1. **Toda comunicação é via arquivos JSON no disco.** Não existe API, socket, ou qualquer protocolo de comunicação em tempo real entre o Studio e o CapCut. O Studio escreve, o CapCut lê.

2. **Quatro arquivos definem um projeto.** `draft_content.json` (timeline), `draft_info.json` (informações), `draft_meta_info.json` (metadados), e `root_meta_info.json` (índice global). Todos devem estar consistentes.

3. **A timeline é Track > Segment > Material.** Tracks são pistas, segments são clips, materials são recursos. Segments referenciam materials por UUID.

4. **Tudo é em microssegundos.** 1 segundo = 1.000.000 us. Exceto timestamps de criação que podem ser em segundos ou microssegundos dependendo do arquivo.

5. **IDs são UUIDs v4 em maiúsculo.** Cada entidade precisa de um ID único. Nunca reutilizar IDs.

6. **Imagens vão para `materials.videos`** com `type: "photo"`. NÃO para `materials.images`.

7. **Cloud sync deve ser desativado** após cada modificação (`cloud_draft_sync: false`), senão o CapCut sobrescreve as mudanças locais.

8. **O campo de tamanho tem underscore no meta, mas não no root.** `draft_timeline_materials_size_` vs `draft_timeline_materials_size`. Isso é do CapCut e deve ser respeitado.

9. **Backup antes de cada operação Python.** A função `create_backup()` é chamada antes de qualquer modificação, criando uma cópia timestamped.

10. **Três camadas coexistem.** JavaScript direto (rápido, simples), Python sync_engine (completo, com auxiliares), Python capcut_editor (API limpa). Cada uma é usada onde faz mais sentido.

11. **O `syncCapCutMetadata()` é chamado após cada operação.** Ele atualiza timestamps, duração e tamanho nos arquivos de índice para manter tudo consistente.

12. **O Extension Bridge conecta extensões do Chrome via WebSocket.** Permite receber mídias geradas por IA e enviá-las para o projeto. Usa autenticação por token.

---

## 22. Mapa de Arquivos Críticos

| Arquivo | Função Principal | Linhas-chave |
|---|---|---|
| `src/main.js` | Processo principal Electron, todos os IPC handlers | runPython (483), syncCapCutMetadata (604), insert-media-batch (1217), insert-director-scenes (1530), watch-project (1961), create-new-project (5491), detect-capcut-exe (5316), sync-project (6358), loop-video (6385), loop-audio (6397), insert-srt (6413), insert-srt-batch (6467), list-backups (8259), undo-changes (8352), scanProjectsInFolder (8422), workspace helpers (8456), detect-capcut-folder (8658), merge-projects (9231) |
| `src/preload.js` | Ponte segura Electron-React, allowlist de canais IPC | ALLOWED_INVOKE_CHANNELS (16-169), ALLOWED_LISTEN_CHANNELS (172-197), exposeInMainWorld (201-229) |
| `src/services/extensionBridge.js` | Servidor WebSocket para extensões Chrome | startBridge (39), handleMessage (181), handleFileGenerated (276), generateImages (665), generateVideos (690), generateAudio (715) |
| `python_src/sync_engine.py` | Motor de sincronização, SRT, loop, inserção avançada | create_backup (138), parse_srt (149), criar_material_texto (210), criar_segmento_texto (224), sync_project (272), flatten_audio_tracks (475), apply_animations_to_images (552), loop_video (641), loop_audio (686), insert_srt (717), insert_srt_batch (858), criar_material_video (1082), criar_materiais_auxiliares_video (1101), criar_segmento_video (1120), insert_media_batch (1141), criar_material_audio (1250), criar_materiais_auxiliares_audio (1263), criar_segmento_audio (1280), insert_audio_batch (1299) |
| `python_src/capcut_editor.py` | API orientada a objetos para manipular projetos | CapCutProject.open (249), add_text (580), add_text_to_track (702), insert_srt_stems (772), import_video (865), import_audio (908), import_image (937) |
| `python_src/context_analyzer.py` | Inserção de cenas/mídia via IA | insert_sound_to_project (88), insert_subtitles_to_project (139), insert_image_to_project (193), insert_scenes_from_subtitles (283), get_scenes_from_subtitles (352) |
| `python_src/project_manager.py` | Export/Import de projetos | get_all_media_paths (31), update_media_paths (100), export_project (137) |
| `python_src/templates/text_material_template.json` | Template de material de texto (~160 campos) | - |
| `python_src/templates/text_segment_template.json` | Template de segment de texto | - |
| `python_src/templates/text_animation_template.json` | Template de animação de texto | - |

---

*Fim do relatório.*
