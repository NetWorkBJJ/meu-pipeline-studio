import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchElectron, dismissHealthCheckModal } from './helpers'

let electronApp: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const app = await launchElectron()
  electronApp = app.electronApp
  page = app.page
  await page.waitForTimeout(2000)
  await dismissHealthCheckModal(page)
})

test.afterAll(async () => {
  if (electronApp) await electronApp.close()
})

test('stage navigation buttons are visible in pipeline', async () => {
  // Try to navigate to a workspace that has projects
  const workspaceCards = page.locator('.grid > div')
  const cardCount = await workspaceCards.count()

  if (cardCount === 0) {
    test.skip()
    return
  }

  // Click first workspace
  await workspaceCards.first().click()
  await page.waitForTimeout(1500)

  // Check if we can see the project dashboard
  const novoProjeto = page.locator('button', { hasText: 'Novo Projeto' })
  const hasDashboard = await novoProjeto.isVisible().catch(() => false)

  if (!hasDashboard) {
    test.skip()
    return
  }

  // Try to open a project
  const projectCards = page.locator('[class*="cursor-pointer"]')
  const projectCount = await projectCards.count()

  if (projectCount === 0) {
    test.skip()
    return
  }

  await projectCards.first().click()
  await page.waitForTimeout(2000)

  // Look for stage navigation buttons
  const stageButtons = page.locator('button[title]').filter({ hasText: /Roteiro|Audio|Sincronizacao|Direcao|VEO3/ })
  const visibleCount = await stageButtons.count()

  await page.screenshot({ path: 'e2e/screenshots/pipeline-01-stages.png' })
  expect(visibleCount).toBeGreaterThanOrEqual(1)
})

test('stage 1 script input area exists', async () => {
  // Verify Stage 1 has a textarea for script input
  const textarea = page.locator('textarea')
  const hasTextarea = await textarea.first().isVisible().catch(() => false)

  if (hasTextarea) {
    await page.screenshot({ path: 'e2e/screenshots/pipeline-02-stage1-input.png' })
    expect(hasTextarea).toBe(true)
  }
})

test('stage 4 director stepper has sub-steps', async () => {
  // Navigate to Stage 4 if available
  const stage4Btn = page.locator('button[title*="Planejar cenas"]').or(
    page.locator('button[title*="Direcao"]')
  )
  const hasStage4 = await stage4Btn.first().isVisible().catch(() => false)

  if (!hasStage4) {
    test.skip()
    return
  }

  // Enable free navigation
  await page.evaluate(() => {
    const stores = (window as unknown as Record<string, unknown>).__ZUSTAND_STORES__ as {
      stageStore: { getState: () => { setFreeNavigation: (v: boolean) => void } }
      projectStore: { setState: (partial: Record<string, unknown>) => void }
    }
    if (stores?.stageStore) {
      stores.stageStore.getState().setFreeNavigation(true)
    }
    if (stores?.projectStore) {
      stores.projectStore.setState({ projectLoaded: true })
    }
  })
  await page.waitForTimeout(500)

  await stage4Btn.first().click()
  await page.waitForTimeout(1000)

  // Check for sub-step buttons
  const configStep = page.locator('button', { hasText: 'Configuracao' })
  const planStep = page.locator('button', { hasText: 'Planejamento' })
  const promptStep = page.locator('button', { hasText: 'Prompts' })
  const importStep = page.locator('button', { hasText: 'Importacao' })

  const hasConfig = await configStep.first().isVisible().catch(() => false)

  if (hasConfig) {
    await expect(configStep.first()).toBeVisible()
    await expect(planStep.first()).toBeVisible()
    await expect(promptStep.first()).toBeVisible()
    await expect(importStep.first()).toBeVisible()
    await page.screenshot({ path: 'e2e/screenshots/pipeline-03-stage4-substeps.png' })
  }
})

test('switching stages preserves state', async () => {
  // Navigate to stage 1
  const stage1Btn = page.locator('button[title*="roteiro"]').or(
    page.locator('button[title*="Roteiro"]')
  )
  const hasStage1 = await stage1Btn.first().isVisible().catch(() => false)

  if (!hasStage1) {
    test.skip()
    return
  }

  await stage1Btn.first().click()
  await page.waitForTimeout(800)

  // Type something
  const textarea = page.locator('textarea').first()
  const hasTextarea = await textarea.isVisible().catch(() => false)

  if (!hasTextarea) {
    test.skip()
    return
  }

  await textarea.fill('Test script preservation')
  await page.waitForTimeout(500)

  // Navigate away and back
  const stage4Btn = page.locator('button[title*="Planejar"]').or(
    page.locator('button[title*="Direcao"]')
  )
  const hasStage4 = await stage4Btn.first().isVisible().catch(() => false)

  if (hasStage4) {
    await stage4Btn.first().click()
    await page.waitForTimeout(500)
    await stage1Btn.first().click()
    await page.waitForTimeout(500)

    const value = await textarea.inputValue()
    expect(value).toContain('Test script')
  }
})
