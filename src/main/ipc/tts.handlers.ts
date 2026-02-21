import { ipcMain, app, safeStorage } from 'electron'
import { readFile, writeFile, mkdir, unlink, stat } from 'fs/promises'
import { join } from 'path'
import { callPython } from '../python/bridge'

function getApiKeyPath(): string {
  return join(app.getPath('appData'), 'meu-pipeline-studio', 'gemini-api-key.enc')
}

async function decryptApiKey(): Promise<string> {
  const keyPath = getApiKeyPath()
  const encrypted = await readFile(keyPath)
  return safeStorage.decryptString(encrypted)
}

export function registerTtsHandlers(): void {
  // === API Key Storage (encrypted with safeStorage / Windows DPAPI) ===

  ipcMain.handle('tts:save-api-key', async (_event, apiKey: string) => {
    const encrypted = safeStorage.encryptString(apiKey)
    const dir = join(app.getPath('appData'), 'meu-pipeline-studio')
    await mkdir(dir, { recursive: true })
    await writeFile(getApiKeyPath(), encrypted)
    return { success: true }
  })

  ipcMain.handle('tts:has-api-key', async () => {
    try {
      await stat(getApiKeyPath())
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('tts:delete-api-key', async () => {
    try {
      await unlink(getApiKeyPath())
    } catch {
      // File may not exist, ignore
    }
    return { success: true }
  })

  // === TTS Generation ===

  ipcMain.handle(
    'tts:generate',
    async (
      _event,
      params: {
        text?: string
        chunks?: string[]
        voice?: string
        style?: string
        customStylePrompt?: string
        ttsModel?: string
        outputDir?: string
        generateSrt?: boolean
        maxWorkers?: number
      }
    ) => {
      let apiKey: string
      try {
        apiKey = await decryptApiKey()
      } catch {
        throw new Error('Google API key not configured. Set it in Settings > TTS.')
      }

      let outputDir = params.outputDir
      if (!outputDir) {
        const baseDir = join(app.getPath('appData'), 'meu-pipeline-studio', 'tts-output')
        await mkdir(baseDir, { recursive: true })
        outputDir = join(baseDir, `tts-${Date.now()}`)
        await mkdir(outputDir, { recursive: true })
      }

      return callPython('tts_generate', {
        api_key: apiKey,
        text: params.text,
        chunks: params.chunks,
        voice: params.voice || 'Kore',
        style: params.style || 'Neutro',
        custom_style_prompt: params.customStylePrompt || '',
        tts_model: params.ttsModel || 'flash',
        output_dir: outputDir,
        generate_srt: params.generateSrt || false,
        max_workers: params.maxWorkers || 3
      })
    }
  )

  // === Voice Preview ===

  ipcMain.handle(
    'tts:preview-voice',
    async (
      _event,
      params: {
        voice: string
        style?: string
        sampleText?: string
        ttsModel?: string
      }
    ) => {
      let apiKey: string
      try {
        apiKey = await decryptApiKey()
      } catch {
        throw new Error('Google API key not configured.')
      }

      return callPython('tts_preview_voice', {
        api_key: apiKey,
        voice: params.voice,
        style: params.style || 'Neutro',
        sample_text: params.sampleText,
        tts_model: params.ttsModel || 'flash'
      })
    }
  )

  // === Voice & Style Catalogs ===

  ipcMain.handle('tts:list-voices', async () => {
    return callPython('tts_list_voices', {})
  })

  ipcMain.handle('tts:list-styles', async () => {
    return callPython('tts_list_styles', {})
  })
}
