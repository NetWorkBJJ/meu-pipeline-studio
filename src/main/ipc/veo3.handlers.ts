import { ipcMain, app, session } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { readFile } from 'fs/promises'
import { join, normalize, resolve, extname } from 'path'
import { getVeo3DownloadPath, setVeo3DownloadPath } from '../index'

function getDownloadPathConfigFile(): string {
  const configDir = join(app.getPath('appData'), 'meu-pipeline-studio')
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true })
  return join(configDir, 'veo3-download-path.txt')
}

export function loadPersistedDownloadPath(): string | null {
  const configFile = getDownloadPathConfigFile()
  if (!existsSync(configFile)) return null
  try {
    const saved = readFileSync(configFile, 'utf-8').trim()
    return saved || null
  } catch {
    return null
  }
}

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
    try {
      writeFileSync(getDownloadPathConfigFile(), folderPath, 'utf-8')
    } catch (err) {
      console.error('[veo3:set-download-path] Failed to persist:', err)
    }
    return { success: true }
  })

  ipcMain.handle('veo3:get-download-path', async () => {
    return getVeo3DownloadPath()
  })

  ipcMain.handle('veo3:read-image-as-dataurl', async (_event, filePath: string) => {
    if (!filePath || !existsSync(filePath)) {
      return null
    }

    try {
      const buf = await readFile(filePath)
      const ext = extname(filePath).toLowerCase().slice(1)
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        bmp: 'image/bmp'
      }
      const mime = mimeMap[ext] || 'image/png'
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch {
      return null
    }
  })

  ipcMain.handle('veo3:sync-prompt-queue', async (_event, prompts: string[]) => {
    const { trackSubmittedPrompt } = await import('../index')
    let added = 0
    for (const prompt of prompts) {
      if (prompt && typeof prompt === 'string') {
        trackSubmittedPrompt(prompt)
        added++
      }
    }
    console.log(`[veo3:sync-prompt-queue] Synced ${added} prompts from renderer`)
    return { success: true, count: added }
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
