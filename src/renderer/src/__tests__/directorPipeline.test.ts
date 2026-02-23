import { describe, it, expect } from 'vitest'
import { buildLlmPayload, parseTakeOutput } from '../lib/promptTemplate'
import { validatePromptQuality } from '../lib/promptValidator'
import type { StoryBlock, Scene, CharacterRef } from '../types/project'

// Simulates a complete pipeline: build payload → mock LLM response → parse → validate

function createMockProject(): {
  blocks: StoryBlock[]
  scenes: Scene[]
  characters: CharacterRef[]
} {
  const blocks: StoryBlock[] = [
    { id: 'b1', index: 1, text: 'Chapter One. The city was bathed in golden light as Amber walked down Fifth Avenue.', startMs: 0, endMs: 5000, durationMs: 5000, characterCount: 80, linkedAudioId: null, textMaterialId: null, textSegmentId: null },
    { id: 'b2', index: 2, text: 'She paused at the crosswalk, her mind racing with thoughts of the meeting ahead.', startMs: 5000, endMs: 10000, durationMs: 5000, characterCount: 75, linkedAudioId: null, textMaterialId: null, textSegmentId: null },
    { id: 'b3', index: 3, text: 'Alexei was already in the boardroom, reviewing documents with cold precision.', startMs: 10000, endMs: 15000, durationMs: 5000, characterCount: 72, linkedAudioId: null, textMaterialId: null, textSegmentId: null },
    { id: 'b4', index: 4, text: 'The two locked eyes as she entered. The tension was palpable.', startMs: 15000, endMs: 20000, durationMs: 5000, characterCount: 60, linkedAudioId: null, textMaterialId: null, textSegmentId: null },
    { id: 'b5', index: 5, text: 'Meanwhile, Renzo watched from the security cameras in the basement.', startMs: 20000, endMs: 25000, durationMs: 5000, characterCount: 62, linkedAudioId: null, textMaterialId: null, textSegmentId: null },
    { id: 'b6', index: 6, text: 'The skyline glowed crimson as the sun set over the corporate district.', startMs: 25000, endMs: 30000, durationMs: 5000, characterCount: 65, linkedAudioId: null, textMaterialId: null, textSegmentId: null }
  ]

  const scenes: Scene[] = [
    { id: 's1', index: 1, description: '', startMs: 0, endMs: 5000, durationMs: 5000, mediaKeyword: '', mediaType: 'video', mediaPath: null, blockIds: ['b1'], prompt: '', promptRevision: 0, generationStatus: 'pending', platform: 'vo3', filenameHint: 'scene_001', narrativeContext: '', sceneType: '', llmMetadata: null, chapter: 1 },
    { id: 's2', index: 2, description: '', startMs: 5000, endMs: 10000, durationMs: 5000, mediaKeyword: '', mediaType: 'photo', mediaPath: null, blockIds: ['b2'], prompt: '', promptRevision: 0, generationStatus: 'pending', platform: 'nano-banana-pro', filenameHint: 'scene_002', narrativeContext: '', sceneType: '', llmMetadata: null, chapter: 1 },
    { id: 's3', index: 3, description: '', startMs: 10000, endMs: 15000, durationMs: 5000, mediaKeyword: '', mediaType: 'video', mediaPath: null, blockIds: ['b3'], prompt: '', promptRevision: 0, generationStatus: 'pending', platform: 'vo3', filenameHint: 'scene_003', narrativeContext: '', sceneType: '', llmMetadata: null, chapter: 1 },
    { id: 's4', index: 4, description: '', startMs: 15000, endMs: 20000, durationMs: 5000, mediaKeyword: '', mediaType: 'video', mediaPath: null, blockIds: ['b4'], prompt: '', promptRevision: 0, generationStatus: 'pending', platform: 'vo3', filenameHint: 'scene_004', narrativeContext: '', sceneType: '', llmMetadata: null, chapter: 1 },
    { id: 's5', index: 5, description: '', startMs: 20000, endMs: 25000, durationMs: 5000, mediaKeyword: '', mediaType: 'photo', mediaPath: null, blockIds: ['b5'], prompt: '', promptRevision: 0, generationStatus: 'pending', platform: 'nano-banana-pro', filenameHint: 'scene_005', narrativeContext: '', sceneType: '', llmMetadata: null, chapter: 1 },
    { id: 's6', index: 6, description: '', startMs: 25000, endMs: 30000, durationMs: 5000, mediaKeyword: '', mediaType: 'video', mediaPath: null, blockIds: ['b6'], prompt: '', promptRevision: 0, generationStatus: 'pending', platform: 'vo3', filenameHint: 'scene_006', narrativeContext: '', sceneType: '', llmMetadata: null, chapter: 1 }
  ]

  const characters: CharacterRef[] = [
    { id: 'c1', name: 'Amber Brown 5', role: 'Lead', chapters: [1], imagePath: '/amber.jpg', label: 'Amber Brown 5 - Lead, chapter 1' },
    { id: 'c2', name: 'Alexei Salvatore 2', role: 'Antagonist', chapters: [1], imagePath: '/alexei.jpg', label: 'Alexei Salvatore 2 - Antagonist, chapter 1' },
    { id: 'c3', name: 'Renzo Bellocchi 3', role: 'Supporting', chapters: [1], imagePath: '/renzo.jpg', label: 'Renzo Bellocchi 3 - Supporting, chapter 1' }
  ]

  return { blocks, scenes, characters }
}

// Simulated LLM output with GOOD quality (varied characters, proper format)
const GOOD_LLM_RESPONSE = `(TAKE 1)
Slow dolly-in wide shot of Fifth Avenue at golden hour, warm amber light casting long shadows across busy sidewalk.
Negative Prompt: text, watermark, typography, ui elements, violence, weapon, gore, sexual content.
Character Anchor: Amber Brown 5.
Environment Lock: Fifth Avenue New York, golden hour, warm directional sunlight through urban canyon.

(TAKE 2)
Static close-up of woman paused at crosswalk, shallow depth of field with blurred traffic behind.
Negative Prompt: text, watermark, typography, ui elements.
Character Anchor: Amber Brown 5.
Environment Lock: Fifth Avenue New York, golden hour, warm amber light on face.

(TAKE 3)
Tracking medium shot through glass boardroom door, cold fluorescent light illuminating documents on table.
Negative Prompt: text, watermark, typography, ui elements.
Character Anchor: Alexei Salvatore 2.
Environment Lock: Corporate boardroom interior, late afternoon, cold fluorescent overhead.

(TAKE 4)
Handheld two-shot from doorway capturing eye contact, tension visible in rigid postures and sharp lighting contrast.
Negative Prompt: text, watermark, typography, ui elements.
Character Anchor: Amber Brown 5, Alexei Salvatore 2.
Environment Lock: Corporate boardroom interior, late afternoon, cold fluorescent overhead.

(TAKE 5)
Static medium shot from behind security monitors, multiple screens glowing in dim basement room.
Negative Prompt: text, watermark, typography, ui elements.
Character Anchor: Renzo Bellocchi 3.
Environment Lock: Corporate basement security room, late afternoon, dim monitor glow.

(TAKE 6)
Crane shot ascending over corporate skyline, crimson sunset painting glass facades across the district.
Negative Prompt: text, watermark, typography, ui elements.
Character Anchor: \u2014
Environment Lock: Corporate district skyline exterior, sunset, crimson and orange sky.`

// Simulated LLM output with BAD quality (same character everywhere)
const BAD_LLM_RESPONSE = `(TAKE 1)
Slow dolly-in wide shot of street, warm light.
Negative Prompt: text, watermark.
Character Anchor: Amber Brown 5.
Environment Lock: Street, afternoon.

(TAKE 2)
Static close-up of woman, warm light.
Negative Prompt: text, watermark.
Character Anchor: Amber Brown 5.
Environment Lock: Street, afternoon.

(TAKE 3)
Tracking medium shot of boardroom.
Negative Prompt: text, watermark.
Character Anchor: Amber Brown 5.
Environment Lock: Boardroom, afternoon.

(TAKE 4)
Handheld two-shot of conversation.
Negative Prompt: text, watermark.
Character Anchor: Amber Brown 5.
Environment Lock: Boardroom, afternoon.

(TAKE 5)
Static medium shot of monitors.
Negative Prompt: text, watermark.
Character Anchor: Amber Brown 5.
Environment Lock: Basement, afternoon.

(TAKE 6)
Crane shot of skyline at sunset.
Negative Prompt: text, watermark.
Character Anchor: Amber Brown 5.
Environment Lock: Skyline, sunset.`

describe('Director Pipeline - End to End', () => {
  it('builds valid payload with roles, full script, and directorial instructions', () => {
    const { blocks, scenes, characters } = createMockProject()

    const { systemPrompt, userMessage } = buildLlmPayload(blocks, scenes, characters)

    // System prompt should be V16
    expect(systemPrompt).toContain('V16')

    // User message should contain roles
    expect(userMessage).toContain('[Lead]')
    expect(userMessage).toContain('[Antagonist]')
    expect(userMessage).toContain('[Supporting]')

    // Full script included
    expect(userMessage).toContain('ROTEIRO COMPLETO')
    expect(userMessage).toContain('Amber walked down Fifth Avenue')
    expect(userMessage).toContain('Alexei was already in the boardroom')
    expect(userMessage).toContain('Renzo watched from the security cameras')

    // Directorial instruction
    expect(userMessage).toContain('INSTRUCAO DE DIRECAO')

    // No per-scene "Personagens disponiveis"
    const perScene = userMessage.split('CENAS COM TEXTO SINCRONIZADO')[1]
    expect(perScene).not.toContain('Personagens disponiveis')

    // Scene structure
    expect(userMessage).toContain('[TAKE 1] Cena 1')
    expect(userMessage).toContain('[TAKE 6] Cena 6')
    expect(userMessage).toContain('TOTAL DE TAKES: 6')
  })

  it('GOOD LLM output passes quality validation (score >= 70)', () => {
    const { scenes, characters } = createMockProject()

    const takes = parseTakeOutput(GOOD_LLM_RESPONSE)
    const report = validatePromptQuality(takes, scenes, characters)

    expect(takes).toHaveLength(6)
    expect(report.passed).toBe(true)
    expect(report.score).toBeGreaterThanOrEqual(70)

    // Specific checks
    const sameRule = report.rules.find((r) => r.id === 'character-not-all-same')
    expect(sameRule?.passed).toBe(true)

    const varietyRule = report.rules.find((r) => r.id === 'character-variety')
    expect(varietyRule?.passed).toBe(true)

    const validRule = report.rules.find((r) => r.id === 'character-names-valid')
    expect(validRule?.passed).toBe(true)
  })

  it('BAD LLM output fails quality validation (same character in all scenes)', () => {
    const { scenes, characters } = createMockProject()

    const takes = parseTakeOutput(BAD_LLM_RESPONSE)
    const report = validatePromptQuality(takes, scenes, characters)

    expect(takes).toHaveLength(6)
    expect(report.passed).toBe(false)

    const sameRule = report.rules.find((r) => r.id === 'character-not-all-same')
    expect(sameRule?.passed).toBe(false)
  })

  it('validates character names against cast list', () => {
    const { scenes, characters } = createMockProject()

    const takes = parseTakeOutput(GOOD_LLM_RESPONSE)
    const report = validatePromptQuality(takes, scenes, characters)

    const validRule = report.rules.find((r) => r.id === 'character-names-valid')
    expect(validRule?.passed).toBe(true)
  })

  it('detects varied character distribution in good output', () => {
    const takes = parseTakeOutput(GOOD_LLM_RESPONSE)

    // Check that different characters appear
    const anchors = takes.map((t) => t.characterAnchor)
    const uniqueAnchors = new Set(anchors)

    // Should have variety (not all the same)
    expect(uniqueAnchors.size).toBeGreaterThan(1)

    // Should have descriptive scene with dash
    expect(anchors.some((a) => a === '\u2014')).toBe(true)

    // Should have multi-character scene
    expect(anchors.some((a) => a.includes(','))).toBe(true)
  })
})
