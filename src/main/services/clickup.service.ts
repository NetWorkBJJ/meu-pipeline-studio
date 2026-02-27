/**
 * ClickUp API v2 Service - Main process HTTP client (read-only)
 *
 * Covers hierarchy navigation (teams, spaces, folders, lists, tasks)
 * and attachment downloads. No write operations.
 *
 * Runs in the Electron main process (Node 22+ native fetch).
 */

import { createWriteStream } from 'fs'
import { mkdir, readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { app } from 'electron'

const BASE_URL = 'https://api.clickup.com/api/v2'

// ---------------------------------------------------------------------------
// Types (internal to service)
// ---------------------------------------------------------------------------

export interface TeamsResponse {
  teams: Array<Record<string, unknown>>
}

export interface SpacesResponse {
  spaces: Array<Record<string, unknown>>
}

export interface FoldersResponse {
  folders: Array<Record<string, unknown>>
}

export interface ListsResponse {
  lists: Array<Record<string, unknown>>
}

export interface TasksResponse {
  tasks: Array<Record<string, unknown>>
  last_page: boolean
}

export interface DownloadResult {
  localPath: string
  size: number
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

export class ClickUpService {
  private token: string

  constructor(token: string) {
    this.token = token
  }

  // -------------------------------------------------------------------------
  // Internal request helper
  // -------------------------------------------------------------------------

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${BASE_URL}${path}`

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.token,
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {})
      }
    })

    if (response.status === 429) {
      const resetAt = response.headers.get('X-RateLimit-Reset')
      throw new Error(
        `Limite de requisicoes do ClickUp atingido. Resets at ${resetAt || 'unknown'}. Aguarde e tente novamente.`
      )
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No details')
      throw new Error(`ClickUp API error ${response.status}: ${errorText}`)
    }

    return response.json() as Promise<T>
  }

  // -------------------------------------------------------------------------
  // Hierarchy navigation
  // -------------------------------------------------------------------------

  async getTeams(): Promise<TeamsResponse> {
    return this.request<TeamsResponse>('/team')
  }

  async getSpaces(teamId: string): Promise<SpacesResponse> {
    return this.request<SpacesResponse>(`/team/${teamId}/space`)
  }

  async getFolders(spaceId: string): Promise<FoldersResponse> {
    return this.request<FoldersResponse>(`/space/${spaceId}/folder`)
  }

  async getFolderlessLists(spaceId: string): Promise<ListsResponse> {
    return this.request<ListsResponse>(`/space/${spaceId}/list`)
  }

  async getLists(folderId: string): Promise<ListsResponse> {
    return this.request<ListsResponse>(`/folder/${folderId}/list`)
  }

  async getTasks(listId: string, page = 0): Promise<TasksResponse> {
    const params = new URLSearchParams({
      page: String(page),
      include_closed: 'true',
      subtasks: 'false'
    })
    return this.request<TasksResponse>(`/list/${listId}/task?${params}`)
  }

  async getTask(taskId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      `/task/${taskId}?include_subtasks=false`
    )
  }

  async getList(listId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/list/${listId}`)
  }

  // -------------------------------------------------------------------------
  // Attachment download
  // -------------------------------------------------------------------------

  async downloadAttachment(
    url: string,
    destDir?: string,
    fileName?: string
  ): Promise<DownloadResult> {
    const outputDir =
      destDir || join(app.getPath('appData'), 'workflowaa', 'clickup-downloads')
    await mkdir(outputDir, { recursive: true })

    const resolvedName = fileName || `clickup-${Date.now()}${extFromUrl(url)}`
    const localPath = join(outputDir, resolvedName)
    await mkdir(dirname(localPath), { recursive: true })

    // ClickUp attachment URLs are typically pre-signed S3 URLs.
    // Try without auth first (pre-signed), fall back to auth header.
    let response = await fetch(url)

    if (!response.ok) {
      response = await fetch(url, {
        headers: { Authorization: this.token }
      })
    }

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    }

    if (!response.body) {
      throw new Error('Download failed: empty response body')
    }

    const nodeStream = Readable.fromWeb(response.body as import('stream/web').ReadableStream)
    const fileStream = createWriteStream(localPath)
    await pipeline(nodeStream, fileStream)

    return { localPath, size: fileStream.bytesWritten }
  }

  // -------------------------------------------------------------------------
  // Text file reading (for script import)
  // -------------------------------------------------------------------------

  async readTextFile(localPath: string): Promise<string> {
    return readFile(localPath, 'utf-8')
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const ext = pathname.slice(pathname.lastIndexOf('.'))
    if (ext && ext.length <= 6) return ext
  } catch {
    // ignore
  }
  return ''
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createClickUpService(token: string): ClickUpService {
  return new ClickUpService(token)
}
