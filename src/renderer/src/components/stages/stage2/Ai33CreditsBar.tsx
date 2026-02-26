import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Loader2, Settings, AlertCircle } from 'lucide-react'
import type { Ai33CreditsResponse, Ai33HealthCheckResponse, Ai33HealthStatus } from '@/types/ai33'

interface Ai33CreditsBarProps {
  onOpenSettings?: () => void
}

const HEALTH_COLORS: Record<Ai33HealthStatus, string> = {
  good: 'bg-emerald-400',
  degraded: 'bg-yellow-400',
  overloaded: 'bg-red-400'
}

const HEALTH_LABELS: Record<Ai33HealthStatus, string> = {
  good: 'Operacional',
  degraded: 'Degradado',
  overloaded: 'Sobrecarregado'
}

function HealthDot({ status }: { status: Ai33HealthStatus }): React.JSX.Element {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${HEALTH_COLORS[status]}`}
      title={HEALTH_LABELS[status]}
    />
  )
}

export function Ai33CreditsBar({ onOpenSettings }: Ai33CreditsBarProps): React.JSX.Element {
  const [credits, setCredits] = useState<number | null>(null)
  const [health, setHealth] = useState<Ai33HealthCheckResponse['data'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const keyExists = await window.api.ai33HasApiKey()
      setHasKey(keyExists)

      if (!keyExists) {
        setCredits(null)
        setHealth(null)
        setLoading(false)
        return
      }

      const [creditsRes, healthRes] = await Promise.all([
        window.api.ai33GetCredits() as Promise<Ai33CreditsResponse>,
        window.api.ai33HealthCheck() as Promise<Ai33HealthCheckResponse>
      ])

      if (creditsRes.success) {
        setCredits(creditsRes.credits)
      } else {
        setError('Falha ao carregar creditos')
      }

      if (healthRes.success) {
        setHealth(healthRes.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro de conexao')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // No API key configured
  if (hasKey === false) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-yellow-400" />
        <span className="text-xs text-text-muted">API key ai33.pro nao configurada.</span>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="ml-auto flex items-center gap-1 text-xs text-primary transition-colors hover:text-primary-light"
          >
            <Settings className="h-3 w-3" />
            Configurar
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
      {/* Credits */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-text-muted">Creditos:</span>
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin text-text-muted" />
        ) : error ? (
          <span className="text-[11px] text-red-400" title={error}>
            --
          </span>
        ) : (
          <span className="text-xs font-medium text-text">
            {credits !== null ? credits.toLocaleString('pt-BR') : '--'}
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="h-3 w-px bg-border" />

      {/* Health indicators */}
      {health && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" title={`ElevenLabs: ${HEALTH_LABELS[health.elevenlabs]}`}>
            <HealthDot status={health.elevenlabs} />
            <span className="text-[11px] text-text-muted">ElevenLabs</span>
          </div>
          <div className="flex items-center gap-1.5" title={`MiniMax: ${HEALTH_LABELS[health.minimax]}`}>
            <HealthDot status={health.minimax} />
            <span className="text-[11px] text-text-muted">MiniMax</span>
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings link */}
      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-1 text-[11px] text-text-muted transition-colors hover:text-text"
          title="Configuracoes ai33.pro"
        >
          <Settings className="h-3 w-3" />
        </button>
      )}

      {/* Refresh */}
      <button
        type="button"
        onClick={loadData}
        disabled={loading}
        className="flex items-center justify-center text-text-muted transition-colors hover:text-text disabled:opacity-40"
        title="Atualizar creditos e status"
      >
        <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  )
}
