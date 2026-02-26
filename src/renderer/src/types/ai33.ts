// ---------------------------------------------------------------------------
// ai33.pro API types
// Based on NardotoStudio ai33Service.ts, adapted for MEU PIPELINE STUDIO
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Common types
// ---------------------------------------------------------------------------

export type Ai33TaskStatus = 'doing' | 'done' | 'error'
export type Ai33HealthStatus = 'good' | 'degraded' | 'overloaded'
export type Ai33TtsProvider = 'elevenlabs' | 'minimax'

// ---------------------------------------------------------------------------
// Account & Health
// ---------------------------------------------------------------------------

export interface Ai33CreditsResponse {
  success: boolean
  credits: number
}

export interface Ai33HealthCheckResponse {
  success: boolean
  data: {
    elevenlabs: Ai33HealthStatus
    minimax: Ai33HealthStatus
  }
}

// ---------------------------------------------------------------------------
// Task Management
// ---------------------------------------------------------------------------

export interface Ai33TaskResponse {
  id: string
  created_at: string
  status: Ai33TaskStatus
  error_message: string | null
  credit_cost: number
  metadata: Ai33TaskMetadata
  progress: number
  type: string
}

export interface Ai33TaskListResponse {
  success: boolean
  data: Ai33TaskResponse[]
  page: number
  limit: number
  total: number
}

export interface Ai33TaskCreatedResponse {
  success: boolean
  task_id: string
  ec_remain_credits: number
}

export interface Ai33TaskDeleteResponse {
  success: boolean
  refund_credits: number
}

// ---------------------------------------------------------------------------
// Task Metadata (varies by task type)
// ---------------------------------------------------------------------------

export interface Ai33TTSMetadata {
  audio_url: string
  srt_url?: string
}

export interface Ai33DubbingMetadata {
  audio_url: string
  srt_url: string
  json_url: string
}

export interface Ai33STTMetadata {
  json_url: string
  srt_url: string
}

export interface Ai33SoundEffectMetadata {
  output_uri: string
  character_cost: number
  duration_seconds: number
}

export interface Ai33VoiceChangerMetadata {
  audio_url: string
}

export interface Ai33VoiceIsolateMetadata {
  output_uri: string
}

export interface Ai33MiniMaxTTSMetadata {
  audio_url: string
  srt_url?: string
}

export interface Ai33MusicMetadata {
  audio_url: string[]
  cover_url: string[]
}

export interface Ai33ImageResultItem {
  id: string
  imageUrl: string
  previewUrl: string
  mimeType: string
  width: number
  height: number
}

export interface Ai33ImageMetadata {
  result_images: Ai33ImageResultItem[]
}

export type Ai33TaskMetadata =
  | Ai33TTSMetadata
  | Ai33DubbingMetadata
  | Ai33STTMetadata
  | Ai33SoundEffectMetadata
  | Ai33VoiceChangerMetadata
  | Ai33VoiceIsolateMetadata
  | Ai33MiniMaxTTSMetadata
  | Ai33MusicMetadata
  | Ai33ImageMetadata
  | Record<string, unknown>

// ---------------------------------------------------------------------------
// ElevenLabs TTS
// ---------------------------------------------------------------------------

export interface Ai33TTSRequest {
  text: string
  model_id?: string
  with_transcript?: boolean
}

export interface Ai33ElevenLabsModel {
  model_id: string
  name: string
  [key: string]: unknown
}

export interface Ai33ElevenLabsVoice {
  voice_id: string
  name: string
  category?: string
  labels?: Record<string, string>
  preview_url?: string
  [key: string]: unknown
}

export interface Ai33ModelsResponse {
  [key: string]: unknown
}

export interface Ai33VoicesResponse {
  voices?: Ai33ElevenLabsVoice[]
  [key: string]: unknown
}

export interface Ai33SharedVoicesResponse {
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// ElevenLabs Audio
// ---------------------------------------------------------------------------

export interface Ai33DubbingRequest {
  filePath: string
  num_speakers?: number
  disable_voice_cloning?: boolean
  source_lang?: string
  target_lang?: string
}

export interface Ai33STTRequest {
  filePath: string
}

export interface Ai33SoundEffectRequest {
  text: string
  duration_seconds?: number
  prompt_influence?: number
  loop?: boolean
  model_id?: string
}

export interface Ai33VoiceChangerRequest {
  filePath: string
  voice_id: string
  model_id?: string
  voice_settings?: Record<string, unknown>
  remove_background_noise?: boolean
}

export interface Ai33VoiceChangerResponse {
  success: boolean
  task_id: string
  duration: number
  credit_cost: number
  ec_remain_credits: number
}

export interface Ai33VoiceIsolateRequest {
  filePath: string
}

// ---------------------------------------------------------------------------
// MiniMax
// ---------------------------------------------------------------------------

export interface Ai33MiniMaxConfig {
  success: boolean
  [key: string]: unknown
}

export interface Ai33MiniMaxVoiceSetting {
  voice_id: string
  vol?: number
  pitch?: number
  speed?: number
}

export interface Ai33MiniMaxTTSRequest {
  text: string
  model?: string
  voice_setting: Ai33MiniMaxVoiceSetting
  language_boost?: string
  with_transcript?: boolean
}

export interface Ai33VoiceCloneRequest {
  filePath: string
  voice_name: string
  preview_text?: string
  language_tag?: string
  need_noise_reduction?: boolean
  gender_tag?: string
}

export interface Ai33VoiceCloneResponse {
  success: boolean
  cloned_voice_id: string
}

export interface Ai33VoiceCloneDeleteResponse {
  success: boolean
}

export interface Ai33ClonedVoice {
  voice_id: string
  voice_name: string
  tag_list?: string[]
  sample_audio?: string
  [key: string]: unknown
}

export interface Ai33ClonedVoicesListResponse {
  success: boolean
  data: Ai33ClonedVoice[]
}

export interface Ai33MiniMaxVoiceListRequest {
  page?: number
  page_size?: number
  tag_list?: string[]
}

export interface Ai33MiniMaxVoiceItem {
  voice_id?: string
  name?: string
  tags?: string[]
  preview_url?: string
  sample_url?: string
  language?: string
  gender?: string
  [key: string]: unknown
}

export interface Ai33MiniMaxVoiceListResponse {
  success: boolean
  data: {
    has_more: boolean
    total: number
    voice_list: Ai33MiniMaxVoiceItem[]
  }
}

export interface Ai33MusicGenerationRequest {
  title?: string
  idea?: string
  lyrics?: string
  style_id?: string
  mood_id?: string
  scenario_id?: string
  n?: number
  rewrite_idea_switch?: boolean
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export interface Ai33ImageModel {
  model_id: string
  max_generations: number
  aspect_ratios?: string[]
  resolutions?: string[]
  [key: string]: unknown
}

export interface Ai33ImageModelsResponse {
  success: boolean
  models: Ai33ImageModel[]
}

export interface Ai33ImagePriceRequest {
  model_id: string
  generations_count: number
  model_parameters?: Record<string, unknown>
}

export interface Ai33ImagePriceResponse {
  success: boolean
  credits: number
}

export interface Ai33ImageGenerateRequest {
  prompt: string
  model_id: string
  generations_count?: number
  model_parameters?: Record<string, unknown>
  assetPaths?: string[]
}

export interface Ai33ImageGenerateResponse {
  success: boolean
  task_id: string
  estimated_credits: number
  ec_remain_credits: number
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

export interface Ai33DownloadResult {
  success: boolean
  localPath: string
  size: number
}

// ---------------------------------------------------------------------------
// Task progress event (emitted via IPC)
// ---------------------------------------------------------------------------

export interface Ai33TaskProgressEvent {
  taskId: string
  progress: number
  status: Ai33TaskStatus
  metadata?: Ai33TaskMetadata
  error_message?: string | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ELEVENLABS_MODELS = [
  { id: 'eleven_multilingual_v2', label: 'Multilingual V2' },
  { id: 'eleven_v3', label: 'V3' },
  { id: 'eleven_flash_v2_5', label: 'Flash V2.5 (rapido)' }
] as const

export const MINIMAX_MODELS = [
  { id: 'speech-2.8-hd', label: 'Speech 2.8 HD' },
  { id: 'speech-2.8-turbo', label: 'Speech 2.8 Turbo (rapido)' },
  { id: 'speech-2.6-hd', label: 'Speech 2.6 HD' },
  { id: 'speech-2.6-turbo', label: 'Speech 2.6 Turbo (rapido)' }
] as const

export const LANGUAGE_BOOST_OPTIONS = [
  { value: '', label: 'Auto' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Portugues' },
  { value: 'es', label: 'Espanhol' },
  { value: 'fr', label: 'Frances' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: 'Japones' },
  { value: 'ko', label: 'Coreano' },
  { value: 'zh', label: 'Chines' },
  { value: 'ru', label: 'Russo' },
  { value: 'ar', label: 'Arabe' }
] as const
