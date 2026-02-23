import { useState } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  Minus,
  Bug,
  Loader2,
  ChevronDown,
  ChevronUp,
  XCircle,
  Info,
  ExternalLink
} from 'lucide-react'
import { msToDisplay } from '@/lib/time'
import { useProjectStore } from '@/stores/useProjectStore'

interface SyncedBlock {
  id: string
  index: number
  text: string
  startMs: number
  endMs: number
  durationMs: number
  linkedAudioId: string | null
}

interface SyncPreviewProps {
  blocks: SyncedBlock[]
  linkedCount: number
  unlinkedCount: number
  gapsRemoved: number
  onConfirm: () => void
  onBack: () => void
  confirmed?: boolean
  onOpenCapCut?: () => void
}

interface DiagTrackInfo {
  track_index: number
  segment_count: number
  first_start_us: number
  last_end_us: number
  has_gaps: boolean
  gap_count: number
  total_gap_ms: number
  out_of_order: boolean
  gaps_detail?: Array<{
    between_segments: number[]
    gap_us: number
    gap_ms: number
    at_position_ms: number
  }>
}

interface DiagResult {
  draft_path: string
  file_modified_ago_seconds: number
  file_size_bytes: number
  draft_duration_ms: number
  total_tracks: number
  audio_tracks: DiagTrackInfo[]
  audio_track_count: number
  total_audio_segments: number
  text_tracks: Array<{ track_index: number; segment_count: number }>
  text_track_count: number
  total_text_segments: number
  metadata: {
    tm_draft_modified: number
    cloud_draft_sync: boolean | string
    materials_size: number
    age_seconds: number
    is_recent: boolean
  }
  capcut_running: boolean
  comparison: {
    expected_count: number
    actual_count: number
    match: boolean
    actual_tracks: number
    position_mismatches?: Array<{
      index: number
      expected_start_ms: number
      actual_start_ms: number
      expected_end_ms: number
      actual_end_ms: number
    }>
  } | null
  issues: string[]
  warnings: string[]
  is_healthy: boolean
  error?: string
}

export function SyncPreview({
  blocks,
  linkedCount,
  unlinkedCount,
  gapsRemoved,
  onConfirm,
  onBack,
  confirmed,
  onOpenCapCut
}: SyncPreviewProps): React.JSX.Element {
  const [diagResult, setDiagResult] = useState<DiagResult | null>(null)
  const [diagLoading, setDiagLoading] = useState(false)
  const [diagOpen, setDiagOpen] = useState(false)
  const capCutDraftPath = useProjectStore((s) => s.capCutDraftPath)

  const runDiagnostic = async (): Promise<void> => {
    if (!capCutDraftPath) return
    setDiagLoading(true)
    setDiagOpen(true)
    try {
      const expectedSegments = blocks
        .filter((b) => b.linkedAudioId)
        .map((b) => ({
          start_ms: b.startMs,
          end_ms: b.endMs,
          duration_ms: b.durationMs
        }))

      const result = (await window.api.debugSyncState({
        draftPath: capCutDraftPath,
        expectedSegments
      })) as DiagResult
      setDiagResult(result)
    } catch (err) {
      setDiagResult({
        error: err instanceof Error ? err.message : 'Erro ao executar diagnostico',
        issues: ['DIAGNOSTIC_FAILED'],
        warnings: [],
        is_healthy: false
      } as unknown as DiagResult)
    } finally {
      setDiagLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-success" />
        <h3 className="text-sm font-medium text-text">Sincronizacao concluida</h3>
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg border border-success/20 bg-success/5 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-success/80">
            Alinhados
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-success">{linkedCount}</p>
        </div>
        {gapsRemoved > 0 && (
          <div className="flex-1 rounded-lg border border-border bg-surface px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
              Tracks consolidadas
            </p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums text-text">{gapsRemoved}</p>
          </div>
        )}
        {unlinkedCount > 0 && (
          <div className="flex-1 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-warning/80">
              Sem audio
            </p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums text-warning">{unlinkedCount}</p>
          </div>
        )}
      </div>

      {/* Mismatch warning */}
      {unlinkedCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs text-text-muted">
            {unlinkedCount} legenda{unlinkedCount > 1 ? 's' : ''} sem audio correspondente.
            Ajuste o roteiro no Stage 1 se necessario.
          </p>
        </div>
      )}

      {/* Alignment table */}
      <div className="max-h-[320px] overflow-auto rounded-lg border border-border">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs font-medium uppercase tracking-wider text-text-muted">
              <th className="w-[48px] px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">Legenda</th>
              <th className="w-[88px] px-3 py-2.5 text-right">Inicio</th>
              <th className="w-[88px] px-3 py-2.5 text-right">Fim</th>
              <th className="w-[80px] px-3 py-2.5 text-right">Duracao</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((block) => {
              const isLinked = block.linkedAudioId !== null
              return (
                <tr
                  key={block.id}
                  className={`border-b border-border/50 transition-colors hover:bg-surface-hover ${
                    isLinked ? 'even:bg-surface/50' : 'bg-warning/5'
                  }`}
                >
                  <td className="px-3 py-2.5 tabular-nums text-text-muted">{block.index}</td>
                  <td className="max-w-0 truncate px-3 py-2.5 text-text" title={block.text}>
                    {block.text}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-text-muted">
                    {isLinked ? (
                      msToDisplay(block.startMs)
                    ) : (
                      <Minus className="ml-auto h-3 w-3 text-text-muted/30" />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-text-muted">
                    {isLinked ? (
                      msToDisplay(block.endMs)
                    ) : (
                      <Minus className="ml-auto h-3 w-3 text-text-muted/30" />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-text-muted">
                    {isLinked ? (
                      msToDisplay(block.durationMs)
                    ) : (
                      <Minus className="ml-auto h-3 w-3 text-text-muted/30" />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Debug panel */}
      {capCutDraftPath && (
        <div className="rounded-lg border border-border bg-surface">
          <button
            onClick={diagOpen ? () => setDiagOpen(false) : runDiagnostic}
            className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-text-muted transition-colors hover:text-text"
          >
            <span className="flex items-center gap-2">
              <Bug className="h-3.5 w-3.5" />
              Diagnostico do Draft
              {diagResult && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    diagResult.is_healthy
                      ? 'bg-success/20 text-success'
                      : 'bg-error/20 text-error'
                  }`}
                >
                  {diagResult.issues.length} problema{diagResult.issues.length !== 1 ? 's' : ''}
                </span>
              )}
            </span>
            {diagLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : diagOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {diagOpen && diagResult && (
            <div className="border-t border-border px-4 py-3 space-y-3">
              {/* Issues */}
              {diagResult.issues.length > 0 && (
                <div className="space-y-1.5">
                  {diagResult.issues.map((issue, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded bg-error/5 px-2.5 py-1.5"
                    >
                      <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-error" />
                      <span className="font-mono text-[11px] text-error/90">{issue}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {diagResult.warnings.length > 0 && (
                <div className="space-y-1.5">
                  {diagResult.warnings.map((warn, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded bg-warning/5 px-2.5 py-1.5"
                    >
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
                      <span className="font-mono text-[11px] text-warning/90">{warn}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Healthy */}
              {diagResult.is_healthy && (
                <div className="flex items-center gap-2 rounded bg-success/5 px-2.5 py-1.5">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  <span className="text-[11px] text-success">
                    Draft no disco esta correto. Nenhum problema detectado.
                  </span>
                </div>
              )}

              {/* Track summary */}
              <div className="grid grid-cols-2 gap-2">
                <DiagStat
                  label="Audio tracks"
                  value={diagResult.audio_track_count}
                  expected={1}
                />
                <DiagStat
                  label="Audio segments"
                  value={diagResult.total_audio_segments}
                  expected={linkedCount}
                />
                <DiagStat
                  label="Text tracks"
                  value={diagResult.text_track_count}
                />
                <DiagStat
                  label="Text segments"
                  value={diagResult.total_text_segments}
                />
              </div>

              {/* Audio track details */}
              {diagResult.audio_tracks?.map((at) => (
                <div
                  key={at.track_index}
                  className="rounded border border-border/50 bg-bg px-3 py-2 text-[11px]"
                >
                  <div className="flex items-center justify-between font-medium text-text-muted">
                    <span>Audio Track #{at.track_index}</span>
                    <span>{at.segment_count} segments</span>
                  </div>
                  <div className="mt-1 flex gap-3 text-text-muted/70">
                    <span>Gaps: {at.gap_count}</span>
                    {at.total_gap_ms > 0 && <span>Total: {at.total_gap_ms}ms</span>}
                    <span>Overlap: {at.out_of_order ? 'SIM' : 'nao'}</span>
                  </div>
                  {at.gaps_detail && at.gaps_detail.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {at.gaps_detail.map((g, gi) => (
                        <div key={gi} className="font-mono text-[10px] text-warning/70">
                          Gap {gi + 1}: {g.gap_ms}ms em {msToDisplay(g.at_position_ms)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Metadata */}
              {diagResult.metadata && (
                <div className="rounded border border-border/50 bg-bg px-3 py-2 text-[11px]">
                  <div className="font-medium text-text-muted">Metadata</div>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-text-muted/70">
                    <span>cloud_draft_sync:</span>
                    <span
                      className={
                        diagResult.metadata.cloud_draft_sync === false
                          ? 'text-success'
                          : 'text-error'
                      }
                    >
                      {String(diagResult.metadata.cloud_draft_sync)}
                    </span>
                    <span>tm_draft_modified:</span>
                    <span
                      className={
                        diagResult.metadata.is_recent ? 'text-success' : 'text-warning'
                      }
                    >
                      {diagResult.metadata.age_seconds}s atras
                    </span>
                    <span>Arquivo modificado:</span>
                    <span>{diagResult.file_modified_ago_seconds}s atras</span>
                    <span>CapCut aberto:</span>
                    <span
                      className={diagResult.capcut_running ? 'text-warning' : 'text-success'}
                    >
                      {diagResult.capcut_running ? 'SIM' : 'Nao'}
                    </span>
                  </div>
                </div>
              )}

              {/* Comparison */}
              {diagResult.comparison && (
                <div className="rounded border border-border/50 bg-bg px-3 py-2 text-[11px]">
                  <div className="font-medium text-text-muted">Preview vs Disco</div>
                  <div className="mt-1 space-y-0.5 text-text-muted/70">
                    <div>
                      Preview: {diagResult.comparison.expected_count} segments em 1 track
                    </div>
                    <div>
                      Disco: {diagResult.comparison.actual_count} segments em{' '}
                      {diagResult.comparison.actual_tracks} track
                      {diagResult.comparison.actual_tracks !== 1 ? 's' : ''}
                    </div>
                    <div
                      className={
                        diagResult.comparison.match ? 'text-success' : 'text-error font-medium'
                      }
                    >
                      {diagResult.comparison.match
                        ? 'Contagem OK'
                        : `DIFERENCA: ${Math.abs(diagResult.comparison.expected_count - diagResult.comparison.actual_count)} segmentos`}
                    </div>
                  </div>
                  {diagResult.comparison.position_mismatches &&
                    diagResult.comparison.position_mismatches.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        <div className="font-medium text-error/80">Posicoes diferentes:</div>
                        {diagResult.comparison.position_mismatches.map((m) => (
                          <div key={m.index} className="font-mono text-[10px] text-error/60">
                            #{m.index}: preview {msToDisplay(m.expected_start_ms)}-
                            {msToDisplay(m.expected_end_ms)} vs disco{' '}
                            {msToDisplay(m.actual_start_ms)}-{msToDisplay(m.actual_end_ms)}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              )}

              {/* Re-run button */}
              <button
                onClick={runDiagnostic}
                disabled={diagLoading}
                className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary-light transition-colors disabled:opacity-50"
              >
                {diagLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Info className="h-3 w-3" />
                )}
                Executar novamente
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-text-muted transition-all duration-150 hover:bg-surface-hover hover:text-text active:scale-[0.98]"
        >
          Refazer
        </button>
        {confirmed && onOpenCapCut ? (
          <button
            onClick={onOpenCapCut}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir CapCut
          </button>
        ) : (
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Confirmar
          </button>
        )}
      </div>
    </div>
  )
}

function DiagStat({
  label,
  value,
  expected
}: {
  label: string
  value: number
  expected?: number
}): React.JSX.Element {
  const isMatch = expected === undefined || value === expected
  return (
    <div className="flex items-center justify-between rounded bg-bg px-2.5 py-1.5 text-[11px]">
      <span className="text-text-muted">{label}</span>
      <span className={`font-mono font-bold ${isMatch ? 'text-text' : 'text-error'}`}>
        {value}
        {expected !== undefined && !isMatch && (
          <span className="ml-1 font-normal text-text-muted">(esperado: {expected})</span>
        )}
      </span>
    </div>
  )
}
