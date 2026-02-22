import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles,
  Download,
  Copy,
  Check,
  CheckCircle2,
  Film,
  ImageIcon,
  Loader2,
  MapPin,
  Users
} from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useUIStore } from '@/stores/useUIStore'
import { buildLlmPayload, parseTakeOutput, formatTake } from '@/lib/promptTemplate'
import { PromptEditor } from './PromptEditor'

interface PromptStudioProps {
  onConfirm: () => void
}

export function PromptStudio({ onConfirm }: PromptStudioProps): React.JSX.Element {
  const scenes = useProjectStore((s) => s.scenes)
  const storyBlocks = useProjectStore((s) => s.storyBlocks)
  const config = useProjectStore((s) => s.directorConfig)
  const characterRefs = useProjectStore((s) => s.characterRefs)
  const progress = useProjectStore((s) => s.directorProgress)
  const { updateScene, bulkUpdateScenes, setDirectorProgress } = useProjectStore()
  const { addToast } = useUIStore()

  const [copiedAll, setCopiedAll] = useState(false)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [chapterNumber, setChapterNumber] = useState(1)
  const [startingTakeNumber, setStartingTakeNumber] = useState(1)

  const promptsGenerated = scenes.filter((s) => s.prompt.trim()).length

  const handleGenerateAll = async (): Promise<void> => {
    if (scenes.length === 0) return

    console.group('[Director] Gerar takes - inicio')
    console.log('Config:', {
      provider: config.llmProvider,
      model: config.llmModel,
      sequenceMode: config.sequenceMode,
      chapterNumber,
      startingTakeNumber
    })
    console.log('Scenes:', scenes.length, scenes.map((s) => ({
      id: s.id,
      index: s.index,
      mediaType: s.mediaType,
      durationMs: s.durationMs,
      blockIds: s.blockIds
    })))
    console.log('StoryBlocks:', storyBlocks.length)
    console.log('CharacterRefs:', characterRefs.map((c) => ({
      name: c.name,
      label: c.label,
      role: c.role,
      chapters: c.chapters
    })))
    console.groupEnd()

    setDirectorProgress({
      isGeneratingPrompts: true,
      currentSceneIndex: 0,
      totalScenes: scenes.length,
      error: null
    })

    try {
      // First, analyze narrative if in ai-decided mode
      if (config.sequenceMode === 'ai-decided') {
        const fullScript = storyBlocks.map((b) => b.text).join(' ')
        const analysis = (await window.api.directorAnalyzeNarrative({
          provider: config.llmProvider,
          model: config.llmModel || undefined,
          script_text: fullScript,
          scene_count: scenes.length
        })) as {
          scenes?: Array<{
            scene_index: number
            narrative_context: string
            scene_type: string
            suggested_media_type?: string
          }>
        }

        if (analysis.scenes) {
          const narrativeUpdates = analysis.scenes
            .map((a) => {
              const scene = scenes.find((s) => s.index === a.scene_index)
              if (!scene) return null
              return {
                id: scene.id,
                updates: {
                  narrativeContext: a.narrative_context || '',
                  sceneType: a.scene_type || '',
                  ...(a.suggested_media_type && {
                    mediaType: a.suggested_media_type as 'video' | 'photo',
                    platform:
                      a.suggested_media_type === 'video'
                        ? ('vo3' as const)
                        : ('nano-banana-pro' as const)
                  })
                }
              }
            })
            .filter(Boolean) as Array<{ id: string; updates: Partial<(typeof scenes)[0]> }>

          if (narrativeUpdates.length > 0) {
            bulkUpdateScenes(narrativeUpdates)
          }
        }
      }

      // Build payload with Master Prompt V12
      const { systemPrompt, userMessage } = buildLlmPayload(
        storyBlocks,
        scenes,
        characterRefs,
        chapterNumber,
        startingTakeNumber
      )

      console.group('[Director] Payload construido')
      console.log('System prompt length:', systemPrompt.length, 'chars')
      console.log('User message length:', userMessage.length, 'chars')
      console.log('User message (primeiros 2000 chars):\n', userMessage.slice(0, 2000))
      console.groupEnd()

      // Batch generate all TAKES at once
      const result = (await window.api.directorGeneratePrompts({
        provider: config.llmProvider,
        model: config.llmModel || undefined,
        system_prompt: systemPrompt,
        user_message: userMessage
      })) as {
        takes: Array<{
          take_number: number
          description: string
          negative_prompt: string
          character_anchor: string
          environment_lock: string
        }>
        success: boolean
        error?: string
        raw_response?: string
      }

      console.group('[Director] Resultado do LLM')
      console.log('Success:', result.success)
      console.log('Takes recebidos:', result.takes?.length ?? 0)
      console.log('Error:', result.error || '(nenhum)')
      if (result.takes?.length > 0) {
        console.log('Takes:', result.takes.map((t) => ({
          take_number: t.take_number,
          desc: t.description?.slice(0, 80) + '...',
          character_anchor: t.character_anchor,
          environment_lock: t.environment_lock
        })))
      }
      if (result.raw_response) {
        console.log('Raw response (primeiros 1000 chars):\n', result.raw_response.slice(0, 1000))
      }
      console.groupEnd()

      if (result.success && result.takes.length > 0) {
        // Assign takes to scenes by expected take number, fallback to index
        const promptUpdates = scenes
          .map((scene, idx) => {
            const expectedTakeNum = startingTakeNumber + idx
            const take =
              result.takes.find((t) => t.take_number === expectedTakeNum) || result.takes[idx]
            if (!take) return null
            return {
              id: scene.id,
              updates: {
                prompt: formatTake({
                  takeNumber: take.take_number,
                  description: take.description,
                  negativePrompt: take.negative_prompt,
                  characterAnchor: take.character_anchor,
                  environmentLock: take.environment_lock
                }),
                generationStatus: 'generated' as const,
                promptRevision: scene.promptRevision + 1,
                narrativeContext: take.environment_lock
              }
            }
          })
          .filter(Boolean) as Array<{ id: string; updates: Partial<(typeof scenes)[0]> }>

        console.log('[Director] Matching takes->scenes:', promptUpdates.length, 'de', scenes.length, 'cenas mapeadas')

        if (promptUpdates.length > 0) {
          bulkUpdateScenes(promptUpdates)
        }

        addToast({
          type: 'success',
          message: `${result.takes.length} takes gerados para ${scenes.length} cenas.`
        })
      } else if (result.raw_response) {
        // Try to parse on the frontend as fallback
        console.log('[Director] Backend parse falhou, tentando fallback frontend...')
        const parsed = parseTakeOutput(result.raw_response)
        console.log('[Director] Fallback frontend parseou:', parsed.length, 'takes')
        if (parsed.length > 0) {
          const promptUpdates = scenes
            .map((scene, idx) => {
              const expectedTakeNum = startingTakeNumber + idx
              const take =
                parsed.find((t) => t.takeNumber === expectedTakeNum) || parsed[idx]
              if (!take) return null
              return {
                id: scene.id,
                updates: {
                  prompt: formatTake(take),
                  generationStatus: 'generated' as const,
                  promptRevision: scene.promptRevision + 1,
                  narrativeContext: take.environmentLock
                }
              }
            })
            .filter(Boolean) as Array<{ id: string; updates: Partial<(typeof scenes)[0]> }>

          if (promptUpdates.length > 0) {
            bulkUpdateScenes(promptUpdates)
          }

          addToast({
            type: 'success',
            message: `${parsed.length} takes parseados (fallback frontend).`
          })
        } else {
          addToast({ type: 'error', message: result.error || 'Falha ao parsear resposta do LLM.' })
        }
      } else {
        addToast({ type: 'error', message: result.error || 'Erro ao gerar prompts.' })
      }
    } catch (err) {
      console.error('[Director] ERRO na geracao:', err)
      const message = err instanceof Error ? err.message : 'Erro ao gerar prompts'
      setDirectorProgress({ error: message })
      addToast({ type: 'error', message })
    } finally {
      setDirectorProgress({ isGeneratingPrompts: false })
    }
  }

  const handleRegenerateOne = async (sceneId: string): Promise<void> => {
    const scene = scenes.find((s) => s.id === sceneId)
    if (!scene) return

    setRegeneratingId(sceneId)
    try {
      const sceneBlocks = storyBlocks.filter((b) => scene.blockIds.includes(b.id))
      const sceneIdx = scenes.findIndex((s) => s.id === sceneId)
      const takeNum = startingTakeNumber + (sceneIdx >= 0 ? sceneIdx : 0)
      console.log('[Director] Regenerar take', takeNum, 'para cena', scene.index, '| blocos:', sceneBlocks.length)
      const { systemPrompt } = buildLlmPayload(
        storyBlocks,
        scenes,
        characterRefs,
        chapterNumber,
        startingTakeNumber
      )

      const singleUserMessage = `Regenere apenas o TAKE ${takeNum}:
Texto da legenda: "${sceneBlocks.map((b) => b.text).join(' ')}"
Duracao: ${(scene.durationMs / 1000).toFixed(1)}s
Tipo: ${scene.mediaType}

Gere apenas 1 TAKE no formato padrao. O numero do TAKE deve ser ${takeNum}.`

      const result = (await window.api.directorGeneratePrompts({
        provider: config.llmProvider,
        model: config.llmModel || undefined,
        system_prompt: systemPrompt,
        user_message: singleUserMessage
      })) as {
        takes: Array<{
          take_number: number
          description: string
          negative_prompt: string
          character_anchor: string
          environment_lock: string
        }>
        success: boolean
        raw_response?: string
      }

      const rawTake = result.takes?.[0]
      let parsedTake = rawTake
        ? {
            takeNumber: rawTake.take_number || takeNum,
            description: rawTake.description,
            negativePrompt: rawTake.negative_prompt,
            characterAnchor: rawTake.character_anchor,
            environmentLock: rawTake.environment_lock
          }
        : null

      if (!parsedTake && result.raw_response) {
        const parsed = parseTakeOutput(result.raw_response)
        parsedTake = parsed[0] || null
      }

      if (parsedTake) {
        updateScene(sceneId, {
          prompt: formatTake(parsedTake),
          generationStatus: 'generated',
          promptRevision: scene.promptRevision + 1
        })
        addToast({ type: 'success', message: `Take ${takeNum} regenerado.` })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao regenerar'
      addToast({ type: 'error', message })
    } finally {
      setRegeneratingId(null)
    }
  }

  const handleExport = async (): Promise<void> => {
    try {
      const exportData = scenes.map((s) => ({
        index: s.index,
        filename_hint: s.filenameHint,
        media_type: s.mediaType,
        platform: s.platform,
        duration_ms: s.durationMs,
        prompt: s.prompt,
        narrative_context: s.narrativeContext
      }))

      const result = (await window.api.directorExportPrompts({
        scenes: exportData,
        format: 'markdown'
      })) as { canceled?: boolean }

      if (!result.canceled) {
        addToast({ type: 'success', message: 'Prompts exportados.' })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao exportar'
      addToast({ type: 'error', message })
    }
  }

  const handleCopyAll = async (): Promise<void> => {
    const text = scenes.map((s) => s.prompt || '(sem prompt)').join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 1500)
  }

  // Extract TAKE metadata from prompt text
  const extractTakeInfo = (
    prompt: string
  ): { characterAnchor: string; environmentLock: string } | null => {
    const charMatch = prompt.match(/Character Anchor:\s*(.+)/i)
    const envMatch = prompt.match(/Environment Lock:\s*(.+)/i)
    if (!charMatch && !envMatch) return null
    return {
      characterAnchor: charMatch?.[1]?.trim() || '-',
      environmentLock: envMatch?.[1]?.trim() || ''
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-muted">Capitulo:</span>
            <input
              type="number"
              min={1}
              value={chapterNumber}
              onChange={(e) => setChapterNumber(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-12 rounded border border-border bg-bg px-1.5 py-0.5 text-xs tabular-nums text-text text-center focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-muted">Take inicial:</span>
            <input
              type="number"
              min={1}
              value={startingTakeNumber}
              onChange={(e) => setStartingTakeNumber(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-14 rounded border border-border bg-bg px-1.5 py-0.5 text-xs tabular-nums text-text text-center focus:border-primary focus:outline-none"
            />
          </div>
          <span className="text-xs text-text">
            {promptsGenerated}/{scenes.length} takes gerados
          </span>
          {progress.isGeneratingPrompts && (
            <div className="flex items-center gap-1.5 text-xs text-primary">
              <Loader2 className="h-3 w-3 animate-spin" />
              Gerando...
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAll}
            disabled={promptsGenerated === 0}
            className="flex items-center gap-1 rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:text-text disabled:opacity-40"
          >
            {copiedAll ? (
              <Check className="h-3 w-3 text-green-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            Copiar todos
          </button>
          <button
            onClick={handleExport}
            disabled={promptsGenerated === 0}
            className="flex items-center gap-1 rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:text-text disabled:opacity-40"
          >
            <Download className="h-3 w-3" />
            Exportar
          </button>
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGenerateAll}
            disabled={progress.isGeneratingPrompts || scenes.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Gerar takes
          </motion.button>
        </div>
      </div>

      {/* Scene/take list */}
      <div className="overflow-auto max-h-[calc(100vh-380px)] space-y-3">
        {scenes.map((scene) => {
          const sceneBlocks = storyBlocks.filter((b) => scene.blockIds.includes(b.id))
          const blockText = sceneBlocks.map((b) => b.text).join(' ')
          const isVideo = scene.mediaType === 'video'
          const takeInfo = scene.prompt ? extractTakeInfo(scene.prompt) : null

          return (
            <div
              key={scene.id}
              className={`rounded-lg border bg-surface p-3 ${
                isVideo ? 'border-l-2 border-l-teal-500/50' : 'border-l-2 border-l-violet-500/50'
              } border-border`}
            >
              {/* Scene header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                    {scene.index}
                  </span>
                  <span className="text-[10px] text-text-muted">{scene.filenameHint}</span>
                  <span
                    className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      isVideo
                        ? 'bg-teal-500/10 text-teal-400'
                        : 'bg-violet-500/10 text-violet-400'
                    }`}
                  >
                    {isVideo ? (
                      <Film className="h-2.5 w-2.5" />
                    ) : (
                      <ImageIcon className="h-2.5 w-2.5" />
                    )}
                    {isVideo ? 'Video' : 'Foto'}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {(scene.durationMs / 1000).toFixed(1)}s
                  </span>
                </div>
              </div>

              {/* Subtitle text */}
              <p className="text-[11px] text-text mb-2 line-clamp-2 italic">
                &quot;{blockText || scene.description}&quot;
              </p>

              {/* TAKE metadata badges */}
              {takeInfo && (
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {takeInfo.characterAnchor && takeInfo.characterAnchor !== '-' && (
                    <span className="flex items-center gap-1 rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-400">
                      <Users className="h-2.5 w-2.5" />
                      {takeInfo.characterAnchor}
                    </span>
                  )}
                  {takeInfo.environmentLock && (
                    <span className="flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-400">
                      <MapPin className="h-2.5 w-2.5" />
                      {takeInfo.environmentLock}
                    </span>
                  )}
                </div>
              )}

              {/* Prompt editor */}
              <PromptEditor
                prompt={scene.prompt}
                onChange={(prompt) =>
                  updateScene(scene.id, { prompt, promptRevision: scene.promptRevision + 1 })
                }
                onRegenerate={() => handleRegenerateOne(scene.id)}
                isRegenerating={regeneratingId === scene.id}
                label="Take"
              />
            </div>
          )
        })}
      </div>

      {/* Confirm */}
      {promptsGenerated > 0 && (
        <div className="flex justify-end pt-2 border-t border-border">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Confirmar prompts
          </motion.button>
        </div>
      )}
    </div>
  )
}
