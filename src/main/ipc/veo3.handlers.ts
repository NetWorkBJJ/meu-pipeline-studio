import { ipcMain, app, session } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { join, normalize, resolve } from 'path'
import { getVeo3DownloadPath, setVeo3DownloadPath } from '../index'

function getInjectorsBasePath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'veo3-injectors')
  }
  return join(__dirname, '../../src/main/veo3/injectors')
}

export function registerVeo3Handlers(): void {
  ipcMain.handle('veo3:read-injector-script', async (_event, relativePath: string) => {
    const basePath = getInjectorsBasePath()
    const fullPath = normalize(join(basePath, relativePath))

    // Path traversal protection
    if (!fullPath.startsWith(resolve(basePath))) {
      return null
    }

    if (!existsSync(fullPath)) {
      return null
    }

    try {
      return readFileSync(fullPath, 'utf-8')
    } catch {
      return null
    }
  })

  ipcMain.handle('veo3:set-download-path', async (_event, folderPath: string) => {
    setVeo3DownloadPath(folderPath)
    return { success: true }
  })

  ipcMain.handle('veo3:get-download-path', async () => {
    return getVeo3DownloadPath()
  })

  ipcMain.handle('veo3:clear-partition', async (_event, partitionName: string) => {
    if (!partitionName.startsWith('persist:veo3-account-')) {
      return { success: false, error: 'Invalid partition name' }
    }

    try {
      const ses = session.fromPartition(partitionName)
      await ses.clearStorageData()
      await ses.clearCache()
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
