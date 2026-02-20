export interface TtsVoice {
  name: string
  id: string
  pitch: 'higher' | 'middle' | 'lower_middle' | 'lower'
}

export interface TtsNarrationStyle {
  key: string
  description: string
  category: string
}

export interface TtsChunkResult {
  index: number
  path: string
  duration_ms: number
  status: 'ok' | 'error'
  error?: string
  chars: number
}

export interface TtsGenerateResult {
  success: boolean
  output_dir: string
  combined_audio_path: string
  parts: TtsChunkResult[]
  total_duration_ms: number
  srt_path: string | null
}

export interface TtsPreviewResult {
  success: boolean
  audio_base64: string
  duration_s: number
  error?: string
}

export interface TtsVoiceListResult {
  voices: TtsVoice[]
}

export interface TtsStyleListResult {
  styles: TtsNarrationStyle[]
}

export interface TtsProgressEvent {
  current: number
  total: number
  message: string
}

export interface TtsDefaults {
  voice: string
  style: string
  ttsModel: 'flash' | 'pro'
}
