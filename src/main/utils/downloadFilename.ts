import { extname } from 'path'

const WINDOWS_ILLEGAL_CHARS = /[<>:"/\\|?*]/g

/**
 * Remove characters that are illegal in Windows filenames.
 * Replaces newlines with spaces, collapses multiple spaces.
 */
export function sanitizeForFilesystem(text: string): string {
  return text
    .replace(/[\r\n]+/g, ' ')
    .replace(WINDOWS_ILLEGAL_CHARS, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Build a sanitized download filename from the original.
 * Attempts Flow-aware parsing first (Take prefix, hex hash removal, underscore→space).
 * Falls back to plain sanitization for non-Flow filenames.
 */
export function buildDownloadFilename(originalFilename: string, maxPromptLength = 50): string {
  const parsed = parseFlowEntryName(originalFilename)
  const isFlowFormat = parsed.takeNumber !== null || looksLikeFlowName(originalFilename)

  if (isFlowFormat && parsed.promptText.length > 0) {
    return buildCleanFilename(parsed, maxPromptLength)
  }

  // Fallback: plain sanitize (for generic names like "video.mp4")
  const ext = extname(originalFilename)
  const nameWithoutExt = originalFilename.slice(0, originalFilename.length - ext.length)

  let sanitized = sanitizeForFilesystem(nameWithoutExt)

  if (sanitized.length > maxPromptLength) {
    sanitized = sanitized.slice(0, maxPromptLength).replace(/[\s.]+$/, '')
  }

  if (sanitized.length === 0) {
    sanitized = `download_${Date.now()}`
  }

  return sanitized + ext
}

/**
 * Heuristic to detect Google Flow filenames.
 * Flow names use underscores as word separators and end with a hex hash suffix.
 */
function looksLikeFlowName(filename: string): boolean {
  const ext = extname(filename)
  const base = filename.slice(0, filename.length - ext.length)
  return /_/.test(base) && /_[a-f0-9]{4,}$/i.test(base)
}

/**
 * Extract the TAKE number from a filename.
 * Matches patterns like "(TAKE 400)", "(TAKE 1)", etc.
 * Returns the number or null if not found.
 */
export function extractTakeNumber(filename: string): number | null {
  const match = filename.match(/\(TAKE\s+(\d+)\)/i)
  return match ? parseInt(match[1], 10) : null
}

export interface FlowEntryParsed {
  takeNumber: number | null
  promptText: string
  ext: string
}

/**
 * Parse a Google Flow ZIP entry filename into structured data.
 * Google Flow names look like:
 *   "Take_11extreme_closeup_of_wine_3de60.mp4"
 *   "Brothers_face_midsentence_05f80.mp4"
 *   "Womans_profile_to_mans_silhouet_4f03.mp4"
 *
 * Convention: underscore-separated words, optional "Take_N" prefix,
 * trailing hex hash before extension.
 */
export function parseFlowEntryName(filename: string): FlowEntryParsed {
  const ext = extname(filename)
  let base = filename.slice(0, filename.length - ext.length)

  // Remove trailing hash suffix: _HEX (4+ hex chars at end)
  base = base.replace(/_[a-f0-9]{4,}$/i, '')

  // Detect Take prefix in multiple formats:
  // - "Take_N" (Google Flow underscore format)
  // - "(TAKE N)" (our own clean format, in case of re-processing)
  let takeNumber: number | null = null
  const takeMatch = base.match(/^Take_(\d+)/i)
  if (takeMatch) {
    takeNumber = parseInt(takeMatch[1], 10)
    base = base.slice(takeMatch[0].length)
  } else {
    const takeParenMatch = base.match(/^\(TAKE\s+(\d+)\)\s*/i)
    if (takeParenMatch) {
      takeNumber = parseInt(takeParenMatch[1], 10)
      base = base.slice(takeParenMatch[0].length)
    } else {
      // Pattern 3: "TAKE NNNN" (toolbar download format, no parentheses)
      const takeSpaceMatch = base.match(/^TAKE\s+(\d+)$/i)
      if (takeSpaceMatch) {
        takeNumber = parseInt(takeSpaceMatch[1], 10)
        base = base.slice(takeSpaceMatch[0].length)
      }
    }
  }

  // Replace underscores with spaces, collapse whitespace
  const promptText = base
    .replace(/_+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return { takeNumber, promptText, ext }
}

/**
 * Build a clean filename from parsed Flow entry data.
 * With take:    "(TAKE 11) extreme closeup of wine.mp4"
 * Without take: "Brothers face midsentence.mp4"
 * Truncates promptText portion to maxLength chars.
 */
export function buildCleanFilename(
  parsed: FlowEntryParsed,
  maxLength = 50
): string {
  let prompt = sanitizeForFilesystem(parsed.promptText)

  // Defensive: strip any existing "(TAKE N)" from prompt to prevent duplication
  prompt = prompt.replace(/^\(TAKE\s+\d+\)\s*/i, '').trim()

  if (prompt.length > maxLength) {
    prompt = prompt.slice(0, maxLength).replace(/[\s.]+$/, '')
  }

  if (parsed.takeNumber !== null) {
    const prefix = `(TAKE ${parsed.takeNumber}) `
    // Ensure total name (prefix + prompt) doesn't exceed a reasonable length
    const availableLength = Math.max(maxLength - prefix.length, 10)
    if (prompt.length > availableLength) {
      prompt = prompt.slice(0, availableLength).replace(/[\s.]+$/, '')
    }
    return prompt.length > 0
      ? `${prefix}${prompt}${parsed.ext}`
      : `${prefix.trim()}${parsed.ext}`
  }

  if (prompt.length === 0) {
    prompt = `download_${Date.now()}`
  }

  return prompt + parsed.ext
}
