import { ipcMain, app, safeStorage, BrowserWindow } from 'electron'
import { readFile, writeFile, mkdir, unlink, stat } from 'fs/promises'
import { join, basename } from 'path'
import { createAi33Service, type Ai33Service } from '../services/ai33.service'

// ---------------------------------------------------------------------------
// API Key management (encrypted with safeStorage / Windows DPAPI)
// ---------------------------------------------------------------------------

function getApiKeyPath(): string {
  return join(app.getPath('appData'), 'workflowaa', 'ai33-api-key.enc')
}

async function decryptApiKey(): Promise<string> {
  const keyPath = getApiKeyPath()
  const encrypted = await readFile(keyPath)
  return safeStorage.decryptString(encrypted)
}

async function getService(): Promise<Ai33Service> {
  const apiKey = await decryptApiKey()
  return createAi33Service(apiKey)
}

function sendProgress(taskId: string, progress: number, status: string): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send('ai33:task-progress', { taskId, progress, status })
  }
}

// ---------------------------------------------------------------------------
// Helper: read local file as FileInput (base64)
// ---------------------------------------------------------------------------

async function filePathToInput(
  filePath: string
): Promise<{ buffer: string; name: string }> {
  const buf = await readFile(filePath)
  return {
    buffer: buf.toString('base64'),
    name: basename(filePath)
  }
}

// ---------------------------------------------------------------------------
// Register all handlers
// ---------------------------------------------------------------------------

export function registerAi33Handlers(): void {
  // === API Key Storage ===

  ipcMain.handle('ai33:save-api-key', async (_event, apiKey: string) => {
    const encrypted = safeStorage.encryptString(apiKey)
    const dir = join(app.getPath('appData'), 'workflowaa')
    await mkdir(dir, { recursive: true })
    await writeFile(getApiKeyPath(), encrypted)
    return { success: true }
  })

  ipcMain.handle('ai33:has-api-key', async () => {
    try {
      await stat(getApiKeyPath())
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('ai33:delete-api-key', async () => {
    try {
      await unlink(getApiKeyPath())
    } catch {
      // File may not exist
    }
    return { success: true }
  })

  // === Account & Health ===

  ipcMain.handle('ai33:get-credits', async () => {
    const svc = await getService()
    return svc.getCredits()
  })

  ipcMain.handle('ai33:health-check', async () => {
    const svc = await getService()
    return svc.healthCheck()
  })

  // === Task Management ===

  ipcMain.handle('ai33:get-task', async (_event, taskId: string) => {
    const svc = await getService()
    return svc.getTask(taskId)
  })

  ipcMain.handle(
    'ai33:list-tasks',
    async (
      _event,
      params: { page?: number; limit?: number; type?: string }
    ) => {
      const svc = await getService()
      return svc.listTasks(params.page, params.limit, params.type)
    }
  )

  ipcMain.handle('ai33:delete-tasks', async (_event, taskIds: string[]) => {
    const svc = await getService()
    return svc.deleteTasks(taskIds)
  })

  ipcMain.handle('ai33:poll-task', async (_event, taskId: string) => {
    const svc = await getService()
    return svc.pollTask(taskId, (progress, status) => {
      sendProgress(taskId, progress, status)
    })
  })

  // === File Download ===

  ipcMain.handle(
    'ai33:download-file',
    async (
      _event,
      params: { url: string; destDir?: string; fileName?: string }
    ) => {
      const svc = await getService()
      const result = await svc.downloadFile(params.url, params.destDir, params.fileName)
      return { success: true, localPath: result.localPath, size: result.size }
    }
  )

  // === ElevenLabs TTS ===

  ipcMain.handle(
    'ai33:tts-elevenlabs',
    async (
      _event,
      params: {
        voiceId: string
        text: string
        model_id?: string
        with_transcript?: boolean
        output_format?: string
      }
    ) => {
      const svc = await getService()
      return svc.textToSpeech(
        params.voiceId,
        {
          text: params.text,
          model_id: params.model_id,
          with_transcript: params.with_transcript
        },
        params.output_format
      )
    }
  )

  // === ElevenLabs Models & Voices ===

  ipcMain.handle('ai33:get-models', async () => {
    const svc = await getService()
    return svc.getModels()
  })

  ipcMain.handle('ai33:get-voices', async () => {
    const svc = await getService()
    return svc.getVoices()
  })

  ipcMain.handle(
    'ai33:get-shared-voices',
    async (_event, params?: { pageSize?: number; page?: number }) => {
      const svc = await getService()
      return svc.getSharedVoices(params?.pageSize, params?.page)
    }
  )

  // === ElevenLabs Audio Tools ===

  ipcMain.handle(
    'ai33:dubbing',
    async (
      _event,
      params: {
        filePath: string
        num_speakers?: number
        disable_voice_cloning?: boolean
        source_lang?: string
        target_lang?: string
      }
    ) => {
      const svc = await getService()
      const file = await filePathToInput(params.filePath)
      return svc.dubbing({
        file,
        num_speakers: params.num_speakers,
        disable_voice_cloning: params.disable_voice_cloning,
        source_lang: params.source_lang,
        target_lang: params.target_lang
      })
    }
  )

  ipcMain.handle('ai33:speech-to-text', async (_event, filePath: string) => {
    const svc = await getService()
    const file = await filePathToInput(filePath)
    return svc.speechToText({ file })
  })

  ipcMain.handle(
    'ai33:sound-effect',
    async (
      _event,
      params: {
        text: string
        duration_seconds?: number
        prompt_influence?: number
        loop?: boolean
        model_id?: string
      }
    ) => {
      const svc = await getService()
      return svc.soundEffect(params)
    }
  )

  ipcMain.handle(
    'ai33:voice-changer',
    async (
      _event,
      params: {
        filePath: string
        voice_id: string
        model_id?: string
        voice_settings?: Record<string, unknown>
        remove_background_noise?: boolean
      }
    ) => {
      const svc = await getService()
      const file = await filePathToInput(params.filePath)
      return svc.voiceChanger({
        file,
        voice_id: params.voice_id,
        model_id: params.model_id,
        voice_settings: params.voice_settings,
        remove_background_noise: params.remove_background_noise
      })
    }
  )

  ipcMain.handle('ai33:voice-isolate', async (_event, filePath: string) => {
    const svc = await getService()
    const file = await filePathToInput(filePath)
    return svc.voiceIsolate({ file })
  })

  // === MiniMax TTS ===

  ipcMain.handle(
    'ai33:tts-minimax',
    async (
      _event,
      params: {
        text: string
        model?: string
        voice_setting: { voice_id: string; vol?: number; pitch?: number; speed?: number }
        language_boost?: string
        with_transcript?: boolean
      }
    ) => {
      const svc = await getService()
      return svc.miniMaxTTS(params)
    }
  )

  ipcMain.handle('ai33:minimax-config', async () => {
    const svc = await getService()
    return svc.getMiniMaxConfig()
  })

  // === MiniMax Voice Management ===

  ipcMain.handle(
    'ai33:minimax-voice-list',
    async (
      _event,
      params?: { page?: number; page_size?: number; tag_list?: string[] }
    ) => {
      const svc = await getService()
      return svc.miniMaxVoiceList(params)
    }
  )

  ipcMain.handle('ai33:minimax-cloned-voices', async () => {
    const svc = await getService()
    return svc.miniMaxListClonedVoices()
  })

  ipcMain.handle(
    'ai33:minimax-voice-clone',
    async (
      _event,
      params: {
        filePath: string
        voice_name: string
        preview_text?: string
        language_tag?: string
        need_noise_reduction?: boolean
        gender_tag?: string
      }
    ) => {
      const svc = await getService()
      const file = await filePathToInput(params.filePath)
      return svc.miniMaxVoiceClone({
        file,
        voice_name: params.voice_name,
        preview_text: params.preview_text,
        language_tag: params.language_tag,
        need_noise_reduction: params.need_noise_reduction,
        gender_tag: params.gender_tag
      })
    }
  )

  ipcMain.handle('ai33:minimax-delete-clone', async (_event, voiceId: string) => {
    const svc = await getService()
    return svc.miniMaxDeleteClonedVoice(voiceId)
  })

  // === MiniMax Music Generation ===

  ipcMain.handle(
    'ai33:music-generation',
    async (
      _event,
      params: {
        title?: string
        idea?: string
        lyrics?: string
        style_id?: string
        mood_id?: string
        scenario_id?: string
        n?: number
        rewrite_idea_switch?: boolean
      }
    ) => {
      const svc = await getService()
      return svc.miniMaxMusicGeneration(params)
    }
  )

  // === Image Generation ===

  ipcMain.handle('ai33:image-models', async () => {
    const svc = await getService()
    return svc.getImageModels()
  })

  ipcMain.handle(
    'ai33:image-price',
    async (
      _event,
      params: {
        model_id: string
        generations_count: number
        model_parameters?: Record<string, unknown>
      }
    ) => {
      const svc = await getService()
      return svc.getImagePrice(params)
    }
  )

  ipcMain.handle(
    'ai33:generate-image',
    async (
      _event,
      params: {
        prompt: string
        model_id: string
        generations_count?: number
        model_parameters?: Record<string, unknown>
        assetPaths?: string[]
      }
    ) => {
      const svc = await getService()

      let assets: Array<{ buffer: string; name: string }> | undefined
      if (params.assetPaths && params.assetPaths.length > 0) {
        assets = await Promise.all(params.assetPaths.map(filePathToInput))
      }

      return svc.generateImage({
        prompt: params.prompt,
        model_id: params.model_id,
        generations_count: params.generations_count,
        model_parameters: params.model_parameters,
        assets
      })
    }
  )
}
