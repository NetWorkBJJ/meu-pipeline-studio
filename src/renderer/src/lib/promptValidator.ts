import type { ParsedTake } from './promptTemplate'
import type { Scene, CharacterRef } from '@/types/project'

export interface QualityRule {
  id: string
  name: string
  weight: number
  passed: boolean
  details: string
}

export interface QualityReport {
  score: number
  passed: boolean
  rules: QualityRule[]
  summary: string
}

const CAMERA_KEYWORDS = [
  'static', 'slow', 'dolly', 'tracking', 'pan', 'tilt', 'crane', 'steadicam',
  'handheld', 'push', 'pull', 'wide shot', 'medium shot', 'close-up', 'extreme',
  'two-shot', 'three-shot', 'over-the-shoulder', 'pov', 'bird', 'aerial',
  'rack focus', 'shallow', 'deep focus', 'telephoto', 'low angle', 'high angle',
  'dutch', 'side profile', 'establishing'
]

const DASH_CHARS = ['\u2014', '\u2013', '---', '--', '-']

function isEmptyAnchor(anchor: string): boolean {
  const trimmed = anchor.trim().replace(/\.$/, '')
  return DASH_CHARS.includes(trimmed) || trimmed === ''
}

function extractCharacterNames(anchor: string): string[] {
  if (isEmptyAnchor(anchor)) return []
  return anchor
    .replace(/\.$/, '')
    .split(/\s*,\s*/)
    .map((n) => n.trim())
    .filter(Boolean)
}

function rulesTakeCount(takes: ParsedTake[], scenes: Scene[]): QualityRule {
  const passed = takes.length === scenes.length
  return {
    id: 'take-count',
    name: 'Numero de takes = numero de cenas',
    weight: 5,
    passed,
    details: passed
      ? `${takes.length} takes para ${scenes.length} cenas`
      : `Esperado ${scenes.length} takes, recebeu ${takes.length}`
  }
}

function rulesTakeSequence(takes: ParsedTake[], startingTake: number): QualityRule {
  const issues: string[] = []
  for (let i = 0; i < takes.length; i++) {
    const expected = startingTake + i
    if (takes[i].takeNumber !== expected) {
      issues.push(`Take ${takes[i].takeNumber} (esperado ${expected})`)
    }
  }
  return {
    id: 'take-sequence',
    name: 'Numeracao sequencial sem gaps',
    weight: 5,
    passed: issues.length === 0,
    details: issues.length === 0
      ? 'Sequencia correta'
      : `Fora de ordem: ${issues.slice(0, 3).join(', ')}${issues.length > 3 ? '...' : ''}`
  }
}

function rulesDescriptionCamera(takes: ParsedTake[]): QualityRule {
  const failing: number[] = []
  for (const take of takes) {
    const lower = take.description.toLowerCase()
    const startsWithCamera = CAMERA_KEYWORDS.some((kw) => lower.startsWith(kw))
    if (!startsWithCamera) {
      failing.push(take.takeNumber)
    }
  }
  const ratio = takes.length > 0 ? (takes.length - failing.length) / takes.length : 0
  return {
    id: 'description-starts-camera',
    name: 'Descricao inicia com tecnica de camera',
    weight: 7,
    passed: ratio >= 0.8,
    details: failing.length === 0
      ? 'Todas as descricoes iniciam com tecnica de camera'
      : `Takes sem camera: ${failing.slice(0, 5).join(', ')}${failing.length > 5 ? '...' : ''} (${failing.length}/${takes.length})`
  }
}

function rulesDescriptionMaxWords(takes: ParsedTake[]): QualityRule {
  const failing: Array<{ take: number; words: number }> = []
  for (const take of takes) {
    const wordCount = take.description.split(/\s+/).filter(Boolean).length
    if (wordCount > 35) {
      failing.push({ take: take.takeNumber, words: wordCount })
    }
  }
  return {
    id: 'description-max-words',
    name: 'Descricao com max ~30 palavras',
    weight: 7,
    passed: failing.length <= Math.ceil(takes.length * 0.2),
    details: failing.length === 0
      ? 'Todas as descricoes dentro do limite'
      : `${failing.length} takes excederam: ${failing.slice(0, 3).map((f) => `Take ${f.take} (${f.words}w)`).join(', ')}`
  }
}

function rulesNoDurationTag(takes: ParsedTake[]): QualityRule {
  const failing: number[] = []
  for (const take of takes) {
    const full = `${take.description} ${take.characterAnchor} ${take.environmentLock}`
    if (/duration:/i.test(full) || /\[foto\]/i.test(full) || /\[video\]/i.test(full)) {
      failing.push(take.takeNumber)
    }
  }
  return {
    id: 'no-duration-tag',
    name: 'Sem Duration/[FOTO]/[VIDEO]',
    weight: 7,
    passed: failing.length === 0,
    details: failing.length === 0
      ? 'Nenhum tag proibido encontrado'
      : `Tags encontradas nos takes: ${failing.join(', ')}`
  }
}

function rulesNegativePrompt(takes: ParsedTake[]): QualityRule {
  const missing: number[] = []
  for (const take of takes) {
    if (!take.negativePrompt || take.negativePrompt.trim().length < 5) {
      missing.push(take.takeNumber)
    }
  }
  return {
    id: 'negative-prompt-present',
    name: 'Negative Prompt presente em todos',
    weight: 7,
    passed: missing.length === 0,
    details: missing.length === 0
      ? 'Todos os takes tem Negative Prompt'
      : `${missing.length} takes sem Negative Prompt`
  }
}

function rulesCharacterNamesValid(takes: ParsedTake[], characters: CharacterRef[]): QualityRule {
  const knownNames = new Set(characters.map((c) => c.name.toLowerCase()))
  const invalid: Array<{ take: number; name: string }> = []

  for (const take of takes) {
    const names = extractCharacterNames(take.characterAnchor)
    for (const name of names) {
      if (!knownNames.has(name.toLowerCase())) {
        invalid.push({ take: take.takeNumber, name })
      }
    }
  }

  return {
    id: 'character-names-valid',
    name: 'Nomes de personagens validos',
    weight: 12,
    passed: invalid.length === 0,
    details: invalid.length === 0
      ? 'Todos os nomes correspondem ao elenco'
      : `Nomes invalidos: ${invalid.slice(0, 3).map((i) => `"${i.name}" (Take ${i.take})`).join(', ')}`
  }
}

function rulesCharacterNotAllSame(takes: ParsedTake[], characters: CharacterRef[]): QualityRule {
  if (characters.length <= 1 || takes.length <= 1) {
    return {
      id: 'character-not-all-same',
      name: 'Personagens variados entre cenas',
      weight: 12,
      passed: true,
      details: 'Apenas 1 personagem ou 1 take -- regra nao aplicavel'
    }
  }

  const takesWithChars = takes.filter((t) => !isEmptyAnchor(t.characterAnchor))
  if (takesWithChars.length === 0) {
    return {
      id: 'character-not-all-same',
      name: 'Personagens variados entre cenas',
      weight: 12,
      passed: false,
      details: 'NENHUM take tem Character Anchor preenchido'
    }
  }

  // Check if the same character appears in ALL takes that have characters
  const charFrequency: Record<string, number> = {}
  for (const take of takesWithChars) {
    const names = extractCharacterNames(take.characterAnchor)
    for (const name of names) {
      charFrequency[name.toLowerCase()] = (charFrequency[name.toLowerCase()] || 0) + 1
    }
  }

  const allSame = Object.values(charFrequency).some(
    (count) => count === takesWithChars.length && takesWithChars.length >= 3
  )

  const topChar = Object.entries(charFrequency).sort((a, b) => b[1] - a[1])[0]

  return {
    id: 'character-not-all-same',
    name: 'Personagens variados entre cenas',
    weight: 12,
    passed: !allSame,
    details: allSame
      ? `"${topChar[0]}" aparece em TODAS as ${takesWithChars.length} cenas com personagem -- falta variedade`
      : `Personagem mais frequente: "${topChar?.[0] || 'N/A'}" (${topChar?.[1] || 0}/${takesWithChars.length} cenas)`
  }
}

function rulesCharacterVariety(takes: ParsedTake[], characters: CharacterRef[]): QualityRule {
  if (characters.length <= 1 || takes.length <= 3) {
    return {
      id: 'character-variety',
      name: 'Distribuicao variada de elenco',
      weight: 12,
      passed: true,
      details: 'Elenco ou cenas insuficientes para avaliar variedade'
    }
  }

  const takesWithChars = takes.filter((t) => !isEmptyAnchor(t.characterAnchor))
  if (takesWithChars.length === 0) {
    return {
      id: 'character-variety',
      name: 'Distribuicao variada de elenco',
      weight: 12,
      passed: false,
      details: 'Nenhum take com Character Anchor preenchido'
    }
  }

  // Count unique character combinations
  const combos = new Set(takesWithChars.map((t) =>
    extractCharacterNames(t.characterAnchor).sort().join('|').toLowerCase()
  ))

  const emptyCount = takes.length - takesWithChars.length
  const hasDescriptiveScenes = emptyCount > 0

  // Check if Lead character is too dominant (>85% of takes with characters)
  const leadChars = characters.filter((c) => {
    const lower = c.role.toLowerCase()
    return lower.includes('lead') || lower.includes('protagonist')
  })

  let leadDominance = 0
  if (leadChars.length > 0) {
    const leadNames = new Set(leadChars.map((c) => c.name.toLowerCase()))
    const leadAppearances = takesWithChars.filter((t) =>
      extractCharacterNames(t.characterAnchor).some((n) => leadNames.has(n.toLowerCase()))
    ).length
    leadDominance = leadAppearances / takesWithChars.length
  }

  const passed = combos.size >= 2 && (leadChars.length === 0 || leadDominance <= 0.85)

  return {
    id: 'character-variety',
    name: 'Distribuicao variada de elenco',
    weight: 12,
    passed,
    details: [
      `${combos.size} combinacoes unicas de elenco`,
      hasDescriptiveScenes ? `${emptyCount} cenas descritivas (sem personagem)` : null,
      leadChars.length > 0 ? `Lead em ${Math.round(leadDominance * 100)}% das cenas` : null
    ].filter(Boolean).join('. ')
  }
}

function rulesEnvironmentLock(takes: ParsedTake[]): QualityRule {
  const missing: number[] = []
  for (const take of takes) {
    if (!take.environmentLock || take.environmentLock.trim().length < 5) {
      missing.push(take.takeNumber)
    }
  }
  return {
    id: 'environment-lock-present',
    name: 'Environment Lock presente em todos',
    weight: 8,
    passed: missing.length <= Math.ceil(takes.length * 0.1),
    details: missing.length === 0
      ? 'Todos os takes tem Environment Lock'
      : `${missing.length} takes sem Environment Lock`
  }
}

function rulesEnvironmentConsistency(takes: ParsedTake[], scenes: Scene[]): QualityRule {
  if (takes.length <= 1) {
    return {
      id: 'environment-consistency',
      name: 'Ambiente consistente por capitulo',
      weight: 8,
      passed: true,
      details: 'Apenas 1 take -- regra nao aplicavel'
    }
  }

  // Group takes by chapter (using scenes index mapping)
  const chapterEnvs: Record<number, string[]> = {}
  for (let i = 0; i < Math.min(takes.length, scenes.length); i++) {
    const chapter = scenes[i].chapter
    const env = takes[i].environmentLock?.trim() || ''
    if (env) {
      if (!chapterEnvs[chapter]) chapterEnvs[chapter] = []
      chapterEnvs[chapter].push(env)
    }
  }

  // For each chapter, check if environments share a common location prefix
  let consistent = true
  const issues: string[] = []

  for (const [ch, envs] of Object.entries(chapterEnvs)) {
    if (envs.length <= 1) continue
    // Extract first significant word of each env as location anchor
    const locations = envs.map((e) => e.split(/[,.]/).map((s) => s.trim())[0]?.toLowerCase() || '')
    const uniqueLocations = new Set(locations)
    // Allow up to 3 unique locations per chapter (location changes are OK, just not per-take)
    if (uniqueLocations.size > Math.ceil(envs.length * 0.5)) {
      consistent = false
      issues.push(`Cap ${ch}: ${uniqueLocations.size} locacoes distintas`)
    }
  }

  return {
    id: 'environment-consistency',
    name: 'Ambiente consistente por capitulo',
    weight: 8,
    passed: consistent,
    details: consistent
      ? 'Ambientes consistentes dentro de cada capitulo'
      : issues.join('. ')
  }
}

function rulesNoAbbreviation(takes: ParsedTake[], characters: CharacterRef[]): QualityRule {
  if (characters.length === 0) {
    return {
      id: 'no-abbreviation',
      name: 'Nomes completos (sem abreviar)',
      weight: 8,
      passed: true,
      details: 'Sem personagens para verificar'
    }
  }

  const abbreviations: Array<{ take: number; found: string; expected: string }> = []

  for (const take of takes) {
    if (isEmptyAnchor(take.characterAnchor)) continue
    const names = extractCharacterNames(take.characterAnchor)

    for (const name of names) {
      // Check if name is a partial match (abbreviation) of any character
      const isExactMatch = characters.some(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      )
      if (!isExactMatch) {
        // Check if it's an abbreviation of a known character
        const partialMatch = characters.find((c) =>
          c.name.toLowerCase().startsWith(name.toLowerCase()) && name.length < c.name.length
        )
        if (partialMatch) {
          abbreviations.push({
            take: take.takeNumber,
            found: name,
            expected: partialMatch.name
          })
        }
      }
    }
  }

  return {
    id: 'no-abbreviation',
    name: 'Nomes completos (sem abreviar)',
    weight: 8,
    passed: abbreviations.length === 0,
    details: abbreviations.length === 0
      ? 'Todos os nomes estao completos'
      : `Abreviacoes: ${abbreviations.slice(0, 3).map((a) => `"${a.found}" → "${a.expected}" (Take ${a.take})`).join(', ')}`
  }
}

export function validatePromptQuality(
  takes: ParsedTake[],
  scenes: Scene[],
  characters: CharacterRef[],
  startingTake: number = 1
): QualityReport {
  const rules: QualityRule[] = [
    rulesTakeCount(takes, scenes),
    rulesTakeSequence(takes, startingTake),
    rulesDescriptionCamera(takes),
    rulesDescriptionMaxWords(takes),
    rulesNoDurationTag(takes),
    rulesNegativePrompt(takes),
    rulesCharacterNamesValid(takes, characters),
    rulesCharacterNotAllSame(takes, characters),
    rulesCharacterVariety(takes, characters),
    rulesEnvironmentLock(takes),
    rulesEnvironmentConsistency(takes, scenes),
    rulesNoAbbreviation(takes, characters)
  ]

  const totalWeight = rules.reduce((sum, r) => sum + r.weight, 0)
  const earnedWeight = rules.filter((r) => r.passed).reduce((sum, r) => sum + r.weight, 0)
  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0

  const failedCritical = rules.filter((r) => !r.passed && r.weight >= 12)
  const failedMinor = rules.filter((r) => !r.passed && r.weight < 12)

  let summary: string
  if (score >= 70 && failedCritical.length === 0) {
    summary = `Qualidade aprovada (${score}/100). ${rules.filter((r) => r.passed).length}/${rules.length} regras OK.`
  } else if (failedCritical.length > 0) {
    summary = `Qualidade reprovada (${score}/100). ${failedCritical.length} falha(s) critica(s): ${failedCritical.map((r) => r.name).join(', ')}.`
  } else {
    summary = `Qualidade baixa (${score}/100). ${failedMinor.length} aviso(s): ${failedMinor.map((r) => r.name).join(', ')}.`
  }

  return {
    score,
    passed: score >= 70 && failedCritical.length === 0,
    rules,
    summary
  }
}
