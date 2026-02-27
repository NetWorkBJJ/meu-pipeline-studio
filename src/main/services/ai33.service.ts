/**
 * AI33 Service - Main process wrapper for the ai33.pro API
 *
 * Covers all endpoints: credits, TTS (ElevenLabs + MiniMax),
 * dubbing, STT, sound effects, voice changer, voice isolate,
 * voice cloning, music generation, and image generation.
 *
 * Runs in the Electron main process (Node 22+ native fetch).
 * Adapted from NardotoStudio ai33Service.ts.
 */

import { createWriteStream } from 'fs'
import { mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { app } from 'electron'

const BASE_URL = 'https://api.ai33.pro'

// ---------------------------------------------------------------------------
// Types (internal to service, mirror the renderer types)
// ---------------------------------------------------------------------------

export interface FileInput {
  buffer: string // base64 encoded
  name: string
}

export type TaskStatus = 'doing' | 'done' | 'error'
export type HealthStatus = 'good' | 'degraded' | 'overloaded'

export interface CreditsResponse {
  success: boolean
  credits: number
}

export interface HealthCheckResponse {
  success: boolean
  data: {
    elevenlabs: HealthStatus
    minimax: HealthStatus
  }
}

export interface TaskResponse {
  id: string
  created_at: string
  status: TaskStatus
  error_message: string | null
  credit_cost: number
  metadata: Record<string, unknown>
  progress: number
  type: string
}

export interface TaskListResponse {
  success: boolean
  data: TaskResponse[]
  page: number
  limit: number
  total: number
}

export interface TaskCreatedResponse {
  success: boolean
  task_id: string
  ec_remain_credits: number
}

export interface TaskDeleteResponse {
  success: boolean
  refund_credits: number
}

export interface VoiceCloneResponse {
  success: boolean
  cloned_voice_id: string
}

export interface VoiceCloneDeleteResponse {
  success: boolean
}

export interface ClonedVoicesListResponse {
  success: boolean
  data: Array<Record<string, unknown>>
}

export interface MiniMaxVoiceListResponse {
  success: boolean
  data: {
    has_more: boolean
    total: number
    voice_list: Array<Record<string, unknown>>
  }
}

export interface ImageModelsResponse {
  success: boolean
  models: Array<Record<string, unknown>>
}

export interface ImagePriceResponse {
  success: boolean
  credits: number
}

export interface ImageGenerateResponse {
  success: boolean
  task_id: string
  estimated_credits: number
  ec_remain_credits: number
}

export interface VoiceChangerResponse {
  success: boolean
  task_id: string
  duration: number
  credit_cost: number
  ec_remain_credits: number
}

export type ProgressCallback = (progress: number, status: TaskStatus) => void

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

export class Ai33Service {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  // -------------------------------------------------------------------------
  // Internal request helpers
  // -------------------------------------------------------------------------

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${BASE_URL}${path}`

    const headers: Record<string, string> = {
      'xi-api-key': this.apiKey,
      ...((options.headers as Record<string, string>) || {})
    }

    if (options.body && typeof options.body === 'string') {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(url, {
      ...options,
      headers
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No details')
      throw new Error(`AI33 API error ${response.status}: ${errorText}`)
    }

    return response.json() as Promise<T>
  }

  private async requestFormData<T>(path: string, formData: FormData): Promise<T> {
    const url = `${BASE_URL}${path}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey
      },
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No details')
      throw new Error(`AI33 API error ${response.status}: ${errorText}`)
    }

    return response.json() as Promise<T>
  }

  private fileInputToBlob(file: FileInput): Blob {
    const bytes = Buffer.from(file.buffer, 'base64')
    return new Blob([bytes])
  }

  // -------------------------------------------------------------------------
  // Account endpoints
  // -------------------------------------------------------------------------

  async getCredits(): Promise<CreditsResponse> {
    return this.request<CreditsResponse>('/v1/credits')
  }

  async healthCheck(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>('/v1/health-check')
  }

  // -------------------------------------------------------------------------
  // Task management
  // -------------------------------------------------------------------------

  async getTask(taskId: string): Promise<TaskResponse> {
    return this.request<TaskResponse>(`/v1/task/${taskId}`)
  }

  async listTasks(page = 1, limit = 20, type?: string): Promise<TaskListResponse> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (type) params.set('type', type)
    return this.request<TaskListResponse>(`/v1/tasks?${params.toString()}`)
  }

  async deleteTasks(taskIds: string[]): Promise<TaskDeleteResponse> {
    return this.request<TaskDeleteResponse>('/v1/task/delete', {
      method: 'POST',
      body: JSON.stringify({ task_ids: taskIds })
    })
  }

  async pollTask(
    taskId: string,
    onProgress?: ProgressCallback,
    interval = 3000
  ): Promise<TaskResponse> {
    return new Promise((resolve, reject) => {
      const check = async (): Promise<void> => {
        try {
          const task = await this.getTask(taskId)

          if (onProgress) {
            onProgress(task.progress, task.status)
          }

          if (task.status === 'done') {
            resolve(task)
            return
          }

          if (task.status === 'error') {
            reject(
              new Error(task.error_message || `Task ${taskId} failed without error message`)
            )
            return
          }

          setTimeout(check, interval)
        } catch (err) {
          reject(err)
        }
      }

      check()
    })
  }

  // -------------------------------------------------------------------------
  // ElevenLabs TTS
  // -------------------------------------------------------------------------

  async textToSpeech(
    voiceId: string,
    request: { text: string; model_id?: string; with_transcript?: boolean },
    outputFormat = 'mp3_44100_128'
  ): Promise<TaskCreatedResponse> {
    const body = {
      text: request.text,
      model_id: request.model_id ?? 'eleven_multilingual_v2',
      with_transcript: request.with_transcript ?? false
    }
    return this.request<TaskCreatedResponse>(
      `/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`,
      {
        method: 'POST',
        body: JSON.stringify(body)
      }
    )
  }

  async getModels(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/v1/models')
  }

  async getVoices(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/v2/voices')
  }

  async getSharedVoices(
    pageSize = 100,
    page = 0
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      `/v1/shared-voices?page_size=${pageSize}&page=${page}`
    )
  }

  // -------------------------------------------------------------------------
  // ElevenLabs Audio
  // -------------------------------------------------------------------------

  async dubbing(request: {
    file: FileInput
    num_speakers?: number
    disable_voice_cloning?: boolean
    source_lang?: string
    target_lang?: string
  }): Promise<TaskCreatedResponse> {
    const formData = new FormData()
    formData.append('file', this.fileInputToBlob(request.file), request.file.name)

    if (request.num_speakers !== undefined) {
      formData.append('num_speakers', String(request.num_speakers))
    }
    if (request.disable_voice_cloning !== undefined) {
      formData.append('disable_voice_cloning', String(request.disable_voice_cloning))
    }
    if (request.source_lang) {
      formData.append('source_lang', request.source_lang)
    }
    if (request.target_lang) {
      formData.append('target_lang', request.target_lang)
    }

    return this.requestFormData<TaskCreatedResponse>('/v1/task/dubbing', formData)
  }

  async speechToText(request: { file: FileInput }): Promise<TaskCreatedResponse> {
    const formData = new FormData()
    formData.append('file', this.fileInputToBlob(request.file), request.file.name)

    return this.requestFormData<TaskCreatedResponse>('/v1/task/speech-to-text', formData)
  }

  async soundEffect(request: {
    text: string
    duration_seconds?: number
    prompt_influence?: number
    loop?: boolean
    model_id?: string
  }): Promise<TaskCreatedResponse> {
    const body = {
      text: request.text,
      duration_seconds: request.duration_seconds,
      prompt_influence: request.prompt_influence ?? 0.3,
      loop: request.loop ?? false,
      model_id: request.model_id ?? 'eleven_text_to_sound_v2'
    }
    return this.request<TaskCreatedResponse>('/v1/task/sound-effect', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async voiceChanger(request: {
    file: FileInput
    voice_id: string
    model_id?: string
    voice_settings?: Record<string, unknown>
    remove_background_noise?: boolean
  }): Promise<VoiceChangerResponse> {
    const formData = new FormData()
    formData.append('file', this.fileInputToBlob(request.file), request.file.name)
    formData.append('voice_id', request.voice_id)
    formData.append('model_id', request.model_id ?? 'eleven_multilingual_sts_v2')

    if (request.voice_settings) {
      formData.append('voice_settings', JSON.stringify(request.voice_settings))
    }
    if (request.remove_background_noise !== undefined) {
      formData.append('remove_background_noise', String(request.remove_background_noise))
    }

    return this.requestFormData<VoiceChangerResponse>('/v1/task/voice-changer', formData)
  }

  async voiceIsolate(request: { file: FileInput }): Promise<TaskCreatedResponse> {
    const formData = new FormData()
    formData.append('file', this.fileInputToBlob(request.file), request.file.name)

    return this.requestFormData<TaskCreatedResponse>('/v1/task/voice-isolate', formData)
  }

  // -------------------------------------------------------------------------
  // MiniMax
  // -------------------------------------------------------------------------

  async getMiniMaxConfig(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/v1m/common/config')
  }

  async miniMaxTTS(request: {
    text: string
    model?: string
    voice_setting: { voice_id: string; vol?: number; pitch?: number; speed?: number }
    language_boost?: string
    with_transcript?: boolean
  }): Promise<TaskCreatedResponse> {
    const body = {
      text: request.text,
      model: request.model ?? 'speech-2.6-hd',
      voice_setting: {
        voice_id: request.voice_setting.voice_id,
        vol: request.voice_setting.vol ?? 1,
        pitch: request.voice_setting.pitch ?? 0,
        speed: request.voice_setting.speed ?? 1
      },
      language_boost: request.language_boost ?? 'Auto',
      with_transcript: request.with_transcript ?? false
    }
    return this.request<TaskCreatedResponse>('/v1m/task/text-to-speech', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  async miniMaxVoiceClone(request: {
    file: FileInput
    voice_name: string
    preview_text?: string
    language_tag?: string
    need_noise_reduction?: boolean
    gender_tag?: string
  }): Promise<VoiceCloneResponse> {
    const formData = new FormData()
    formData.append('file', this.fileInputToBlob(request.file), request.file.name)
    formData.append('voice_name', request.voice_name)

    if (request.preview_text) {
      formData.append('preview_text', request.preview_text)
    }
    if (request.language_tag) {
      formData.append('language_tag', request.language_tag)
    }
    if (request.need_noise_reduction !== undefined) {
      formData.append('need_noise_reduction', String(request.need_noise_reduction))
    }
    if (request.gender_tag) {
      formData.append('gender_tag', request.gender_tag)
    }

    return this.requestFormData<VoiceCloneResponse>('/v1m/voice/clone', formData)
  }

  async miniMaxDeleteClonedVoice(voiceCloneId: string): Promise<VoiceCloneDeleteResponse> {
    return this.request<VoiceCloneDeleteResponse>(`/v1m/voice/clone/${voiceCloneId}`, {
      method: 'DELETE'
    })
  }

  async miniMaxListClonedVoices(): Promise<ClonedVoicesListResponse> {
    return this.request<ClonedVoicesListResponse>('/v1m/voice/clone')
  }

  async miniMaxVoiceList(
    request: { page?: number; page_size?: number; tag_list?: string[] } = {}
  ): Promise<MiniMaxVoiceListResponse> {
    return this.request<MiniMaxVoiceListResponse>('/v1m/voice/list', {
      method: 'POST',
      body: JSON.stringify(request)
    })
  }

  async miniMaxMusicGeneration(request: {
    title?: string
    idea?: string
    lyrics?: string
    style_id?: string
    mood_id?: string
    scenario_id?: string
    n?: number
    rewrite_idea_switch?: boolean
  }): Promise<TaskCreatedResponse> {
    const body = {
      title: request.title,
      idea: request.idea,
      lyrics: request.lyrics,
      style_id: request.style_id,
      mood_id: request.mood_id,
      scenario_id: request.scenario_id,
      n: request.n ?? 1,
      rewrite_idea_switch: request.rewrite_idea_switch ?? false
    }
    return this.request<TaskCreatedResponse>('/v1m/task/music-generation', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  // -------------------------------------------------------------------------
  // Images
  // -------------------------------------------------------------------------

  async getImageModels(): Promise<ImageModelsResponse> {
    return this.request<ImageModelsResponse>('/v1i/models')
  }

  async getImagePrice(request: {
    model_id: string
    generations_count: number
    model_parameters?: Record<string, unknown>
  }): Promise<ImagePriceResponse> {
    return this.request<ImagePriceResponse>('/v1i/task/price', {
      method: 'POST',
      body: JSON.stringify(request)
    })
  }

  async generateImage(request: {
    prompt: string
    model_id: string
    generations_count?: number
    model_parameters?: Record<string, unknown>
    assets?: FileInput[]
  }): Promise<ImageGenerateResponse> {
    const formData = new FormData()
    formData.append('prompt', request.prompt)
    formData.append('model_id', request.model_id)
    formData.append('generations_count', String(request.generations_count ?? 1))

    if (request.model_parameters) {
      formData.append('model_parameters', JSON.stringify(request.model_parameters))
    }

    if (request.assets && request.assets.length > 0) {
      for (const asset of request.assets) {
        formData.append('assets', this.fileInputToBlob(asset), asset.name)
      }
    }

    return this.requestFormData<ImageGenerateResponse>('/v1i/task/generate-image', formData)
  }

  // -------------------------------------------------------------------------
  // File download utility
  // -------------------------------------------------------------------------

  async downloadFile(
    url: string,
    destDir?: string,
    fileName?: string
  ): Promise<{ localPath: string; size: number }> {
    const outputDir =
      destDir || join(app.getPath('appData'), 'workflowaa', 'ai33-output')
    await mkdir(outputDir, { recursive: true })

    const resolvedName =
      fileName || `ai33-${Date.now()}${extFromUrl(url)}`
    const localPath = join(outputDir, resolvedName)

    await mkdir(dirname(localPath), { recursive: true })

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    }

    if (!response.body) {
      throw new Error('Download failed: empty response body')
    }

    const nodeStream = Readable.fromWeb(response.body as import('stream/web').ReadableStream)
    const fileStream = createWriteStream(localPath)
    await pipeline(nodeStream, fileStream)

    const size = fileStream.bytesWritten
    return { localPath, size }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const ext = pathname.slice(pathname.lastIndexOf('.'))
    if (ext && ext.length <= 5) return ext
  } catch {
    // ignore
  }
  return '.mp3'
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createAi33Service(apiKey: string): Ai33Service {
  return new Ai33Service(apiKey)
}
