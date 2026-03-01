import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchElectron, clearStateAndReload } from './helpers'

let electronApp: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const app = await launchElectron()
  electronApp = app.electronApp
  page = app.page
  await clearStateAndReload(page)
})

test.afterAll(async () => {
  if (electronApp) await electronApp.close()
})

test('settings sections are present', async () => {
  const settingsBtn = page.locator('button[title="Configuracoes"]').first()
  await expect(settingsBtn).toBeVisible({ timeout: 10_000 })
  await settingsBtn.click()
  await page.waitForTimeout(800)

  // Check main sections
  const capcutSection = page.locator('text=Projeto CapCut')
  await expect(capcutSection).toBeVisible({ timeout: 5_000 })

  await page.screenshot({ path: 'e2e/screenshots/settings-01-sections.png' })

  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
})

test('about section shows app name and version', async () => {
  const settingsBtn = page.locator('button[title="Configuracoes"]').first()
  await settingsBtn.click()
  await page.waitForTimeout(800)

  const aboutText = page.locator('text=MEU PIPELINE STUDIO')
  await expect(aboutText.first()).toBeVisible({ timeout: 5_000 })

  const version = page.locator('text=v0.1')
  await expect(version.first()).toBeVisible()

  await page.screenshot({ path: 'e2e/screenshots/settings-02-about.png' })

  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
})

test('settings modal closes on escape', async () => {
  const settingsBtn = page.locator('button[title="Configuracoes"]').first()
  await settingsBtn.click()
  await page.waitForTimeout(800)

  const settingsTitle = page.locator('h2', { hasText: 'Configuracoes' })
  await expect(settingsTitle).toBeVisible({ timeout: 5_000 })

  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)

  await expect(settingsTitle).not.toBeVisible()
  await page.screenshot({ path: 'e2e/screenshots/settings-03-closed.png' })
})
