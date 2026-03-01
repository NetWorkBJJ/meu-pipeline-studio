import { ipcMain, session } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { callPython } from '../python/bridge'

interface HealthCheckResult {
  python: { ok: boolean; error?: string }
  capcut: { ok: boolean; path?: string }
  capcutProjects: { ok: boolean; path?: string }
}

export function registerSystemHandlers(): void {
  ipcMain.handle('system:health-check', async (): Promise<HealthCheckResult> => {
    const home = homedir()
    const result: HealthCheckResult = {
      python: { ok: false },
      capcut: { ok: false },
      capcutProjects: { ok: false }
    }

    // Check 1: Python bridge alive (5s timeout)
    try {
      const pingResult = await Promise.race([
        callPython('ping', {}),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ])
      if (pingResult && typeof pingResult === 'object' && 'ok' in pingResult) {
        result.python = { ok: true }
      }
    } catch (err) {
      result.python = {
        ok: false,
        error: err instanceof Error ? err.message : 'Python bridge not responding'
      }
    }

    // Check 2: CapCut Desktop installed
    const capCutPath = join(home, 'AppData/Local/CapCut/CapCut.exe')
    if (existsSync(capCutPath)) {
      result.capcut = { ok: true, path: capCutPath }
    } else {
      result.capcut = { ok: false, path: capCutPath }
    }

    // Check 3: CapCut projects directory exists
    const projectsPath = join(
      home,
      'AppData/Local/CapCut/User Data/Projects/com.lveditor.draft'
    )
    if (existsSync(projectsPath)) {
      result.capcutProjects = { ok: true, path: projectsPath }
    } else {
      result.capcutProjects = { ok: false, path: projectsPath }
    }

    return result
  })

  ipcMain.handle('system:clear-cache', async (): Promise<{ success: boolean }> => {
    // Clear all veo3 webview session caches
    for (let i = 1; i <= 5; i++) {
      const sess = session.fromPartition(`persist:veo3-account-${i}`)
      await sess.clearCache()
      await sess.clearStorageData({
        storages: ['cachestorage', 'localstorage', 'sessionstorage']
      })
    }

    // Clear default session cache
    await session.defaultSession.clearCache()

    return { success: true }
  })
}
