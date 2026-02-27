import { app, shell, BrowserWindow, session } from 'electron'
import { join, extname, basename } from 'path'
import { existsSync, mkdirSync, renameSync } from 'fs'
import icon from '../../resources/icon.png?asset'
import { startPythonBridge, stopPythonBridge } from './python/bridge'
import { registerAllHandlers } from './ipc/handlers'
import { loadPersistedDownloadPath } from './ipc/veo3.handlers'
import {
  buildDownloadFilename,
  parseFlowEntryName,
  buildCleanFilename
} from './utils/downloadFilename'
import { processVeo3Zip } from './utils/zipProcessor'

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

// --- Prompt queue: maps submitted prompts to downloads ---
const submittedPrompts: string[] = []
const MAX_PROMPT_QUEUE = 200

export function trackSubmittedPrompt(prompt: string): void {
  // Avoid duplicates (renderer may re-sync on mount)
  if (submittedPrompts.includes(prompt)) return
  submittedPrompts.push(prompt)
  console.log(`[PromptQueue] Tracked prompt (${submittedPrompts.length} total): "${prompt.substring(0, 60)}..."`)
  if (submittedPrompts.length > MAX_PROMPT_QUEUE) {
    submittedPrompts.splice(0, submittedPrompts.length - MAX_PROMPT_QUEUE)
  }
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
 * Returns the full prompt if matched, null otherwise.
 */
function matchPromptForFilename(parsedPromptText: string): string | null {
  if (submittedPrompts.length === 0) {
    console.log('[PromptMatch] Queue empty - no prompts tracked')
    return null
  }

  const normalized = normalizeForMatching(parsedPromptText)
  if (!normalized || normalized.length < 3) return null

  console.log(`[PromptMatch] Matching "${normalized}" against ${submittedPrompts.length} prompts`)

  const nameWords = normalized.split(' ').filter((w) => w.length > 1)
  let bestMatch: string | null = null
  let bestScore = 0

  for (const prompt of submittedPrompts) {
    const normalizedPrompt = normalizeForMatching(prompt)

    // Strategy 1: exact prefix match (prompt starts with filename text)
    if (normalizedPrompt.startsWith(normalized)) {
      console.log(`[PromptMatch] Prefix match found`)
      return prompt
    }

    // Strategy 2: prefix without leading article
    const withoutArticle = normalizedPrompt.replace(/^(a|an|the)\s+/, '')
    if (withoutArticle.startsWith(normalized)) {
      console.log(`[PromptMatch] Prefix match (no article) found`)
      return prompt
    }

    // Strategy 3: filename is a substring of the prompt
    if (normalizedPrompt.includes(normalized)) {
      console.log(`[PromptMatch] Substring match found`)
      return prompt
    }

    // Strategy 4: word overlap scoring
    const promptWords = new Set(normalizedPrompt.split(' ').filter((w) => w.length > 1))
    let matchCount = 0
    for (const word of nameWords) {
      if (promptWords.has(word)) matchCount++
    }
    const score = nameWords.length > 0 ? matchCount / nameWords.length : 0
    if (score > bestScore) {
      bestScore = score
      bestMatch = prompt
    }
  }

  // Accept word overlap >= 60%
  if (bestScore >= 0.6 && bestMatch) {
    console.log(`[PromptMatch] Word overlap match (${Math.round(bestScore * 100)}%)`)
    return bestMatch
  }

  console.log(`[PromptMatch] No match found (best score: ${Math.round(bestScore * 100)}%)`)
  return null
}

/**
 * Build the best possible filename for a download.
 * Tries to match against submitted prompts for full prompt text,
 * falls back to Flow-parsed filename.
 */
function buildBestFilename(
  suggestedFilename: string,
  maxPromptLength: number
): string {
  const parsed = parseFlowEntryName(suggestedFilename)
  console.log(`[Download] suggestedFilename: "${suggestedFilename}"`)
  console.log(`[Download] parsed promptText: "${parsed.promptText}", take: ${parsed.takeNumber}`)

  const matchedPrompt = matchPromptForFilename(parsed.promptText)

  if (matchedPrompt) {
    const result = buildCleanFilename(
      { takeNumber: parsed.takeNumber, promptText: matchedPrompt, ext: parsed.ext },
      maxPromptLength
    )
    console.log(`[Download] -> matched! Final: "${result}"`)
    return result
  }

  const fallback = buildDownloadFilename(suggestedFilename, maxPromptLength)
  console.log(`[Download] -> no match, fallback: "${fallback}"`)
  return fallback
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon,
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
  const filename = buildBestFilename(originalFilename, 150)

  let savePath = join(veo3DownloadPath, filename)
  if (existsSync(savePath)) {
    const ext = extname(filename)
    const base = basename(filename, ext)
    let version = 2
    while (existsSync(join(veo3DownloadPath, `${base}_v${version}${ext}`))) {
      version++
    }
    savePath = join(veo3DownloadPath, `${base}_v${version}${ext}`)
  }

  item.setSavePath(savePath)

  item.on('done', (_e, state) => {
    if (state !== 'completed' || !mainWindow) return

    const ext = extname(savePath).toLowerCase()
    if (ext === '.zip') {
      // Extract ZIP, rename contents, notify renderer for each file
      const result = processVeo3Zip(savePath, veo3DownloadPath, {
        deleteZipAfter: true,
        maxPromptLength: 150,
        matchPrompt: matchPromptForFilename
      })
      for (const file of result.extractedFiles) {
        mainWindow.webContents.send('veo3:download-complete', {
          path: file.fullPath,
          filename: file.cleanName,
          originalFilename: file.originalName,
          folder: veo3DownloadPath
        })
      }
    } else {
      // Individual file download
      mainWindow.webContents.send('veo3:download-complete', {
        path: savePath,
        filename: basename(savePath),
        originalFilename,
        folder: veo3DownloadPath
      })
    }
  })
}

/**
 * Handle a completed CDP-tracked download: rename files and extract ZIPs.
 * Passed as callback to cdp-core's download tracking.
 */
export function handleVeo3DownloadComplete(suggestedFilename: string, downloadDir: string): void {
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
      matchPrompt: matchPromptForFilename
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

    const cleanName = buildBestFilename(suggestedFilename, 150)
    let finalPath = join(downloadDir, cleanName)

    if (existsSync(finalPath) && finalPath !== currentPath) {
      const fileExt = extname(cleanName)
      const fileBase = basename(cleanName, fileExt)
      let version = 2
      while (existsSync(join(downloadDir, `${fileBase}_v${version}${fileExt}`))) {
        version++
      }
      finalPath = join(downloadDir, `${fileBase}_v${version}${fileExt}`)
    }

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

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.meupipeline.studio')
  }

  // Initialize download path: use persisted value or default
  const persistedPath = loadPersistedDownloadPath()
  veo3DownloadPath = persistedPath || join(app.getPath('downloads'), 'MeuPipeline', 'midias')

  setupWebviewSecurity()
  setupVeo3Downloads()
  startPythonBridge()
  registerAllHandlers()
  createWindow()

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
