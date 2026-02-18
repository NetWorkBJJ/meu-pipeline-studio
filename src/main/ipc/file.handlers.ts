import { ipcMain, dialog } from 'electron'

interface FileFilter {
  name: string
  extensions: string[]
}

export function registerFileHandlers(): void {
  ipcMain.handle('file:select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  ipcMain.handle('file:select-files', async (_event, filters: FileFilter[]) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters
    })
    if (result.canceled) return []
    return result.filePaths
  })
}
