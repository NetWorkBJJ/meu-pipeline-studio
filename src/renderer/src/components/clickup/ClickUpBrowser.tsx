import { useState, useEffect, useCallback } from 'react'
import {
  Loader2,
  ChevronRight,
  Folder,
  List,
  FileText,
  Paperclip,
  Image,
  File,
  AlertCircle,
  Pin,
  PinOff,
  Building2,
  RefreshCw,
  Link2,
  ArrowRight
} from 'lucide-react'
import { useUIStore } from '@/stores/useUIStore'
import type {
  ClickUpTeam,
  ClickUpSpace,
  ClickUpFolder,
  ClickUpList,
  ClickUpTask,
  ClickUpAttachment
} from '@/types/clickup'
import { classifyAttachment } from '@/types/clickup'

interface ClickUpDefaultListConfig {
  listId: string
  listName: string
  breadcrumb: string
}

interface ClickUpBrowserProps {
  onTaskSelected: (task: ClickUpTask) => void
  selectedTaskId: string | null
  defaultList: ClickUpDefaultListConfig | null
  onDefaultListChanged?: (config: ClickUpDefaultListConfig | null) => void
}

interface TreeState {
  teams: ClickUpTeam[]
  spaces: ClickUpSpace[]
  folders: ClickUpFolder[]
  folderlessLists: ClickUpList[]
  lists: ClickUpList[]
  tasks: ClickUpTask[]
  selectedTeamId: string | null
  selectedSpaceId: string | null
  selectedFolderId: string | null
  selectedListId: string | null
  selectedListName: string | null
  tasksPage: number
  tasksHasMore: boolean
}

const initialTree: TreeState = {
  teams: [],
  spaces: [],
  folders: [],
  folderlessLists: [],
  lists: [],
  tasks: [],
  selectedTeamId: null,
  selectedSpaceId: null,
  selectedFolderId: null,
  selectedListId: null,
  selectedListName: null,
  tasksPage: 0,
  tasksHasMore: false
}

// Parse ClickUp list URL to extract list ID
// Formats:
//   https://app.clickup.com/1234567/v/li/901234567
//   https://app.clickup.com/1234567/v/li/901234567?...
//   Just a numeric ID: 901234567
function parseClickUpListId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Pure numeric ID
  if (/^\d+$/.test(trimmed)) return trimmed

  // URL pattern
  try {
    const url = new URL(trimmed)
    // /teamId/v/li/listId or /teamId/v/li/listId/...
    const match = url.pathname.match(/\/v\/li\/(\d+)/)
    if (match) return match[1]

    // /teamId/v/l/li/listId (another variant)
    const match2 = url.pathname.match(/\/li\/(\d+)/)
    if (match2) return match2[1]
  } catch {
    // Not a URL
  }

  return null
}

export function ClickUpBrowser({
  onTaskSelected,
  selectedTaskId,
  defaultList,
  onDefaultListChanged
}: ClickUpBrowserProps): React.JSX.Element {
  const { addToast } = useUIStore()
  const [tree, setTree] = useState<TreeState>(initialTree)
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [directMode, setDirectMode] = useState(!!defaultList)
  const [urlInput, setUrlInput] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)

  const setLoadingKey = (key: string, value: boolean): void => {
    setLoading((prev) => ({ ...prev, [key]: value }))
  }

  // Load tasks directly from default list, or load teams for hierarchy navigation
  useEffect(() => {
    if (defaultList) {
      loadTasksFromList(defaultList.listId, defaultList.listName)
    } else {
      loadTeams()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadTeams = async (): Promise<void> => {
    setLoadingKey('teams', true)
    setError(null)
    try {
      const res = (await window.api.clickupGetTeams()) as {
        teams: ClickUpTeam[]
      }
      setTree((prev) => ({ ...prev, teams: res.teams || [] }))
      // Auto-select first team if only one
      if (res.teams?.length === 1) {
        await handleSelectTeam(res.teams[0].id)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar workspaces'
      setError(msg)
      addToast({ type: 'error', message: msg })
    } finally {
      setLoadingKey('teams', false)
    }
  }

  const loadTasksFromList = async (listId: string, listName?: string): Promise<void> => {
    setLoadingKey('tasks', true)
    setError(null)
    try {
      const res = (await window.api.clickupGetTasks({ listId, page: 0 })) as {
        tasks: ClickUpTask[]
        last_page: boolean
      }
      setTree((prev) => ({
        ...prev,
        selectedListId: listId,
        selectedListName: listName || prev.selectedListName,
        tasks: res.tasks || [],
        tasksPage: 0,
        tasksHasMore: !res.last_page
      }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar tarefas'
      setError(msg)
      addToast({ type: 'error', message: msg })
    } finally {
      setLoadingKey('tasks', false)
    }
  }

  const handleSelectTeam = useCallback(
    async (teamId: string): Promise<void> => {
      setLoadingKey('spaces', true)
      try {
        const res = (await window.api.clickupGetSpaces(teamId)) as {
          spaces: ClickUpSpace[]
        }
        setTree((prev) => ({
          ...prev,
          selectedTeamId: teamId,
          spaces: res.spaces || [],
          selectedSpaceId: null,
          folders: [],
          folderlessLists: [],
          lists: [],
          tasks: [],
          selectedFolderId: null,
          selectedListId: null,
          selectedListName: null
        }))
      } catch (err) {
        addToast({
          type: 'error',
          message: err instanceof Error ? err.message : 'Erro ao carregar spaces'
        })
      } finally {
        setLoadingKey('spaces', false)
      }
    },
    [addToast]
  )

  const handleSelectSpace = async (spaceId: string): Promise<void> => {
    setLoadingKey('folders', true)
    try {
      const [foldersRes, listsRes] = await Promise.all([
        window.api.clickupGetFolders(spaceId) as Promise<{ folders: ClickUpFolder[] }>,
        window.api.clickupGetFolderlessLists(spaceId) as Promise<{ lists: ClickUpList[] }>
      ])
      setTree((prev) => ({
        ...prev,
        selectedSpaceId: spaceId,
        folders: foldersRes.folders || [],
        folderlessLists: listsRes.lists || [],
        lists: [],
        tasks: [],
        selectedFolderId: null,
        selectedListId: null,
        selectedListName: null
      }))
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao carregar folders'
      })
    } finally {
      setLoadingKey('folders', false)
    }
  }

  const handleSelectFolder = async (folderId: string): Promise<void> => {
    setLoadingKey('lists', true)
    try {
      const res = (await window.api.clickupGetLists(folderId)) as {
        lists: ClickUpList[]
      }
      setTree((prev) => ({
        ...prev,
        selectedFolderId: folderId,
        lists: res.lists || [],
        tasks: [],
        selectedListId: null,
        selectedListName: null
      }))
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao carregar listas'
      })
    } finally {
      setLoadingKey('lists', false)
    }
  }

  const handleSelectList = async (listId: string, listName?: string): Promise<void> => {
    setLoadingKey('tasks', true)
    try {
      const res = (await window.api.clickupGetTasks({ listId, page: 0 })) as {
        tasks: ClickUpTask[]
        last_page: boolean
      }
      setTree((prev) => ({
        ...prev,
        selectedListId: listId,
        selectedListName: listName || prev.selectedListName,
        tasks: res.tasks || [],
        tasksPage: 0,
        tasksHasMore: !res.last_page
      }))
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao carregar tarefas'
      })
    } finally {
      setLoadingKey('tasks', false)
    }
  }

  const handleLoadMoreTasks = async (): Promise<void> => {
    if (!tree.selectedListId) return
    setLoadingKey('moreTasks', true)
    try {
      const nextPage = tree.tasksPage + 1
      const res = (await window.api.clickupGetTasks({
        listId: tree.selectedListId,
        page: nextPage
      })) as { tasks: ClickUpTask[]; last_page: boolean }
      setTree((prev) => ({
        ...prev,
        tasks: [...prev.tasks, ...(res.tasks || [])],
        tasksPage: nextPage,
        tasksHasMore: !res.last_page
      }))
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao carregar mais tarefas'
      })
    } finally {
      setLoadingKey('moreTasks', false)
    }
  }

  const handleSelectTask = async (taskId: string): Promise<void> => {
    setLoadingKey('task', true)
    try {
      const task = (await window.api.clickupGetTask(taskId)) as ClickUpTask
      onTaskSelected(task)
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao carregar tarefa'
      })
    } finally {
      setLoadingKey('task', false)
    }
  }

  const handleRefreshTasks = async (): Promise<void> => {
    if (!tree.selectedListId) return
    await loadTasksFromList(tree.selectedListId, tree.selectedListName || undefined)
  }

  const handleUrlSubmit = async (): Promise<void> => {
    const listId = parseClickUpListId(urlInput)
    if (!listId) {
      addToast({ type: 'error', message: 'URL ou ID invalido. Cole a URL da lista do ClickUp ou o ID numerico.' })
      return
    }

    setUrlLoading(true)
    try {
      // Fetch list metadata to get the name
      const listData = (await window.api.clickupGetList(listId)) as { id: string; name: string; folder?: { name: string }; space?: { name: string } }

      const listName = listData.name || 'Lista'
      const breadcrumbParts: string[] = []
      if (listData.space && typeof listData.space === 'object' && 'name' in listData.space) {
        breadcrumbParts.push(listData.space.name as string)
      }
      if (listData.folder && typeof listData.folder === 'object' && 'name' in listData.folder) {
        breadcrumbParts.push(listData.folder.name as string)
      }
      breadcrumbParts.push(listName)

      // Load tasks
      await loadTasksFromList(listId, listName)

      // Auto-save as default list
      const config: ClickUpDefaultListConfig = {
        listId,
        listName,
        breadcrumb: breadcrumbParts.join(' > ')
      }
      await window.api.clickupSaveDefaultList(config)
      onDefaultListChanged?.(config)
      setDirectMode(true)

      addToast({ type: 'success', message: `Lista conectada: ${listName}` })
      setUrlInput('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao acessar lista'
      addToast({ type: 'error', message: msg })
    } finally {
      setUrlLoading(false)
    }
  }

  const handlePinList = async (): Promise<void> => {
    if (!tree.selectedListId) return

    // Build breadcrumb from current navigation state
    const parts: string[] = []
    if (tree.selectedTeamId) {
      const team = tree.teams.find((t) => t.id === tree.selectedTeamId)
      if (team) parts.push(team.name)
    }
    if (tree.selectedSpaceId) {
      const space = tree.spaces.find((s) => s.id === tree.selectedSpaceId)
      if (space) parts.push(space.name)
    }
    if (tree.selectedFolderId) {
      const folder = tree.folders.find((f) => f.id === tree.selectedFolderId)
      if (folder) parts.push(folder.name)
    }

    const allLists = [...tree.folderlessLists, ...tree.lists]
    const list = allLists.find((l) => l.id === tree.selectedListId)
    const listName = list?.name || tree.selectedListName || 'Lista'
    parts.push(listName)

    const config: ClickUpDefaultListConfig = {
      listId: tree.selectedListId,
      listName,
      breadcrumb: parts.join(' > ')
    }

    try {
      await window.api.clickupSaveDefaultList(config)
      onDefaultListChanged?.(config)
      addToast({ type: 'success', message: `Lista fixada: ${listName}` })
    } catch {
      addToast({ type: 'error', message: 'Erro ao fixar lista' })
    }
  }

  const handleUnpinList = async (): Promise<void> => {
    try {
      await window.api.clickupSaveDefaultList(null)
      onDefaultListChanged?.(null)
      addToast({ type: 'success', message: 'Lista desafixada' })
    } catch {
      addToast({ type: 'error', message: 'Erro ao desafixar lista' })
    }
  }

  const handleSwitchToBrowser = (): void => {
    setDirectMode(false)
    setTree(initialTree)
    loadTeams()
  }

  const isPinnedList = defaultList && tree.selectedListId === defaultList.listId

  // Breadcrumb (only in browse mode)
  const breadcrumb: Array<{ label: string; onClick: () => void }> = []
  if (!directMode) {
    if (tree.teams.length > 1 && tree.selectedTeamId) {
      const team = tree.teams.find((t) => t.id === tree.selectedTeamId)
      breadcrumb.push({
        label: team?.name || 'Workspace',
        onClick: () => setTree({ ...initialTree, teams: tree.teams })
      })
    }
    if (tree.selectedSpaceId) {
      const space = tree.spaces.find((s) => s.id === tree.selectedSpaceId)
      breadcrumb.push({
        label: space?.name || 'Space',
        onClick: () => {
          if (tree.selectedTeamId) handleSelectTeam(tree.selectedTeamId)
        }
      })
    }
    if (tree.selectedFolderId) {
      const folder = tree.folders.find((f) => f.id === tree.selectedFolderId)
      breadcrumb.push({
        label: folder?.name || 'Folder',
        onClick: () => {
          if (tree.selectedSpaceId) handleSelectSpace(tree.selectedSpaceId)
        }
      })
    }
    if (tree.selectedListId) {
      const allLists = [...tree.folderlessLists, ...tree.lists]
      const list = allLists.find((l) => l.id === tree.selectedListId)
      breadcrumb.push({
        label: list?.name || tree.selectedListName || 'Lista',
        onClick: () => {
          if (tree.selectedFolderId) {
            handleSelectFolder(tree.selectedFolderId)
          } else if (tree.selectedSpaceId) {
            handleSelectSpace(tree.selectedSpaceId)
          }
        }
      })
    }
  }

  // Check if hierarchy is stuck (spaces loaded but empty)
  const hierarchyEmpty = !directMode && tree.selectedTeamId && !tree.selectedSpaceId &&
    !loading.spaces && tree.spaces.length === 0

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <AlertCircle className="h-8 w-8 text-error" />
        <p className="text-sm text-error">{error}</p>
        <p className="text-xs text-text-muted">
          Verifique seu token nas Configuracoes.
        </p>
        <button
          onClick={() => {
            setError(null)
            if (defaultList) {
              loadTasksFromList(defaultList.listId, defaultList.listName)
            } else {
              loadTeams()
            }
          }}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-surface-hover"
        >
          <RefreshCw className="h-3 w-3" />
          Tentar novamente
        </button>
        <UrlInputSection
          urlInput={urlInput}
          setUrlInput={setUrlInput}
          urlLoading={urlLoading}
          onSubmit={handleUrlSubmit}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Direct mode header */}
      {directMode && defaultList && (
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <Pin className="h-3 w-3 text-primary" />
              <span className="text-xs font-medium text-text">{defaultList.listName}</span>
            </div>
            <span className="text-[10px] text-text-muted">{defaultList.breadcrumb}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRefreshTasks}
              disabled={!!loading.tasks}
              className="flex h-6 items-center gap-1 rounded-md border border-border bg-surface px-2 text-[10px] text-text-muted transition-colors hover:bg-surface-hover disabled:opacity-40"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${loading.tasks ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            <button
              onClick={handleSwitchToBrowser}
              className="flex h-6 items-center gap-1 rounded-md border border-border bg-surface px-2 text-[10px] text-text-muted transition-colors hover:bg-surface-hover"
            >
              Alterar
            </button>
          </div>
        </div>
      )}

      {/* Breadcrumb (browse mode) */}
      {!directMode && breadcrumb.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-text-muted">
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <button
                onClick={crumb.onClick}
                className="text-primary/70 transition-colors hover:text-primary"
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Pin/Unpin button when viewing tasks (browse mode) */}
      {!directMode && tree.selectedListId && !loading.tasks && tree.tasks.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-muted">
            {tree.tasks.length} tarefa{tree.tasks.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={isPinnedList ? handleUnpinList : handlePinList}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] transition-colors ${
              isPinnedList
                ? 'text-primary hover:text-error'
                : 'text-text-muted hover:text-primary'
            }`}
          >
            {isPinnedList ? (
              <>
                <PinOff className="h-3 w-3" />
                Desafixar
              </>
            ) : (
              <>
                <Pin className="h-3 w-3" />
                Fixar como padrao
              </>
            )}
          </button>
        </div>
      )}

      {/* Teams picker (browse mode, multiple teams) */}
      {!directMode && !tree.selectedTeamId && !loading.teams && tree.teams.length > 1 && (
        <NavLevel
          items={tree.teams.map((t) => ({
            id: t.id,
            label: t.name,
            icon: <Building2 className="h-3.5 w-3.5 text-text-muted" />
          }))}
          onSelect={(id) => handleSelectTeam(id)}
          loading={false}
          emptyMessage="Nenhum workspace encontrado"
        />
      )}

      {/* Spaces */}
      {!directMode && tree.selectedTeamId && !tree.selectedSpaceId && !hierarchyEmpty && (
        <NavLevel
          items={tree.spaces.map((s) => ({
            id: s.id,
            label: s.name,
            icon: <Folder className="h-3.5 w-3.5 text-text-muted" />
          }))}
          onSelect={handleSelectSpace}
          loading={!!loading.spaces}
          emptyMessage="Nenhum space encontrado"
        />
      )}

      {/* Hierarchy empty fallback - show URL input */}
      {hierarchyEmpty && (
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-3">
            <AlertCircle className="h-5 w-5 text-warning" />
            <p className="text-center text-xs text-warning">
              Nenhum space visivel neste workspace. Isso pode acontecer quando sua conta nao tem acesso direto aos spaces.
            </p>
          </div>
          <UrlInputSection
            urlInput={urlInput}
            setUrlInput={setUrlInput}
            urlLoading={urlLoading}
            onSubmit={handleUrlSubmit}
          />
        </div>
      )}

      {/* Folders + Folderless Lists */}
      {!directMode &&
        tree.selectedSpaceId &&
        !tree.selectedFolderId &&
        !tree.selectedListId && (
          <NavLevel
            items={[
              ...tree.folders.map((f) => ({
                id: f.id,
                label: f.name,
                icon: <Folder className="h-3.5 w-3.5 text-text-muted" />,
                isFolder: true
              })),
              ...tree.folderlessLists.map((l) => ({
                id: l.id,
                label: l.name,
                icon: <List className="h-3.5 w-3.5 text-text-muted" />,
                suffix: l.task_count ? `${l.task_count}` : undefined
              }))
            ]}
            onSelect={(id) => {
              const isFolder = tree.folders.some((f) => f.id === id)
              if (isFolder) {
                handleSelectFolder(id)
              } else {
                const list = tree.folderlessLists.find((l) => l.id === id)
                handleSelectList(id, list?.name)
              }
            }}
            loading={!!loading.folders}
            emptyMessage="Nenhuma pasta ou lista encontrada"
          />
        )}

      {/* Lists inside Folder */}
      {!directMode && tree.selectedFolderId && !tree.selectedListId && (
        <NavLevel
          items={tree.lists.map((l) => ({
            id: l.id,
            label: l.name,
            icon: <List className="h-3.5 w-3.5 text-text-muted" />,
            suffix: l.task_count ? `${l.task_count}` : undefined
          }))}
          onSelect={(id) => {
            const list = tree.lists.find((l) => l.id === id)
            handleSelectList(id, list?.name)
          }}
          loading={!!loading.lists}
          emptyMessage="Nenhuma lista encontrada"
        />
      )}

      {/* Tasks */}
      {tree.selectedListId && (
        <div className="flex flex-col gap-1">
          {loading.tasks ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : tree.tasks.length === 0 ? (
            <p className="py-4 text-center text-xs text-text-muted">
              Nenhuma tarefa nesta lista
            </p>
          ) : (
            <>
              {tree.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isSelected={task.id === selectedTaskId}
                  isLoading={!!loading.task && task.id === selectedTaskId}
                  onClick={() => handleSelectTask(task.id)}
                />
              ))}
              {tree.tasksHasMore && (
                <button
                  onClick={handleLoadMoreTasks}
                  disabled={!!loading.moreTasks}
                  className="mt-1 flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-surface-hover disabled:opacity-40"
                >
                  {loading.moreTasks && <Loader2 className="h-3 w-3 animate-spin" />}
                  Carregar mais
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Initial loading */}
      {loading.teams && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {/* Always show URL input in browse mode when no list selected yet (and not in hierarchy-empty state) */}
      {!directMode && !tree.selectedListId && !hierarchyEmpty && !loading.teams && !error && (
        <div className="mt-2 border-t border-border pt-3">
          <UrlInputSection
            urlInput={urlInput}
            setUrlInput={setUrlInput}
            urlLoading={urlLoading}
            onSubmit={handleUrlSubmit}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// URL Input Section
// ---------------------------------------------------------------------------

function UrlInputSection({
  urlInput,
  setUrlInput,
  urlLoading,
  onSubmit
}: {
  urlInput: string
  setUrlInput: (v: string) => void
  urlLoading: boolean
  onSubmit: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Link2 className="h-3 w-3 text-text-muted" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
          Acessar lista por URL ou ID
        </span>
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !urlLoading) onSubmit()
          }}
          placeholder="Cole a URL da lista ou o ID numerico"
          className="flex-1 rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs text-text placeholder:text-text-muted/50 focus:border-primary/50 focus:outline-none"
        />
        <button
          onClick={onSubmit}
          disabled={urlLoading || !urlInput.trim()}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
        >
          {urlLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ArrowRight className="h-3 w-3" />
          )}
          Ir
        </button>
      </div>
      <p className="text-[10px] leading-relaxed text-text-muted/60">
        Abra sua lista no ClickUp, copie a URL do navegador e cole aqui.
        Ex: https://app.clickup.com/.../v/li/123456789
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  suffix?: string
  isFolder?: boolean
}

function NavLevel({
  items,
  onSelect,
  loading: isLoading,
  emptyMessage
}: {
  items: NavItem[]
  onSelect: (id: string) => void
  loading: boolean
  emptyMessage: string
}): React.JSX.Element {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    )
  }

  if (items.length === 0) {
    return <p className="py-4 text-center text-xs text-text-muted">{emptyMessage}</p>
  }

  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-text transition-colors hover:bg-surface-hover"
        >
          {item.icon}
          <span className="flex-1 truncate">{item.label}</span>
          {item.suffix && (
            <span className="text-xs text-text-muted">{item.suffix}</span>
          )}
          <ChevronRight className="h-3.5 w-3.5 text-text-muted/50" />
        </button>
      ))}
    </div>
  )
}

function TaskRow({
  task,
  isSelected,
  isLoading,
  onClick
}: {
  task: ClickUpTask
  isSelected: boolean
  isLoading: boolean
  onClick: () => void
}): React.JSX.Element {
  const attCount = task.attachments?.length || 0
  const scriptCount =
    task.attachments?.filter((a: ClickUpAttachment) => classifyAttachment(a) === 'script')
      .length || 0
  const charCount =
    task.attachments?.filter((a: ClickUpAttachment) => classifyAttachment(a) === 'character')
      .length || 0

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors ${
        isSelected
          ? 'bg-primary/10 border border-primary/30'
          : 'hover:bg-surface-hover border border-transparent'
      }`}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
      ) : (
        <FileText className="h-3.5 w-3.5 shrink-0 text-text-muted" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-text">{task.name}</div>
        <div className="mt-0.5 flex items-center gap-2">
          {task.status && (
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: task.status.color || '#71717A' }}
            />
          )}
          <span className="text-[10px] text-text-muted">
            {task.status?.status || 'sem status'}
          </span>
          {attCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-text-muted">
              <Paperclip className="h-2.5 w-2.5" />
              {attCount}
              {scriptCount > 0 && (
                <span className="ml-1 flex items-center gap-0.5">
                  <File className="h-2.5 w-2.5" />
                  {scriptCount}
                </span>
              )}
              {charCount > 0 && (
                <span className="ml-1 flex items-center gap-0.5">
                  <Image className="h-2.5 w-2.5" />
                  {charCount}
                </span>
              )}
            </span>
          )}
        </div>
      </div>
      {task.tags?.map((tag) => (
        <span
          key={tag.name}
          className="rounded-sm px-1.5 py-0.5 text-[9px] font-medium"
          style={{
            backgroundColor: tag.tag_bg || '#27272A',
            color: tag.tag_fg || '#FAFAFA'
          }}
        >
          {tag.name}
        </span>
      ))}
    </button>
  )
}
