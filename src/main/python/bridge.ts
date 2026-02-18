import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { app } from 'electron'

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

let pythonProcess: ChildProcess | null = null
const pendingRequests = new Map<string, PendingRequest>()
let buffer = ''

function getPythonPath(): string {
  return 'python'
}

function getScriptPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'python', 'main_bridge.py')
  }
  return join(app.getAppPath(), 'python', 'main_bridge.py')
}

export function startPythonBridge(): void {
  if (pythonProcess) return

  const scriptPath = getScriptPath()
  pythonProcess = spawn(getPythonPath(), [scriptPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  })

  pythonProcess.stdout?.on('data', (data: Buffer) => {
    buffer += data.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const response = JSON.parse(line)
        const pending = pendingRequests.get(response.id)
        if (pending) {
          pendingRequests.delete(response.id)
          if (response.error) {
            pending.reject(new Error(response.error.message))
          } else {
            pending.resolve(response.result)
          }
        }
      } catch {
        console.error('[Python Bridge] Failed to parse:', line)
      }
    }
  })

  pythonProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[Python Bridge] stderr:', data.toString())
  })

  pythonProcess.on('close', (code) => {
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

    pendingRequests.set(id, { resolve, reject })
    pythonProcess.stdin.write(request)
  })
}
