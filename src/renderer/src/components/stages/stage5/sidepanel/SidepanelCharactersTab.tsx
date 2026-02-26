import { ImageIcon, Link2, CheckCircle2 } from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useVeo3AutomationStore } from '@/stores/useVeo3AutomationStore'
import type { WebviewElement } from '@/types/veo3'

interface SidepanelCharactersTabProps {
  webviewRef: React.RefObject<WebviewElement | null>
}

export function SidepanelCharactersTab({
  webviewRef
}: SidepanelCharactersTabProps): React.JSX.Element {
  const { characterRefs } = useProjectStore()
  const { commands } = useVeo3AutomationStore()

  const getSceneCount = (characterId: string): number => {
    return commands.filter((cmd) =>
      cmd.characterImages.some((ci) => ci.characterId === characterId)
    ).length
  }

  const isMapped = (characterId: string): boolean => {
    for (const cmd of commands) {
      for (const ci of cmd.characterImages) {
        if (ci.characterId === characterId && ci.galleryItemName) return true
      }
    }
    return false
  }

  const handleMapLibrary = (): void => {
    const wv = webviewRef.current
    if (!wv) return

    const payload = JSON.stringify({
      type: 'SIDEPANEL_TO_CONTENT',
      action: 'MAP_MEDIA_LIBRARY',
      data: {}
    })
    wv.executeJavaScript(`window.postMessage(${payload}, '*')`)
  }

  if (characterRefs.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
        <div className="rounded-full bg-white/5 p-3">
          <ImageIcon className="h-5 w-5 text-text-muted" />
        </div>
        <p className="text-center text-xs text-text-muted">
          Nenhum personagem definido no Stage 4. Adicione personagens no Director
          para usar imagens de referencia.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-text-muted">
          {characterRefs.length} personagens
        </span>
        <button
          onClick={handleMapLibrary}
          className="flex items-center gap-1 rounded bg-white/5 px-2 py-1 text-[10px] text-text-muted transition-colors hover:bg-white/10 hover:text-text"
        >
          <Link2 className="h-3 w-3" />
          Mapear Biblioteca
        </button>
      </div>

      {characterRefs.map((char) => {
        const sceneCount = getSceneCount(char.id)
        const mapped = isMapped(char.id)

        return (
          <div
            key={char.id}
            className="flex items-start gap-3 rounded-lg border border-border bg-bg p-3"
          >
            {char.imagePath ? (
              <img
                src={`file://${char.imagePath}`}
                alt={char.name}
                className="h-10 w-10 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/5">
                <ImageIcon className="h-4 w-4 text-text-muted" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text truncate">
                  {char.name}
                </span>
                {mapped && (
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-green-400" />
                )}
              </div>
              <span className="text-[10px] text-text-muted">{char.role}</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[10px] text-text-muted">
                  {sceneCount} cena{sceneCount !== 1 ? 's' : ''}
                </span>
                {char.chapters.length > 0 && (
                  <span className="text-[10px] text-text-muted">
                    Ch. {char.chapters.join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
