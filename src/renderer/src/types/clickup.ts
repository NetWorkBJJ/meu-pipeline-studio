// ClickUp API v2 types (read-only subset)

export interface ClickUpTeam {
  id: string
  name: string
  color: string
  avatar: string | null
  members: ClickUpMember[]
}

export interface ClickUpMember {
  user: {
    id: number
    username: string
    email: string
    profilePicture: string | null
  }
}

export interface ClickUpSpace {
  id: string
  name: string
  private: boolean
  color: string | null
  avatar: string | null
  statuses: ClickUpStatus[]
}

export interface ClickUpStatus {
  id: string
  status: string
  color: string
  orderindex: number
  type: string
}

export interface ClickUpFolder {
  id: string
  name: string
  orderindex: number
  hidden: boolean
  space: { id: string }
  lists: ClickUpList[]
}

export interface ClickUpList {
  id: string
  name: string
  orderindex: number
  folder?: { id: string; name: string }
  space: { id: string }
  task_count?: number
}

export interface ClickUpAttachment {
  id: string
  title: string
  url: string
  url_w_query: string
  extension: string
  size: number
  date: string
}

export interface ClickUpTask {
  id: string
  name: string
  description: string | null
  status: ClickUpStatus
  date_created: string
  date_updated: string
  creator: { id: number; username: string }
  assignees: Array<{ id: number; username: string; profilePicture: string | null }>
  tags: Array<{ name: string; tag_fg: string; tag_bg: string }>
  attachments: ClickUpAttachment[]
  custom_fields: Array<{
    id: string
    name: string
    type: string
    value: unknown
  }>
  list: { id: string; name: string }
  folder?: { id: string; name: string }
  space: { id: string }
  url: string
}

export interface ClickUpTasksResponse {
  tasks: ClickUpTask[]
  last_page: boolean
}

export interface ClickUpTaskRef {
  taskId: string
  taskName: string
  listId: string
  listName: string
  url: string
  importedAt: number
}

// Attachment classification
export const SCRIPT_EXTENSIONS = ['txt', 'md']
export const CHARACTER_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']

export function classifyAttachment(
  att: ClickUpAttachment
): 'script' | 'character' | 'other' {
  const ext = (att.extension || '').toLowerCase().replace(/^\./, '')
  if (SCRIPT_EXTENSIONS.includes(ext)) return 'script'
  if (CHARACTER_EXTENSIONS.includes(ext)) return 'character'
  return 'other'
}
