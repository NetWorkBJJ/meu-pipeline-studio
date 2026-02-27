import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { app, BrowserWindow } from 'electron'
import { appendFile, mkdir } from 'fs/promises'
import { StringDecoder } from 'string_decoder'

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  method: string
  startTime: number
}

let pythonProcess: ChildProcess | null = null
const pendingRequests = new Map<string, PendingRequest>()
let buffer = ''
let logFilePath = ''

async function ensureLogFile(): Promise<void> {
  if (logFilePath) return
  const logDir = join(app.getPath('appData'), 'workflowaa', 'logs')
  await mkdir(logDir, { recursive: true })
  const date = new Date().toISOString().split('T')[0]
  logFilePath = join(logDir, `bridge-node-${date}.log`)
}

async function bridgeLog(level: string, msg: string): Promise<void> {
  const timestamp = new Date().toISOString().split('T')[1]?.slice(0, 8) || ''
  const line = `${timestamp} | ${level.padEnd(5)} | ${msg}\n`
  try {
    await ensureLogFile()
    await appendFile(logFilePath, line, 'utf-8')
  } catch {
    // silent
  }
}

function summarize(obj: unknown, maxLen = 200): string {
  try {
    const s = JSON.stringify(obj)
    return s.length > maxLen ? s.slice(0, maxLen) + '...' : s
  } catch {
    return '[unserializable]'
  }
}

function getPythonPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'python', 'python.exe')
  }
  return 'python'
}

function getScriptPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'executions', 'main_bridge.py')
  }
  return join(app.getAppPath(), 'executions', 'main_bridge.py')
}

export function startPythonBridge(): void {
  if (pythonProcess) return

  const scriptPath = getScriptPath()
  const pythonPath = getPythonPath()

  const env: Record<string, string | undefined> = {
    ...process.env,
    PYTHONUTF8: '1',
    PYTHONDONTWRITEBYTECODE: '1'
  }

  if (app.isPackaged) {
    env.PYTHONPATH = join(process.resourcesPath, 'executions')
  }

  pythonProcess = spawn(pythonPath, [scriptPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: app.isPackaged ? join(process.resourcesPath, 'executions') : undefined,
    env
  })

  bridgeLog(
    'INFO',
    `Python bridge started (python=${pythonPath}, script=${scriptPath}, pid=${pythonProcess.pid})`
  )

  const stdoutDecoder = new StringDecoder('utf8')
  pythonProcess.stdout?.on('data', (data: Buffer) => {
    buffer += stdoutDecoder.write(data)
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const response = JSON.parse(line)

        // Intercept progress side-channel messages (do NOT resolve pending requests)
        if (response.type === 'progress') {
          for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) {
              win.webContents.send('tts:progress', response.data)
            }
          }
          continue
        }

        const pending = pendingRequests.get(response.id)
        if (pending) {
          pendingRequests.delete(response.id)
          const elapsed = Date.now() - pending.startTime
          if (response.error) {
            bridgeLog(
              'ERROR',
              `<<< [${response.id.slice(0, 8)}] ${pending.method} ERROR (${elapsed}ms): ${response.error.message}`
            )
            pending.reject(new Error(response.error.message))
          } else {
            bridgeLog(
              'INFO',
              `<<< [${response.id.slice(0, 8)}] ${pending.method} OK (${elapsed}ms) result=${summarize(response.result)}`
            )
            pending.resolve(response.result)
          }
        }
      } catch {
        console.error('[Python Bridge] Failed to parse:', line)
      }
    }
  })

  const stderrDecoder = new StringDecoder('utf8')
  pythonProcess.stderr?.on('data', (data: Buffer) => {
    const msg = stderrDecoder.write(data).trim()
    if (msg) {
      bridgeLog('WARN', `stderr: ${msg}`)
      console.error('[Python Bridge] stderr:', msg)
    }
  })

  pythonProcess.on('close', (code) => {
    bridgeLog('INFO', `Python bridge exited (code=${code})`)
    console.log('[Python Bridge] Process exited with code', code)
    pythonProcess = null
    for (const [id, pending] of pendingRequests) {
      pending.reject(new Error('Python process terminated'))
      pendingRequests.delete(id)
    }
  })
}

export function stopPythonBridge(): void {
  if (pythonProcess) {
    bridgeLog('INFO', 'Stopping Python bridge')
    pythonProcess.kill()
    pythonProcess = null
  }
}

export function callPython(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!pythonProcess || !pythonProcess.stdin) {
      reject(new Error('Python bridge not started'))
      return
    }

    const id = uuidv4()
    const request = JSON.stringify({ id, method, params }) + '\n'

    bridgeLog('INFO', `>>> [${id.slice(0, 8)}] ${method} params=${summarize(params)}`)
    pendingRequests.set(id, { resolve, reject, method, startTime: Date.now() })
    pythonProcess.stdin.write(request)
  })
}
