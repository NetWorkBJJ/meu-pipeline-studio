import { ipcMain, dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { callPython } from '../python/bridge'
import { watchDraft, unwatchDraft, isWatching } from './draft-watcher'

export function registerProjectHandlers(): void {
  ipcMain.handle('project:select-draft', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Selecionar projeto CapCut',
      properties: ['openDirectory'],
      defaultPath: 'C:/Users/ander/AppData/Local/CapCut/User Data/Projects/com.lveditor.draft'
    })
    if (result.canceled) return null

    const draftPath = join(result.filePaths[0], 'draft_content.json')
    return draftPath
  })

  ipcMain.handle('project:save', async (_event, data: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Salvar projeto',
      defaultPath: 'projeto.mps.json',
      filters: [{ name: 'MEU Pipeline Studio', extensions: ['mps.json'] }]
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
}
