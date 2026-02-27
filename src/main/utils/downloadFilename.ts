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
 * Preserves the extension, truncates the name portion to maxPromptLength chars.
 */
export function buildDownloadFilename(originalFilename: string, maxPromptLength = 50): string {
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
 * Extract the TAKE number from a filename.
 * Matches patterns like "(TAKE 400)", "(TAKE 1)", etc.
 * Returns the number or null if not found.
 */
export function extractTakeNumber(filename: string): number | null {
  const match = filename.match(/\(TAKE\s+(\d+)\)/i)
  return match ? parseInt(match[1], 10) : null
}
