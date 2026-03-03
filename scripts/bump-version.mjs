// scripts/bump-version.mjs
// Auto-increments patch version in package.json.
// Idempotent: skips if the last commit was already a version bump.

import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PKG_PATH = resolve(__dirname, '..', 'package.json')

// Check if last commit was a version bump (prevent infinite CI loop)
try {
  const lastMsg = execSync('git log -1 --pretty=%s', { encoding: 'utf-8' }).trim()
  if (lastMsg.startsWith('chore: bump version to')) {
    console.log(`[bump-version] Last commit was a version bump ("${lastMsg}"). Skipping.`)
    process.exit(0)
  }
} catch {
  // Not in a git repo or no commits - continue with bump
}

const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'))
const [major, minor, patch] = pkg.version.split('.').map(Number)
const newVersion = `${major}.${minor}.${patch + 1}`

pkg.version = newVersion
writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')

console.log(`[bump-version] ${major}.${minor}.${patch} -> ${newVersion}`)
