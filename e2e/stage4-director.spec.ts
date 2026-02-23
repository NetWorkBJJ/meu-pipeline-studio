import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'

const ROOT = path.join(__dirname, '..')
const SCREENSHOT_DIR = 'e2e/screenshots/stage4'

let electronApp: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const electronPath = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')

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
  await page.waitForTimeout(2000)
})

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close()
  }
})

test('Stage 4 Director: navega ate o projeto Theo 2 e testa a fase de Direcao', async () => {
  // ====================================================================
  // NAVIGATION: Workspace Selector -> Project Dashboard -> Pipeline
  // ====================================================================

  // --- Open workspace "Anderson Testando" ---
  const workspaceCard = page.locator('text=Anderson Testando')
  await expect(workspaceCard).toBeVisible({ timeout: 10_000 })
  await workspaceCard.click()
  await page.waitForTimeout(1500)

  // --- Verify ProjectDashboard loaded ---
  await expect(page.locator('button', { hasText: 'Novo Projeto' })).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: `${SCREENSHOT_DIR}/01-project-dashboard.png` })
  await page.waitForTimeout(500)

  // --- Open "Theo 2" project ---
  const theoCard = page.locator('text=Theo 2').first()
  await expect(theoCard).toBeVisible()
  await theoCard.click()
  await page.waitForTimeout(2000)

  // --- Verify PipelineWorkspace loaded ---
  const stageLabel = page.locator('text=Direcao')
  await expect(stageLabel).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: `${SCREENSHOT_DIR}/02-pipeline-loaded.png` })

  // Wait for project data to load via Python bridge.
  // If it doesn't load in time, enable free navigation manually via Zustand.
  const stage4Btn = page.locator('button[title="Planejar cenas, gerar prompts e importar midias"]')
  await expect(stage4Btn).toBeVisible()

  // Try waiting for Python bridge to enable free navigation naturally
  try {
    await expect(stage4Btn).toBeEnabled({ timeout: 8_000 })
  } catch {
    // Python bridge didn't load data in time - enable free navigation + projectLoaded via Zustand
    await page.evaluate(() => {
      const stores = (window as unknown as Record<string, unknown>).__ZUSTAND_STORES__ as {
        stageStore: { getState: () => { setFreeNavigation: (v: boolean) => void } }
        projectStore: { setState: (partial: Record<string, unknown>) => void }
      }
      stores.stageStore.getState().setFreeNavigation(true)
      stores.projectStore.setState({ projectLoaded: true })
    })
    await page.waitForTimeout(500)
  }

  // Now click Stage 4
  await stage4Btn.click()
  await page.waitForTimeout(1000)

  // ====================================================================
  // STAGE 4: Verify Director UI
  // ====================================================================

  // Verify Stage 4 content appeared
  const directorTitle = page.locator('text=Direcao de Cenas')
  await expect(directorTitle).toBeVisible({ timeout: 5_000 })

  const directorSubtitle = page.locator('text=Configure, planeje cenas, gere prompts e importe midias.')
  await expect(directorSubtitle).toBeVisible()

  await page.screenshot({ path: `${SCREENSHOT_DIR}/03-stage4-entered.png` })
  await page.waitForTimeout(800)

  // ====================================================================
  // CHECK: Existing videos banner (Theo 2 may have videos)
  // ====================================================================
  const videoBanner = page.locator('text=videos ja existem na timeline')
  const hasBanner = await videoBanner.isVisible().catch(() => false)

  if (hasBanner) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-existing-videos-banner.png` })
    await page.waitForTimeout(800)

    // Verify the "keep existing videos" button
    const keepBtn = page.locator('button', { hasText: 'Manter videos existentes' })
    await expect(keepBtn).toBeVisible()
  }

  // ====================================================================
  // STEP 0: DirectorConfigPanel (Configuracao)
  // ====================================================================

  // Verify the DirectorStepper is visible with all 4 sub-steps
  const stepConfig = page.getByRole('button', { name: 'Configuracao', exact: true })
  const stepPlanning = page.getByRole('button', { name: 'Planejamento', exact: true })
  const stepPrompts = page.getByRole('button', { name: 'Prompts', exact: true })
  const stepImport = page.getByRole('button', { name: 'Importacao', exact: true })

  await expect(stepConfig).toBeVisible()
  await expect(stepPlanning).toBeVisible()
  await expect(stepPrompts).toBeVisible()
  await expect(stepImport).toBeVisible()

  // Verify ConfigPanel sections
  await expect(page.locator('text=Modo de sequencia')).toBeVisible()
  await expect(page.locator('text=Regras de timing')).toBeVisible()
  await expect(page.locator('text=Provedor LLM')).toBeVisible()
  await expect(page.locator('text=Personagens (Character Anchors)')).toBeVisible()

  await page.screenshot({ path: `${SCREENSHOT_DIR}/05-config-panel.png` })
  await page.waitForTimeout(500)

  // --- Test sequence mode selection ---
  const imgModeBtn = page.locator('button', { hasText: 'So imagens' })
  await imgModeBtn.click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SCREENSHOT_DIR}/06-mode-so-imagens.png` })

  const altModeBtn = page.locator('button', { hasText: 'Intercalado' })
  await altModeBtn.click()
  await page.waitForTimeout(400)

  const aiModeBtn = page.locator('button', { hasText: 'IA decide' })
  await aiModeBtn.click()
  await page.waitForTimeout(400)

  const videoModeBtn = page.locator('button', { hasText: 'So videos' })
  await videoModeBtn.click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SCREENSHOT_DIR}/07-mode-so-videos.png` })

  // --- Verify timing inputs ---
  await expect(page.locator('text=Videos (VO3)')).toBeVisible()
  await expect(page.locator('text=Imagens (Nano Banana)')).toBeVisible()

  // --- Check LLM provider section ---
  const llmSelect = page.locator('select').first()
  await expect(llmSelect).toBeVisible()

  // Check LLM status indicator (at least one provider shows status)
  const llmStatus = page.locator('text=Conectado').or(page.locator('text=Nao instalado')).first()
  await expect(llmStatus).toBeVisible({ timeout: 5_000 })

  await page.screenshot({ path: `${SCREENSHOT_DIR}/08-llm-status.png` })
  await page.waitForTimeout(500)

  // --- Click "Confirmar configuracao" to move to Step 1 ---
  const confirmConfigBtn = page.locator('button', { hasText: 'Confirmar configuracao' })
  await expect(confirmConfigBtn).toBeVisible()
  await confirmConfigBtn.click()
  await page.waitForTimeout(800)

  // ====================================================================
  // STEP 1: ScenePlannerPanel (Planejamento) - observe UI
  // ====================================================================

  // After confirming config, we should be on the Planejamento step
  await page.screenshot({ path: `${SCREENSHOT_DIR}/09-planner-panel.png` })
  await page.waitForTimeout(500)

  // ====================================================================
  // NAVIGATE: Go back to Configuracao (always accessible)
  // ====================================================================

  await stepConfig.click()
  await page.waitForTimeout(600)
  await expect(page.locator('text=Modo de sequencia')).toBeVisible()
  await page.screenshot({ path: `${SCREENSHOT_DIR}/10-back-to-config.png` })

  // ====================================================================
  // NAVIGATE: Switch between main stages
  // ====================================================================

  // Click Stage 1 (Roteiro)
  const stage1Btn = page.locator('button[title="Transformar o roteiro em blocos de legenda"]')
  await stage1Btn.click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${SCREENSHOT_DIR}/11-switched-to-stage1.png` })

  // Come back to Stage 4
  await stage4Btn.click()
  await page.waitForTimeout(800)
  await expect(directorTitle).toBeVisible()
  await page.screenshot({ path: `${SCREENSHOT_DIR}/12-back-to-stage4.png` })
})
