import type { Scene, CharacterRef } from '@/types/project'
import type { FlowCommand, FlowCreationMode, FlowCharacterImageRef } from '@/types/veo3'

const MIN_MATCH_LENGTH = 3

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractKeywords(name: string): string[] {
  const normalized = name.toLowerCase()
  const keywords = new Set<string>()

  keywords.add(normalized)

  const parts = normalized.split(/[_\-\s]+/).filter((p) => p.length >= MIN_MATCH_LENGTH)

  for (const part of parts) {
    const clean = part.replace(/^\d+|\d+$/g, '').trim()
    if (clean.length >= MIN_MATCH_LENGTH) {
      keywords.add(clean)
    }
  }

  for (let i = 0; i < parts.length - 1; i++) {
    keywords.add(`${parts[i]} ${parts[i + 1]}`)
  }

  const withoutNumbers = normalized
    .replace(/\d+/g, '')
    .replace(/[_\-]+/g, ' ')
    .trim()
  if (withoutNumbers.length >= MIN_MATCH_LENGTH) {
    keywords.add(withoutNumbers)
  }

  return Array.from(keywords)
}

function calculateConfidence(matchedName: string, prompt: string): number {
  let confidence = matchedName.length * 10

  const regex = new RegExp(
    `(^|[\\s.,;:!?])(${escapeRegex(matchedName)})([\\s.,;:!?]|$)`,
    'i'
  )
  if (regex.test(prompt)) {
    confidence += 50
  }

  return confidence
}

export function matchCharactersToPrompt(
  prompt: string,
  characters: CharacterRef[]
): FlowCharacterImageRef[] {
  if (!prompt || characters.length === 0) return []

  const promptLower = prompt.toLowerCase()
  const matches: { ref: FlowCharacterImageRef; confidence: number }[] = []
  const matchedIds = new Set<string>()

  for (const char of characters) {
    if (matchedIds.has(char.id)) continue

    const keywords = extractKeywords(char.name)

    for (const keyword of keywords) {
      if (promptLower.includes(keyword)) {
        matches.push({
          ref: {
            characterId: char.id,
            name: char.name,
            keywords,
            imagePath: char.imagePath || null,
            galleryItemName: null
          },
          confidence: calculateConfidence(keyword, promptLower)
        })
        matchedIds.add(char.id)
        break
      }
    }
  }

  matches.sort((a, b) => b.confidence - a.confidence)
  return matches.map((m) => m.ref)
}

export function determineFlowMode(
  scene: Scene,
  matchedCharacters: FlowCharacterImageRef[]
): FlowCreationMode {
  if (scene.platform === 'nano-banana-pro') {
    return 'imagem'
  }

  if (matchedCharacters.length > 0) {
    return 'elementos'
  }

  return 'texto'
}

export function buildFlowCommands(
  scenes: Scene[],
  characters: CharacterRef[]
): FlowCommand[] {
  const commands: FlowCommand[] = []

  for (const scene of scenes) {
    if (!scene.prompt || scene.prompt.trim() === '') continue

    const matchedCharacters = matchCharactersToPrompt(scene.prompt, characters)
    const mode = determineFlowMode(scene, matchedCharacters)

    commands.push({
      id: `flow-${scene.id}`,
      sceneId: scene.id,
      sceneIndex: scene.index,
      chapter: scene.chapter,
      prompt: scene.prompt,
      mode,
      characterImages: matchedCharacters,
      status: 'queued',
      tabId: null,
      submittedAt: null,
      completedAt: null,
      error: null
    })
  }

  return commands
}
