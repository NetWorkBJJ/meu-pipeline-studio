import { _electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'

const ROOT = path.join(__dirname, '..')

export async function launchElectron(): Promise<{ electronApp: ElectronApplication; page: Page }> {
  const electronExe = process.platform === 'win32' ? 'electron.exe' : 'electron'
  const electronPath = path.join(ROOT, 'node_modules', 'electron', 'dist', electronExe)

  // Remove ELECTRON_RUN_AS_NODE inherited from VSCode
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE

  const electronApp = await _electron.launch({
    executablePath: electronPath,
    args: [path.join(ROOT, 'out', 'main', 'index.js')],
    env,
    timeout: 30_000
  })

  const page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return { electronApp, page }
}

export async function clearStateAndReload(page: Page): Promise<void> {
  // Clear state but pre-set healthCheckDismissed to skip the modal
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('healthCheckDismissed', '0.1.0')
  })
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(2000)
}

/**
 * Dismiss the HealthCheckModal that appears on fresh start.
 * The modal blocks all pointer events. It either auto-closes after 1.5s
 * (all checks pass) or shows a "Continuar mesmo assim" button.
 */
export async function dismissHealthCheckModal(page: Page): Promise<void> {
  // Wait for the modal to appear and health checks to complete
  await page.waitForTimeout(3000)

  // Try clicking "Continuar mesmo assim" if health check has failures
  const continueBtn = page.locator('button', { hasText: 'Continuar mesmo assim' })
  const hasContinueBtn = await continueBtn.isVisible().catch(() => false)
  if (hasContinueBtn) {
    await continueBtn.click()
    await page.waitForTimeout(500)
    return
  }

  // If modal auto-closed (all checks passed), wait a bit more
  await page.waitForTimeout(2000)
}
