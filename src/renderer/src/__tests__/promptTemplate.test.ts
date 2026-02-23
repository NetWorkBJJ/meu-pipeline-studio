import { describe, it, expect } from 'vitest'
import { buildLlmPayload, parseTakeOutput, formatTake, MASTER_PROMPT } from '../lib/promptTemplate'
import type { StoryBlock, Scene, CharacterRef } from '../types/project'

function makeBlock(overrides: Partial<StoryBlock> = {}): StoryBlock {
  return {
    id: 'block-1',
    index: 1,
    text: 'She walked into the office.',
    startMs: 0,
    endMs: 5000,
    durationMs: 5000,
    characterCount: 27,
    linkedAudioId: null,
    textMaterialId: null,
    textSegmentId: null,
    ...overrides
  }
}

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 'scene-1',
    index: 1,
    description: 'Opening scene',
    startMs: 0,
    endMs: 5000,
    durationMs: 5000,
    mediaKeyword: '',
    mediaType: 'video',
    mediaPath: null,
    blockIds: ['block-1'],
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
    imagePath: '/path/to/img.jpg',
    label: 'Amber Brown 5 - Lead, chapter 1',
    ...overrides
  }
}

describe('buildLlmPayload', () => {
  it('includes character roles in the payload', () => {
    const blocks = [makeBlock()]
    const scenes = [makeScene()]
    const chars = [
      makeChar({ name: 'Amber Brown 5', role: 'Lead' }),
      makeChar({ id: 'char-2', name: 'Alexei Salvatore 2', role: 'Antagonist', chapters: [1] })
    ]

    const { userMessage } = buildLlmPayload(blocks, scenes, chars)

    expect(userMessage).toContain('[Lead]')
    expect(userMessage).toContain('[Antagonist]')
    expect(userMessage).toContain('protagonista')
    expect(userMessage).toContain('antagonista')
  })

  it('includes full script as narrative context', () => {
    const blocks = [
      makeBlock({ id: 'b1', text: 'She walked into the office.', startMs: 0, endMs: 3000 }),
      makeBlock({ id: 'b2', text: 'He was waiting for her.', startMs: 3000, endMs: 6000 })
    ]
    const scenes = [
      makeScene({ blockIds: ['b1'] }),
      makeScene({ id: 'scene-2', index: 2, blockIds: ['b2'], startMs: 3000, endMs: 6000 })
    ]

    const { userMessage } = buildLlmPayload(blocks, scenes, [])

    expect(userMessage).toContain('ROTEIRO COMPLETO')
    expect(userMessage).toContain('She walked into the office.')
    expect(userMessage).toContain('He was waiting for her.')
  })

  it('includes directorial instructions when characters exist', () => {
    const blocks = [makeBlock()]
    const scenes = [makeScene()]
    const chars = [makeChar()]

    const { userMessage } = buildLlmPayload(blocks, scenes, chars)

    expect(userMessage).toContain('INSTRUCAO DE DIRECAO')
    expect(userMessage).toContain('VARIE os personagens')
  })

  it('does NOT repeat "Personagens disponiveis" per scene', () => {
    const blocks = [
      makeBlock({ id: 'b1', startMs: 0, endMs: 3000 }),
      makeBlock({ id: 'b2', startMs: 3000, endMs: 6000 })
    ]
    const scenes = [
      makeScene({ blockIds: ['b1'] }),
      makeScene({ id: 's2', index: 2, blockIds: ['b2'], startMs: 3000, endMs: 6000 })
    ]
    const chars = [makeChar()]

    const { userMessage } = buildLlmPayload(blocks, scenes, chars)

    // Should NOT have "Personagens disponiveis:" in per-scene sections
    const perSceneSection = userMessage.split('CENAS COM TEXTO SINCRONIZADO')[1] || ''
    expect(perSceneSection).not.toContain('Personagens disponiveis:')
  })

  it('groups characters by chapter when multiple chapters', () => {
    const blocks = [makeBlock()]
    const scenes = [
      makeScene({ chapter: 1 }),
      makeScene({ id: 's2', index: 2, chapter: 3, startMs: 5000, endMs: 10000 })
    ]
    const chars = [
      makeChar({ name: 'Amber Brown 5', role: 'Lead', chapters: [1] }),
      makeChar({ id: 'c2', name: 'Renzo Bellocchi 3', role: 'Supporting', chapters: [3] })
    ]

    const { userMessage } = buildLlmPayload(blocks, scenes, chars)

    expect(userMessage).toContain('ELENCO POR CAPITULO')
    expect(userMessage).toContain('Capitulo 1:')
    expect(userMessage).toContain('Capitulo 3:')
  })

  it('generates correct take count in header', () => {
    const blocks = [makeBlock()]
    const scenes = [
      makeScene(),
      makeScene({ id: 's2', index: 2, startMs: 5000, endMs: 10000 }),
      makeScene({ id: 's3', index: 3, startMs: 10000, endMs: 15000 })
    ]

    const { userMessage } = buildLlmPayload(blocks, scenes, [], 100)

    expect(userMessage).toContain('TOTAL DE TAKES: 3')
    expect(userMessage).toContain('TAKE INICIAL: 100')
    expect(userMessage).toContain('TAKE FINAL: 102')
  })

  it('uses MASTER_PROMPT as system prompt', () => {
    const { systemPrompt } = buildLlmPayload([makeBlock()], [makeScene()], [])

    expect(systemPrompt).toContain('MASTER PROMPT V16')
    expect(systemPrompt).toContain('CHARACTER ASSIGNMENT')
    expect(systemPrompt).toContain('DIRECAO DE ELENCO')
  })

  it('includes exact name warning in payload when characters exist', () => {
    const blocks = [makeBlock()]
    const scenes = [makeScene()]
    const chars = [makeChar()]

    const { userMessage } = buildLlmPayload(blocks, scenes, chars)

    expect(userMessage).toContain('COPIE cada nome EXATAMENTE')
    expect(userMessage).toContain('APENAS os nomes listados')
  })
})

describe('MASTER_PROMPT', () => {
  it('contains character distribution rules', () => {
    expect(MASTER_PROMPT).toContain('NUNCA coloque o MESMO personagem em TODAS as cenas')
    expect(MASTER_PROMPT).toContain('VARIEDADE e essencial')
    expect(MASTER_PROMPT).toContain('[Lead]')
    expect(MASTER_PROMPT).toContain('[Supporting]')
    expect(MASTER_PROMPT).toContain('[Antagonist]')
  })

  it('contains pronoun resolution rules', () => {
    expect(MASTER_PROMPT).toContain('RESOLUCAO DE PRONOMES')
    expect(MASTER_PROMPT).toContain('she/her')
    expect(MASTER_PROMPT).toContain('he/him')
  })

  it('contains self-validation checklist for character variety', () => {
    expect(MASTER_PROMPT).toContain('NENHUM personagem aparece em TODAS as cenas')
  })

  it('contains never-invent-names and image-match rules', () => {
    expect(MASTER_PROMPT).toContain('NUNCA invente nomes')
    expect(MASTER_PROMPT).toContain('match automatico com a imagem')
  })

  it('requires using all relevant characters', () => {
    expect(MASTER_PROMPT).toContain('Use TODOS os personagens da lista que participam na narrativa')
  })
})

describe('parseTakeOutput', () => {
  it('parses standard TAKE format correctly', () => {
    const output = `(TAKE 1)
Slow dolly-in two-shot inside glass elevator, warm golden backlight.
Negative Prompt: text, watermark, typography, ui elements.
Character Anchor: Amber Brown 5, Alexei Salvatore 2.
Environment Lock: Salvatore corporate headquarters, early afternoon.`

    const takes = parseTakeOutput(output)

    expect(takes).toHaveLength(1)
    expect(takes[0].takeNumber).toBe(1)
    expect(takes[0].description).toContain('Slow dolly-in')
    expect(takes[0].negativePrompt).toContain('text, watermark')
    expect(takes[0].characterAnchor).toBe('Amber Brown 5, Alexei Salvatore 2.')
    expect(takes[0].environmentLock).toContain('Salvatore corporate')
  })

  it('parses multiple takes', () => {
    const output = `(TAKE 10)
Static wide shot of executive office.
Negative Prompt: text, watermark.
Character Anchor: \u2014
Environment Lock: Office, afternoon.

(TAKE 11)
Handheld close-up of face.
Negative Prompt: text, watermark.
Character Anchor: Amber Brown 5.
Environment Lock: Office, afternoon.`

    const takes = parseTakeOutput(output)

    expect(takes).toHaveLength(2)
    expect(takes[0].takeNumber).toBe(10)
    expect(takes[1].takeNumber).toBe(11)
    expect(takes[0].characterAnchor).toBe('\u2014')
    expect(takes[1].characterAnchor).toBe('Amber Brown 5.')
  })

  it('handles --- dash in Character Anchor', () => {
    const output = `(TAKE 5)
Crane shot descending over mansion.
Negative Prompt: text, watermark.
Character Anchor: ---
Environment Lock: Seaside mansion, late afternoon.`

    const takes = parseTakeOutput(output)

    expect(takes).toHaveLength(1)
    expect(takes[0].characterAnchor).toBe('---')
  })

  it('handles multiple characters in Character Anchor', () => {
    const output = `(TAKE 7)
Two-shot medium of conversation.
Negative Prompt: text, watermark.
Character Anchor: Amber Brown 5, Alexei Salvatore 2, Renzo Bellocchi 3.
Environment Lock: Restaurant, evening.`

    const takes = parseTakeOutput(output)

    expect(takes).toHaveLength(1)
    expect(takes[0].characterAnchor).toContain('Amber Brown 5')
    expect(takes[0].characterAnchor).toContain('Alexei Salvatore 2')
    expect(takes[0].characterAnchor).toContain('Renzo Bellocchi 3')
  })

  it('sorts takes by take number', () => {
    const output = `(TAKE 3)
Desc three.
Negative Prompt: np.
Character Anchor: -
Environment Lock: env.

(TAKE 1)
Desc one.
Negative Prompt: np.
Character Anchor: -
Environment Lock: env.

(TAKE 2)
Desc two.
Negative Prompt: np.
Character Anchor: -
Environment Lock: env.`

    const takes = parseTakeOutput(output)

    expect(takes.map((t) => t.takeNumber)).toEqual([1, 2, 3])
  })
})

describe('formatTake', () => {
  it('formats take into standard 5-line format', () => {
    const formatted = formatTake({
      takeNumber: 42,
      description: 'Static wide shot of office.',
      negativePrompt: 'text, watermark.',
      characterAnchor: 'Amber Brown 5.',
      environmentLock: 'Office, afternoon.'
    })

    expect(formatted).toBe(`(TAKE 42)
Static wide shot of office.
Negative Prompt: text, watermark.
Character Anchor: Amber Brown 5.
Environment Lock: Office, afternoon.`)
  })
})
