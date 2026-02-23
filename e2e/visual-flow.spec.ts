import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'

const ROOT = path.join(__dirname, '..')

let electronApp: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const electronPath = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')

  // Remove ELECTRON_RUN_AS_NODE inherited from VSCode (which is an Electron app)
  // Without this, electron.exe runs as plain Node.js and require('electron') fails
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE

  electronApp = await _electron.launch({
    executablePath: electronPath,
    args: [path.join(ROOT, 'out', 'main', 'index.js')],
    env,
    timeout: 30_000
  })

  page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  // Clear persisted Zustand state so we always start on WorkspaceSelectorScreen
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(2000)
})

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close()
  }
})

test('Visual E2E: navega workspace selector, settings e dashboard', async () => {
  // --- STEP 1: Verify WorkspaceSelectorScreen ---
  const title = page.locator('h1', { hasText: 'MEU PIPELINE STUDIO' })
  await expect(title).toBeVisible({ timeout: 10_000 })

  const subtitle = page.locator('text=Studio de pre-edicao automatizada para CapCut')
  await expect(subtitle).toBeVisible()

  const novoWorkspaceBtn = page.locator('button', { hasText: 'Novo Workspace' })
  await expect(novoWorkspaceBtn).toBeVisible()

  await page.screenshot({ path: 'e2e/screenshots/01-workspace-selector.png' })
  await page.waitForTimeout(1000)

  // --- STEP 2: Open Settings modal ---
  const settingsBtn = page.locator('button[title="Configuracoes"]').first()
  await expect(settingsBtn).toBeVisible()
  await settingsBtn.click()
  await page.waitForTimeout(800)

  const settingsTitle = page.locator('h2', { hasText: 'Configuracoes' })
  await expect(settingsTitle).toBeVisible({ timeout: 5_000 })

  const capcutSection = page.locator('text=Projeto CapCut')
  await expect(capcutSection).toBeVisible()

  const aboutText = page.locator('text=MEU PIPELINE STUDIO v0.1.0')
  await expect(aboutText).toBeVisible()

  await page.screenshot({ path: 'e2e/screenshots/02-settings-modal.png' })
  await page.waitForTimeout(1000)

  // Close Settings with Escape
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  await expect(settingsTitle).not.toBeVisible()

  // --- STEP 3: Check for existing workspace cards ---
  // WorkspaceCard has an onClick that triggers handleOpenWorkspace.
  // Cards are rendered inside motion.div wrappers with cursor-pointer styling.
  // We look for the workspace card grid items.
  await page.waitForTimeout(500)

  // Try to find any clickable workspace card
  // WorkspaceCard renders a div with onClick, inside a motion.div in the grid
  const workspaceGrid = page.locator('.grid')
  const hasGrid = (await workspaceGrid.count()) > 0
  const gridChildren = hasGrid ? await workspaceGrid.first().locator('> div').count() : 0

  if (gridChildren > 0) {
    // --- PATH A: Workspaces exist - navigate to ProjectDashboard ---
    await page.screenshot({ path: 'e2e/screenshots/03-workspaces-found.png' })
    await page.waitForTimeout(500)

    // Click the first workspace card (the motion.div wrapper triggers onClick on the inner card)
    const firstCard = workspaceGrid.first().locator('> div').first()
    await firstCard.click()
    await page.waitForTimeout(1500)

    // --- STEP 4: Verify ProjectDashboard ---
    const novoProjeto = page.locator('button', { hasText: 'Novo Projeto' })
    await expect(novoProjeto).toBeVisible({ timeout: 10_000 })

    const projetosHeading = page.locator('text=Projetos CapCut')
    await expect(projetosHeading).toBeVisible()

    const searchInput = page.locator('input[placeholder="Buscar projeto..."]')
    await expect(searchInput).toBeVisible()

    // Type in search to demonstrate interactivity
    await searchInput.click()
    await page.waitForTimeout(300)
    await searchInput.fill('teste')
    await page.waitForTimeout(800)
    await searchInput.clear()
    await page.waitForTimeout(500)

    const abrirPasta = page.locator('button', { hasText: 'Abrir Pasta' })
    await expect(abrirPasta).toBeVisible()

    await page.screenshot({ path: 'e2e/screenshots/04-project-dashboard.png' })
    await page.waitForTimeout(1000)

    // Open Settings from dashboard
    const dashSettingsBtn = page.locator('button[title="Configuracoes"]').first()
    await dashSettingsBtn.click()
    await page.waitForTimeout(800)

    const settingsTitle2 = page.locator('h2', { hasText: 'Configuracoes' })
    await expect(settingsTitle2).toBeVisible({ timeout: 5_000 })

    await page.screenshot({ path: 'e2e/screenshots/05-dashboard-settings.png' })

    // Close settings
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)

    // --- STEP 5: Navigate back to WorkspaceSelectorScreen ---
    const backBtn = page.locator('button[title="Voltar aos workspaces"]')
    await expect(backBtn).toBeVisible()
    await backBtn.click()
    await page.waitForTimeout(1000)

    // Verify we're back on workspace selector
    await expect(title).toBeVisible({ timeout: 10_000 })
    await expect(novoWorkspaceBtn).toBeVisible()

    await page.screenshot({ path: 'e2e/screenshots/06-back-to-selector.png' })
  } else {
    // --- PATH B: Empty state ---
    const emptyState = page.locator('text=Nenhum workspace')
    const hasEmpty = await emptyState.isVisible().catch(() => false)

    if (hasEmpty) {
      const createBtn = page.locator('button', { hasText: 'Criar Workspace' })
      await expect(createBtn).toBeVisible()
    }

    await novoWorkspaceBtn.hover()
    await page.waitForTimeout(500)

    await page.screenshot({ path: 'e2e/screenshots/03-empty-state.png' })
  }

  // --- FINAL: Version tag ---
  const versionTag = page.locator('text=v0.1.0')
  await expect(versionTag).toBeVisible()

  await page.screenshot({ path: 'e2e/screenshots/final-state.png' })
})
