import { ipcMain, app, safeStorage } from 'electron'
import { readFile, writeFile, mkdir, unlink, stat } from 'fs/promises'
import { join } from 'path'
import { createClickUpService, type ClickUpService } from '../services/clickup.service'

// ---------------------------------------------------------------------------
// API Key management (encrypted with safeStorage / Windows DPAPI)
// ---------------------------------------------------------------------------

function getAppDir(): string {
  return join(app.getPath('appData'), 'meu-pipeline-studio')
}

function getApiKeyPath(): string {
  return join(getAppDir(), 'clickup-api-key.enc')
}

function getConfigPath(): string {
  return join(getAppDir(), 'clickup-config.json')
}

async function decryptApiKey(): Promise<string> {
  const keyPath = getApiKeyPath()
  const encrypted = await readFile(keyPath)
  return safeStorage.decryptString(encrypted)
}

async function getService(): Promise<ClickUpService> {
  const token = await decryptApiKey()
  return createClickUpService(token)
}

// ---------------------------------------------------------------------------
// Register all handlers
// ---------------------------------------------------------------------------

export function registerClickUpHandlers(): void {
  // === API Key Storage ===

  ipcMain.handle('clickup:save-api-key', async (_event, apiKey: string) => {
    const encrypted = safeStorage.encryptString(apiKey)
    const dir = join(app.getPath('appData'), 'meu-pipeline-studio')
    await mkdir(dir, { recursive: true })
    await writeFile(getApiKeyPath(), encrypted)
    return { success: true }
  })

  ipcMain.handle('clickup:has-api-key', async () => {
    try {
      await stat(getApiKeyPath())
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('clickup:delete-api-key', async () => {
    try {
      await unlink(getApiKeyPath())
    } catch {
      // File may not exist
    }
    return { success: true }
  })

  // === Hierarchy Navigation ===

  ipcMain.handle('clickup:get-teams', async () => {
    const svc = await getService()
    return svc.getTeams()
  })

  ipcMain.handle('clickup:get-spaces', async (_e, teamId: string) => {
    const svc = await getService()
    return svc.getSpaces(teamId)
  })

  ipcMain.handle('clickup:get-folders', async (_e, spaceId: string) => {
    const svc = await getService()
    return svc.getFolders(spaceId)
  })

  ipcMain.handle('clickup:get-folderless-lists', async (_e, spaceId: string) => {
    const svc = await getService()
    return svc.getFolderlessLists(spaceId)
  })

  ipcMain.handle('clickup:get-lists', async (_e, folderId: string) => {
    const svc = await getService()
    return svc.getLists(folderId)
  })

  ipcMain.handle(
    'clickup:get-tasks',
    async (_e, params: { listId: string; page?: number }) => {
      const svc = await getService()
      return svc.getTasks(params.listId, params.page)
    }
  )

  ipcMain.handle('clickup:get-task', async (_e, taskId: string) => {
    const svc = await getService()
    return svc.getTask(taskId)
  })

  ipcMain.handle('clickup:get-list', async (_e, listId: string) => {
    const svc = await getService()
    return svc.getList(listId)
  })

  // === Download ===

  ipcMain.handle(
    'clickup:download-attachment',
    async (
      _e,
      params: { url: string; destDir?: string; fileName?: string }
    ) => {
      const svc = await getService()
      return svc.downloadAttachment(params.url, params.destDir, params.fileName)
    }
  )

  ipcMain.handle(
    'clickup:download-task-attachments',
    async (
      _e,
      params: {
        attachments: Array<{ url: string; fileName: string }>
        destDir?: string
      }
    ) => {
      const svc = await getService()
      const results: Array<{
        fileName: string
        localPath: string
        size: number
        error?: string
      }> = []

      for (const att of params.attachments) {
        try {
          const r = await svc.downloadAttachment(att.url, params.destDir, att.fileName)
          results.push({ fileName: att.fileName, localPath: r.localPath, size: r.size })
        } catch (err) {
          results.push({
            fileName: att.fileName,
            localPath: '',
            size: 0,
            error: err instanceof Error ? err.message : 'Unknown error'
          })
        }
      }

      return { results, successCount: results.filter((r) => !r.error).length }
    }
  )

  // === Text File Reading ===

  ipcMain.handle('clickup:read-text-file', async (_e, filePath: string) => {
    const svc = await getService()
    return svc.readTextFile(filePath)
  })

  // === Connection Test ===

  ipcMain.handle('clickup:test-connection', async () => {
    const svc = await getService()
    const res = await svc.getTeams()
    const teams = res.teams || []
    if (teams.length === 0) {
      return { success: true, teamName: null }
    }
    return { success: true, teamName: (teams[0] as Record<string, unknown>).name as string }
  })

  // === Default List Config ===

  ipcMain.handle(
    'clickup:save-default-list',
    async (
      _e,
      config: { listId: string; listName: string; breadcrumb: string } | null
    ) => {
      const configPath = getConfigPath()
      if (config === null) {
        try {
          await unlink(configPath)
        } catch {
          // File may not exist
        }
      } else {
        await mkdir(getAppDir(), { recursive: true })
        await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
      }
      return { success: true }
    }
  )

  ipcMain.handle('clickup:get-default-list', async () => {
    try {
      const raw = await readFile(getConfigPath(), 'utf-8')
      return JSON.parse(raw) as {
        listId: string
        listName: string
        breadcrumb: string
      }
    } catch {
      return null
    }
  })
}
