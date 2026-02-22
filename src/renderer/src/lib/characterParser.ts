import { v4 as uuidv4 } from 'uuid'
import type { CharacterRef } from '@/types/project'

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp'])

function extractFilename(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/')
  const filename = parts[parts.length - 1]
  const dotIdx = filename.lastIndexOf('.')
  return dotIdx > 0 ? filename.substring(0, dotIdx) : filename
}

function parseChapters(chaptersStr: string): number[] {
  const chapters: number[] = []
  const cleaned = chaptersStr.trim()

  const parts = cleaned.split(/\s*(?:,|and)\s*/i).filter(Boolean)
  for (const part of parts) {
    const num = parseInt(part.trim(), 10)
    if (!isNaN(num)) chapters.push(num)
  }

  return chapters.sort((a, b) => a - b)
}

export function parseCharacterFilename(filePath: string): CharacterRef | null {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  if (!IMAGE_EXTENSIONS.has(ext)) return null

  const filename = extractFilename(filePath)

  // Try: "Name - Role, chapter(s) N, M and P"
  const withChapter = filename.match(/^(.+?)\s*-\s*(.+?),\s*chapter[s]?\s*(.+)$/i)
  if (withChapter) {
    const chapters = parseChapters(withChapter[3])
    if (chapters.length > 0) {
      return {
        id: uuidv4(),
        name: withChapter[1].trim(),
        role: withChapter[2].trim(),
        chapters,
        imagePath: filePath,
        label: filename
      }
    }
  }

  // Fallback: "Name - Role" (no chapter = appears in all chapters)
  const withoutChapter = filename.match(/^(.+?)\s*-\s*(.+)$/)
  if (withoutChapter) {
    return {
      id: uuidv4(),
      name: withoutChapter[1].trim(),
      role: withoutChapter[2].trim(),
      chapters: [],
      imagePath: filePath,
      label: filename
    }
  }

  return null
}

export function parseCharacterFilenames(files: string[]): CharacterRef[] {
  const refs: CharacterRef[] = []
  for (const file of files) {
    const ref = parseCharacterFilename(file)
    if (ref) refs.push(ref)
  }
  return refs.sort(
    (a, b) => a.name.localeCompare(b.name) || (a.chapters[0] ?? 0) - (b.chapters[0] ?? 0)
  )
}

export function getCharactersForChapter(
  characters: CharacterRef[],
  chapter: number
): CharacterRef[] {
  return characters.filter((c) => c.chapters.length === 0 || c.chapters.includes(chapter))
}

export function getUniqueCharacterNames(characters: CharacterRef[]): string[] {
  return [...new Set(characters.map((c) => c.name))].sort()
}
