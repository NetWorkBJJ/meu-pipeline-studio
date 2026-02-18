import { useState } from 'react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'

type InsertStatus = 'idle' | 'inserting' | 'done' | 'error'

interface InsertLog {
  step: string
  status: 'pending' | 'running' | 'done' | 'error'
  detail?: string
}

export function Stage6Insert(): React.JSX.Element {
  const [status, setStatus] = useState<InsertStatus>('idle')
  const [logs, setLogs] = useState<InsertLog[]>([])
  const { storyBlocks, scenes, capCutDraftPath } = useProjectStore()
  const { completeStage } = useStageStore()
  const { addToast } = useUIStore()

  const addLog = (step: string, logStatus: InsertLog['status'], detail?: string): void => {
    setLogs((prev) => {
      const existing = prev.findIndex((l) => l.step === step)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { step, status: logStatus, detail }
        return updated
      }
      return [...prev, { step, status: logStatus, detail }]
    })
  }

  const handleInsert = async (): Promise<void> => {
    if (!capCutDraftPath) {
      addToast({ type: 'error', message: 'Nenhum projeto CapCut selecionado.' })
      return
    }

    setStatus('inserting')
    setLogs([])

    try {
      addLog('Escrevendo legendas...', 'running')
      const textBlocks = storyBlocks.map((b) => ({
        text: b.text,
        start_ms: b.startMs,
        end_ms: b.endMs,
      }))
      await window.api.writeTextSegments(capCutDraftPath, textBlocks)
      addLog('Escrevendo legendas...', 'done', `${textBlocks.length} legendas`)

      const scenesWithMedia = scenes.filter((s) => s.mediaPath)
      if (scenesWithMedia.length > 0) {
        addLog('Escrevendo midias...', 'running')
        const videoScenes = scenesWithMedia.map((s) => ({
          media_path: s.mediaPath,
          start_ms: s.startMs,
          end_ms: s.endMs,
          media_type: s.mediaType,
        }))
        await window.api.writeVideoSegments(capCutDraftPath, videoScenes)
        addLog('Escrevendo midias...', 'done', `${videoScenes.length} midias`)
      }

      addLog('Sincronizando metadata...', 'running')
      await window.api.syncMetadata(capCutDraftPath)
      addLog('Sincronizando metadata...', 'done')

      setStatus('done')
      completeStage(6)
      addToast({ type: 'success', message: 'Insercao concluida! Abra o projeto no CapCut.' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      addLog('Erro', 'error', message)
      setStatus('error')
      addToast({ type: 'error', message: 'Erro durante a insercao.' })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-medium text-text">Insercao no CapCut</h3>
        <p className="text-xs text-text-muted mt-1">
          Escreve todas as legendas e midias no projeto CapCut e sincroniza os metadados.
        </p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 rounded-md border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Legendas</p>
          <p className="text-2xl font-semibold text-text mt-1">{storyBlocks.length}</p>
        </div>
        <div className="flex-1 rounded-md border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Midias</p>
          <p className="text-2xl font-semibold text-text mt-1">
            {scenes.filter((s) => s.mediaPath).length}
          </p>
        </div>
        <div className="flex-1 rounded-md border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Projeto</p>
          <p className="mt-1 truncate text-xs text-text-muted">
            {capCutDraftPath || 'Nao selecionado'}
          </p>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="rounded-md border border-border bg-surface p-3 space-y-2">
          {logs.map((log, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={`h-2 w-2 shrink-0 rounded-full ${
                log.status === 'done' ? 'bg-success' :
                log.status === 'running' ? 'bg-primary animate-pulse' :
                log.status === 'error' ? 'bg-error' : 'bg-border'
              }`} />
              <span className="text-text">{log.step}</span>
              {log.detail && <span className="text-text-muted">{log.detail}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {status === 'done' && (
          <span className="self-center text-xs text-success">Concluido com sucesso!</span>
        )}
        <button
          onClick={handleInsert}
          disabled={status === 'inserting' || !capCutDraftPath}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === 'inserting' ? 'Inserindo...' :
           status === 'done' ? 'Inserir novamente' :
           'Inserir no CapCut'}
        </button>
      </div>
    </div>
  )
}
