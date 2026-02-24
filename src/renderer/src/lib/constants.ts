export const CHARS_PER_SECOND = 15
export const MAX_BLOCK_CHARS = 80
export const MIN_BLOCK_DURATION_MS = 500
export const STAGE_COUNT = 4

export const STAGE_LABELS: Record<number, string> = {
  1: 'Roteiro',
  2: 'Audio',
  3: 'Sincronizacao',
  4: 'Direcao'
}

export const STAGE_DESCRIPTIONS: Record<number, string> = {
  1: 'Transformar o roteiro em blocos de legenda',
  2: 'Configurar ou detectar audio do projeto',
  3: 'Sincronizar legendas com o audio',
  4: 'Planejar cenas, gerar prompts, importar midias e inserir no CapCut'
}
