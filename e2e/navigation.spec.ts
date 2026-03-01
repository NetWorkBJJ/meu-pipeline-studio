import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchElectron, clearStateAndReload } from './helpers'

let electronApp: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const app = await launchElectron()
  electronApp = app.electronApp
  page = app.page

  // Start from clean state
  await clearStateAndReload(page)
})

test.afterAll(async () => {
  if (electronApp) await electronApp.close()
})

test('workspace selector renders on fresh start', async () => {
  const title = page.locator('h1', { hasText: 'Pipeline Studio' })
  await expect(title).toBeVisible({ timeout: 10_000 })

  const subtitle = page.locator('text=Pre-edicao automatizada para CapCut')
  await expect(subtitle).toBeVisible()

  const novoBtn = page.locator('button', { hasText: 'Novo Workspace' })
  await expect(novoBtn).toBeVisible()

  await page.screenshot({ path: 'e2e/screenshots/nav-01-workspace-selector.png' })
})

test('settings modal opens and closes', async () => {
  const settingsBtn = page.locator('button[title="Configuracoes"]').first()
  await expect(settingsBtn).toBeVisible()
  await settingsBtn.click()
  await page.waitForTimeout(800)

  const settingsTitle = page.locator('h2', { hasText: 'Configuracoes' })
  await expect(settingsTitle).toBeVisible({ timeout: 5_000 })

  await page.screenshot({ path: 'e2e/screenshots/nav-02-settings-open.png' })

  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  await expect(settingsTitle).not.toBeVisible()
})

test('create workspace modal appears', async () => {
  const novoBtn = page.locator('button', { hasText: 'Novo Workspace' })
  await novoBtn.click()
  await page.waitForTimeout(800)

  // Look for the create workspace modal (Modal component uses h3 for title)
  const modalTitle = page.locator('h3', { hasText: 'Novo Workspace' })
  await expect(modalTitle).toBeVisible({ timeout: 5_000 })

  await page.screenshot({ path: 'e2e/screenshots/nav-03-create-workspace-modal.png' })

  // Close modal
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
})

test('version tag is visible', async () => {
  const version = page.locator('text=v0.1')
  await expect(version.first()).toBeVisible({ timeout: 5_000 })
})

test('escape closes modals', async () => {
  const settingsBtn = page.locator('button[title="Configuracoes"]').first()
  await settingsBtn.click()
  await page.waitForTimeout(800)

  const settingsTitle = page.locator('h2', { hasText: 'Configuracoes' })
  await expect(settingsTitle).toBeVisible({ timeout: 5_000 })

  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  await expect(settingsTitle).not.toBeVisible()
})
