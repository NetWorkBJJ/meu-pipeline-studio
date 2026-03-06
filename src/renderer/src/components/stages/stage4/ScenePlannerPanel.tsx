import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  LayoutGrid,
  Film,
  ImageIcon,
  Clock,
  BarChart3,
  CheckCircle2,
  RefreshCw,
  Loader2
} from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useUIStore } from '@/stores/useUIStore'
import { planScenes } from '@/lib/scenePlanner'
import type { PlanResult } from '@/lib/scenePlanner'
import type { MediaPlatform } from '@/types/project'
import { SceneCard } from './SceneCard'
import { SceneTimeline } from './SceneTimeline'

interface MediaTypeDecision {
  scene_index: number
  media_type: 'video' | 'photo'
  reasoning?: string
}

interface ScenePlannerPanelProps {
  onConfirm: () => void
}

export function ScenePlannerPanel({ onConfirm }: ScenePlannerPanelProps): React.JSX.Element {
  const storyBlocks = useProjectStore((s) => s.storyBlocks)
  const scenes = useProjectStore((s) => s.scenes)
  const config = useProjectStore((s) => s.directorConfig)
  const { setScenes, updateScene, bulkUpdateScenes } = useProjectStore()
  const { addToast } = useUIStore()
  const [stats, setStats] = useState<PlanResult['statistics'] | null>(null)
  const [isDecidingMedia, setIsDecidingMedia] = useState(false)

  const totalDurationMs =
    storyBlocks.length > 0
      ? storyBlocks[storyBlocks.length - 1].endMs - storyBlocks[0].startMs
      : 0

  const handlePlan = async (): Promise<void> => {
    if (storyBlocks.length === 0) {
      addToast({ type: 'warning', message: 'Nenhum bloco de texto disponivel.' })
      return
    }

    const result = planScenes(storyBlocks, config)
    setScenes(result.scenes)
    setStats(result.statistics)

    // For ai-decided mode, call LLM to decide media types per scene
    if (config.sequenceMode === 'ai-decided') {
      setIsDecidingMedia(true)
      try {
        const sceneData = result.scenes.map((s) => {
          const sceneBlocks = storyBlocks.filter((b) => s.blockIds.includes(b.id))
          return {
            index: s.index,
            block_texts: sceneBlocks.map((b) => b.text).join(' '),
            duration_ms: s.durationMs,
            narrative_context: s.narrativeContext || ''
          }
        })

        const response = (await window.api.directorDecideMediaTypes({
          provider: config.llmProvider,
          model: config.llmModel || undefined,
          scenes: sceneData
        })) as { decisions: MediaTypeDecision[] }

        if (response.decisions && response.decisions.length > 0) {
          const updates = response.decisions
            .map((d) => {
              const scene = result.scenes.find((s) => s.index === d.scene_index)
              if (!scene) return null
              const mediaType = d.media_type === 'photo' ? 'photo' : 'video'
              const platform: MediaPlatform = mediaType === 'photo' ? 'nano-banana-2' : 'vo3'
              return { id: scene.id, updates: { mediaType, platform } }
            })
            .filter(Boolean) as Array<{ id: string; updates: { mediaType: 'video' | 'photo'; platform: MediaPlatform } }>

          if (updates.length > 0) {
            bulkUpdateScenes(updates)
            const videoCount = updates.filter((u) => u.updates.mediaType === 'video').length
            const imageCount = updates.filter((u) => u.updates.mediaType === 'photo').length
            setStats((prev) => prev ? { ...prev, videoCount, imageCount } : prev)
          }

          addToast({
            type: 'success',
            message: `${result.scenes.length} cenas planejadas. IA decidiu: ${response.decisions.filter((d) => d.media_type === 'video').length} videos, ${response.decisions.filter((d) => d.media_type === 'photo').length} fotos.`
          })
        } else {
          addToast({
            type: 'success',
            message: `${result.scenes.length} cenas planejadas (${result.statistics.videoCount} videos, ${result.statistics.imageCount} fotos).`
          })
        }
      } catch (err) {
        console.error('[ScenePlanner] Failed to decide media types via LLM:', err)
        addToast({
          type: 'warning',
          message: `Cenas planejadas, mas IA nao conseguiu decidir tipos de midia. Usando distribuicao padrao.`
        })
      } finally {
        setIsDecidingMedia(false)
      }
    } else {
      addToast({
        type: 'success',
        message: `${result.scenes.length} cenas planejadas (${result.statistics.videoCount} videos, ${result.statistics.imageCount} fotos).`
      })
    }
  }

  const handleReplan = (): void => {
    handlePlan()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-text-muted" />
            <span className="text-xs text-text">
              {(totalDurationMs / 1000).toFixed(1)}s total
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5 text-text-muted" />
            <span className="text-xs text-text">{scenes.length} cenas</span>
          </div>
          {stats && (
            <>
              <div className="flex items-center gap-1">
                <Film className="h-3 w-3 text-teal-400" />
                <span className="text-xs text-teal-400">{stats.videoCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <ImageIcon className="h-3 w-3 text-violet-400" />
                <span className="text-xs text-violet-400">{stats.imageCount}</span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {scenes.length > 0 && (
            <button
              onClick={handleReplan}
              className="flex items-center gap-1 rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:text-text"
            >
              <RefreshCw className="h-3 w-3" />
              Replanejar
            </button>
          )}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handlePlan}
            disabled={storyBlocks.length === 0 || isDecidingMedia}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDecidingMedia ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LayoutGrid className="h-3.5 w-3.5" />
            )}
            {isDecidingMedia ? 'IA decidindo tipos...' : 'Planejar cenas'}
          </motion.button>
        </div>
      </div>

      {/* Scene Timeline visualization */}
      {scenes.length > 0 && (
        <SceneTimeline scenes={scenes} totalDurationMs={totalDurationMs} />
      )}

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-4 gap-2">
          {[
            {
              icon: BarChart3,
              label: 'Media',
              value: `${(stats.avgDurationMs / 1000).toFixed(1)}s`
            },
            {
              icon: Clock,
              label: 'Min',
              value: `${(stats.minDurationMs / 1000).toFixed(1)}s`
            },
            {
              icon: Clock,
              label: 'Max',
              value: `${(stats.maxDurationMs / 1000).toFixed(1)}s`
            },
            {
              icon: BarChart3,
              label: 'Cobertura',
              value: `${stats.coveragePercent}%`
            }
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="rounded-lg border border-border bg-surface p-2 text-center"
            >
              <Icon className="mx-auto h-3.5 w-3.5 text-text-muted mb-1" />
              <div className="text-xs font-medium text-text">{value}</div>
              <div className="text-[10px] text-text-muted">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Scene list */}
      {scenes.length > 0 && (
        <>
          {/* Confirm */}
          <div className="flex justify-end">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={onConfirm}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Confirmar planejamento
            </motion.button>
          </div>

          <div className="overflow-auto max-h-[calc(100vh-480px)] space-y-2">
            {scenes.map((scene) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                blocks={storyBlocks}
                onUpdate={(id, updates) => updateScene(id, updates)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
