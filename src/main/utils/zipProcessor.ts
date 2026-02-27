import AdmZip from 'adm-zip'
import { existsSync, writeFileSync, unlinkSync } from 'fs'
import { join, extname, basename } from 'path'
import { parseFlowEntryName, buildCleanFilename } from './downloadFilename'

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

/**
 * Extract a Veo3 Flow download ZIP, rename entries using prompt-based naming,
 * and save to destDir. Optionally deletes the ZIP after extraction.
 */
export function processVeo3Zip(
  zipPath: string,
  destDir: string,
  options?: {
    deleteZipAfter?: boolean
    maxPromptLength?: number
    matchPrompt?: (parsedText: string) => string | null
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

  for (const entry of entries) {
    if (entry.isDirectory) continue

    const originalName = basename(entry.entryName)
    const ext = extname(originalName).toLowerCase()

    if (!MEDIA_EXTENSIONS.has(ext)) continue

    try {
      const parsed = parseFlowEntryName(originalName)
      const matched = matchPrompt?.(parsed.promptText)
      const finalParsed = matched
        ? { takeNumber: parsed.takeNumber, promptText: matched, ext: parsed.ext }
        : parsed
      const cleanName = buildCleanFilename(finalParsed, maxPromptLength)
      const fullPath = resolveCollision(destDir, cleanName)
      const buffer = entry.getData()

      writeFileSync(fullPath, buffer)

      result.extractedFiles.push({
        originalName,
        cleanName: basename(fullPath),
        fullPath,
        takeNumber: parsed.takeNumber
      })

      console.log(`[ZipProcessor] extracted: ${originalName} -> ${basename(fullPath)}`)
    } catch (err) {
      const msg = `Failed to extract ${originalName}: ${String(err)}`
      console.error(`[ZipProcessor] ${msg}`)
      result.errors.push(msg)
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
