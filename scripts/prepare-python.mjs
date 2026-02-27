// scripts/prepare-python.mjs
// Downloads Python Embeddable Package, enables pip, installs requirements.
// Idempotent: skips if already prepared and all imports pass.

import { execSync } from 'child_process'
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  createWriteStream,
  unlinkSync
} from 'fs'
import { join, resolve, dirname } from 'path'
import { get as httpsGet } from 'https'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// --- Configuration ---
const PYTHON_VERSION = '3.12.8'
const PYTHON_MAJOR_MINOR = '312'
const PYTHON_URL = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`
const GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py'

const ROOT = resolve(__dirname, '..')
const TARGET_DIR = join(ROOT, 'resources', 'python-embed')
const PYTHON_EXE = join(TARGET_DIR, 'python.exe')
const PTH_FILE = join(TARGET_DIR, `python${PYTHON_MAJOR_MINOR}._pth`)
const GET_PIP_PATH = join(TARGET_DIR, 'get-pip.py')
const REQUIREMENTS = join(ROOT, 'executions', 'requirements.txt')
const SITE_PACKAGES = join(TARGET_DIR, 'Lib', 'site-packages')

// --- Helpers ---
function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath)
    httpsGet(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close()
        try {
          unlinkSync(destPath)
        } catch {
          /* ignore */
        }
        return download(response.headers.location, destPath).then(resolve).catch(reject)
      }
      if (response.statusCode !== 200) {
        file.close()
        reject(new Error(`HTTP ${response.statusCode} for ${url}`))
        return
      }
      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
      file.on('error', reject)
    }).on('error', reject)
  })
}

function run(cmd, opts = {}) {
  execSync(cmd, {
    cwd: TARGET_DIR,
    stdio: 'inherit',
    env: { ...process.env, PYTHONUTF8: '1' },
    ...opts
  })
}

// --- Main ---
async function main() {
  console.log('[prepare-python] Python Embeddable Package preparation')
  console.log(`[prepare-python] Target: ${TARGET_DIR}`)
  console.log(`[prepare-python] Python version: ${PYTHON_VERSION}`)

  // Step 1: Check if already fully prepared
  if (existsSync(PYTHON_EXE) && existsSync(SITE_PACKAGES)) {
    try {
      execSync(
        `"${PYTHON_EXE}" -c "import google.genai; import requests; import websocket; print('OK')"`,
        { cwd: TARGET_DIR, stdio: 'pipe', env: { ...process.env, PYTHONUTF8: '1' } }
      )
      console.log('[prepare-python] Already prepared -- all dependencies available. Skipping.')
      return
    } catch {
      console.log('[prepare-python] Python exists but dependencies incomplete. Re-installing...')
    }
  }

  // Step 2: Download and extract Python embeddable
  if (!existsSync(PYTHON_EXE)) {
    console.log(`[prepare-python] Downloading Python ${PYTHON_VERSION} embeddable...`)
    mkdirSync(TARGET_DIR, { recursive: true })

    const zipPath = join(TARGET_DIR, 'python-embed.zip')
    await download(PYTHON_URL, zipPath)
    console.log('[prepare-python] Download complete. Extracting...')

    // Use adm-zip (already a project dependency)
    const AdmZip = (await import('adm-zip')).default
    const zip = new AdmZip(zipPath)
    zip.extractAllTo(TARGET_DIR, true)
    unlinkSync(zipPath)
    console.log('[prepare-python] Extraction complete.')
  } else {
    console.log('[prepare-python] Python exe already present, skipping download.')
  }

  // Step 3: Enable import site in ._pth file
  if (existsSync(PTH_FILE)) {
    let pthContent = readFileSync(PTH_FILE, 'utf-8')
    let changed = false

    if (pthContent.includes('#import site')) {
      pthContent = pthContent.replace('#import site', 'import site')
      changed = true
    }

    if (!pthContent.includes('Lib\\site-packages')) {
      pthContent = pthContent.trimEnd() + '\nLib\\site-packages\n'
      changed = true
    }

    if (changed) {
      writeFileSync(PTH_FILE, pthContent, 'utf-8')
      console.log('[prepare-python] Enabled import site + site-packages in ._pth file.')
    } else {
      console.log('[prepare-python] ._pth already configured.')
    }
  } else {
    console.error(`[prepare-python] WARNING: ._pth file not found at ${PTH_FILE}`)
    console.error('[prepare-python] Python embeddable may not have been extracted correctly.')
    process.exit(1)
  }

  // Step 4: Install pip
  const pipModule = join(TARGET_DIR, 'Lib', 'site-packages', 'pip')
  if (!existsSync(pipModule)) {
    console.log('[prepare-python] Downloading get-pip.py...')
    await download(GET_PIP_URL, GET_PIP_PATH)

    console.log('[prepare-python] Installing pip...')
    run(`"${PYTHON_EXE}" "${GET_PIP_PATH}" --no-warn-script-location`)

    if (existsSync(GET_PIP_PATH)) unlinkSync(GET_PIP_PATH)
    console.log('[prepare-python] pip installed successfully.')
  } else {
    console.log('[prepare-python] pip already installed.')
  }

  // Step 5: Install requirements
  console.log('[prepare-python] Installing Python dependencies from requirements.txt...')
  mkdirSync(SITE_PACKAGES, { recursive: true })
  run(
    `"${PYTHON_EXE}" -m pip install --no-warn-script-location --target "${SITE_PACKAGES}" -r "${REQUIREMENTS}"`
  )
  console.log('[prepare-python] Dependencies installed successfully.')

  // Step 6: Verify
  console.log('[prepare-python] Verifying imports...')
  try {
    run(
      `"${PYTHON_EXE}" -c "import google.genai; import requests; import websocket; print('All imports OK')"`,
      { stdio: 'inherit' }
    )
    console.log('[prepare-python] Verification passed.')
  } catch (err) {
    console.error('[prepare-python] Verification FAILED:', err.message)
    process.exit(1)
  }

  console.log('[prepare-python] Done.')
}

main().catch((err) => {
  console.error('[prepare-python] Fatal error:', err)
  process.exit(1)
})
