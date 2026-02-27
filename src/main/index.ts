import { app, shell, BrowserWindow, session } from 'electron'
import { join, extname, basename } from 'path'
import { existsSync, mkdirSync } from 'fs'
import icon from '../../resources/icon.png?asset'
import { startPythonBridge, stopPythonBridge } from './python/bridge'
import { registerAllHandlers } from './ipc/handlers'
import { loadPersistedDownloadPath } from './ipc/veo3.handlers'
import { buildDownloadFilename } from './utils/downloadFilename'

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
  console.log('[Veo3Download] === will-download fired ===')
  console.log('[Veo3Download] originalFilename:', item.getFilename())
  console.log('[Veo3Download] url:', item.getURL()?.slice(0, 200))
  console.log('[Veo3Download] mimeType:', item.getMimeType())
  console.log('[Veo3Download] totalBytes:', item.getTotalBytes())
  console.log('[Veo3Download] downloadPath:', veo3DownloadPath)

  if (!existsSync(veo3DownloadPath)) {
    mkdirSync(veo3DownloadPath, { recursive: true })
  }

  const originalFilename = item.getFilename()
  const filename = buildDownloadFilename(originalFilename, 50)
  console.log('[Veo3Download] sanitized filename:', filename)

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

  console.log('[Veo3Download] final savePath:', savePath)
  item.setSavePath(savePath)

  item.on('updated', (_e, state) => {
    if (state === 'progressing') {
      const received = item.getReceivedBytes()
      const total = item.getTotalBytes()
      const pct = total > 0 ? Math.round((received / total) * 100) : 0
      console.log(`[Veo3Download] progress: ${pct}% (${received}/${total})`)
    }
  })

  item.on('done', (_e, state) => {
    console.log('[Veo3Download] done:', state, 'path:', savePath)
    if (state === 'completed' && mainWindow) {
      mainWindow.webContents.send('veo3:download-complete', {
        path: savePath,
        filename: basename(savePath),
        originalFilename,
        folder: veo3DownloadPath
      })
    }
  })
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
