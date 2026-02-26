import { useState, useEffect, useCallback } from 'react'
import {
  Loader2,
  ChevronRight,
  ChevronDown,
  Folder,
  List,
  FileText,
  Paperclip,
  Image,
  File,
  AlertCircle
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

interface ClickUpBrowserProps {
  onTaskSelected: (task: ClickUpTask) => void
  selectedTaskId: string | null
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
  tasksPage: 0,
  tasksHasMore: false
}

export function ClickUpBrowser({
  onTaskSelected,
  selectedTaskId
}: ClickUpBrowserProps): React.JSX.Element {
  const { addToast } = useUIStore()
  const [tree, setTree] = useState<TreeState>(initialTree)
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const setLoadingKey = (key: string, value: boolean): void => {
    setLoading((prev) => ({ ...prev, [key]: value }))
  }

  // Load teams on mount
  useEffect(() => {
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
          handleSelectTeam(res.teams[0].id)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao carregar workspaces'
        setError(msg)
        addToast({ type: 'error', message: msg })
      } finally {
        setLoadingKey('teams', false)
      }
    }
    loadTeams()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          selectedListId: null
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
        selectedListId: null
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
        selectedListId: null
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

  const handleSelectList = async (listId: string): Promise<void> => {
    setLoadingKey('tasks', true)
    try {
      const res = (await window.api.clickupGetTasks({ listId, page: 0 })) as {
        tasks: ClickUpTask[]
        last_page: boolean
      }
      setTree((prev) => ({
        ...prev,
        selectedListId: listId,
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

  // Breadcrumb
  const breadcrumb: Array<{ label: string; onClick: () => void }> = []
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
      label: list?.name || 'Lista',
      onClick: () => {
        if (tree.selectedFolderId) {
          handleSelectFolder(tree.selectedFolderId)
        } else if (tree.selectedSpaceId) {
          handleSelectSpace(tree.selectedSpaceId)
        }
      }
    })
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <AlertCircle className="h-8 w-8 text-error" />
        <p className="text-sm text-error">{error}</p>
        <p className="text-xs text-text-muted">
          Verifique seu token nas Configuracoes.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Breadcrumb */}
      {breadcrumb.length > 0 && (
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

      {/* Spaces */}
      {tree.selectedTeamId && !tree.selectedSpaceId && (
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

      {/* Folders + Folderless Lists */}
      {tree.selectedSpaceId && !tree.selectedFolderId && !tree.selectedListId && (
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
              handleSelectList(id)
            }
          }}
          loading={!!loading.folders}
          emptyMessage="Nenhuma pasta ou lista encontrada"
        />
      )}

      {/* Lists inside Folder */}
      {tree.selectedFolderId && !tree.selectedListId && (
        <NavLevel
          items={tree.lists.map((l) => ({
            id: l.id,
            label: l.name,
            icon: <List className="h-3.5 w-3.5 text-text-muted" />,
            suffix: l.task_count ? `${l.task_count}` : undefined
          }))}
          onSelect={handleSelectList}
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
    task.attachments?.filter((a: ClickUpAttachment) => classifyAttachment(a) === 'script').length || 0
  const charCount =
    task.attachments?.filter((a: ClickUpAttachment) => classifyAttachment(a) === 'character').length || 0

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
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm text-text">{task.name}</div>
        <div className="flex items-center gap-2 mt-0.5">
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
