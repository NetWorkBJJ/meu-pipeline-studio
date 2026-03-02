// scripts/prepare-python-mac.mjs
// Installs Python dependencies into a target directory for macOS bundling.
// Uses pip --target (no venv, no symlinks) to avoid codesign issues.
// Idempotent: skips if already prepared and all imports pass.

import { execSync } from 'child_process'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// --- Configuration ---
const ROOT = resolve(__dirname, '..')
const TARGET_DIR = join(ROOT, 'resources', 'python-embed')
const SITE_PACKAGES = join(TARGET_DIR, 'site-packages')
const REQUIREMENTS = join(ROOT, 'executions', 'requirements.txt')

// --- Helpers ---
function run(cmd, opts = {}) {
  console.log(`[prepare-python-mac] $ ${cmd}`)
  execSync(cmd, {
    stdio: 'inherit',
    env: { ...process.env, PYTHONUTF8: '1' },
    ...opts
  })
}

function findSystemPython() {
  try {
    const p = execSync('which python3', { encoding: 'utf-8' }).trim()
    if (p && existsSync(p)) return p
  } catch { /* ignore */ }

  const knownPaths = [
    '/Library/Frameworks/Python.framework/Versions/Current/bin/python3',
    '/usr/local/bin/python3',
    '/opt/homebrew/bin/python3',
    '/usr/bin/python3'
  ]
  for (const p of knownPaths) {
    if (existsSync(p)) return p
  }
  return null
}

// --- Main ---
async function main() {
  console.log('[prepare-python-mac] Python deps preparation for macOS (no venv, no symlinks)')
  console.log(`[prepare-python-mac] Target: ${SITE_PACKAGES}`)

  if (process.platform !== 'darwin') {
    console.log('[prepare-python-mac] Not on macOS, skipping.')
    return
  }

  // Step 1: Find system Python
  const systemPython = findSystemPython()
  if (!systemPython) {
    console.error('[prepare-python-mac] ERROR: python3 not found on this system.')
    console.error('[prepare-python-mac] Install Python 3.10+ from python.org or via Homebrew.')
    process.exit(1)
  }

  const version = execSync(`"${systemPython}" --version`, { encoding: 'utf-8' }).trim()
  console.log(`[prepare-python-mac] System Python: ${systemPython} (${version})`)

  // Step 2: Check if already fully prepared
  if (existsSync(SITE_PACKAGES)) {
    try {
      execSync(
        `"${systemPython}" -c "import sys; sys.path.insert(0, '${SITE_PACKAGES}'); import google.genai; import requests; import websocket; print('OK')"`,
        { stdio: 'pipe', env: { ...process.env, PYTHONUTF8: '1' } }
      )
      console.log('[prepare-python-mac] Already prepared -- all dependencies available. Skipping.')
      return
    } catch {
      console.log('[prepare-python-mac] site-packages exists but incomplete. Re-installing...')
    }
  }

  // Step 3: Clean and create target
  if (existsSync(TARGET_DIR)) {
    rmSync(TARGET_DIR, { recursive: true, force: true })
  }
  mkdirSync(SITE_PACKAGES, { recursive: true })

  // Step 4: Install requirements with --target (pure files, no symlinks)
  console.log('[prepare-python-mac] Installing Python dependencies via pip --target...')
  run(
    `"${systemPython}" -m pip install --target "${SITE_PACKAGES}" -r "${REQUIREMENTS}"`,
    { cwd: ROOT }
  )
  console.log('[prepare-python-mac] Dependencies installed successfully.')

  // Step 5: Remove any .dylib symlinks that could break codesign
  // (cryptography and cffi include compiled .so/.dylib files but they should be real files with --target)
  console.log('[prepare-python-mac] Cleaning up any remaining symlinks...')
  try {
    execSync(`find "${SITE_PACKAGES}" -type l -delete`, { stdio: 'inherit' })
  } catch { /* ignore */ }

  // Step 6: Remove unnecessary files to reduce bundle size
  console.log('[prepare-python-mac] Cleaning up unnecessary files...')
  const cleanupPatterns = [
    '__pycache__',
    '*.pyc',
    '*.pyo',
    '*.dist-info/RECORD',
    'tests',
    'test'
  ]
  for (const pattern of cleanupPatterns) {
    try {
      execSync(`find "${SITE_PACKAGES}" -name "${pattern}" -type d -exec rm -rf {} + 2>/dev/null || true`, { stdio: 'pipe' })
      execSync(`find "${SITE_PACKAGES}" -name "${pattern}" -type f -delete 2>/dev/null || true`, { stdio: 'pipe' })
    } catch { /* ignore cleanup failures */ }
  }

  // Step 7: Verify
  console.log('[prepare-python-mac] Verifying imports...')
  try {
    run(
      `"${systemPython}" -c "import sys; sys.path.insert(0, '${SITE_PACKAGES}'); import google.genai; import requests; import websocket; print('All imports OK')"`,
      { stdio: 'inherit' }
    )
    console.log('[prepare-python-mac] Verification passed.')
  } catch (err) {
    console.error('[prepare-python-mac] Verification FAILED:', err.message)
    process.exit(1)
  }

  console.log('[prepare-python-mac] Done.')
}

main().catch((err) => {
  console.error('[prepare-python-mac] Fatal error:', err)
  process.exit(1)
})
