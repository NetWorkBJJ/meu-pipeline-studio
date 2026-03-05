import { app, shell, BrowserWindow, session, nativeImage } from 'electron'
import { join, extname, basename } from 'path'
import { existsSync, mkdirSync, renameSync } from 'fs'
import { execSync } from 'child_process'
import iconIco from '../../resources/icon.ico?asset'
import iconPng from '../../resources/icon.png?asset'
import { startPythonBridge, stopPythonBridge } from './python/bridge'
import { registerAllHandlers } from './ipc/handlers'
import { loadPersistedDownloadPath } from './ipc/veo3.handlers'
import {
  buildDownloadFilename,
  parseFlowEntryName,
  buildCleanFilename
} from './utils/downloadFilename'
import { processVeo3Zip } from './utils/zipProcessor'
import { setupAutoUpdater } from './updater'

let mainWindow: BrowserWindow | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

const VEO3_DOMAINS = [
  'labs.google',
  'accounts.google.com',
  'accounts.youtube.com',
  'myaccount.google.com'
]

// Global download path for VEO3 (can be overridden via IPC)
// Initialized lazily in app.whenReady() because app.getPath() is not available at module load
let veo3DownloadPath = ''

export function getVeo3DownloadPath(): string {
  return veo3DownloadPath
}

export function setVeo3DownloadPath(p: string): void {
  veo3DownloadPath = p
}

// --- Prompt queue: maps submitted prompts + scene index to downloads ---
export interface TrackedPrompt {
  prompt: string
  sceneIndex: number
}

const submittedPrompts: TrackedPrompt[] = []
const MAX_PROMPT_QUEUE = 5000
let autoSceneCounter = 0

export function trackSubmittedPrompt(prompt: string, sceneIndex?: number): void {
  // Avoid duplicates (renderer may re-sync on mount)
  if (submittedPrompts.some((p) => p.prompt === prompt)) return
  const idx = sceneIndex ?? autoSceneCounter++
  submittedPrompts.push({ prompt, sceneIndex: idx })
  console.log(
    `[PromptQueue] Tracked prompt #${idx} (${submittedPrompts.length} total): "${prompt.substring(0, 60)}..."`
  )
  if (submittedPrompts.length > MAX_PROMPT_QUEUE) {
    submittedPrompts.splice(0, submittedPrompts.length - MAX_PROMPT_QUEUE)
  }
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'shall', 'can',
  'not', 'no', 'nor', 'so', 'if', 'then', 'than', 'that', 'this',
  'these', 'those', 'it', 'its', 'he', 'she', 'his', 'her', 'their',
  'our', 'your', 'my', 'up', 'out', 'off', 'over', 'under', 'into'
])

function filterContentWords(words: string[]): string[] {
  return words.filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
}

function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Match a parsed download filename against submitted prompts.
 * Google Flow may truncate, summarize, or reorder prompt text in filenames.
 * Uses multiple strategies: prefix, substring, word overlap.
 * Returns the tracked prompt (with sceneIndex) if matched, null otherwise.
 */
export function matchPromptForFilename(parsedPromptText: string): TrackedPrompt | null {
  if (submittedPrompts.length === 0) {
    console.log('[PromptMatch] Queue empty - no prompts tracked')
    return null
  }

  const normalized = normalizeForMatching(parsedPromptText)
  if (!normalized || normalized.length < 3) return null

  console.log(`[PromptMatch] Matching "${normalized}" against ${submittedPrompts.length} prompts`)

  // Prepare filename words: content words for scoring, all words as fallback
  const allNameWords = normalized.split(' ').filter((w) => w.length >= 2)
  const nameContentWords = filterContentWords(allNameWords)
  // Use content words if enough are available (>= 2), otherwise fall back to all words
  const nameWords = nameContentWords.length >= 2 ? nameContentWords : allNameWords

  let bestMatch: TrackedPrompt | null = null
  let bestScore = 0

  for (const tracked of submittedPrompts) {
    const normalizedPrompt = normalizeForMatching(tracked.prompt)

    // Strategy 1: exact prefix match (prompt starts with filename text)
    if (normalizedPrompt.startsWith(normalized)) {
      console.log(`[PromptMatch] Prefix match found (scene ${tracked.sceneIndex})`)
      return tracked
    }

    // Strategy 2: prefix without leading article
    const withoutArticle = normalizedPrompt.replace(/^(a|an|the)\s+/, '')
    if (withoutArticle.startsWith(normalized)) {
      console.log(`[PromptMatch] Prefix match (no article) found (scene ${tracked.sceneIndex})`)
      return tracked
    }

    // Strategy 3: filename is a substring of the prompt
    if (normalizedPrompt.includes(normalized)) {
      console.log(`[PromptMatch] Substring match found (scene ${tracked.sceneIndex})`)
      return tracked
    }

    // Strategy 4: word overlap scoring with stop word filtering
    const promptContentWords = new Set(
      filterContentWords(normalizedPrompt.split(' ').filter((w) => w.length >= 2))
    )
    let matchCount = 0
    for (const word of nameWords) {
      if (promptContentWords.has(word)) matchCount++
    }
    const score = nameWords.length > 0 ? matchCount / nameWords.length : 0
    if (score > bestScore) {
      bestScore = score
      bestMatch = tracked
    }
  }

  // Dynamic threshold: lower for short filenames (fewer content words = less data to match)
  const threshold = nameContentWords.length <= 3 ? 0.5 : 0.55

  if (bestScore >= threshold && bestMatch) {
    console.log(
      `[PromptMatch] Word overlap match (${Math.round(bestScore * 100)}%, scene ${bestMatch.sceneIndex}, threshold ${Math.round(threshold * 100)}%)`
    )
    return bestMatch
  }

  console.log(`[PromptMatch] No match found (best score: ${Math.round(bestScore * 100)}%, threshold: ${Math.round(threshold * 100)}%)`)
  return null
}

/**
 * Build the best possible filename for a download.
 * Tries to match against submitted prompts for full prompt text + sceneIndex,
 * falls back to Flow-parsed filename.
 * TAKE priority: sceneIndex (from project) > filename Take_N > fallback
 */
function buildBestFilename(
  suggestedFilename: string,
  maxPromptLength: number
): string {
  const parsed = parseFlowEntryName(suggestedFilename)
  console.log(`[Download] suggestedFilename: "${suggestedFilename}"`)
  console.log(`[Download] parsed promptText: "${parsed.promptText}", take: ${parsed.takeNumber}`)

  const matched = matchPromptForFilename(parsed.promptText)

  if (matched) {
    // Use sceneIndex+1 as TAKE (project order), fall back to filename TAKE
    const takeNumber = matched.sceneIndex + 1
    const result = buildCleanFilename(
      { takeNumber, promptText: matched.prompt, ext: parsed.ext },
      maxPromptLength
    )
    console.log(`[Download] -> matched scene ${matched.sceneIndex}! Final: "${result}"`)
    return result
  }

  const fallback = buildDownloadFilename(suggestedFilename, maxPromptLength)
  console.log(`[Download] -> no match, fallback: "${fallback}"`)
  return fallback
}

/**
 * Read download context captured by content-bridge's click interceptor.
 * Returns the prompt text from the gallery tile where download was clicked.
 * Uses CDP evaluate to read window.__veo3_downloadContexts[] (FIFO queue).
 */
async function readDownloadContextFromPage(): Promise<string | null> {
  try {
    const { cdpCore } = await import('./veo3/cdp-core')
    if (!cdpCore.isAttached()) return null

    const result = await cdpCore.evaluate<{ prompt: string; timestamp: number } | null>(`
      (() => {
        const q = window.__veo3_downloadContexts;
        if (!q || q.length === 0) return null;
        return q.shift();
      })()
    `)

    if (result && result.prompt && Date.now() - result.timestamp < 30000) {
      console.log(`[Download] CDP context: "${result.prompt.substring(0, 80)}..."`)
      return result.prompt
    }
    return null
  } catch {
    return null
  }
}

function resolveFileCollision(dir: string, filename: string): string {
  let fullPath = join(dir, filename)
  if (!existsSync(fullPath)) return fullPath
  const ext = extname(filename)
  const base = basename(filename, ext)
  let version = 2
  while (existsSync(join(dir, `${base}_v${version}${ext}`))) {
    version++
  }
  return join(dir, `${base}_v${version}${ext}`)
}

function createWindow(): void {
  const iconFile = process.platform === 'win32' ? iconIco : iconPng
  const appIcon = nativeImage.createFromPath(iconFile)
  if (appIcon.isEmpty()) {
    console.warn('Failed to load app icon from:', iconFile)
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupWebviewSecurity(): void {
  app.on('web-contents-created', (_event, contents) => {
    // Secure webview: disable node, enable context isolation
    contents.on('will-attach-webview', (_e, webPreferences) => {
      delete webPreferences.preload
      webPreferences.nodeIntegration = false
      webPreferences.nodeIntegrationInSubFrames = false
      webPreferences.contextIsolation = true
    })

    // Intercept new windows only from webview contents (not from main window)
    if (contents.getType() === 'webview') {
      contents.setWindowOpenHandler(({ url }) => {
        const isVeo3Domain = VEO3_DOMAINS.some((d) => url.includes(d))
        if (isVeo3Domain) {
          // Navigate within the webview instead of opening new window
          setImmediate(() => contents.loadURL(url))
        } else {
          shell.openExternal(url)
        }
        return { action: 'deny' }
      })
    }
  })
}

function handleVeo3Download(_event: Electron.Event, item: Electron.DownloadItem): void {
  if (!existsSync(veo3DownloadPath)) {
    mkdirSync(veo3DownloadPath, { recursive: true })
  }

  const originalFilename = item.getFilename()

  // First pass: synchronous naming from filename matching (best effort)
  const firstPassName = buildBestFilename(originalFilename, 150)
  const savePath = resolveFileCollision(veo3DownloadPath, firstPassName)

  item.setSavePath(savePath)

  item.on('done', async (_e, state) => {
    if (state !== 'completed' || !mainWindow) return

    const ext = extname(savePath).toLowerCase()
    if (ext === '.zip') {
      const result = processVeo3Zip(savePath, veo3DownloadPath, {
        deleteZipAfter: true,
        maxPromptLength: 150,
        matchPrompt: (text) => matchPromptForFilename(text)
      })
      for (const file of result.extractedFiles) {
        mainWindow.webContents.send('veo3:download-complete', {
          path: file.fullPath,
          filename: file.cleanName,
          originalFilename: file.originalName,
          folder: veo3DownloadPath
        })
      }
      return
    }

    // Second pass: if first pass didn't produce a (TAKE N) name, try CDP context
    let finalPath = savePath
    const hasGoodName = basename(savePath).startsWith('(TAKE ')

    if (!hasGoodName) {
      const contextPrompt = await readDownloadContextFromPage()
      if (contextPrompt) {
        const matched = matchPromptForFilename(contextPrompt)
        if (matched) {
          const betterName = buildCleanFilename(
            { takeNumber: matched.sceneIndex + 1, promptText: matched.prompt, ext: extname(originalFilename) },
            150
          )
          const betterPath = resolveFileCollision(veo3DownloadPath, betterName)
          try {
            renameSync(savePath, betterPath)
            finalPath = betterPath
            console.log(`[Download] CDP rename: "${basename(betterPath)}"`)
          } catch (err) {
            console.error('[Download] CDP rename failed:', err)
          }
        }
      }
    }

    mainWindow.webContents.send('veo3:download-complete', {
      path: finalPath,
      filename: basename(finalPath),
      originalFilename,
      folder: veo3DownloadPath
    })
  })
}

/**
 * Handle a completed CDP-tracked download: rename files and extract ZIPs.
 * Passed as callback to cdp-core's download tracking.
 * Also tries CDP context (from content-bridge interceptor) for better naming.
 */
export async function handleVeo3DownloadComplete(suggestedFilename: string, downloadDir: string): Promise<void> {
  if (!suggestedFilename || !mainWindow) return

  const ext = extname(suggestedFilename).toLowerCase()

  if (ext === '.zip') {
    const zipPath = join(downloadDir, suggestedFilename)
    if (!existsSync(zipPath)) {
      console.error('[DownloadComplete] ZIP not found:', zipPath)
      return
    }

    const result = processVeo3Zip(zipPath, downloadDir, {
      deleteZipAfter: true,
      maxPromptLength: 150,
      matchPrompt: (text) => matchPromptForFilename(text)
    })

    for (const file of result.extractedFiles) {
      mainWindow.webContents.send('veo3:download-complete', {
        path: file.fullPath,
        filename: file.cleanName,
        originalFilename: file.originalName,
        folder: downloadDir
      })
    }
  } else if (['.mp4', '.webm', '.mov', '.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    const currentPath = join(downloadDir, suggestedFilename)
    if (!existsSync(currentPath)) {
      console.log('[DownloadComplete] File not found (likely handled by session):', currentPath)
      return
    }

    // First pass: filename-based matching
    let cleanName = buildBestFilename(suggestedFilename, 150)

    // Second pass: if no (TAKE N), try CDP context
    if (!cleanName.startsWith('(TAKE ')) {
      const contextPrompt = await readDownloadContextFromPage()
      if (contextPrompt) {
        const matched = matchPromptForFilename(contextPrompt)
        if (matched) {
          cleanName = buildCleanFilename(
            { takeNumber: matched.sceneIndex + 1, promptText: matched.prompt, ext: extname(suggestedFilename) },
            150
          )
          console.log(`[DownloadComplete] CDP context matched scene ${matched.sceneIndex}`)
        }
      }
    }

    let finalPath = resolveFileCollision(downloadDir, cleanName)

    if (currentPath !== finalPath) {
      try {
        renameSync(currentPath, finalPath)
      } catch (err) {
        console.error('[DownloadComplete] Rename failed:', err)
        finalPath = currentPath
      }
    }

    mainWindow.webContents.send('veo3:download-complete', {
      path: finalPath,
      filename: basename(finalPath),
      originalFilename: suggestedFilename,
      folder: downloadDir
    })
  }
}

function setupVeo3Downloads(): void {
  for (let i = 1; i <= 5; i++) {
    const accountSession = session.fromPartition(`persist:veo3-account-${i}`)
    accountSession.on('will-download', handleVeo3Download)
  }
}

/**
 * Fix process.env.PATH for GUI-launched apps.
 * When Electron is launched from a shortcut (not terminal), PATH may be incomplete --
 * missing npm global bin, nvm, homebrew, etc. This reads the actual user PATH
 * dynamically (no hardcoded dirs) and merges missing entries.
 */
function fixProcessPath(): void {
  try {
    if (process.platform === 'win32') {
      // Read user-level PATH from Windows Registry (authoritative source)
      const output = execSync('reg query "HKCU\\Environment" /v Path', {
        encoding: 'utf-8',
        timeout: 5000
      })
      const match = output.match(/REG_(?:EXPAND_)?SZ\s+(.+)/i)
      if (match) {
        const userPath = match[1]
          .trim()
          .replace(/%([^%]+)%/g, (_, key: string) => process.env[key] || `%${key}%`)
        const existing = new Set(
          (process.env.PATH || '')
            .split(';')
            .map((p) => p.toLowerCase().replace(/\\$/, ''))
        )
        const missing = userPath
          .split(';')
          .filter((p) => p && !existing.has(p.toLowerCase().replace(/\\$/, '')))
        if (missing.length > 0) {
          process.env.PATH = `${process.env.PATH};${missing.join(';')}`
          console.log(`[PATH] Merged ${missing.length} user PATH entries`)
        }
      }
    } else if (process.platform === 'darwin') {
      // Get full PATH from user's login shell (handles nvm, homebrew, pyenv, etc.)
      const shell = process.env.SHELL || '/bin/zsh'
      const shellPath = execSync(`${shell} -ilc 'echo -n "$PATH"'`, {
        encoding: 'utf-8',
        timeout: 5000
      }).trim()
      if (shellPath && shellPath.length > 0) {
        process.env.PATH = shellPath
        console.log('[PATH] Loaded login shell PATH')
      }
    }
  } catch {
    // Keep existing PATH on any error -- silent fallback
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.workflowaa.app')
  }

  // Fix PATH before spawning any child processes
  fixProcessPath()

  // Initialize download path: use persisted value or default
  const persistedPath = loadPersistedDownloadPath()
  veo3DownloadPath = persistedPath || join(app.getPath('downloads'), 'WorkFlowAA', 'midias')

  setupWebviewSecurity()
  setupVeo3Downloads()
  startPythonBridge()
  registerAllHandlers()
  createWindow()

  if (mainWindow) {
    setupAutoUpdater(mainWindow)
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopPythonBridge()
})
