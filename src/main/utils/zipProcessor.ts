import AdmZip from 'adm-zip'
import { existsSync, writeFileSync, unlinkSync } from 'fs'
import { join, extname, basename } from 'path'
import {
  parseFlowEntryName,
  buildCleanFilename,
  type FlowEntryParsed
} from './downloadFilename'

export interface ExtractedFile {
  originalName: string
  cleanName: string
  fullPath: string
  takeNumber: number | null
}

export interface ZipProcessResult {
  extractedFiles: ExtractedFile[]
  errors: string[]
}

interface MatchedPrompt {
  prompt: string
  sceneIndex: number
}

const MEDIA_EXTENSIONS = new Set([
  '.mp4', '.webm', '.mov', '.avi', '.mkv',
  '.jpg', '.jpeg', '.png', '.webp'
])

function resolveCollision(destDir: string, filename: string): string {
  let finalPath = join(destDir, filename)
  if (!existsSync(finalPath)) return finalPath

  const ext = extname(filename)
  const base = basename(filename, ext)
  let version = 2
  while (existsSync(join(destDir, `${base}_v${version}${ext}`))) {
    version++
  }
  finalPath = join(destDir, `${base}_v${version}${ext}`)
  return finalPath
}

function normalizeForGrouping(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

interface ParsedEntry {
  originalName: string
  parsed: FlowEntryParsed
  matched: MatchedPrompt | null
  buffer: Buffer
}

/**
 * Extract a Veo3 Flow download ZIP, rename entries using prompt-based naming,
 * and save to destDir. Optionally deletes the ZIP after extraction.
 *
 * Two-phase processing:
 * 1. Parse all entries + match against prompt queue
 * 2. Propagate TAKE numbers within groups, then write files
 */
export function processVeo3Zip(
  zipPath: string,
  destDir: string,
  options?: {
    deleteZipAfter?: boolean
    maxPromptLength?: number
    matchPrompt?: (parsedText: string) => MatchedPrompt | null
  }
): ZipProcessResult {
  const { deleteZipAfter = true, maxPromptLength = 50, matchPrompt } = options ?? {}
  const result: ZipProcessResult = { extractedFiles: [], errors: [] }

  let zip: AdmZip
  try {
    zip = new AdmZip(zipPath)
  } catch (err) {
    result.errors.push(`Failed to open ZIP: ${String(err)}`)
    return result
  }

  const entries = zip.getEntries()

  // Phase 1: Parse all entries and match prompts (no file writes yet)
  const parsedEntries: ParsedEntry[] = []

  for (const entry of entries) {
    if (entry.isDirectory) continue

    const originalName = basename(entry.entryName)
    const ext = extname(originalName).toLowerCase()

    if (!MEDIA_EXTENSIONS.has(ext)) continue

    try {
      const parsed = parseFlowEntryName(originalName)
      const matched = matchPrompt?.(parsed.promptText) ?? null
      const buffer = entry.getData()
      parsedEntries.push({ originalName, parsed, matched, buffer })
    } catch (err) {
      const msg = `Failed to parse ${originalName}: ${String(err)}`
      console.error(`[ZipProcessor] ${msg}`)
      result.errors.push(msg)
    }
  }

  // Phase 2: Group by resolved prompt text and propagate TAKE numbers
  // Key = normalized prompt text (from match or from filename parsing)
  const promptGroups = new Map<
    string,
    { takeNumber: number | null; sceneIndex: number | null; entries: ParsedEntry[] }
  >()

  for (const pe of parsedEntries) {
    const promptText = pe.matched?.prompt ?? pe.parsed.promptText
    const groupKey = normalizeForGrouping(promptText)

    let group = promptGroups.get(groupKey)
    if (!group) {
      group = { takeNumber: null, sceneIndex: null, entries: [] }
      promptGroups.set(groupKey, group)
    }

    // Collect TAKE from filename (any entry that has it)
    if (pe.parsed.takeNumber !== null && group.takeNumber === null) {
      group.takeNumber = pe.parsed.takeNumber
    }

    // Collect sceneIndex from matched prompt (any entry that matched)
    if (pe.matched && group.sceneIndex === null) {
      group.sceneIndex = pe.matched.sceneIndex
    }

    group.entries.push(pe)
  }

  // Phase 3: Write files with unified TAKE numbers
  for (const [, group] of promptGroups) {
    for (const pe of group.entries) {
      try {
        const promptText = pe.matched?.prompt ?? pe.parsed.promptText

        // TAKE priority: sceneIndex+1 (project order) > filename TAKE > group propagated TAKE
        let takeNumber: number | null
        if (group.sceneIndex !== null) {
          takeNumber = group.sceneIndex + 1
        } else if (pe.parsed.takeNumber !== null) {
          takeNumber = pe.parsed.takeNumber
        } else {
          takeNumber = group.takeNumber
        }

        const cleanName = buildCleanFilename(
          { takeNumber, promptText, ext: pe.parsed.ext },
          maxPromptLength
        )
        const fullPath = resolveCollision(destDir, cleanName)

        writeFileSync(fullPath, pe.buffer)

        result.extractedFiles.push({
          originalName: pe.originalName,
          cleanName: basename(fullPath),
          fullPath,
          takeNumber
        })

        console.log(`[ZipProcessor] extracted: ${pe.originalName} -> ${basename(fullPath)}`)
      } catch (err) {
        const msg = `Failed to extract ${pe.originalName}: ${String(err)}`
        console.error(`[ZipProcessor] ${msg}`)
        result.errors.push(msg)
      }
    }
  }

  if (deleteZipAfter && result.extractedFiles.length > 0) {
    try {
      unlinkSync(zipPath)
      console.log(`[ZipProcessor] deleted ZIP: ${zipPath}`)
    } catch {
      // Non-critical: ZIP stays on disk
    }
  }

  console.log(
    `[ZipProcessor] done: ${result.extractedFiles.length} files extracted, ${result.errors.length} errors`
  )
  return result
}
