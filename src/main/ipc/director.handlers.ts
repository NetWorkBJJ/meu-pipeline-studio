import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readdir } from 'fs/promises'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { callPython } from '../python/bridge'

const execAsync = promisify(exec)

const NPM_PACKAGES: Record<string, string> = {
  claude: '@anthropic-ai/claude-code',
  codex: '@openai/codex',
  chatgpt: '@openai/codex',
  gemini: '@google/gemini-cli'
}

export function registerDirectorHandlers(): void {
  ipcMain.handle('director:check-llm-available', async (_event, provider: string) => {
    return callPython('director_check_llm', { provider })
  })

  ipcMain.handle('director:install-cli', async (_event, provider: string) => {
    const pkg = NPM_PACKAGES[provider]
    if (!pkg) {
      throw new Error(`Unknown provider: ${provider}`)
    }

    try {
      const { stdout, stderr } = await execAsync(`npm install -g ${pkg}`, {
        timeout: 180000,
        encoding: 'utf-8'
      })
      return { success: true, output: stdout.trim(), warnings: stderr.trim() }
    } catch (err: unknown) {
      const error = err as { stderr?: string; message?: string }
      throw new Error(
        `Falha ao instalar ${pkg}: ${error.stderr?.trim() || error.message || 'Unknown error'}`
      )
    }
  })

  ipcMain.handle(
    'director:analyze-narrative',
    async (_event, params: Record<string, unknown>) => {
      return callPython('director_analyze_narrative', params)
    }
  )

  ipcMain.handle(
    'director:generate-prompts',
    async (_event, params: Record<string, unknown>) => {
      return callPython('director_generate_prompts', params)
    }
  )

  ipcMain.handle(
    'director:decide-media-types',
    async (_event, params: Record<string, unknown>) => {
      return callPython('director_decide_media_types', params)
    }
  )

  ipcMain.handle(
    'director:export-prompts',
    async (_event, params: Record<string, unknown>) => {
      if (!params.output_path) {
        const format = (params.format as string) || 'markdown'
        const extensions: Record<string, string[]> = {
          markdown: ['md'],
          json: ['json'],
          csv: ['csv']
        }
        const win = BrowserWindow.getFocusedWindow()
        const result = await dialog.showSaveDialog(win!, {
          title: 'Exportar prompts',
          defaultPath: `scene_prompts.${extensions[format]?.[0] || 'md'}`,
          filters: [{ name: 'Prompt File', extensions: extensions[format] || ['md'] }]
        })
        if (result.canceled || !result.filePath) {
          return { canceled: true }
        }
        params.output_path = result.filePath
      }
      return callPython('director_export_prompts', params)
    }
  )

  ipcMain.handle(
    'director:match-media-files',
    async (_event, params: Record<string, unknown>) => {
      return callPython('director_match_media', params)
    }
  )

  ipcMain.handle('director:select-media-files', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: 'Selecionar midias para importacao',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Media Files',
          extensions: [
            'mp4',
            'mov',
            'avi',
            'mkv',
            'webm',
            'm4v',
            'jpg',
            'jpeg',
            'png',
            'webp',
            'bmp',
            'gif'
          ]
        }
      ]
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('director:import-characters', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: 'Selecionar pasta de personagens',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { files: [] }
    }

    const dirPath = result.filePaths[0]
    const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp'])

    try {
      const entries = await readdir(dirPath)
      const imageFiles = entries
        .filter((name) => {
          const ext = name.split('.').pop()?.toLowerCase() || ''
          return imageExtensions.has(ext)
        })
        .map((name) => join(dirPath, name))

      return { files: imageFiles, directory: dirPath }
    } catch {
      return { files: [], error: 'Failed to read directory' }
    }
  })
}
