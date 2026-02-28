import { ipcMain, dialog, shell } from 'electron'
import { readFile, writeFile, rm, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { callPython } from '../python/bridge'
import { watchDraft, unwatchDraft, isWatching } from './draft-watcher'

export function registerProjectHandlers(): void {
  ipcMain.handle('project:select-draft', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Selecionar projeto CapCut',
      properties: ['openDirectory'],
      defaultPath:
        process.platform === 'darwin'
          ? join(require('os').homedir(), 'Movies/CapCut/User Data/Projects/com.lveditor.draft')
          : join(
              process.env.LOCALAPPDATA || require('os').homedir(),
              'CapCut/User Data/Projects/com.lveditor.draft'
            )
    })
    if (result.canceled) return null

    const projectDir = result.filePaths[0]
    // Prefer draft_info.json (CapCut working file, most up-to-date on macOS)
    const draftInfoPath = join(projectDir, 'draft_info.json')
    const draftContentPath = join(projectDir, 'draft_content.json')
    const draftPath = existsSync(draftInfoPath) ? draftInfoPath : draftContentPath
    return draftPath
  })

  ipcMain.handle('project:save', async (_event, data: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Salvar projeto',
      defaultPath: 'projeto.mps.json',
      filters: [{ name: 'WorkFlowAA', extensions: ['mps.json'] }]
    })
    if (result.canceled || !result.filePath) return
    await writeFile(result.filePath, data, 'utf-8')
  })

  ipcMain.handle('project:load', async (_event, path: string) => {
    const data = await readFile(path, 'utf-8')
    return data
  })

  ipcMain.handle('project:create-capcut', async (_event, name: string) => {
    return callPython('create_project', { name })
  })

  ipcMain.handle('project:list-capcut', async () => {
    return callPython('list_projects', {})
  })

  ipcMain.handle('project:watch-draft', async (_event, draftPath: string) => {
    watchDraft(draftPath)
    return { watching: true, path: draftPath }
  })

  ipcMain.handle('project:unwatch-draft', async () => {
    unwatchDraft()
    return { watching: false }
  })

  ipcMain.handle('project:is-watching', async () => {
    return { watching: isWatching() }
  })

  ipcMain.handle(
    'project:delete-capcut',
    async (_event, params: { projectPaths: string[] }) => {
      const results: Array<{ path: string; success: boolean; error?: string }> = []

      for (const projectPath of params.projectPaths) {
        try {
          const normalized = projectPath.replace(/\\/g, '/')
          if (!normalized.includes('com.lveditor.draft')) {
            results.push({
              path: projectPath,
              success: false,
              error: 'Path does not appear to be a CapCut project directory'
            })
            continue
          }

          const stats = await stat(projectPath)
          if (!stats.isDirectory()) {
            results.push({ path: projectPath, success: false, error: 'Path is not a directory' })
            continue
          }

          const hasDraftInfo = existsSync(join(projectPath, 'draft_info.json'))
          const hasDraftContent = existsSync(join(projectPath, 'draft_content.json'))
          if (!hasDraftInfo && !hasDraftContent) {
            results.push({
              path: projectPath,
              success: false,
              error: 'No draft file found - not a valid CapCut project'
            })
            continue
          }

          await rm(projectPath, { recursive: true, force: true })
          results.push({ path: projectPath, success: true })
        } catch (err) {
          results.push({
            path: projectPath,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
          })
        }
      }

      return {
        totalRequested: params.projectPaths.length,
        totalDeleted: results.filter((r) => r.success).length,
        results
      }
    }
  )

  ipcMain.handle('project:save-director', async (_event, draftPath: string, data: string) => {
    const projectFolder = join(draftPath, '..')
    const savePath = join(projectFolder, '.mps-director.json')
    try {
      await writeFile(savePath, data, 'utf-8')
      return { saved: true }
    } catch (err) {
      return { saved: false, error: err instanceof Error ? err.message : 'Write failed' }
    }
  })

  ipcMain.handle('project:load-director', async (_event, draftPath: string) => {
    const projectFolder = join(draftPath, '..')
    const savePath = join(projectFolder, '.mps-director.json')
    try {
      const data = await readFile(savePath, 'utf-8')
      return data
    } catch {
      return null
    }
  })

  ipcMain.handle('project:open-capcut', async () => {
    const home = homedir()
    let capCutPath: string

    if (process.platform === 'darwin') {
      capCutPath = '/Applications/CapCut.app'
    } else {
      capCutPath = join(home, 'AppData/Local/CapCut/CapCut.exe')
    }

    if (existsSync(capCutPath)) {
      const error = await shell.openPath(capCutPath)
      if (error) return { success: false, error }
      return { success: true }
    }

    return {
      success: false,
      error: 'CapCut nao encontrado. Verifique se o CapCut esta instalado.'
    }
  })
}
