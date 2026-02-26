import type { Scene, CharacterRef } from '@/types/project'
import type { FlowCommand, FlowCreationMode, FlowCharacterImageRef } from '@/types/veo3'

const MIN_MATCH_LENGTH = 3

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

/**
 * Parse the "Character Anchor:" line from a Stage 4 prompt.
 * Returns character names (before the " - " description).
 * Returns empty array if anchor is absent or is the em-dash placeholder.
 */
function parseCharacterAnchor(prompt: string): string[] {
  const match = prompt.match(/Character Anchor:\s*(.+?)(?:\n|$)/i)
  if (!match) return []

  const anchorText = match[1].trim()
  if (anchorText === '\u2014' || anchorText === '-' || anchorText === '' || anchorText === '\u2014.') {
    return []
  }

  const parts = anchorText
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean)

  return parts.map((part) => {
    const clean = part.replace(/\.$/, '').trim()
    const dashIndex = clean.indexOf(' - ')
    return (dashIndex > 0 ? clean.substring(0, dashIndex) : clean).trim()
  })
}

/**
 * Match characters from the prompt's Character Anchor line to CharacterRef entries.
 * Each unique character name produces exactly ONE match (no duplicates).
 */
export function matchCharactersToPrompt(
  prompt: string,
  characters: CharacterRef[]
): FlowCharacterImageRef[] {
  if (!prompt || characters.length === 0) return []

  const anchorNames = parseCharacterAnchor(prompt)
  if (anchorNames.length === 0) return []

  const result: FlowCharacterImageRef[] = []
  const usedNames = new Set<string>()

  for (const anchorName of anchorNames) {
    const normalized = anchorName.toLowerCase().trim()
    if (usedNames.has(normalized)) continue

    let bestRef: CharacterRef | null = null
    let bestScore = 0

    for (const char of characters) {
      const charLower = char.name.toLowerCase().trim()
      if (charLower === normalized) {
        bestRef = char
        break
      }
      if (charLower.includes(normalized) || normalized.includes(charLower)) {
        const score = Math.min(charLower.length, normalized.length)
        if (score > bestScore) {
          bestScore = score
          bestRef = char
        }
      }
    }

    if (bestRef) {
      result.push({
        characterId: bestRef.id,
        name: anchorName,
        keywords: extractKeywords(anchorName),
        imagePath: bestRef.imagePath || null,
        galleryItemName: null
      })
      usedNames.add(normalized)
    }
  }

  return result
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
