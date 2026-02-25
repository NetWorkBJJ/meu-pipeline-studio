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

function extractCharacterLabels(anchor: string): string[] {
  if (isEmptyAnchor(anchor)) return []
  return anchor
    .replace(/\.$/, '')
    .split(/\s*\|\s*/)
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
  const knownLabels = new Set(characters.map((c) => c.label.toLowerCase()))
  const invalid: Array<{ take: number; name: string }> = []

  for (const take of takes) {
    const labels = extractCharacterLabels(take.characterAnchor)
    for (const label of labels) {
      if (!knownLabels.has(label.toLowerCase())) {
        invalid.push({ take: take.takeNumber, name: label })
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
    const labels = extractCharacterLabels(take.characterAnchor)
    for (const label of labels) {
      charFrequency[label.toLowerCase()] = (charFrequency[label.toLowerCase()] || 0) + 1
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
    extractCharacterLabels(t.characterAnchor).sort().join('||').toLowerCase()
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
    const leadLabels = new Set(leadChars.map((c) => c.label.toLowerCase()))
    const leadAppearances = takesWithChars.filter((t) =>
      extractCharacterLabels(t.characterAnchor).some((l) => leadLabels.has(l.toLowerCase()))
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
      name: 'Identificadores completos (sem abreviar)',
      weight: 8,
      passed: true,
      details: 'Sem personagens para verificar'
    }
  }

  const abbreviations: Array<{ take: number; found: string; expected: string }> = []

  for (const take of takes) {
    if (isEmptyAnchor(take.characterAnchor)) continue
    const labels = extractCharacterLabels(take.characterAnchor)

    for (const label of labels) {
      // Check if label is an exact match of any character's label
      const isExactMatch = characters.some(
        (c) => c.label.toLowerCase() === label.toLowerCase()
      )
      if (!isExactMatch) {
        // Check if it's an abbreviation/partial of a known character label
        const partialMatch = characters.find((c) =>
          c.label.toLowerCase().startsWith(label.toLowerCase()) && label.length < c.label.length
        )
        if (partialMatch) {
          abbreviations.push({
            take: take.takeNumber,
            found: label,
            expected: partialMatch.label
          })
        }
      }
    }
  }

  return {
    id: 'no-abbreviation',
    name: 'Identificadores completos (sem abreviar)',
    weight: 8,
    passed: abbreviations.length === 0,
    details: abbreviations.length === 0
      ? 'Todos os identificadores estao completos'
      : `Abreviacoes: ${abbreviations.slice(0, 3).map((a) => `"${a.found}" → "${a.expected}" (Take ${a.take})`).join(', ')}`
  }
}

// --- V17 Quality Guard Rules ---

function rulesMaxCharsPerAnchor(takes: ParsedTake[]): QualityRule {
  const MAX_CHARS = 3
  const failing: Array<{ take: number; count: number }> = []
  for (const take of takes) {
    const labels = extractCharacterLabels(take.characterAnchor)
    if (labels.length > MAX_CHARS) {
      failing.push({ take: take.takeNumber, count: labels.length })
    }
  }
  return {
    id: 'max-characters-per-anchor',
    name: 'Maximo 3 personagens por Character Anchor',
    weight: 12,
    passed: failing.length === 0,
    details: failing.length === 0
      ? 'Todos os takes respeitam o limite de 3 personagens'
      : `${failing.length} take(s) com excesso: ${failing.map((f) => `Take ${f.take} (${f.count})`).join(', ')}`
  }
}

function rulesExtendedNegativeOnTransition(takes: ParsedTake[]): QualityRule {
  const EXTENDED_KEYWORDS = ['violence', 'weapon', 'gore', 'sexual']
  const missing: number[] = []

  for (let i = 0; i < takes.length; i++) {
    const isFirstTake = i === 0
    const envChanged =
      i > 0 &&
      takes[i].environmentLock.trim().toLowerCase() !==
        takes[i - 1].environmentLock.trim().toLowerCase()

    if (isFirstTake || envChanged) {
      const hasExtended = EXTENDED_KEYWORDS.some((kw) =>
        takes[i].negativePrompt.toLowerCase().includes(kw)
      )
      if (!hasExtended) {
        missing.push(takes[i].takeNumber)
      }
    }
  }

  return {
    id: 'extended-negative-on-transition',
    name: 'Negative Prompt estendido em transicoes',
    weight: 8,
    passed: missing.length === 0,
    details: missing.length === 0
      ? 'Todas as transicoes de localizacao tem Negative Prompt estendido'
      : `${missing.length} transicao(oes) sem estendido: Takes ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`
  }
}

const INTERNAL_EMOTION_BLOCKLIST = [
  'processing',
  'realizing',
  'thinking',
  'remembering',
  'feeling',
  'heart racing',
  'heart warmed',
  'weight of',
  'loaded words',
  'means everything',
  'admitting fear',
  'deeper meaning',
  'crossed line',
  'surprising himself',
  'surprising herself',
  'chose him',
  'chose her',
  'internal conflict',
  'wondering',
  'she chose',
  'he chose',
  'it means'
]

function rulesNoInternalEmotions(takes: ParsedTake[]): QualityRule {
  const failing: Array<{ take: number; word: string }> = []
  for (const take of takes) {
    const lower = take.description.toLowerCase()
    for (const phrase of INTERNAL_EMOTION_BLOCKLIST) {
      if (lower.includes(phrase)) {
        failing.push({ take: take.takeNumber, word: phrase })
        break
      }
    }
  }
  return {
    id: 'no-internal-emotions',
    name: 'Sem emocoes internas na descricao',
    weight: 7,
    passed: failing.length <= Math.ceil(takes.length * 0.05),
    details: failing.length === 0
      ? 'Nenhuma emocao interna detectada nas descricoes'
      : `${failing.length} take(s) com emocoes internas: ${failing.slice(0, 3).map((f) => `Take ${f.take} ("${f.word}")`).join(', ')}`
  }
}

const ROOM_KEYWORDS = [
  'bedroom',
  'living room',
  'kitchen',
  'bathroom',
  'hallway',
  'corridor',
  'entrance',
  'lobby',
  'garage',
  'rooftop',
  'balcony',
  'garden',
  'courtyard',
  'parking',
  'elevator',
  'staircase',
  'office',
  'restaurant',
  'bar',
  'cafe'
]

function rulesDescriptionMatchesEnvironment(takes: ParsedTake[]): QualityRule {
  const mismatches: Array<{ take: number; descRoom: string; envRoom: string }> = []

  for (const take of takes) {
    const descLower = take.description.toLowerCase()
    const envLower = take.environmentLock.toLowerCase()

    for (const room of ROOM_KEYWORDS) {
      if (descLower.includes(room) && !envLower.includes(room)) {
        mismatches.push({
          take: take.takeNumber,
          descRoom: room,
          envRoom: envLower.split(',')[0] || 'unknown'
        })
        break
      }
    }
  }

  return {
    id: 'description-matches-environment',
    name: 'Descricao coerente com Environment Lock',
    weight: 5,
    passed: mismatches.length === 0,
    details: mismatches.length === 0
      ? 'Todas as descricoes sao coerentes com o Environment Lock'
      : `${mismatches.length} incoerencia(s): ${mismatches.slice(0, 3).map((m) => `Take ${m.take} ("${m.descRoom}" na descricao, "${m.envRoom}" no env)`).join(', ')}`
  }
}

// --- Auto-Fix Types ---

export interface AutoFixCorrection {
  takeNumber: number
  ruleId: string
  field: 'description' | 'negativePrompt' | 'characterAnchor' | 'environmentLock' | 'takeNumber'
  before: string
  after: string
}

export interface AutoFixResult {
  fixed: ParsedTake[]
  corrections: AutoFixCorrection[]
  rulesApplied: string[]
}

const FORBIDDEN_TAG_PATTERNS = [
  /\bDuration:\s*[\d.]+s?\.?\s*/gi,
  /\[FOTO\]\s*/gi,
  /\[VIDEO\]\s*/gi
]

const DEFAULT_NEGATIVE = 'text, watermark, typography, ui elements.'
const EXTENDED_NEGATIVE_SUFFIX = ', violence, weapon, gore, sexual content.'
const EXTENDED_KEYWORDS_SET = ['violence', 'weapon', 'gore', 'sexual']
const MAX_ANCHOR_CHARS = 3

export function autoFixTakes(
  takes: ParsedTake[],
  characters: CharacterRef[],
  _scenes: Scene[],
  startingTake: number
): AutoFixResult {
  if (takes.length === 0) return { fixed: [], corrections: [], rulesApplied: [] }

  const corrections: AutoFixCorrection[] = []
  const rulesApplied = new Set<string>()
  const fixed = takes.map((t) => ({ ...t }))

  // Fix 1: take-sequence — renumber sequentially
  for (let i = 0; i < fixed.length; i++) {
    const expected = startingTake + i
    if (fixed[i].takeNumber !== expected) {
      corrections.push({
        takeNumber: expected,
        ruleId: 'take-sequence',
        field: 'takeNumber',
        before: String(fixed[i].takeNumber),
        after: String(expected)
      })
      fixed[i].takeNumber = expected
      rulesApplied.add('take-sequence')
    }
  }

  // Fix 2: no-duration-tag — strip forbidden tags from description/anchor/env
  for (const take of fixed) {
    for (const field of ['description', 'characterAnchor', 'environmentLock'] as const) {
      let value = take[field]
      for (const pattern of FORBIDDEN_TAG_PATTERNS) {
        pattern.lastIndex = 0
        value = value.replace(pattern, '')
      }
      value = value.trim()
      if (value !== take[field]) {
        corrections.push({
          takeNumber: take.takeNumber,
          ruleId: 'no-duration-tag',
          field,
          before: take[field],
          after: value
        })
        take[field] = value
        rulesApplied.add('no-duration-tag')
      }
    }
  }

  // Fix 3: no-abbreviation — expand abbreviated character names to full labels
  if (characters.length > 0) {
    for (const take of fixed) {
      if (isEmptyAnchor(take.characterAnchor)) continue
      const labels = extractCharacterLabels(take.characterAnchor)
      let changed = false
      const fixedLabels = labels.map((label) => {
        const isExact = characters.some((c) => c.label.toLowerCase() === label.toLowerCase())
        if (isExact) return label
        const match = characters.find(
          (c) => c.label.toLowerCase().startsWith(label.toLowerCase()) && label.length < c.label.length
        )
        if (match) {
          changed = true
          return match.label
        }
        return label
      })
      if (changed) {
        const newAnchor = fixedLabels.join(' | ') + '.'
        corrections.push({
          takeNumber: take.takeNumber,
          ruleId: 'no-abbreviation',
          field: 'characterAnchor',
          before: take.characterAnchor,
          after: newAnchor
        })
        take.characterAnchor = newAnchor
        rulesApplied.add('no-abbreviation')
      }
    }
  }

  // Fix 4: character-names-valid — remove unknown names (after abbreviation fix)
  if (characters.length > 0) {
    const knownSet = new Set(characters.map((c) => c.label.toLowerCase()))
    for (const take of fixed) {
      if (isEmptyAnchor(take.characterAnchor)) continue
      const labels = extractCharacterLabels(take.characterAnchor)
      const validLabels = labels.filter((l) => knownSet.has(l.toLowerCase()))
      if (validLabels.length < labels.length) {
        const newAnchor = validLabels.length > 0 ? validLabels.join(' | ') + '.' : '\u2014'
        corrections.push({
          takeNumber: take.takeNumber,
          ruleId: 'character-names-valid',
          field: 'characterAnchor',
          before: take.characterAnchor,
          after: newAnchor
        })
        take.characterAnchor = newAnchor
        rulesApplied.add('character-names-valid')
      }
    }
  }

  // Fix 5: max-characters-per-anchor — trim to first 3
  for (const take of fixed) {
    if (isEmptyAnchor(take.characterAnchor)) continue
    const labels = extractCharacterLabels(take.characterAnchor)
    if (labels.length > MAX_ANCHOR_CHARS) {
      const trimmed = labels.slice(0, MAX_ANCHOR_CHARS)
      const newAnchor = trimmed.join(' | ') + '.'
      corrections.push({
        takeNumber: take.takeNumber,
        ruleId: 'max-characters-per-anchor',
        field: 'characterAnchor',
        before: take.characterAnchor,
        after: newAnchor
      })
      take.characterAnchor = newAnchor
      rulesApplied.add('max-characters-per-anchor')
    }
  }

  // Fix 6: negative-prompt-present — add default if missing
  for (const take of fixed) {
    if (!take.negativePrompt || take.negativePrompt.trim().length < 5) {
      corrections.push({
        takeNumber: take.takeNumber,
        ruleId: 'negative-prompt-present',
        field: 'negativePrompt',
        before: take.negativePrompt,
        after: DEFAULT_NEGATIVE
      })
      take.negativePrompt = DEFAULT_NEGATIVE
      rulesApplied.add('negative-prompt-present')
    }
  }

  // Fix 7: extended-negative-on-transition — append extended keywords on env transitions
  for (let i = 0; i < fixed.length; i++) {
    const isFirst = i === 0
    const envChanged =
      i > 0 &&
      fixed[i].environmentLock.trim().toLowerCase() !==
        fixed[i - 1].environmentLock.trim().toLowerCase()

    if (isFirst || envChanged) {
      const hasExtended = EXTENDED_KEYWORDS_SET.some((kw) =>
        fixed[i].negativePrompt.toLowerCase().includes(kw)
      )
      if (!hasExtended) {
        const before = fixed[i].negativePrompt
        let neg = before.replace(/\.\s*$/, '')
        neg += EXTENDED_NEGATIVE_SUFFIX
        corrections.push({
          takeNumber: fixed[i].takeNumber,
          ruleId: 'extended-negative-on-transition',
          field: 'negativePrompt',
          before,
          after: neg
        })
        fixed[i].negativePrompt = neg
        rulesApplied.add('extended-negative-on-transition')
      }
    }
  }

  return {
    fixed,
    corrections,
    rulesApplied: [...rulesApplied]
  }
}

// --- Per-take failure identification (for LLM selective fix) ---

export function identifyFailingTakes(
  takes: ParsedTake[],
  scenes: Scene[],
  characters: CharacterRef[],
  _startingTake: number
): Map<number, string[]> {
  const failures = new Map<number, string[]>()

  const addFailure = (takeNum: number, ruleId: string): void => {
    if (!failures.has(takeNum)) failures.set(takeNum, [])
    failures.get(takeNum)!.push(ruleId)
  }

  // description-starts-camera
  for (const take of takes) {
    const lower = take.description.toLowerCase()
    const startsWithCamera = CAMERA_KEYWORDS.some((kw) => lower.startsWith(kw))
    if (!startsWithCamera) {
      addFailure(take.takeNumber, 'description-starts-camera')
    }
  }

  // description-max-words
  for (const take of takes) {
    const wordCount = take.description.split(/\s+/).filter(Boolean).length
    if (wordCount > 35) {
      addFailure(take.takeNumber, 'description-max-words')
    }
  }

  // no-internal-emotions
  for (const take of takes) {
    const lower = take.description.toLowerCase()
    for (const phrase of INTERNAL_EMOTION_BLOCKLIST) {
      if (lower.includes(phrase)) {
        addFailure(take.takeNumber, 'no-internal-emotions')
        break
      }
    }
  }

  // environment-lock-present
  for (const take of takes) {
    if (!take.environmentLock || take.environmentLock.trim().length < 5) {
      addFailure(take.takeNumber, 'environment-lock-present')
    }
  }

  // description-matches-environment
  for (const take of takes) {
    const descLower = take.description.toLowerCase()
    const envLower = take.environmentLock.toLowerCase()
    for (const room of ROOM_KEYWORDS) {
      if (descLower.includes(room) && !envLower.includes(room)) {
        addFailure(take.takeNumber, 'description-matches-environment')
        break
      }
    }
  }

  // environment-consistency (chapter-level — flag all takes in inconsistent chapters)
  if (takes.length > 1) {
    const chapterTakes: Record<number, Array<{ idx: number; env: string }>> = {}
    for (let i = 0; i < Math.min(takes.length, scenes.length); i++) {
      const chapter = scenes[i].chapter
      const env = takes[i].environmentLock?.trim() || ''
      if (!chapterTakes[chapter]) chapterTakes[chapter] = []
      chapterTakes[chapter].push({ idx: i, env })
    }
    for (const entries of Object.values(chapterTakes)) {
      if (entries.length <= 1) continue
      const locations = entries.map((e) => e.env.split(/[,.]/).map((s) => s.trim())[0]?.toLowerCase() || '')
      const uniqueLocations = new Set(locations)
      if (uniqueLocations.size > Math.ceil(entries.length * 0.5)) {
        for (const entry of entries) {
          addFailure(takes[entry.idx].takeNumber, 'environment-consistency')
        }
      }
    }
  }

  // character-not-all-same + character-variety (global — flag all takes with characters)
  if (characters.length > 1 && takes.length > 1) {
    const takesWithChars = takes.filter((t) => !isEmptyAnchor(t.characterAnchor))
    if (takesWithChars.length > 0) {
      const charFrequency: Record<string, number> = {}
      for (const take of takesWithChars) {
        const labels = extractCharacterLabels(take.characterAnchor)
        for (const label of labels) {
          charFrequency[label.toLowerCase()] = (charFrequency[label.toLowerCase()] || 0) + 1
        }
      }
      const allSame = Object.values(charFrequency).some(
        (count) => count === takesWithChars.length && takesWithChars.length >= 3
      )
      if (allSame) {
        for (const take of takesWithChars) {
          addFailure(take.takeNumber, 'character-not-all-same')
        }
      }

      // character-variety check
      const combos = new Set(
        takesWithChars.map((t) =>
          extractCharacterLabels(t.characterAnchor).sort().join('||').toLowerCase()
        )
      )
      const leadChars = characters.filter((c) => {
        const lower = c.role.toLowerCase()
        return lower.includes('lead') || lower.includes('protagonist')
      })
      let leadDominance = 0
      if (leadChars.length > 0) {
        const leadLabels = new Set(leadChars.map((c) => c.label.toLowerCase()))
        const leadAppearances = takesWithChars.filter((t) =>
          extractCharacterLabels(t.characterAnchor).some((l) => leadLabels.has(l.toLowerCase()))
        ).length
        leadDominance = leadAppearances / takesWithChars.length
      }
      if (combos.size < 2 || (leadChars.length > 0 && leadDominance > 0.85)) {
        for (const take of takesWithChars) {
          addFailure(take.takeNumber, 'character-variety')
        }
      }
    }
  }

  return failures
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
    rulesNoAbbreviation(takes, characters),
    rulesMaxCharsPerAnchor(takes),
    rulesExtendedNegativeOnTransition(takes),
    rulesNoInternalEmotions(takes),
    rulesDescriptionMatchesEnvironment(takes)
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
