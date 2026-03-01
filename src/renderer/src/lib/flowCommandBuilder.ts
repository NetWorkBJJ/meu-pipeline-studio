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
 * Returns full anchor labels (including role, outfit, chapter) for exact matching.
 * Returns empty array if anchor is absent or is the em-dash placeholder.
 */
function parseCharacterAnchor(prompt: string): string[] {
  const match = prompt.match(/Character Anchor:\s*(.+?)(?:\n|$)/i)
  if (!match) return []

  const anchorText = match[1].trim()
  if (anchorText === '\u2014' || anchorText === '-' || anchorText === '' || anchorText === '\u2014.') {
    return []
  }

  return anchorText
    .split('|')
    .map((p) => p.replace(/\.$/, '').trim())
    .filter(Boolean)
}

/**
 * Extract just the name portion from a full anchor label.
 * "Roger Ceou - Lead, Outfit 2, chapter 1" → "Roger Ceou"
 */
function extractNameFromAnchor(anchor: string): string {
  const dashIndex = anchor.indexOf(' - ')
  return (dashIndex > 0 ? anchor.substring(0, dashIndex) : anchor).trim()
}

/**
 * Match characters from the prompt's Character Anchor line to CharacterRef entries.
 * Uses 3-level matching strategy:
 *   1. Exact label match (handles outfits correctly)
 *   2. Label substring match
 *   3. Fallback by name only (before " - ")
 * Each unique anchor produces exactly ONE match (no duplicates).
 */
export function matchCharactersToPrompt(
  prompt: string,
  characters: CharacterRef[]
): FlowCharacterImageRef[] {
  if (!prompt || characters.length === 0) return []

  const anchors = parseCharacterAnchor(prompt)
  if (anchors.length === 0) return []

  const result: FlowCharacterImageRef[] = []
  const usedIds = new Set<string>()

  for (const anchor of anchors) {
    const anchorLower = anchor.toLowerCase().trim()
    let bestRef: CharacterRef | null = null

    // Level 1: Exact label match (case-insensitive)
    for (const char of characters) {
      if (char.label.toLowerCase().trim() === anchorLower) {
        bestRef = char
        break
      }
    }

    // Level 2: Label substring match (anchor contains label or vice-versa)
    if (!bestRef) {
      let bestScore = 0
      for (const char of characters) {
        const labelLower = char.label.toLowerCase().trim()
        if (anchorLower.includes(labelLower) || labelLower.includes(anchorLower)) {
          const score = Math.min(labelLower.length, anchorLower.length)
          if (score > bestScore) {
            bestScore = score
            bestRef = char
          }
        }
      }
    }

    // Level 3: Fallback by name only (before " - ")
    if (!bestRef) {
      const anchorName = extractNameFromAnchor(anchor).toLowerCase()
      let bestScore = 0
      for (const char of characters) {
        const charName = char.name.toLowerCase().trim()
        if (charName === anchorName) {
          bestRef = char
          break
        }
        if (charName.includes(anchorName) || anchorName.includes(charName)) {
          const score = Math.min(charName.length, anchorName.length)
          if (score > bestScore) {
            bestScore = score
            bestRef = char
          }
        }
      }
    }

    if (bestRef && !usedIds.has(bestRef.id)) {
      const displayName = extractNameFromAnchor(anchor)
      result.push({
        characterId: bestRef.id,
        name: displayName,
        keywords: extractKeywords(displayName),
        imagePath: bestRef.imagePath || null,
        galleryItemName: null
      })
      usedIds.add(bestRef.id)
    }
  }

  return result
}

export function determineFlowMode(
  scene: Scene,
  matchedCharacters: FlowCharacterImageRef[]
): FlowCreationMode {
  if (scene.platform === 'nano-banana-2') {
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
