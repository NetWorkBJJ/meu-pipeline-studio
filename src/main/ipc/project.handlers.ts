import { ipcMain, dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

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
}
