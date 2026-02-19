import { useState } from 'react'
import { motion } from 'framer-motion'
import { FolderOpen, Loader2, Image } from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'
import { msToDisplay } from '@/lib/time'

export function Stage5Media(): React.JSX.Element {
  const { scenes, setScenes, capCutDraftPath, mediaPreset } = useProjectStore()
  const { completeStage } = useStageStore()
  const { addToast } = useUIStore()
  const [batchLoading, setBatchLoading] = useState(false)
  const [imageDuration, setImageDuration] = useState(mediaPreset.defaultDurationMs / 1000)

  const handleSelectMedia = async (sceneId: string): Promise<void> => {
    try {
      const files = await window.api.selectFiles([
        { name: 'Midia', extensions: ['mp4', 'mov', 'avi', 'jpg', 'jpeg', 'png', 'webp'] }
      ])
      if (files.length === 0) return

      const updated = scenes.map((s) => (s.id === sceneId ? { ...s, mediaPath: files[0] } : s))
      setScenes(updated)
      addToast({ type: 'success', message: 'Midia selecionada.' })
    } catch {
      addToast({ type: 'error', message: 'Erro ao selecionar midia.' })
    }
  }

  const handleBatchImport = async (): Promise<void> => {
    if (!capCutDraftPath) {
      addToast({ type: 'error', message: 'Nenhum projeto CapCut selecionado.' })
      return
    }

    try {
      const dir = await window.api.selectDirectory()
      if (!dir) return

      setBatchLoading(true)

      const files = await window.api.selectFiles([
        { name: 'Midia', extensions: ['mp4', 'mov', 'avi', 'mkv', 'jpg', 'jpeg', 'png', 'webp'] }
      ])
      if (files.length === 0) {
        setBatchLoading(false)
        return
      }

      const result = (await window.api.insertMediaBatch({
        draftPath: capCutDraftPath,
        mediaFiles: files,
        imageDurationMs: Math.round(imageDuration * 1000)
      })) as { inserted: number; videos: number; images: number }

      await window.api.syncMetadata(capCutDraftPath)

      addToast({
        type: 'success',
        message: `${result.inserted} midias inseridas (${result.videos} videos, ${result.images} fotos).`
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao importar midias'
      addToast({ type: 'error', message })
    } finally {
      setBatchLoading(false)
    }
  }

  const assignedCount = scenes.filter((s) => s.mediaPath).length
  const allAssigned = scenes.length > 0 && assignedCount === scenes.length

  const handleConfirm = (): void => {
    if (!allAssigned) {
      addToast({ type: 'warning', message: 'Atribua midia a todas as cenas antes de confirmar.' })
      return
    }
    completeStage(5)
    addToast({ type: 'success', message: 'Etapa 5 concluida. Avance para Insercao.' })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-text">Selecao de Midias</h3>
          <p className="text-xs text-text-muted mt-1">
            Atribua midias por cena ou importe em lote direto no CapCut.
          </p>
        </div>
        {scenes.length > 0 && (
          <button
            onClick={handleConfirm}
            disabled={!allAssigned}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirmar midias
          </button>
        )}
      </div>

      {/* Batch import section */}
      <div className="rounded-lg border border-border bg-surface p-4 shadow-surface">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-text">Insercao em lote</p>
            <p className="text-[11px] text-text-muted mt-0.5">
              Selecione multiplos arquivos para inserir sequencialmente na timeline do CapCut.
            </p>
          </div>
          <button
            onClick={handleBatchImport}
            disabled={batchLoading || !capCutDraftPath}
            className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-all hover:bg-primary/20 disabled:opacity-40"
          >
            {batchLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FolderOpen className="h-3 w-3" />
            )}
            {batchLoading ? 'Importando...' : 'Selecionar arquivos'}
          </button>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <Image className="h-3 w-3" />
            Duracao de fotos:
          </label>
          <input
            type="number"
            value={imageDuration}
            onChange={(e) => setImageDuration(Number(e.target.value) || 5)}
            min={1}
            max={30}
            step={0.5}
            className="w-16 rounded border border-border bg-bg px-2 py-0.5 text-xs text-text text-center outline-none focus:border-primary"
          />
          <span className="text-[11px] text-text-muted">segundos</span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span>{assignedCount} / {scenes.length} cenas com midia</span>
      </div>

      <div className="space-y-2 overflow-auto max-h-[calc(100vh-340px)]">
        {scenes.map((scene) => (
          <motion.div
            key={scene.id}
            whileHover={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3.5 shadow-surface"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {scene.index}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span>
                  {msToDisplay(scene.startMs)} - {msToDisplay(scene.endMs)}
                </span>
                <span className="rounded bg-bg px-1.5 py-0.5">{scene.mediaType}</span>
                {scene.mediaKeyword && <span className="text-primary">{scene.mediaKeyword}</span>}
              </div>
              {scene.mediaPath ? (
                <p className="mt-0.5 truncate text-xs text-success">{scene.mediaPath}</p>
              ) : (
                <p className="mt-0.5 text-xs text-text-muted/50">Sem midia</p>
              )}
            </div>
            <button
              onClick={() => handleSelectMedia(scene.id)}
              className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-text-muted transition-all duration-150 hover:bg-surface-hover hover:text-text active:scale-[0.98]"
            >
              {scene.mediaPath ? 'Trocar' : 'Selecionar'}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
