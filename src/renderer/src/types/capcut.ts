export interface CapCutTimeRange {
  start: number
  duration: number
}

export interface CapCutSegment {
  id: string
  material_id: string
  target_timerange: CapCutTimeRange
  source_timerange: CapCutTimeRange | null
  render_index: number
  visible: boolean
  volume: number
  extra_material_refs: string[]
}

export interface CapCutTrack {
  type: 'video' | 'text' | 'audio'
  segments: CapCutSegment[]
  flag: number
  id: string
  attribute: number
}

export interface CapCutTextMaterial {
  id: string
  recognize_text: string
  content: string
  type: string
  font_path: string
  text_color: string
  text_size: number
}

export interface CapCutAudioMaterial {
  id: string
  path: string
  duration: number
  tone_type: string
  tone_platform: string
  type: string
}

export interface CapCutVideoMaterial {
  id: string
  path: string
  type: string
  width: number
  height: number
  duration: number
}

export interface CapCutCanvasConfig {
  height: number
  width: number
  ratio: string
}

export interface CapCutDraftSummary {
  canvasConfig: CapCutCanvasConfig
  duration: number
  tracks: CapCutTrack[]
  textMaterials: CapCutTextMaterial[]
  audioMaterials: CapCutAudioMaterial[]
  videoMaterials: CapCutVideoMaterial[]
}
