import { ipcMain } from 'electron'
import { callPython } from '../python/bridge'

export function registerCapCutHandlers(): void {
  ipcMain.handle('capcut:read-draft', async (_event, draftPath: string) => {
    return callPython('read_draft', { draft_path: draftPath })
  })

  ipcMain.handle(
    'capcut:write-text-segments',
    async (_event, draftPath: string, blocks: unknown[]) => {
      return callPython('write_text_segments', { draft_path: draftPath, blocks })
    }
  )

  ipcMain.handle('capcut:read-audio-blocks', async (_event, draftPath: string) => {
    return callPython('read_audio_blocks', { draft_path: draftPath })
  })

  ipcMain.handle(
    'capcut:update-subtitle-timings',
    async (_event, draftPath: string, blocks: unknown[]) => {
      return callPython('update_subtitle_timings', { draft_path: draftPath, blocks })
    }
  )

  ipcMain.handle('capcut:sync-metadata', async (_event, draftPath: string) => {
    const draftDir = draftPath.replace(/[/\\][^/\\]+$/, '')
    return callPython('sync_metadata', { draft_dir: draftDir })
  })

  ipcMain.handle(
    'capcut:write-video-segments',
    async (_event, draftPath: string, scenes: unknown[]) => {
      return callPython('write_video_segments', { draft_path: draftPath, scenes })
    }
  )
}
