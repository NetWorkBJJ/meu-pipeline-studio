# PRD: Eliminar Paths Hardcoded - Usar Workspace Config

## Problema

O projeto tem paths do CapCut hardcoded com o username `ander` em 3 arquivos. O sistema de workspaces ja tem `capCutProjectsPath` configuravel via UI (botao "CapCut Path" em Settings), mas nem todos os pontos do codigo usam esse valor. O CLAUDE.md tambem documenta o path fixo. O objetivo e eliminar TODOS os paths hardcoded e usar sempre o path configurado no workspace.

## Inventario de Paths Hardcoded

| Arquivo | Linha | Path Hardcoded | Tipo |
|---------|-------|---------------|------|
| `CLAUDE.md` | 210 | `C:/Users/ander/AppData/Local/CapCut/User Data/Projects/com.lveditor.draft/` | Documentacao |
| `src/main/ipc/project.handlers.ts` | 14 | `C:/Users/ander/AppData/Local/CapCut/User Data/Projects/com.lveditor.draft` | defaultPath do dialog select-draft |
| `src/main/ipc/project.handlers.ts` | 137 | `AppData/Local/CapCut/CapCut.exe` | Path do executavel (usa homedir(), parcialmente dinamico) |
| `src/renderer/src/components/workspace/WorkspaceCreateModal.tsx` | 16-17 | `C:/Users/ander/AppData/Local/CapCut/User Data/Projects/com.lveditor.draft` | Constante DEFAULT_CAPCUT_PATH |

## Solucao Existente (ja implementada, so precisa ser reusada)

- `src/main/ipc/workspace.handlers.ts:45-48` - funcao `getDefaultCapCutPath()` usa `process.env.LOCALAPPDATA` (dinamico, sem username hardcoded)
- Cada `workspace.json` armazena `capCutProjectsPath` configurado pelo usuario
- UI: SettingsModal tem botao "CapCut Path" para alterar o valor por workspace

## Mudancas Necessarias

### A. CLAUDE.md (secao Paths Importantes, linha 210)

- Remover path hardcoded `C:/Users/ander/...`
- Documentar que o path e configuravel via workspace (`activeWorkspace.capCutProjectsPath`)
- Mencionar fallback dinamico via `getDefaultCapCutPath()` que usa `%LOCALAPPDATA%/CapCut/User Data/Projects/com.lveditor.draft`

### B. project.handlers.ts - `project:select-draft` (linha 14)

Estado atual:
```typescript
defaultPath: 'C:/Users/ander/AppData/Local/CapCut/User Data/Projects/com.lveditor.draft'
```

Mudanca:
- Receber `capCutProjectsPath` como argumento opcional vindo do renderer
- Fallback: usar `getDefaultCapCutPath()` (importar de workspace.handlers ou extrair para modulo util compartilhado)
- Atualizar preload: `selectCapCutDraft()` deve aceitar path opcional e repassar ao main

### C. project.handlers.ts - `project:open-capcut` (linha 137)

Estado atual:
```typescript
const directPath = join(home, 'AppData/Local/CapCut/CapCut.exe')
```

Mudanca:
- Usar `process.env.LOCALAPPDATA` em vez de `homedir() + 'AppData/Local'`
- Resultado: `join(process.env.LOCALAPPDATA || '', 'CapCut', 'CapCut.exe')`

### D. WorkspaceCreateModal.tsx (linhas 16-17)

Estado atual:
```typescript
const DEFAULT_CAPCUT_PATH =
  'C:/Users/ander/AppData/Local/CapCut/User Data/Projects/com.lveditor.draft'
```

Mudanca:
- Remover constante hardcoded
- Criar novo IPC `workspace:get-default-capcut-path` que retorna o resultado de `getDefaultCapCutPath()`
- No componente: chamar IPC no mount (useEffect) para obter o default path
- Alternativa mais simples: exportar `getDefaultCapCutPath` e registrar o IPC em workspace.handlers.ts

## Arquivos a Modificar

1. `CLAUDE.md` - Atualizar secao Paths Importantes
2. `src/main/ipc/project.handlers.ts` - Usar path dinamico no dialog + open-capcut
3. `src/main/ipc/workspace.handlers.ts` - Exportar `getDefaultCapCutPath` + registrar IPC `workspace:get-default-capcut-path`
4. `src/renderer/src/components/workspace/WorkspaceCreateModal.tsx` - Remover DEFAULT_CAPCUT_PATH, usar IPC
5. `src/preload/index.ts` - Expor `getDefaultCapCutPath` e atualizar `selectCapCutDraft` com param opcional
6. `src/preload/index.d.ts` - Atualizar tipos

## Verificacao

- [ ] Criar workspace novo: campo CapCut Path deve mostrar path dinamico (nao hardcoded com username)
- [ ] Selecionar draft (`project:select-draft`): dialog deve abrir no path do workspace ativo
- [ ] Abrir CapCut (`project:open-capcut`): deve encontrar exe via LOCALAPPDATA
- [ ] CLAUDE.md nao deve ter nenhum path com username hardcoded
- [ ] `npm run typecheck` deve passar
- [ ] Buscar no projeto inteiro por `ander` para garantir que nao ha mais paths hardcoded
