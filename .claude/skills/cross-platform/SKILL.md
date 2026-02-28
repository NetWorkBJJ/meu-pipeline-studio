# Cross-Platform Compatibility Agent

Agente especialista em compatibilidade multiplataforma (Windows + macOS) para aplicacoes Electron + Python. Use este skill sempre que estiver criando, modificando ou revisando codigo que possa ter comportamento diferente entre plataformas.

## Quando Ativar

- Criando ou editando IPC handlers, Python bridge, file paths, shell commands
- Escrevendo codigo que usa `child_process`, `fs`, `path`, `os`, `process.env`
- Trabalhando com executaveis (Python, ffprobe, npm, CapCut)
- Configurando electron-builder, empacotamento ou distribuicao
- Qualquer codigo que interage com o sistema operacional

## Checklist de Auditoria

### 1. File Paths

| Regra | Errado | Correto |
|-------|--------|---------|
| Sempre usar `path.join()` | `home + '/Movies/CapCut'` | `join(home, 'Movies', 'CapCut')` |
| Nunca hardcodar separadores | `folder.replace("/", "\\")` | `path.normalize(folder)` |
| Nunca converter `/` para `\\` em Python | `path.replace("/", "\\")` | Usar `pathlib.Path` ou `os.path` |
| Paths com espacos devem ser quoted | `exec(cmd + path)` | `execFile(cmd, [path])` |

### 2. Python Spawning

| Plataforma | Executavel | Localizacao |
|------------|-----------|-------------|
| Windows (dev) | `python` ou `python3` | PATH ou `py -3` launcher |
| macOS (dev) | `python3` | `/usr/bin/python3`, `/opt/homebrew/bin/python3` |
| Windows (packaged) | `python.exe` | `resources/python/python.exe` |
| macOS (packaged) | `python3` | `resources/python/bin/python3` |

**Regra critica**: Em `bridge.ts`, verificar `process.platform` para selecionar o executavel correto.

### 3. Environment Variables

| Variavel | Windows | macOS |
|----------|---------|-------|
| Home dir | `USERPROFILE` | `HOME` |
| App data | `LOCALAPPDATA` | `~/Library/Application Support` |
| Temp dir | `TEMP` ou `TMP` | `TMPDIR` |
| Path sep | `;` | `:` |

**Regra**: Sempre usar APIs do Node (`os.homedir()`, `os.tmpdir()`, `app.getPath()`) ao inves de env vars diretas.

### 4. Shell & Commands

| Operacao | Windows | macOS |
|----------|---------|-------|
| Listar processos | `tasklist` | `ps aux` |
| Matar processo | `taskkill /F /PID` | `kill -9` |
| Encontrar executavel | `where` | `which` |
| Abrir arquivo | `start` | `open` |
| Modifier teclado | `Ctrl` (modifier 2) | `Cmd/Meta` (modifier 4) |

**Regra**: Usar `process.platform === 'darwin'` para branching, nunca assumir uma plataforma.

### 5. CapCut Paths

| Plataforma | Projetos CapCut |
|------------|----------------|
| Windows | `%LOCALAPPDATA%/CapCut/User Data/Projects/com.lveditor.draft` |
| macOS | `~/Movies/CapCut/User Data/Projects/com.lveditor.draft` |

**Regra**: Sempre usar `getDefaultCapCutPath()` com `process.platform` check.

### 6. Electron Builder

```yaml
# Correto: recursos separados por plataforma
win:
  extraResources:
    - from: resources/python-embed-win
      to: python
mac:
  extraResources:
    - from: resources/python-embed-mac
      to: python
```

### 7. CDP / Browser Automation

| Acao | Windows | macOS |
|------|---------|-------|
| Select All | `Ctrl+A` (modifier 2) | `Cmd+A` (modifier 4) |
| Copy | `Ctrl+C` (modifier 2) | `Cmd+C` (modifier 4) |
| Paste | `Ctrl+V` (modifier 2) | `Cmd+V` (modifier 4) |
| Undo | `Ctrl+Z` (modifier 2) | `Cmd+Z` (modifier 4) |

**Regra**: `const mod = process.platform === 'darwin' ? 4 : 2`

### 8. External Tools

| Ferramenta | Verificacao |
|-----------|-------------|
| `ffprobe` | `shutil.which("ffprobe")` antes de usar |
| `npm` | Pode nao estar no PATH em GUI apps no macOS (usar `fix-path`) |
| `python3` | Verificar existencia antes de spawn |

## Problemas Conhecidos Neste Projeto

### CRITICAL
1. **`scripts/prepare-python.mjs`** - Pipeline de bundling Python e 100% Windows. Baixa `.exe` embeddable, usa `._pth`. macOS nao tem equivalente.
2. **`electron-builder.yml`** - `extraResources` copia binarios Windows para todas as plataformas.
3. **`executions/debug_tools.py:268`** - `.replace("/", "\\")` corrompe paths macOS.

### HIGH
4. **`src/main/veo3/cdp-core.ts:496`** - `Ctrl+A` (modifier 2) nao funciona como Select All no macOS. Precisa de `Cmd+A` (modifier 4).
5. **`package.json`** - Nao existe script `build:mac`.
6. **`executions/capcut_writer.py:1357`** - `os_version` hardcoded como `"10.0.22631"`.

### MEDIUM
7. **`workspace.handlers.ts:46-51`** - Template literal paths ao inves de `path.join()`.
8. **`project.handlers.ts:14-20`** - Mesma questao de template paths.
9. **`project.handlers.ts:145-148`** - CapCut executable path hardcoded sem fallbacks.
10. **`capcut_writer.py:774`** - `ffprobe` assume estar no PATH sem verificacao.
11. **`director.handlers.ts:29`** - `npm` pode nao estar no PATH em GUI apps no macOS.
12. **`veo3.handlers.ts:28`** - Path relativo fragil com `__dirname` em dev mode.
13. **`llm_director.py:87-88`** - Escaping de `cmd.exe` incompleto (falta `^`, `&`, `|`, `!`).

### LOW
14. **Varios** - `LOCALAPPDATA` fallback para string vazia.
15. **`tts.handlers.ts`** - Comentario menciona "Windows DPAPI" mas `safeStorage` e cross-platform.
16. **`cdp-core.ts`** - `windowsVirtualKeyCode` e nome padrao CDP, nao bug.

## Template de Fix

Ao corrigir um problema de plataforma, seguir este padrao:

```typescript
// TypeScript - Platform branching
if (process.platform === 'darwin') {
  // macOS logic
} else {
  // Windows logic (default)
}
```

```python
# Python - Platform branching
import sys
if sys.platform == "darwin":
    # macOS logic
else:
    # Windows logic (default)
```

## Processo de Auditoria

Ao auditar um arquivo ou feature:

1. Buscar por: hardcoded paths, `\\`, `C:`, `.exe`, `LOCALAPPDATA`, `APPDATA`, `USERPROFILE`
2. Buscar por: `exec(`, `spawn(`, `execFile(`, `child_process`, `subprocess.run`
3. Buscar por: `fs.`, `os.path`, `pathlib`, `shutil`
4. Buscar por: `process.env.` sem fallback cross-platform
5. Buscar por: `modifier` ou keyboard shortcuts sem platform check
6. Verificar se electron-builder config tem secoes `win:` e `mac:` separadas
7. Verificar se scripts npm tem variantes para ambas plataformas
