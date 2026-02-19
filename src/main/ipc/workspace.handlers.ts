import { ipcMain, app, shell } from 'electron'
import { readFile, writeFile, mkdir, stat, readdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

interface ProjectLink {
  name: string
  capCutPath: string
  linkedAt: string
}

interface WorkspaceRegistryEntry {
  id: string
  name: string
  description: string
  path: string
  createdAt: string
  updatedAt: string
  isDefault: boolean
  lastOpenedAt: string | null
  pinned: boolean
  projectCount: number
  _missing: boolean
}

interface WorkspaceConfig {
  id: string
  name: string
  description: string
  capCutProjectsPath: string
  projects: ProjectLink[]
  mediaPreset: {
    defaultType: 'video' | 'photo'
    defaultDurationMs: number
    transitionMs: number
  }
  recentProjects: Array<{ name: string; path: string; lastOpened: number }>
  pipelineStatuses: Record<string, unknown>
}

function getRegistryPath(): string {
  return join(app.getPath('appData'), 'meu-pipeline-studio', 'workspace-registry.json')
}

function getDefaultCapCutPath(): string {
  const localAppData = process.env.LOCALAPPDATA || ''
  return `${localAppData}/CapCut/User Data/Projects/com.lveditor.draft`.replace(/\\/g, '/')
}

function normalizePath(p: string): string {
  return p ? p.replace(/\\/g, '/').replace(/\/$/, '') : ''
}

async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true })
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

async function readRegistry(): Promise<WorkspaceRegistryEntry[]> {
  const registryPath = getRegistryPath()
  try {
    const data = await readFile(registryPath, 'utf-8')
    return JSON.parse(data) as WorkspaceRegistryEntry[]
  } catch {
    return []
  }
}

async function writeRegistry(entries: WorkspaceRegistryEntry[]): Promise<void> {
  const registryPath = getRegistryPath()
  await ensureDir(join(app.getPath('appData'), 'meu-pipeline-studio'))
  await writeFile(registryPath, JSON.stringify(entries, null, 2), 'utf-8')
}

async function readWorkspaceConfig(workspacePath: string): Promise<WorkspaceConfig | null> {
  const configPath = join(workspacePath, 'workspace.json')
  try {
    const data = await readFile(configPath, 'utf-8')
    return JSON.parse(data) as WorkspaceConfig
  } catch {
    return null
  }
}

async function writeWorkspaceConfig(
  workspacePath: string,
  config: WorkspaceConfig
): Promise<void> {
  const configPath = join(workspacePath, 'workspace.json')
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

async function countCapCutProjects(capCutPath: string): Promise<number> {
  try {
    const entries = await readdir(capCutPath, { withFileTypes: true })
    let count = 0
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const draftFile = join(capCutPath, entry.name, 'draft_content.json')
        if (await fileExists(draftFile)) {
          count++
        }
      }
    }
    return count
  } catch {
    return 0
  }
}

async function countWorkspaceProjects(
  wsPath: string,
  capCutPath: string,
  isDefault: boolean
): Promise<number> {
  if (isDefault) return countCapCutProjects(capCutPath)
  const config = await readWorkspaceConfig(wsPath)
  return config?.projects?.length || 0
}

async function resolveCoverPath(projectPath: string, coverField: string): Promise<string> {
  if (coverField) {
    const resolved = join(projectPath, coverField)
    if (await fileExists(resolved)) return resolved
  }
  const defaultCover = join(projectPath, 'draft_cover.jpg')
  if (await fileExists(defaultCover)) return defaultCover
  return ''
}

async function scanCapCutProjects(
  capCutProjectsPath: string
): Promise<Array<Record<string, unknown>>> {
  const entries = await readdir(capCutProjectsPath, { withFileTypes: true })
  const projects: Array<Record<string, unknown>> = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const projectPath = join(capCutProjectsPath, entry.name)
    const draftPath = join(projectPath, 'draft_content.json')
    const metaPath = join(projectPath, 'draft_meta_info.json')

    if (!(await fileExists(draftPath))) continue

    let name = entry.name
    let modifiedUs = 0
    let createdUs = 0
    let durationUs = 0
    let materialsSize = 0
    let cover = ''

    try {
      const metaData = await readFile(metaPath, 'utf-8')
      const meta = JSON.parse(metaData)
      name = meta.draft_name || entry.name
      modifiedUs = meta.tm_draft_modified || 0
      createdUs = meta.tm_draft_create || 0
      durationUs = meta.draft_timeline_duration || 0
      materialsSize = meta['draft_timeline_materials_size_'] || 0
      cover = meta.draft_cover || ''
    } catch {
      // ignore meta read errors
    }

    const coverPath = await resolveCoverPath(projectPath, cover)

    projects.push({
      name,
      path: projectPath,
      draft_path: draftPath,
      modified_us: modifiedUs,
      created_us: createdUs,
      duration_us: durationUs,
      materials_size: materialsSize,
      cover: coverPath,
      exists: true
    })
  }

  projects.sort(
    (a, b) => ((b.modified_us as number) || 0) - ((a.modified_us as number) || 0)
  )
  return projects
}

async function createDefaultWorkspace(): Promise<WorkspaceRegistryEntry | null> {
  const capCutPath = getDefaultCapCutPath()
  if (!(await fileExists(capCutPath))) return null

  const id = randomUUID()
  const now = new Date().toISOString()
  const workspacePath = join(
    app.getPath('appData'),
    'meu-pipeline-studio',
    'workspaces',
    'capcut-default'
  )

  await ensureDir(workspacePath)

  const config: WorkspaceConfig = {
    id,
    name: 'CapCut',
    description: 'Area de trabalho padrao do CapCut',
    capCutProjectsPath: capCutPath,
    projects: [],
    mediaPreset: {
      defaultType: 'video',
      defaultDurationMs: 5000,
      transitionMs: 500
    },
    recentProjects: [],
    pipelineStatuses: {}
  }
  await writeWorkspaceConfig(workspacePath, config)

  const projectCount = await countCapCutProjects(capCutPath)

  const entry: WorkspaceRegistryEntry = {
    id,
    name: 'CapCut',
    description: 'Area de trabalho padrao do CapCut',
    path: workspacePath,
    createdAt: now,
    updatedAt: now,
    isDefault: true,
    lastOpenedAt: null,
    pinned: true,
    projectCount,
    _missing: false
  }

  await writeRegistry([entry])
  return entry
}

export function registerWorkspaceHandlers(): void {
  ipcMain.handle('workspace:load-registry', async () => {
    let entries = await readRegistry()

    // Auto-create default CapCut workspace if registry is empty
    if (entries.length === 0) {
      const defaultEntry = await createDefaultWorkspace()
      if (defaultEntry) {
        entries = [defaultEntry]
      }
    }

    const validated: WorkspaceRegistryEntry[] = []
    for (const entry of entries) {
      const missing = !(await fileExists(join(entry.path, 'workspace.json')))
      validated.push({ ...entry, _missing: missing })
    }
    return validated
  })

  ipcMain.handle(
    'workspace:create',
    async (
      _event,
      params: { name: string; description: string; path: string; capCutProjectsPath?: string }
    ) => {
      const id = randomUUID()
      const now = new Date().toISOString()
      const workspacePath = params.path
      const capCutProjectsPath = params.capCutProjectsPath || getDefaultCapCutPath()

      await ensureDir(workspacePath)

      const config: WorkspaceConfig = {
        id,
        name: params.name,
        description: params.description,
        capCutProjectsPath,
        projects: [],
        mediaPreset: {
          defaultType: 'video',
          defaultDurationMs: 5000,
          transitionMs: 500
        },
        recentProjects: [],
        pipelineStatuses: {}
      }
      await writeWorkspaceConfig(workspacePath, config)

      const registry = await readRegistry()
      const isDefault = registry.length === 0
      const projectCount = isDefault ? await countCapCutProjects(capCutProjectsPath) : 0

      const entry: WorkspaceRegistryEntry = {
        id,
        name: params.name,
        description: params.description,
        path: workspacePath,
        createdAt: now,
        updatedAt: now,
        isDefault,
        lastOpenedAt: now,
        pinned: false,
        projectCount,
        _missing: false
      }

      registry.push(entry)
      await writeRegistry(registry)

      return { entry, config }
    }
  )

  ipcMain.handle('workspace:open', async (_event, id: string) => {
    const registry = await readRegistry()
    const idx = registry.findIndex((e) => e.id === id)
    if (idx === -1) throw new Error('Workspace not found in registry')

    const entry = registry[idx]
    const config = await readWorkspaceConfig(entry.path)
    if (!config) throw new Error('workspace.json not found at ' + entry.path)

    // Backward compat: initialize projects array if missing
    if (!config.projects) {
      config.projects = []
      await writeWorkspaceConfig(entry.path, config)
    }

    const projectCount = await countWorkspaceProjects(
      entry.path,
      config.capCutProjectsPath,
      entry.isDefault
    )

    registry[idx] = {
      ...entry,
      lastOpenedAt: new Date().toISOString(),
      projectCount,
      _missing: false
    }
    await writeRegistry(registry)

    return { entry: registry[idx], config }
  })

  ipcMain.handle(
    'workspace:update',
    async (
      _event,
      params: { id: string; name?: string; description?: string; capCutProjectsPath?: string }
    ) => {
      const registry = await readRegistry()
      const idx = registry.findIndex((e) => e.id === params.id)
      if (idx === -1) throw new Error('Workspace not found')

      const entry = registry[idx]
      const now = new Date().toISOString()

      if (params.name !== undefined) entry.name = params.name
      if (params.description !== undefined) entry.description = params.description
      entry.updatedAt = now
      registry[idx] = entry
      await writeRegistry(registry)

      const config = await readWorkspaceConfig(entry.path)
      if (config) {
        if (params.name !== undefined) config.name = params.name
        if (params.description !== undefined) config.description = params.description
        if (params.capCutProjectsPath !== undefined)
          config.capCutProjectsPath = params.capCutProjectsPath
        await writeWorkspaceConfig(entry.path, config)
      }

      return entry
    }
  )

  ipcMain.handle(
    'workspace:delete',
    async (_event, params: { id: string; deleteFiles?: boolean }) => {
      const registry = await readRegistry()
      const idx = registry.findIndex((e) => e.id === params.id)
      if (idx === -1) throw new Error('Workspace not found')

      const entry = registry[idx]
      registry.splice(idx, 1)

      if (entry.isDefault && registry.length > 0) {
        registry[0].isDefault = true
      }

      await writeRegistry(registry)

      if (params.deleteFiles) {
        try {
          const { rm } = await import('fs/promises')
          await rm(entry.path, { recursive: true, force: true })
        } catch {
          // ignore cleanup errors
        }
      }

      return { success: true }
    }
  )

  ipcMain.handle('workspace:set-default', async (_event, id: string) => {
    const registry = await readRegistry()
    for (const entry of registry) {
      entry.isDefault = entry.id === id
    }
    await writeRegistry(registry)
    return { success: true }
  })

  ipcMain.handle('workspace:pin', async (_event, params: { id: string; pinned: boolean }) => {
    const registry = await readRegistry()
    const idx = registry.findIndex((e) => e.id === params.id)
    if (idx === -1) throw new Error('Workspace not found')
    registry[idx].pinned = params.pinned
    await writeRegistry(registry)
    return registry[idx]
  })

  // List projects filtered by workspace (ref: NardotoStudio filterProjectsByWorkspace)
  ipcMain.handle(
    'workspace:list-projects',
    async (_event, params: { workspaceId: string }) => {
      try {
        const registry = await readRegistry()
        const wsEntry = registry.find((e) => e.id === params.workspaceId)
        if (!wsEntry) return []

        const config = await readWorkspaceConfig(wsEntry.path)
        if (!config) return []
        if (!config.projects) config.projects = []

        const allProjects = await scanCapCutProjects(config.capCutProjectsPath)

        // Default workspace: return ALL projects (global view)
        if (wsEntry.isDefault) {
          return allProjects
        }

        // Custom workspace: return ONLY linked projects
        const linkedPaths = new Set(config.projects.map((p) => normalizePath(p.capCutPath)))
        return allProjects.filter((p) => linkedPaths.has(normalizePath(p.path as string)))
      } catch {
        return []
      }
    }
  )

  // Link projects to a workspace
  ipcMain.handle(
    'workspace:link-projects',
    async (
      _event,
      params: {
        workspaceId: string
        projects: Array<{ name: string; capCutPath: string }>
      }
    ) => {
      const registry = await readRegistry()
      const wsEntry = registry.find((e) => e.id === params.workspaceId)
      if (!wsEntry) throw new Error('Workspace not found')

      const config = await readWorkspaceConfig(wsEntry.path)
      if (!config) throw new Error('workspace.json not found')
      if (!config.projects) config.projects = []

      const now = new Date().toISOString()
      let added = 0

      for (const proj of params.projects) {
        const exists = config.projects.some(
          (p) => normalizePath(p.capCutPath) === normalizePath(proj.capCutPath)
        )
        if (!exists) {
          config.projects.push({
            name: proj.name,
            capCutPath: proj.capCutPath,
            linkedAt: now
          })
          added++
        }
      }

      await writeWorkspaceConfig(wsEntry.path, config)

      // Update project count in registry
      const idx = registry.findIndex((e) => e.id === params.workspaceId)
      if (idx !== -1) {
        registry[idx].projectCount = config.projects.length
        registry[idx].updatedAt = now
        await writeRegistry(registry)
      }

      return { success: true, added, projectCount: config.projects.length }
    }
  )

  // Unlink projects from a workspace
  ipcMain.handle(
    'workspace:unlink-projects',
    async (_event, params: { workspaceId: string; capCutPaths: string[] }) => {
      const registry = await readRegistry()
      const wsEntry = registry.find((e) => e.id === params.workspaceId)
      if (!wsEntry) throw new Error('Workspace not found')

      const config = await readWorkspaceConfig(wsEntry.path)
      if (!config) throw new Error('workspace.json not found')
      if (!config.projects) config.projects = []

      const pathsToRemove = new Set(params.capCutPaths.map(normalizePath))
      const before = config.projects.length
      config.projects = config.projects.filter(
        (p) => !pathsToRemove.has(normalizePath(p.capCutPath))
      )
      const removed = before - config.projects.length

      await writeWorkspaceConfig(wsEntry.path, config)

      const now = new Date().toISOString()
      const idx = registry.findIndex((e) => e.id === params.workspaceId)
      if (idx !== -1) {
        registry[idx].projectCount = config.projects.length
        registry[idx].updatedAt = now
        await writeRegistry(registry)
      }

      return { success: true, removed, projectCount: config.projects.length }
    }
  )

  // List CapCut projects NOT linked to this workspace (for project picker)
  ipcMain.handle(
    'workspace:list-available-projects',
    async (_event, params: { workspaceId: string }) => {
      try {
        const registry = await readRegistry()
        const wsEntry = registry.find((e) => e.id === params.workspaceId)
        if (!wsEntry) return []

        const config = await readWorkspaceConfig(wsEntry.path)
        if (!config) return []
        if (!config.projects) config.projects = []

        const linkedPaths = new Set(config.projects.map((p) => normalizePath(p.capCutPath)))
        const allProjects = await scanCapCutProjects(config.capCutProjectsPath)

        return allProjects.filter((p) => !linkedPaths.has(normalizePath(p.path as string)))
      } catch {
        return []
      }
    }
  )

  ipcMain.handle(
    'workspace:save-pipeline-status',
    async (_event, params: { workspacePath: string; projectPath: string; status: unknown }) => {
      const config = await readWorkspaceConfig(params.workspacePath)
      if (!config) throw new Error('workspace.json not found')

      config.pipelineStatuses[params.projectPath] = params.status
      await writeWorkspaceConfig(params.workspacePath, config)
      return { success: true }
    }
  )

  ipcMain.handle(
    'workspace:load-pipeline-status',
    async (_event, params: { workspacePath: string; projectPath: string }) => {
      const config = await readWorkspaceConfig(params.workspacePath)
      if (!config) return null
      return config.pipelineStatuses[params.projectPath] || null
    }
  )

  ipcMain.handle('workspace:open-in-explorer', async (_event, path: string) => {
    shell.openPath(path)
    return { success: true }
  })

  ipcMain.handle(
    'workspace:save-recent-projects',
    async (
      _event,
      params: {
        workspacePath: string
        recentProjects: Array<{ name: string; path: string; lastOpened: number }>
      }
    ) => {
      const config = await readWorkspaceConfig(params.workspacePath)
      if (!config) throw new Error('workspace.json not found')

      config.recentProjects = params.recentProjects
      await writeWorkspaceConfig(params.workspacePath, config)
      return { success: true }
    }
  )
}
