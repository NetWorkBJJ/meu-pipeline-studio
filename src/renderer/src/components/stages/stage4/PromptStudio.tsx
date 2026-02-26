import { useState, useMemo, useRef } from 'react'
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
  Users,
  BookOpen,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Clock,
  Square
} from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useUIStore } from '@/stores/useUIStore'
import { buildLlmPayload, parseTakeOutput, formatTake, computeChunks, buildFixPrompt } from '@/lib/promptTemplate'
import type { ParsedTake } from '@/lib/promptTemplate'
import { getCharactersForChapter } from '@/lib/characterParser'
import { validatePromptQuality, autoFixTakes, identifyFailingTakes } from '@/lib/promptValidator'
import type { QualityReport } from '@/lib/promptValidator'
import type { BatchResult } from '@/types/project'
import { PromptEditor } from './PromptEditor'

interface TakeRecord {
  take_number: number
  description: string
  negative_prompt: string
  character_anchor: string
  environment_lock: string
}

interface PromptStudioProps {
  onConfirm: () => void
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function updateBatchResult(
  results: BatchResult[],
  idx: number,
  updates: Partial<BatchResult>
): BatchResult[] {
  return results.map((r, i) => (i === idx ? { ...r, ...updates } : r))
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
  const [copiedVideos, setCopiedVideos] = useState(false)
  const [copiedPhotos, setCopiedPhotos] = useState(false)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [startingTakeNumber, setStartingTakeNumber] = useState(1)
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null)
  const [showQualityDetails, setShowQualityDetails] = useState(false)
  const [chunkSize, setChunkSize] = useState(60)
  const abortRef = useRef<AbortController | null>(null)

  const promptsGenerated = scenes.filter((s) => s.prompt.trim()).length

  const { videoCount, photoCount } = useMemo(() => {
    let vc = 0
    let pc = 0
    for (const s of scenes) {
      if (!s.prompt.trim()) continue
      if (s.mediaType === 'video') vc++
      else pc++
    }
    return { videoCount: vc, photoCount: pc }
  }, [scenes])

  const detectedChapters = useMemo(() => {
    const chapters = [
      ...new Set(
        scenes
          .map((s) => s.chapter)
          .filter((c): c is number => typeof c === 'number')
      )
    ].sort((a, b) => a - b)
    return chapters.length > 0 ? chapters : [1]
  }, [scenes])

  // Elapsed time from generation start
  const elapsed = useMemo(() => {
    if (!progress.startedAt || !progress.isGeneratingPrompts) return 0
    return Date.now() - progress.startedAt
  }, [progress.startedAt, progress.isGeneratingPrompts, progress.completedTakes])

  const handleCancel = (): void => {
    if (abortRef.current) {
      abortRef.current.abort()
      addToast({ type: 'info', message: 'Geracao sera cancelada apos o lote atual.' })
    }
  }

  const handleGenerateAll = async (): Promise<void> => {
    if (scenes.length === 0) return

    const controller = new AbortController()
    abortRef.current = controller

    const chunks = computeChunks(scenes.length, chunkSize)

    const initialBatchResults: BatchResult[] = chunks.map((chunk, i) => ({
      batchIndex: i,
      startTake: startingTakeNumber + chunk.startIndex,
      endTake: startingTakeNumber + chunk.endIndex - 1,
      sceneCount: chunk.endIndex - chunk.startIndex,
      takesGenerated: 0,
      status: 'pending' as const
    }))

    setDirectorProgress({
      isGeneratingPrompts: true,
      currentSceneIndex: 0,
      totalScenes: scenes.length,
      error: null,
      currentBatch: 0,
      totalBatches: chunks.length,
      batchStartTake: startingTakeNumber,
      batchEndTake: startingTakeNumber + (chunks[0]?.endIndex ?? 0) - (chunks[0]?.startIndex ?? 0) - 1,
      completedTakes: 0,
      batchResults: initialBatchResults,
      startedAt: Date.now()
    })

    try {
      // Narrative analysis (once, before batch loop)
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
                        : ('nano-banana-2' as const)
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

      let allGeneratedTakes: TakeRecord[] = []
      let currentBatchResults = [...initialBatchResults]

      for (let batchIdx = 0; batchIdx < chunks.length; batchIdx++) {
        if (controller.signal.aborted) {
          // Mark remaining as cancelled
          for (let j = batchIdx; j < chunks.length; j++) {
            currentBatchResults = updateBatchResult(currentBatchResults, j, { status: 'cancelled' })
          }
          setDirectorProgress({ batchResults: currentBatchResults })
          break
        }

        const chunk = chunks[batchIdx]
        const chunkStartTake = startingTakeNumber + chunk.startIndex
        const chunkEndTake = startingTakeNumber + chunk.endIndex - 1

        // Mark batch as in_progress
        currentBatchResults = updateBatchResult(currentBatchResults, batchIdx, { status: 'in_progress' })
        setDirectorProgress({
          currentBatch: batchIdx,
          batchStartTake: chunkStartTake,
          batchEndTake: chunkEndTake,
          currentSceneIndex: chunk.startIndex,
          batchResults: currentBatchResults
        })

        const batchStart = Date.now()

        try {
          const { systemPrompt, userMessage } = buildLlmPayload(
            storyBlocks,
            scenes,
            characterRefs,
            startingTakeNumber,
            chunk,
            { batchNumber: batchIdx + 1, totalBatches: chunks.length }
          )

          console.log(`[Director] Lote ${batchIdx + 1}/${chunks.length}: takes ${chunkStartTake}-${chunkEndTake} | payload ${userMessage.length} chars`)

          const result = (await window.api.directorGeneratePrompts({
            provider: config.llmProvider,
            model: config.llmModel || undefined,
            system_prompt: systemPrompt,
            user_message: userMessage
          })) as {
            takes: TakeRecord[]
            success: boolean
            error?: string
            raw_response?: string
          }

          let batchTakes: TakeRecord[] = []

          if (result.success && result.takes?.length > 0) {
            batchTakes = result.takes
          } else if (result.raw_response) {
            const parsed = parseTakeOutput(result.raw_response)
            batchTakes = parsed.map((t) => ({
              take_number: t.takeNumber,
              description: t.description,
              negative_prompt: t.negativePrompt,
              character_anchor: t.characterAnchor,
              environment_lock: t.environmentLock
            }))
          }

          if (batchTakes.length > 0) {
            allGeneratedTakes.push(...batchTakes)

            // Apply this batch's takes to scenes immediately
            const chunkScenes = scenes.slice(chunk.startIndex, chunk.endIndex)
            const promptUpdates = chunkScenes
              .map((scene, idx) => {
                const expectedTakeNum = chunkStartTake + idx
                const take =
                  batchTakes.find((t) => t.take_number === expectedTakeNum) || batchTakes[idx]
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

            if (promptUpdates.length > 0) {
              bulkUpdateScenes(promptUpdates)
            }

            currentBatchResults = updateBatchResult(currentBatchResults, batchIdx, {
              status: 'success',
              takesGenerated: batchTakes.length,
              durationMs: Date.now() - batchStart
            })
          } else {
            currentBatchResults = updateBatchResult(currentBatchResults, batchIdx, {
              status: 'error',
              error: result.error || 'Nenhum take parseado',
              durationMs: Date.now() - batchStart
            })
          }
        } catch (batchErr) {
          const message = batchErr instanceof Error ? batchErr.message : 'Erro no lote'
          currentBatchResults = updateBatchResult(currentBatchResults, batchIdx, {
            status: 'error',
            error: message,
            durationMs: Date.now() - batchStart
          })
          console.error(`[Director] Lote ${batchIdx + 1} falhou:`, batchErr)
        }

        setDirectorProgress({
          completedTakes: allGeneratedTakes.length,
          batchResults: currentBatchResults
        })
      }

      // Quality validation + auto-fix + LLM fix (all automatic)
      if (allGeneratedTakes.length > 0) {
        let parsedForValidation: ParsedTake[] = allGeneratedTakes.map((t) => ({
          takeNumber: t.take_number,
          description: t.description,
          negativePrompt: t.negative_prompt,
          characterAnchor: t.character_anchor,
          environmentLock: t.environment_lock
        }))

        // First validation pass
        let report = validatePromptQuality(parsedForValidation, scenes, characterRefs, startingTakeNumber)

        // Phase A: deterministic auto-fix
        const FIXABLE_RULES = new Set([
          'take-sequence', 'no-duration-tag', 'no-abbreviation', 'character-names-valid',
          'max-characters-per-anchor', 'negative-prompt-present', 'extended-negative-on-transition'
        ])
        const hasFixableFailures = report.rules.some((r) => !r.passed && FIXABLE_RULES.has(r.id))

        if (hasFixableFailures) {
          const { fixed, corrections } = autoFixTakes(parsedForValidation, characterRefs, scenes, startingTakeNumber)

          if (corrections.length > 0) {
            const fixUpdates = scenes
              .map((scene, idx) => {
                const fixedTake = fixed.find((t) => t.takeNumber === startingTakeNumber + idx)
                if (!fixedTake) return null
                return {
                  id: scene.id,
                  updates: {
                    prompt: formatTake(fixedTake),
                    promptRevision: scene.promptRevision + 1
                  }
                }
              })
              .filter(Boolean) as Array<{ id: string; updates: Partial<(typeof scenes)[0]> }>

            if (fixUpdates.length > 0) bulkUpdateScenes(fixUpdates)
            parsedForValidation = fixed
            report = validatePromptQuality(fixed, scenes, characterRefs, startingTakeNumber)
            console.log(`[Director] Auto-fix: ${corrections.length} correcoes deterministicas`)
          }
        }

        // Phase B: automatic LLM fix for remaining failures
        const LLM_RULES = new Set([
          'description-starts-camera', 'description-max-words', 'no-internal-emotions',
          'character-not-all-same', 'character-variety', 'environment-consistency',
          'environment-lock-present', 'description-matches-environment'
        ])
        const hasLlmFailures = !report.passed && report.rules.some((r) => !r.passed && LLM_RULES.has(r.id))

        if (hasLlmFailures) {
          console.log('[Director] Iniciando correcao automatica com LLM...')
          try {
            const failingMap = identifyFailingTakes(parsedForValidation, scenes, characterRefs, startingTakeNumber)

            if (failingMap.size > 0) {
              const failingTakeData = [...failingMap.entries()]
                .map(([takeNum, ruleIds]) => {
                  const take = parsedForValidation.find((t) => t.takeNumber === takeNum)
                  if (!take) return null
                  const sceneIdx = takeNum - startingTakeNumber
                  const scene = scenes[sceneIdx]
                  if (!scene) return null
                  const sceneBlocks = storyBlocks.filter((b) => scene.blockIds.includes(b.id))
                  const sceneText = sceneBlocks.map((b) => b.text).join(' ')
                  return { take, violations: ruleIds, sceneText }
                })
                .filter(Boolean) as Array<{ take: ParsedTake; violations: string[]; sceneText: string }>

              if (failingTakeData.length > 0) {
                const { systemPrompt, userMessage } = buildFixPrompt(failingTakeData, characterRefs)
                console.log(`[Director] LLM fix: ${failingTakeData.length} takes, ${userMessage.length} chars`)

                const fixResult = (await window.api.directorGeneratePrompts({
                  provider: config.llmProvider,
                  model: config.llmModel || undefined,
                  system_prompt: systemPrompt,
                  user_message: userMessage
                })) as { takes: TakeRecord[]; success: boolean; raw_response?: string }

                let llmFixedTakes: ParsedTake[] = []
                if (fixResult.success && fixResult.takes?.length > 0) {
                  llmFixedTakes = fixResult.takes.map((t) => ({
                    takeNumber: t.take_number,
                    description: t.description,
                    negativePrompt: t.negative_prompt,
                    characterAnchor: t.character_anchor,
                    environmentLock: t.environment_lock
                  }))
                } else if (fixResult.raw_response) {
                  llmFixedTakes = parseTakeOutput(fixResult.raw_response)
                }

                if (llmFixedTakes.length > 0) {
                  // Apply LLM-corrected takes
                  const llmUpdates = llmFixedTakes
                    .map((take) => {
                      const sceneIdx = take.takeNumber - startingTakeNumber
                      const scene = scenes[sceneIdx]
                      if (!scene) return null
                      return {
                        id: scene.id,
                        updates: {
                          prompt: formatTake(take),
                          promptRevision: scene.promptRevision + 1
                        }
                      }
                    })
                    .filter(Boolean) as Array<{ id: string; updates: Partial<(typeof scenes)[0]> }>

                  if (llmUpdates.length > 0) bulkUpdateScenes(llmUpdates)

                  // Merge corrected takes and run deterministic fix again
                  const merged = parsedForValidation.map((t) => {
                    const corrected = llmFixedTakes.find((f) => f.takeNumber === t.takeNumber)
                    return corrected || t
                  })
                  const { fixed: reFixed } = autoFixTakes(merged, characterRefs, scenes, startingTakeNumber)

                  // Apply re-fixed takes
                  const reFixUpdates = scenes
                    .map((scene, idx) => {
                      const take = reFixed.find((t) => t.takeNumber === startingTakeNumber + idx)
                      if (!take) return null
                      return {
                        id: scene.id,
                        updates: {
                          prompt: formatTake(take),
                          promptRevision: scene.promptRevision + 1
                        }
                      }
                    })
                    .filter(Boolean) as Array<{ id: string; updates: Partial<(typeof scenes)[0]> }>
                  if (reFixUpdates.length > 0) bulkUpdateScenes(reFixUpdates)

                  // Final validation
                  report = validatePromptQuality(reFixed, scenes, characterRefs, startingTakeNumber)
                  console.log(`[Director] LLM fix: ${llmFixedTakes.length} takes corrigidos. Score: ${report.score}/100`)
                }
              }
            }
          } catch (llmErr) {
            console.error('[Director] Erro na correcao LLM (nao-fatal):', llmErr)
          }
        }

        setQualityReport(report)

        const failedBatches = currentBatchResults.filter((r) => r.status === 'error').length
        const cancelledBatches = currentBatchResults.filter((r) => r.status === 'cancelled').length
        let msg = `${allGeneratedTakes.length}/${scenes.length} takes. Qualidade: ${report.score}/100.`
        if (failedBatches > 0) msg += ` ${failedBatches} lote(s) com erro.`
        if (cancelledBatches > 0) msg += ` ${cancelledBatches} lote(s) cancelado(s).`

        addToast({
          type: failedBatches > 0 || cancelledBatches > 0 ? 'warning' : report.passed ? 'success' : 'warning',
          message: msg
        })
      } else {
        addToast({ type: 'error', message: 'Nenhum take gerado.' })
      }
    } catch (err) {
      console.error('[Director] ERRO na geracao:', err)
      const message = err instanceof Error ? err.message : 'Erro ao gerar prompts'
      setDirectorProgress({ error: message })
      addToast({ type: 'error', message })
    } finally {
      abortRef.current = null
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
      const { systemPrompt } = buildLlmPayload(
        storyBlocks,
        scenes,
        characterRefs,
        startingTakeNumber
      )

      const chapterChars = getCharactersForChapter(characterRefs, scene.chapter ?? 1)

      let singleUserMessage = `Regenere apenas o TAKE ${takeNum}:
Texto da legenda: "${sceneBlocks.map((b) => b.text).join(' ')}"
Tipo: ${scene.mediaType}`

      if (chapterChars.length > 0) {
        singleUserMessage += `\nElenco deste capitulo (copie o identificador EXATAMENTE como esta aqui):`
        for (const char of chapterChars) {
          singleUserMessage += `\n- "${char.label}"`
        }
        singleUserMessage += `\nNo Character Anchor, copie o identificador IDENTICO ao listado acima. Separe multiplos com |`
      }

      singleUserMessage += `\n\nGere apenas 1 TAKE no formato padrao. O numero do TAKE deve ser ${takeNum}.`

      const result = (await window.api.directorGeneratePrompts({
        provider: config.llmProvider,
        model: config.llmModel || undefined,
        system_prompt: systemPrompt,
        user_message: singleUserMessage
      })) as {
        takes: TakeRecord[]
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
    const text = scenes
      .filter((s) => s.prompt.trim())
      .map((s) => s.prompt)
      .join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 1500)
  }

  const handleCopyVideos = async (): Promise<void> => {
    const text = scenes
      .filter((s) => s.mediaType === 'video' && s.prompt.trim())
      .map((s) => s.prompt)
      .join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopiedVideos(true)
    setTimeout(() => setCopiedVideos(false), 1500)
  }

  const handleCopyPhotos = async (): Promise<void> => {
    const text = scenes
      .filter((s) => s.mediaType === 'photo' && s.prompt.trim())
      .map((s) => s.prompt)
      .join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopiedPhotos(true)
    setTimeout(() => setCopiedPhotos(false), 1500)
  }

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

  // Compute batch status for scene badges during generation
  const getSceneBatchStatus = (sceneIdx: number): 'generated' | 'generating' | 'pending' | null => {
    if (!progress.isGeneratingPrompts) return null
    const chunks = computeChunks(scenes.length, chunkSize)
    for (let i = 0; i < chunks.length; i++) {
      if (sceneIdx >= chunks[i].startIndex && sceneIdx < chunks[i].endIndex) {
        const br = progress.batchResults[i]
        if (!br) return 'pending'
        if (br.status === 'success') return 'generated'
        if (br.status === 'in_progress') return 'generating'
        return 'pending'
      }
    }
    return 'pending'
  }

  const totalChunks = Math.ceil(scenes.length / chunkSize)
  const progressPct = progress.totalScenes > 0
    ? Math.round((progress.completedTakes / progress.totalScenes) * 100)
    : 0

  // Estimate remaining time
  const completedBatchCount = progress.batchResults.filter((r) => r.status === 'success' || r.status === 'error').length
  const avgBatchMs = completedBatchCount > 0 && progress.startedAt
    ? (Date.now() - progress.startedAt) / completedBatchCount
    : 0
  const remainingBatches = progress.totalBatches - completedBatchCount
  const estimatedRemainingMs = avgBatchMs * remainingBatches

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-3 w-3 text-text-muted" />
              <span className="text-[10px] text-text-muted">
                {detectedChapters.length === 1
                  ? `Cap. ${detectedChapters[0]}`
                  : `Cap. ${detectedChapters.join(', ')}`}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-muted">Take inicial:</span>
              <input
                type="number"
                min={1}
                value={startingTakeNumber}
                onChange={(e) => setStartingTakeNumber(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={progress.isGeneratingPrompts}
                className="w-14 rounded border border-border bg-bg px-1.5 py-0.5 text-xs tabular-nums text-text text-center focus:border-primary focus:outline-none disabled:opacity-40"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-muted">Lote:</span>
              <input
                type="number"
                min={10}
                max={200}
                step={10}
                value={chunkSize}
                onChange={(e) => setChunkSize(Math.max(10, Math.min(200, parseInt(e.target.value) || 60)))}
                disabled={progress.isGeneratingPrompts}
                className="w-14 rounded border border-border bg-bg px-1.5 py-0.5 text-xs tabular-nums text-text text-center focus:border-primary focus:outline-none disabled:opacity-40"
              />
            </div>
            <span className="text-xs text-text">
              {promptsGenerated}/{scenes.length} takes
            </span>
          </div>
          <div className="flex items-center gap-2">
            {promptsGenerated > 0 && !progress.isGeneratingPrompts && (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={onConfirm}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirmar prompts
              </motion.button>
            )}
            <button
              onClick={handleExport}
              disabled={promptsGenerated === 0}
              className="flex items-center gap-1 rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:text-text disabled:opacity-40"
            >
              <Download className="h-3 w-3" />
              Exportar
            </button>
            {progress.isGeneratingPrompts ? (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCancel}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-medium text-white shadow-surface transition-all duration-150 hover:bg-red-700"
              >
                <Square className="h-3 w-3" />
                Cancelar ({progress.completedTakes}/{scenes.length})
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGenerateAll}
                disabled={scenes.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Gerar takes
                {scenes.length > chunkSize && (
                  <span className="text-white/60">({totalChunks} lotes)</span>
                )}
              </motion.button>
            )}
          </div>
        </div>

        {/* Batch progress panel */}
        {progress.isGeneratingPrompts && (
          <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span className="text-xs font-medium text-primary">
                  Lote {progress.currentBatch + 1}/{progress.totalBatches}
                </span>
                <span className="text-[10px] text-text-muted">
                  takes {progress.batchStartTake}-{progress.batchEndTake}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-text-muted">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatElapsed(elapsed)}
                </span>
                {avgBatchMs > 0 && (
                  <>
                    <span>~{formatElapsed(avgBatchMs)}/lote</span>
                    <span>Restante: ~{formatElapsed(estimatedRemainingMs)}</span>
                  </>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 overflow-hidden rounded-full bg-surface">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-text-muted">
              <span>{progress.completedTakes}/{progress.totalScenes} takes gerados</span>
              <span>{progressPct}%</span>
            </div>

            {/* Batch chips */}
            <div className="flex flex-wrap gap-1">
              {progress.batchResults.map((batch) => {
                let chipClass = 'bg-surface text-text-muted border-border/50'
                let label = `${batch.startTake}-${batch.endTake}`

                if (batch.status === 'success') {
                  chipClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  label += ` (${batch.takesGenerated})`
                } else if (batch.status === 'error') {
                  chipClass = 'bg-red-500/10 text-red-400 border-red-500/20'
                  label += ' ERR'
                } else if (batch.status === 'in_progress') {
                  chipClass = 'bg-primary/10 text-primary border-primary/20 animate-pulse'
                } else if (batch.status === 'cancelled') {
                  chipClass = 'bg-surface text-text-muted/40 border-border/30 line-through'
                }

                return (
                  <span
                    key={batch.batchIndex}
                    className={`rounded border px-1.5 py-0.5 text-[9px] font-mono ${chipClass}`}
                    title={batch.error || `Lote ${batch.batchIndex + 1}: ${batch.status}`}
                  >
                    {label}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Completed batch summary (after generation ends) */}
        {!progress.isGeneratingPrompts && progress.batchResults.length > 0 && progress.totalBatches > 1 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-bg p-2">
            <span className="text-[10px] text-text-muted">
              {progress.completedTakes}/{progress.totalScenes} takes em {progress.totalBatches} lotes
              {progress.startedAt && ` (${formatElapsed(Date.now() - progress.startedAt)})`}
            </span>
            <div className="flex flex-wrap gap-1">
              {progress.batchResults.map((batch) => {
                let chipClass = 'bg-surface text-text-muted border-border/50'
                if (batch.status === 'success') chipClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                else if (batch.status === 'error') chipClass = 'bg-red-500/10 text-red-400 border-red-500/20'
                else if (batch.status === 'cancelled') chipClass = 'bg-surface text-text-muted/40 border-border/30'

                return (
                  <span
                    key={batch.batchIndex}
                    className={`rounded border px-1 py-0.5 text-[8px] font-mono ${chipClass}`}
                    title={batch.error || `${batch.startTake}-${batch.endTake}: ${batch.status}`}
                  >
                    {batch.status === 'success' ? batch.takesGenerated : batch.status === 'error' ? 'ERR' : 'X'}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Character warning */}
        {characterRefs.length === 0 && !progress.isGeneratingPrompts && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 p-2.5">
            <Users className="h-4 w-4 text-warning shrink-0" />
            <span className="text-[11px] text-warning">
              Nenhum personagem importado. O LLM nao tera nomes para usar no Character Anchor.
              Importe na aba Configuracao.
            </span>
          </div>
        )}

        {/* Copy buttons row */}
        {promptsGenerated > 0 && !progress.isGeneratingPrompts && (
          <div className="flex items-center gap-2 border-t border-border/50 pt-2">
            <span className="text-[10px] text-text-muted mr-1">Copiar:</span>
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1 rounded-md border border-border bg-bg px-2 py-1 text-[11px] text-text-muted transition-colors hover:text-text"
            >
              {copiedAll ? (
                <Check className="h-3 w-3 text-success" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              Todos ({promptsGenerated})
            </button>
            {videoCount > 0 && (
              <button
                onClick={handleCopyVideos}
                className="flex items-center gap-1 rounded-md border border-teal-500/30 bg-teal-500/5 px-2 py-1 text-[11px] text-teal-400 transition-colors hover:bg-teal-500/10"
              >
                {copiedVideos ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <Film className="h-3 w-3" />
                )}
                Videos ({videoCount})
              </button>
            )}
            {photoCount > 0 && (
              <button
                onClick={handleCopyPhotos}
                className="flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/5 px-2 py-1 text-[11px] text-violet-400 transition-colors hover:bg-violet-500/10"
              >
                {copiedPhotos ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <ImageIcon className="h-3 w-3" />
                )}
                Fotos ({photoCount})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quality report banner */}
      {qualityReport && !progress.isGeneratingPrompts && (
        <div
          className={`rounded-lg border p-3 ${
            qualityReport.passed
              ? 'border-success/30 bg-success/5'
              : 'border-warning/30 bg-warning/5'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {qualityReport.passed ? (
                <ShieldCheck className="h-4 w-4 text-success" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-warning" />
              )}
              <span
                className={`text-xs font-medium ${
                  qualityReport.passed ? 'text-success' : 'text-warning'
                }`}
              >
                {qualityReport.score}/100
                {qualityReport.passed ? ' -- Aprovado' : ' -- Requer atencao'}
              </span>
              <span className="text-[10px] text-text-muted">
                {qualityReport.rules.filter((r) => r.passed).length}/{qualityReport.rules.length} regras OK
              </span>
            </div>
            <button
              onClick={() => setShowQualityDetails((v) => !v)}
              className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text"
            >
              {showQualityDetails ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              {showQualityDetails ? 'Ocultar' : 'Detalhes'}
            </button>
          </div>
          {showQualityDetails && (
            <div className="mt-2 space-y-1 border-t border-border/30 pt-2">
              {qualityReport.rules.map((rule) => (
                <div key={rule.id} className="flex items-start gap-2 text-[10px]">
                  <span className={rule.passed ? 'text-success' : 'text-warning'}>
                    {rule.passed ? 'OK' : 'FALHA'}
                  </span>
                  <span className="text-text-muted">{rule.name}</span>
                  <span className="text-text-muted/60 ml-auto text-right max-w-[50%] truncate">
                    {rule.details}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scene/take list */}
      <div className="overflow-auto max-h-[calc(100vh-380px)] space-y-3">
        {scenes.map((scene, sceneIdx) => {
          const sceneBlocks = storyBlocks.filter((b) => scene.blockIds.includes(b.id))
          const blockText = sceneBlocks.map((b) => b.text).join(' ')
          const isVideo = scene.mediaType === 'video'
          const takeInfo = scene.prompt ? extractTakeInfo(scene.prompt) : null
          const batchStatus = getSceneBatchStatus(sceneIdx)

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
                  <span className="rounded bg-surface px-1 py-0.5 text-[9px] text-text-muted border border-border/50">
                    Cap. {scene.chapter}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {(scene.durationMs / 1000).toFixed(1)}s
                  </span>
                  {/* Batch status badge */}
                  {batchStatus === 'generated' && (
                    <span className="flex items-center gap-0.5 rounded bg-emerald-500/10 px-1 py-0.5 text-[9px] text-emerald-400">
                      <Check className="h-2.5 w-2.5" />
                      Gerado
                    </span>
                  )}
                  {batchStatus === 'generating' && (
                    <span className="flex items-center gap-0.5 rounded bg-primary/10 px-1 py-0.5 text-[9px] text-primary animate-pulse">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      Gerando...
                    </span>
                  )}
                  {batchStatus === 'pending' && (
                    <span className="rounded bg-surface px-1 py-0.5 text-[9px] text-text-muted/50 border border-border/30">
                      Pendente
                    </span>
                  )}
                </div>
              </div>

              {/* Subtitle text */}
              <p className="text-[11px] text-text mb-2 line-clamp-2 italic">
                &quot;{blockText || scene.description}&quot;
              </p>

              {/* TAKE metadata badges */}
              {takeInfo && (
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {takeInfo.characterAnchor && takeInfo.characterAnchor !== '-' && takeInfo.characterAnchor !== '\u2014' && (
                    <span className="flex items-center gap-1 rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-400">
                      <Users className="h-2.5 w-2.5" />
                      {takeInfo.characterAnchor}
                    </span>
                  )}
                  {takeInfo.environmentLock && (
                    <span className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
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

    </div>
  )
}
