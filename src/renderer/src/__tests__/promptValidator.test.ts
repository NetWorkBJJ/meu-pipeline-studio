import { describe, it, expect } from 'vitest'
import { validatePromptQuality } from '../lib/promptValidator'
import type { ParsedTake } from '../lib/promptTemplate'
import type { Scene, CharacterRef } from '../types/project'

function makeTake(overrides: Partial<ParsedTake> = {}): ParsedTake {
  return {
    takeNumber: 1,
    description: 'Slow dolly-in medium shot of office, warm ambient light through windows.',
    negativePrompt: 'text, watermark, typography, ui elements.',
    characterAnchor: 'Amber Brown 5.',
    environmentLock: 'Executive office, early afternoon, warm natural light.',
    ...overrides
  }
}

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 'scene-1',
    index: 1,
    description: '',
    startMs: 0,
    endMs: 5000,
    durationMs: 5000,
    mediaKeyword: '',
    mediaType: 'video',
    mediaPath: null,
    blockIds: [],
    prompt: '',
    promptRevision: 0,
    generationStatus: 'pending',
    platform: 'vo3',
    filenameHint: 'scene_001',
    narrativeContext: '',
    sceneType: '',
    llmMetadata: null,
    chapter: 1,
    ...overrides
  }
}

function makeChar(overrides: Partial<CharacterRef> = {}): CharacterRef {
  return {
    id: 'char-1',
    name: 'Amber Brown 5',
    role: 'Lead',
    chapters: [1],
    imagePath: '/img.jpg',
    label: 'Amber Brown 5 - Lead, chapter 1',
    ...overrides
  }
}

describe('validatePromptQuality', () => {
  it('approves output with character variety', () => {
    const takes = [
      makeTake({ takeNumber: 1, characterAnchor: 'Amber Brown 5.' }),
      makeTake({ takeNumber: 2, characterAnchor: 'Alexei Salvatore 2.' }),
      makeTake({ takeNumber: 3, characterAnchor: '\u2014' }),
      makeTake({ takeNumber: 4, characterAnchor: 'Amber Brown 5, Alexei Salvatore 2.' }),
      makeTake({ takeNumber: 5, characterAnchor: 'Renzo Bellocchi 3.' })
    ]
    const scenes = takes.map((_, i) => makeScene({ id: `s${i}`, index: i + 1 }))
    const chars = [
      makeChar({ name: 'Amber Brown 5', role: 'Lead' }),
      makeChar({ id: 'c2', name: 'Alexei Salvatore 2', role: 'Antagonist' }),
      makeChar({ id: 'c3', name: 'Renzo Bellocchi 3', role: 'Supporting' })
    ]

    const report = validatePromptQuality(takes, scenes, chars)

    expect(report.passed).toBe(true)
    expect(report.score).toBeGreaterThanOrEqual(70)
  })

  it('fails output with same character in ALL scenes', () => {
    const takes = [
      makeTake({ takeNumber: 1, characterAnchor: 'Amber Brown 5.' }),
      makeTake({ takeNumber: 2, characterAnchor: 'Amber Brown 5.' }),
      makeTake({ takeNumber: 3, characterAnchor: 'Amber Brown 5.' }),
      makeTake({ takeNumber: 4, characterAnchor: 'Amber Brown 5.' }),
      makeTake({ takeNumber: 5, characterAnchor: 'Amber Brown 5.' })
    ]
    const scenes = takes.map((_, i) => makeScene({ id: `s${i}`, index: i + 1 }))
    const chars = [
      makeChar({ name: 'Amber Brown 5', role: 'Lead' }),
      makeChar({ id: 'c2', name: 'Alexei Salvatore 2', role: 'Antagonist' })
    ]

    const report = validatePromptQuality(takes, scenes, chars)

    const sameRule = report.rules.find((r) => r.id === 'character-not-all-same')
    expect(sameRule?.passed).toBe(false)
  })

  it('fails output with abbreviated names', () => {
    const takes = [
      makeTake({ takeNumber: 1, characterAnchor: 'Amber.' }),
      makeTake({ takeNumber: 2, characterAnchor: '\u2014' })
    ]
    const scenes = takes.map((_, i) => makeScene({ id: `s${i}`, index: i + 1 }))
    const chars = [makeChar({ name: 'Amber Brown 5', role: 'Lead' })]

    const report = validatePromptQuality(takes, scenes, chars)

    const abbrRule = report.rules.find((r) => r.id === 'no-abbreviation')
    expect(abbrRule?.passed).toBe(false)
  })

  it('fails output with descriptions missing camera technique', () => {
    const takes = [
      makeTake({ takeNumber: 1, description: 'The office was dark and empty.' }),
      makeTake({ takeNumber: 2, description: 'A woman entered the room slowly.' }),
      makeTake({ takeNumber: 3, description: 'Lights flickered overhead.' })
    ]
    const scenes = takes.map((_, i) => makeScene({ id: `s${i}`, index: i + 1 }))

    const report = validatePromptQuality(takes, scenes, [])

    const cameraRule = report.rules.find((r) => r.id === 'description-starts-camera')
    expect(cameraRule?.passed).toBe(false)
  })

  it('flags descriptions exceeding 30 words', () => {
    const longDesc = Array(40).fill('word').join(' ')
    const takes = [
      makeTake({ takeNumber: 1, description: `Static wide shot. ${longDesc}` }),
      makeTake({ takeNumber: 2, description: `Slow dolly-in. ${longDesc}` }),
      makeTake({ takeNumber: 3, description: `Handheld close-up. ${longDesc}` }),
      makeTake({ takeNumber: 4, description: 'Tracking medium shot, warm light.' }),
      makeTake({ takeNumber: 5, description: 'Crane shot descending, soft glow.' })
    ]
    const scenes = takes.map((_, i) => makeScene({ id: `s${i}`, index: i + 1 }))

    const report = validatePromptQuality(takes, scenes, [])

    const wordRule = report.rules.find((r) => r.id === 'description-max-words')
    // 3 out of 5 exceeding (60%) > 20% threshold = should fail
    expect(wordRule?.passed).toBe(false)
  })

  it('approves output with em-dash for descriptive scenes', () => {
    const takes = [
      makeTake({ takeNumber: 1, characterAnchor: 'Amber Brown 5.' }),
      makeTake({ takeNumber: 2, characterAnchor: '\u2014' }),
      makeTake({ takeNumber: 3, characterAnchor: 'Alexei Salvatore 2.' })
    ]
    const scenes = takes.map((_, i) => makeScene({ id: `s${i}`, index: i + 1 }))
    const chars = [
      makeChar({ name: 'Amber Brown 5', role: 'Lead' }),
      makeChar({ id: 'c2', name: 'Alexei Salvatore 2', role: 'Antagonist' })
    ]

    const report = validatePromptQuality(takes, scenes, chars)

    const validRule = report.rules.find((r) => r.id === 'character-names-valid')
    expect(validRule?.passed).toBe(true)
  })

  it('verifies take count matches scene count', () => {
    const takes = [
      makeTake({ takeNumber: 1 }),
      makeTake({ takeNumber: 2 })
    ]
    const scenes = [
      makeScene({ id: 's1', index: 1 }),
      makeScene({ id: 's2', index: 2 }),
      makeScene({ id: 's3', index: 3 })
    ]

    const report = validatePromptQuality(takes, scenes, [])

    const countRule = report.rules.find((r) => r.id === 'take-count')
    expect(countRule?.passed).toBe(false)
    expect(countRule?.details).toContain('Esperado 3')
  })

  it('detects out-of-sequence take numbers', () => {
    const takes = [
      makeTake({ takeNumber: 10 }),
      makeTake({ takeNumber: 12 }),
      makeTake({ takeNumber: 13 })
    ]
    const scenes = takes.map((_, i) => makeScene({ id: `s${i}`, index: i + 1 }))

    const report = validatePromptQuality(takes, scenes, [], 10)

    const seqRule = report.rules.find((r) => r.id === 'take-sequence')
    expect(seqRule?.passed).toBe(false)
    expect(seqRule?.details).toContain('Fora de ordem')
  })

  it('checks for Duration/FOTO tags', () => {
    const takes = [
      makeTake({ takeNumber: 1, description: 'Duration: 6.1s. Static wide shot of office.' }),
      makeTake({ takeNumber: 2, description: '[FOTO] Close-up of hands.' })
    ]
    const scenes = takes.map((_, i) => makeScene({ id: `s${i}`, index: i + 1 }))

    const report = validatePromptQuality(takes, scenes, [])

    const tagRule = report.rules.find((r) => r.id === 'no-duration-tag')
    expect(tagRule?.passed).toBe(false)
  })

  it('checks for missing Negative Prompt', () => {
    const takes = [
      makeTake({ takeNumber: 1, negativePrompt: '' }),
      makeTake({ takeNumber: 2, negativePrompt: 'text, watermark.' })
    ]
    const scenes = takes.map((_, i) => makeScene({ id: `s${i}`, index: i + 1 }))

    const report = validatePromptQuality(takes, scenes, [])

    const npRule = report.rules.find((r) => r.id === 'negative-prompt-present')
    expect(npRule?.passed).toBe(false)
  })

  it('checks for missing Environment Lock', () => {
    const takes = [
      makeTake({ takeNumber: 1, environmentLock: '' }),
      makeTake({ takeNumber: 2, environmentLock: '' })
    ]
    const scenes = takes.map((_, i) => makeScene({ id: `s${i}`, index: i + 1 }))

    const report = validatePromptQuality(takes, scenes, [])

    const envRule = report.rules.find((r) => r.id === 'environment-lock-present')
    expect(envRule?.passed).toBe(false)
  })

  it('returns score between 0 and 100', () => {
    const takes = [makeTake()]
    const scenes = [makeScene()]

    const report = validatePromptQuality(takes, scenes, [])

    expect(report.score).toBeGreaterThanOrEqual(0)
    expect(report.score).toBeLessThanOrEqual(100)
  })

  it('includes summary in report', () => {
    const takes = [makeTake()]
    const scenes = [makeScene()]

    const report = validatePromptQuality(takes, scenes, [])

    expect(report.summary).toBeTruthy()
    expect(typeof report.summary).toBe('string')
  })
})
