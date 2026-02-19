import { watch, FSWatcher, statSync } from 'fs'
import { BrowserWindow } from 'electron'
import { callPython } from '../python/bridge'

let currentWatcher: FSWatcher | null = null
let currentDraftPath: string | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let lastOurWriteTs = 0

const DEBOUNCE_MS = 800
const OUR_WRITE_GRACE_MS = 2000

export interface DraftChangeSummary {
  draftPath: string
  timestamp: number
  tracks: Array<{
    index: number
    type: string
    segments: number
    duration_ms: number
    name: string
  }>
  subtitleCount: number
}

/**
 * Call this before any Python write operation to suppress the next file change event.
 * The watcher will ignore changes within OUR_WRITE_GRACE_MS of this call.
 */
export function suppressNextChange(): void {
  lastOurWriteTs = Date.now()
}

/**
 * Start watching a draft_content.json file for external changes.
 * Sends 'capcut:project-changed' events to all renderer windows.
 */
export function watchDraft(draftPath: string): void {
  unwatchDraft()

  currentDraftPath = draftPath

  try {
    currentWatcher = watch(draftPath, { persistent: false }, (_eventType) => {
      // Ignore our own writes
      if (Date.now() - lastOurWriteTs < OUR_WRITE_GRACE_MS) {
        return
      }

      // Debounce - CapCut writes in bursts
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      debounceTimer = setTimeout(() => {
        handleExternalChange(draftPath)
      }, DEBOUNCE_MS)
    })

    currentWatcher.on('error', () => {
      unwatchDraft()
    })
  } catch {
    currentWatcher = null
    currentDraftPath = null
  }
}

/**
 * Stop watching the current draft file.
 */
export function unwatchDraft(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (currentWatcher) {
    currentWatcher.close()
    currentWatcher = null
  }
  currentDraftPath = null
}

/**
 * Returns true if currently watching a draft file.
 */
export function isWatching(): boolean {
  return currentWatcher !== null && currentDraftPath !== null
}

async function handleExternalChange(draftPath: string): Promise<void> {
  // Verify file still exists and is accessible
  try {
    statSync(draftPath)
  } catch {
    return
  }

  try {
    const [analyzeResult, subtitles] = await Promise.all([
      callPython('analyze_project', { draft_path: draftPath }) as Promise<{
        tracks: DraftChangeSummary['tracks']
      }>,
      callPython('read_subtitles', { draft_path: draftPath }) as Promise<unknown[]>
    ])

    const summary: DraftChangeSummary = {
      draftPath,
      timestamp: Date.now(),
      tracks: analyzeResult.tracks || [],
      subtitleCount: Array.isArray(subtitles) ? subtitles.length : 0
    }

    // Send to all renderer windows
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('capcut:project-changed', summary)
      }
    }
  } catch {
    // Silent - external change detection is best-effort
  }
}
