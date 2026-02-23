import { ipcMain } from 'electron'
import { callPython } from '../python/bridge'
import { suppressNextChange } from './draft-watcher'

export function registerCapCutHandlers(): void {
  ipcMain.handle('capcut:read-draft', async (_event, draftPath: string) => {
    return callPython('read_draft', { draft_path: draftPath })
  })

  ipcMain.handle('capcut:load-full-project', async (_event, draftPath: string) => {
    return callPython('load_full_project', { draft_path: draftPath })
  })

  ipcMain.handle(
    'capcut:write-text-segments',
    async (_event, draftPath: string, blocks: unknown[]) => {
      suppressNextChange()
      return callPython('write_text_segments', { draft_path: draftPath, blocks })
    }
  )

  ipcMain.handle('capcut:read-audio-blocks', async (_event, draftPath: string) => {
    return callPython('read_audio_blocks', { draft_path: draftPath })
  })

  ipcMain.handle('capcut:read-subtitles', async (_event, draftPath: string) => {
    return callPython('read_subtitles', { draft_path: draftPath })
  })

  ipcMain.handle(
    'capcut:update-subtitle-texts',
    async (_event, draftPath: string, updates: unknown[]) => {
      suppressNextChange()
      return callPython('update_subtitle_texts', { draft_path: draftPath, updates })
    }
  )

  ipcMain.handle(
    'capcut:update-subtitle-timings',
    async (_event, draftPath: string, blocks: unknown[]) => {
      suppressNextChange()
      return callPython('update_subtitle_timings', { draft_path: draftPath, blocks })
    }
  )

  ipcMain.handle('capcut:sync-metadata', async (_event, draftPath: string) => {
    suppressNextChange()
    const draftDir = draftPath.replace(/[/\\][^/\\]+$/, '')
    return callPython('sync_metadata', { draft_dir: draftDir })
  })

  ipcMain.handle(
    'capcut:write-video-segments',
    async (_event, draftPath: string, scenes: unknown[]) => {
      suppressNextChange()
      return callPython('write_video_segments', { draft_path: draftPath, scenes })
    }
  )

  ipcMain.handle('capcut:sync-project', async (_event, params: Record<string, unknown>) => {
    suppressNextChange()
    return callPython('sync_project', {
      draft_path: params.draftPath,
      audio_track_index: params.audioTrackIndex ?? 0,
      mode: params.mode ?? 'audio',
      sync_subtitles: params.syncSubtitles ?? true,
      apply_animations: params.applyAnimations ?? false
    })
  })

  ipcMain.handle('capcut:apply-animations', async (_event, draftPath: string) => {
    suppressNextChange()
    return callPython('apply_animations', { draft_path: draftPath })
  })

  ipcMain.handle('capcut:analyze-project', async (_event, draftPath: string) => {
    return callPython('analyze_project', { draft_path: draftPath })
  })

  ipcMain.handle('capcut:insert-media-batch', async (_event, params: Record<string, unknown>) => {
    suppressNextChange()
    return callPython('insert_media_batch', {
      draft_path: params.draftPath,
      media_files: params.mediaFiles,
      image_duration_ms: params.imageDurationMs ?? 5000
    })
  })

  ipcMain.handle('capcut:create-backup', async (_event, draftPath: string) => {
    return callPython('create_backup', { draft_path: draftPath })
  })

  ipcMain.handle('capcut:insert-audio-batch', async (_event, params: Record<string, unknown>) => {
    suppressNextChange()
    return callPython('insert_audio_batch', {
      draft_path: params.draftPath,
      audio_files: params.audioFiles,
      use_existing_track: params.useExistingTrack ?? false
    })
  })

  ipcMain.handle('capcut:insert-srt', async (_event, params: Record<string, unknown>) => {
    suppressNextChange()
    return callPython('insert_srt', {
      draft_path: params.draftPath,
      srt_file_paths: params.srtFilePaths,
      create_title: params.createTitle ?? true,
      separate_tracks: params.separateTracks ?? false
    })
  })

  ipcMain.handle('capcut:insert-srt-batch', async (_event, params: Record<string, unknown>) => {
    suppressNextChange()
    return callPython('insert_srt_batch', {
      draft_path: params.draftPath,
      srt_files: params.srtFiles,
      create_title: params.createTitle ?? true,
      gap_us: params.gapUs ?? 2000000
    })
  })

  ipcMain.handle('capcut:flatten-audio', async (_event, draftPath: string) => {
    suppressNextChange()
    return callPython('flatten_audio', { draft_path: draftPath })
  })

  ipcMain.handle('capcut:loop-video', async (_event, params: Record<string, unknown>) => {
    suppressNextChange()
    return callPython('loop_video', {
      draft_path: params.draftPath,
      audio_track_index: params.audioTrackIndex ?? 0,
      order: params.order ?? 'random'
    })
  })

  ipcMain.handle('capcut:loop-audio', async (_event, params: Record<string, unknown>) => {
    suppressNextChange()
    return callPython('loop_audio', {
      draft_path: params.draftPath,
      track_index: params.trackIndex,
      target_duration_us: params.targetDurationUs
    })
  })

  ipcMain.handle('capcut:clear-text-segments', async (_event, draftPath: string) => {
    suppressNextChange()
    return callPython('clear_text_segments', { draft_path: draftPath })
  })

  ipcMain.handle('capcut:clear-video-segments', async (_event, draftPath: string) => {
    suppressNextChange()
    return callPython('clear_video_segments', { draft_path: draftPath })
  })

  ipcMain.handle(
    'capcut:generate-srt',
    async (_event, params: Record<string, unknown>) => {
      return callPython('generate_srt', {
        blocks: params.blocks,
        output_path: params.outputPath
      })
    }
  )

  // Debug handlers
  ipcMain.handle('capcut:validate-project', async (_event, projectPath: string) => {
    return callPython('validate_project', { project_path: projectPath })
  })

  ipcMain.handle('capcut:diagnose-root-meta', async (_event, projectName: string) => {
    return callPython('diagnose_root_meta', { project_name: projectName })
  })

  ipcMain.handle('capcut:check-capcut-running', async () => {
    return callPython('check_capcut_running', {})
  })

  ipcMain.handle('capcut:close-capcut', async () => {
    return callPython('close_capcut', {})
  })

  ipcMain.handle('capcut:get-project-health', async (_event, projectPath: string) => {
    return callPython('get_project_health', { project_path: projectPath })
  })

  ipcMain.handle(
    'capcut:debug-sync-state',
    async (_event, params: Record<string, unknown>) => {
      return callPython('debug_sync_state', {
        draft_path: params.draftPath,
        expected_segments: params.expectedSegments
      })
    }
  )
}
