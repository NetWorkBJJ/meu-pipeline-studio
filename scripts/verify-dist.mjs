// scripts/verify-dist.mjs
// Post-build verification: checks that all critical files are present in dist/

import { existsSync, statSync, readdirSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DIST = join(ROOT, 'dist')
const UNPACKED = join(DIST, 'win-unpacked')
const RESOURCES = join(UNPACKED, 'resources')

function formatSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function getDirSize(dirPath) {
  let total = 0
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += getDirSize(full)
      } else {
        total += statSync(full).size
      }
    }
  } catch {
    // silent
  }
  return total
}

const checks = [
  { path: join(UNPACKED, 'workflowaa.exe'), label: 'Executable' },
  { path: join(RESOURCES, 'python', 'python.exe'), label: 'Python embed' },
  { path: join(RESOURCES, 'executions', 'main_bridge.py'), label: 'Python bridge' },
  { path: join(RESOURCES, 'executions', 'capcut_writer.py'), label: 'CapCut writer' },
  { path: join(RESOURCES, 'executions', 'tts_generator.py'), label: 'TTS generator' },
  {
    path: join(RESOURCES, 'executions', 'templates'),
    label: 'Templates dir',
    isDir: true,
    minFiles: 3
  },
  { path: join(RESOURCES, 'veo3-injectors', 'content-bridge.js'), label: 'Veo3 injectors' }
]

console.log('\n[verify-dist] Checking build output...\n')

let allPassed = true

for (const check of checks) {
  if (!existsSync(check.path)) {
    console.log(`  FAIL  ${check.label}: ${check.path}`)
    allPassed = false
    continue
  }

  if (check.isDir && check.minFiles) {
    const files = readdirSync(check.path)
    if (files.length < check.minFiles) {
      console.log(
        `  FAIL  ${check.label}: expected >= ${check.minFiles} files, found ${files.length}`
      )
      allPassed = false
      continue
    }
    console.log(`  OK    ${check.label} (${files.length} files)`)
  } else {
    const size = statSync(check.path).size
    console.log(`  OK    ${check.label} (${formatSize(size)})`)
  }
}

// Find the installer .exe
const installers = existsSync(DIST)
  ? readdirSync(DIST).filter((f) => f.endsWith('-setup.exe'))
  : []

console.log('')

if (installers.length > 0) {
  for (const installer of installers) {
    const size = statSync(join(DIST, installer)).size
    console.log(`  Installer: ${installer} (${formatSize(size)})`)
  }
} else {
  console.log('  WARN  No installer .exe found in dist/')
}

const unpackedSize = getDirSize(UNPACKED)
console.log(`  Unpacked:  ${formatSize(unpackedSize)}`)

console.log('')

if (allPassed) {
  console.log('[verify-dist] Build OK - all checks passed\n')
} else {
  console.error('[verify-dist] Build FAILED - some checks did not pass\n')
  process.exit(1)
}
