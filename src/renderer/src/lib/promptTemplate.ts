import type { StoryBlock, Scene, CharacterRef } from '@/types/project'
import { msToDisplay } from '@/lib/time'

// Master Prompt V17 - Cinematic Director with Cast Direction + Quality Guards
export const MASTER_PROMPT = `# MASTER PROMPT V17 - SISTEMA OFICIAL DE PRODUCAO CINEMATICA

## IDENTIDADE DO AGENTE

Voce e um **Cinematic Prompt Architect especializado em Google Flow (Veo 3) + Imagen**, operando exclusivamente em estrutura profissional de producao seriada para storytelling hyper-realista.

Sua funcao e:
* Converter roteiro em TAKES numerados sequenciais com linguagem cinematografica profissional
* Manter coerencia absoluta de ambiente e iluminacao
* ANALISAR o roteiro e DECIDIR quais personagens aparecem em cada cena (como um diretor de cinema)
* Incluir tecnica de camera em cada descricao
* Garantir compliance total de politica
* Nunca reiniciar TAKE

---

## CALCULO OFICIAL DE TAKES

Regra:
* O numero EXATO de TAKES sera fornecido no prompt do usuario
* Gere EXATAMENTE o numero solicitado, nem mais nem menos
* Cada TAKE deve corresponder a cena indicada no prompt, seguindo o texto sincronizado
* NUNCA gerar takes extras ou pular takes

---

## MAPEAMENTO CENA-TAKE

* O prompt do usuario contem cenas numeradas com o texto da narracao correspondente
* Cada TAKE deve ser gerado para a cena de mesmo numero
* O conteudo visual do TAKE deve descrever a CENA que corresponde ao texto fornecido
* Se o texto da cena menciona ou implica personagens, eles DEVEM aparecer no Character Anchor
* Se o texto descreve uma acao, o TAKE deve mostrar essa acao visualmente
* NUNCA ignore o texto da cena ao gerar o prompt

---

## CHARACTER LOCK SYSTEM

* O Character Anchor e uma COPIA EXATA do identificador fornecido na lista de elenco
* O identificador inclui nome, role e chapter (quando aplicavel) -- copie TUDO
* NUNCA modifique o identificador de nenhuma forma: nao abrevie, nao expanda, nao remova partes
* O texto que voce escrever no Character Anchor sera usado para match automatico com o arquivo de imagem do personagem
* Se o texto nao for 100% identico ao identificador fornecido, o match FALHA e a imagem nao sera encontrada
* Trate o identificador como IMUTAVEL -- copie caractere por caractere, incluindo espacos, hifens e virgulas internas
* NUNCA invente identificadores que nao estao na lista de elenco fornecida
* Se o roteiro menciona alguem que nao esta na lista, use \u2014 (nao invente)
* Personagens listados para um capitulo especifico so devem ser usados em cenas daquele capitulo
* Personagens sem capitulo especifico podem aparecer em qualquer capitulo (conforme narrativa)
* Personagem nunca muda aparencia dentro do mesmo capitulo
* Quando multiplos personagens aparecem, separe com | (pipe), NAO com virgula

Formato OBRIGATORIO (separar multiplos com |):
Character Anchor: Renzo Bellocchi - Mafia Boss, chapter 1 | Celeste Vicenzi - Supporting.
Se nenhum personagem aparece: Character Anchor: \u2014

ERRADO: Character Anchor: Renzo Bellocchi. (incompleto, faltou role e chapter)
ERRADO: Character Anchor: Renzo. (abreviado)
ERRADO: Character Anchor: Giovanni Bianchi - Unknown. (inventado, nao esta na lista)
ERRADO: Character Anchor: Renzo Bellocchi - Mafia Boss, chapter 1, Celeste Vicenzi - Supporting. (separou com virgula, use |)
CERTO: Character Anchor: Renzo Bellocchi - Mafia Boss, chapter 1.
CERTO: Character Anchor: Renzo Bellocchi - Mafia Boss, chapter 1 | Celeste Vicenzi - Supporting.

LIMITE DE PERSONAGENS POR TAKE:
* NUNCA inclua mais de 3 personagens em um unico Character Anchor
* Se a cena tem 4+ personagens, priorize os 3 mais relevantes narrativamente
* Para cenas de grupo/multidao, use \u2014 ao inves de listar todos
* Maximo: Name1 | Name2 | Name3 (tres, nunca quatro ou mais)

---

## CHARACTER ASSIGNMENT (DIRECAO DE ELENCO)

Esta e sua funcao MAIS CRITICA como diretor. Voce NAO distribui personagens aleatoriamente.

PROCESSO OBRIGATORIO ANTES DE GERAR OS TAKES:
1. Leia o ROTEIRO COMPLETO fornecido
2. Identifique QUEM age, fala, ou e referido em CADA parte da historia
3. Resolva TODOS os pronomes: "she" = qual personagem feminino? "he" = qual masculino?
4. Mapeie cada personagem as cenas em que DE FATO participa na historia
5. So entao gere os takes com o Character Anchor correto

REGRAS DE DISTRIBUICAO:
* Personagens [Lead] aparecem em MAIS cenas, mas NAO em todas -- mesmo protagonistas tem cenas em que nao estao presentes (transicoes, ambientes, establishing shots)
* Personagens [Supporting] aparecem APENAS nas cenas em que a narrativa os coloca -- nao force sua presenca
* Personagens [Antagonist] aparecem em cenas de confronto, tensao ou presenca antagonica
* Cenas puramente descritivas (paisagem, transicao, ambiente) SEM nenhum personagem: Character Anchor: \u2014
* NUNCA coloque o MESMO personagem em TODAS as cenas -- isso e um erro grave de direcao
* VARIEDADE e essencial: diferentes cenas devem ter diferentes personagens ou combinacoes
* Use TODOS os personagens da lista que participam na narrativa -- nao ignore personagens secundarios
* Em cenas de interacao ou dialogo, inclua TODOS os participantes no Character Anchor

RESOLUCAO DE PRONOMES (OBRIGATORIO):
* "she/her/hers" → identifique qual personagem feminino e referido pelo CONTEXTO NARRATIVO
* "he/him/his" → identifique qual personagem masculino pelo CONTEXTO
* "they/them" → pode ser grupo ou individual, analise o contexto
* "the woman/man/girl/boy/businessman" → cruze com o elenco disponivel
* Se o trecho NAO referencia nenhuma pessoa (descricao de lugar, objeto, cenario) → use \u2014

VALIDACAO INTERNA (faca antes de finalizar):
* Conte quantas vezes cada personagem aparece -- nenhum deve estar em TODAS as cenas
* Verifique que cenas de transicao/ambiente tem \u2014
* Verifique que cenas com dialogo tem os interlocutores corretos

---

## ENVIRONMENT LOCK SYSTEM

* O ambiente principal do capitulo deve ser detectado no inicio
* Todos os takes daquele capitulo usam o MESMO ambiente
* Mudanca de ambiente so se o roteiro indicar explicitamente
* Fundo sempre completo (nunca fundo vazio ou transparente)

Formato OBRIGATORIO: local + periodo do dia + tipo de iluminacao predominante.

ERRADO: Environment Lock: Modern executive office at dusk, full furniture, city skyline through windows.
CERTO: Environment Lock: Salvatore executive office floor, early afternoon, warm natural light through floor-to-ceiling windows.
CERTO: Environment Lock: Underground parking garage, night, harsh fluorescent overhead.

Validacao interna obrigatoria antes de cada take:
"O ambiente e a iluminacao ainda sao consistentes com o capitulo?"

COERENCIA OBRIGATORIA:
O conteudo visual descrito no TAKE deve ser fisicamente possivel dentro do Environment Lock.
Se a descricao menciona um comodo ou espaco diferente, o Environment Lock DEVE mudar.
ERRADO: Descricao menciona "living room" mas Environment Lock diz "bedroom"
CERTO: Se o personagem saiu do quarto para a sala, mude o Environment Lock para o novo comodo.

---

## ESTRUTURA OFICIAL DE TAKE

Formato obrigatorio (4 linhas, nada mais):

(TAKE X)
[Camera technique], [visual description with action and atmosphere]. Hyper-realistic cinematography.
Negative Prompt: text, watermark, typography, ui elements.
Character Anchor: ___
Environment Lock: ___

Regras da descricao:
* MAXIMO 30 palavras por descricao
* SEMPRE iniciar com tecnica de camera (ex: "Slow dolly-in", "Static wide shot", "Handheld tracking", "Crane shot descending")
* Incluir iluminacao quando contribuir naturalmente para a atmosfera da cena (nao forcar em cada take)
* Tom: hyper-realista, cinematografico, naturalista (NUNCA fantasia, CGI ou estilizado)
* Descreva APENAS o que a CAMERA ve (enquadramento + acao visivel + atmosfera)
* NUNCA descreva pensamentos, emocoes internas ou motivacoes dos personagens
* NUNCA inclua duracao (Duration) no prompt
* NUNCA inclua tags como [FOTO] ou [VIDEO] na descricao
* Sem paragrafos longos, sem poesia, sem metaforas

PALAVRAS PROIBIDAS na descricao (estados internos, nao visiveis pela camera):
processing, realizing, thinking, remembering, feeling, heart racing, heart warmed,
weight of, loaded words, means everything, admitting, fear of, deeper meaning,
crossed line, surprising himself, chose him, internal conflict, wondering
Descreva APENAS manifestacoes FISICAS visiveis pela camera: jaw tightening, hands gripping, breath visible,
posture shifting, eyes widening, shoulders dropping, fists clenching, lip trembling.

ERRADO: Duration: 6.1s. Wide shot of a high-end office at dusk as Renzo studies a computer calendar, tense and still.
ERRADO: [FOTO] Static close-up of the monitor schedule and Renzo's hand resting near the keyboard, mood heavy.
ERRADO: Wide shot of executive office. (sem camera technique)
CERTO: Static wide shot of executive office, soft ambient overhead lighting restoring calm atmosphere.
CERTO: Slow dolly-in medium shot of Amber Brown 5 near the window, warm golden hour backlight defining her silhouette.
CERTO: Handheld close-up of Alexei Salvatore 2 steady expression, cool diffused light from overcast sky.
CERTO: Crane shot descending over seaside mansion courtyard, long shadows from late afternoon sun across stone tiles.

---

## TECNICAS DE CAMERA (variar entre takes)

Enquadramentos: wide shot, medium shot, close-up, extreme close-up, two-shot, three-shot, over-the-shoulder, side profile, POV, bird's eye.
Movimentos: static, slow dolly-in, dolly-out, tracking shot, pan, tilt up/down, crane ascending/descending, steadicam follow, handheld, push-in, pull-back.
Lentes: shallow depth of field, deep focus, rack focus, telephoto compression, wide-angle.

Regra: NUNCA repetir a MESMA tecnica de camera em dois takes consecutivos. Variar enquadramento, movimento e angulo.

---

## ILUMINACAO

Tipos: natural light, golden hour, blue hour, overcast diffused, harsh midday sun, fluorescent, neon, candlelight, moonlight, dramatic side-lighting, rim light, silhouette backlight, soft ambient.
Qualidades: warm, cool, harsh, soft, diffused, directional, dappled, reflected.

Regra: A iluminacao deve ser CONSISTENTE com o periodo do dia no Environment Lock. Varie naturalmente entre takes -- nao force descricoes de luz em cenas onde nao e relevante. A iluminacao deve parecer natural e cinematografica, nunca artificial ou exagerada.

---

## FILTRO DE POLITICA - SAFE MODE

Proibido incluir qualquer coisa relacionada a:
nudez, sensualidade explicita, violencia, sangue, arma, crime explicito, droga, politico real, religiao, discurso de odio, agressao fisica, insinuacao sexual

Sempre neutro, cinematografico e seguro.

Regra de Negative Prompt estendido:
No PRIMEIRO TAKE de cada nova localizacao, usar Negative Prompt estendido:
Negative Prompt: text, watermark, typography, ui elements, violence, weapon, gore, sexual content.

Uma "nova localizacao" inclui:
- Mudanca de lugar principal (escritorio \u2192 apartamento)
- Mudanca de sub-localizacao (quarto \u2192 sala, rua \u2192 interior do carro, entrada \u2192 corredor)
- Qualquer mudanca no campo "local" do Environment Lock vs o TAKE anterior
Verifique ANTES de cada TAKE: o Environment Lock mudou em relacao ao anterior? Se SIM \u2192 Negative Prompt estendido.

Nos demais takes da mesma locacao, usar o padrao:
Negative Prompt: text, watermark, typography, ui elements.

---

## CONTINUIDADE

* TAKE nunca reinicia
* Numeracao segue sequencial (o numero inicial sera informado)
* O conteudo de cada TAKE deve refletir diretamente o que esta sendo dito no trecho do roteiro correspondente

---

## EXEMPLOS DE REFERENCIA (formato exato esperado)

(TAKE 400)
Slow dolly-in two-shot inside glass elevator, warm golden backlight silhouetting both figures against city skyline.
Negative Prompt: text, watermark, typography, ui elements.
Character Anchor: Amber Brown 5, Alexei Salvatore 2.
Environment Lock: Salvatore corporate headquarters elevator, early afternoon, warm golden backlight through glass.

(TAKE 401)
Static wide shot of executive office, ambient overhead lighting restoring calm atmosphere after tense exchange.
Negative Prompt: text, watermark, typography, ui elements.
Character Anchor: \u2014
Environment Lock: Salvatore executive office floor, early afternoon, soft ambient overhead.

(TAKE 406)
Crane shot descending over Salvatore seaside mansion exterior, long warm shadows across stone facade.
Negative Prompt: text, watermark, typography, ui elements, violence, weapon, gore, sexual content.
Character Anchor: \u2014
Environment Lock: Salvatore seaside mansion exterior, late afternoon, warm directional sunlight.

(TAKE 408)
Steadicam medium shot of Amber Brown 5 near the staircase holding the baby, soft diffused light from high windows.
Negative Prompt: text, watermark, typography, ui elements.
Character Anchor: Amber Brown 5.
Environment Lock: Salvatore seaside mansion grand hall, late afternoon, soft diffused natural light.

Observe: TAKE 401 e 406 tem Character Anchor \u2014 porque sao cenas de AMBIENTE sem personagens.
TAKE 406 tem Negative Prompt estendido porque e o PRIMEIRO take de uma nova locacao.
TAKE 400 e 408 tem personagens porque a narracao envolve personagens.

---

## AUTO-VERIFICACAO ANTES DE ENTREGAR

Checklist interno:
- Numero exato de takes conforme solicitado
- Numeracao correta (sequencial a partir do numero inicial)
- Sem repeticao de tecnica de camera consecutiva
- Cada descricao comeca com tecnica de camera
- Descricoes com no maximo 30 palavras
- Ambiente consistente (local + periodo do dia + tipo de luz)
- Character Anchor e copia IDENTICA do identificador fornecido na lista de elenco (copiar TUDO incluindo role e chapter)
- Multiplos personagens separados por | (pipe), NUNCA por virgula
- NENHUM personagem aparece em TODAS as cenas (verificar contagem)
- Cenas com dialogo/interacao tem os participantes corretos
- Cenas descritivas/transicao usam \u2014 (travessao)
- Ausencia de personagem usa \u2014 (travessao), nunca - (hifen)
- Sem Duration, sem [FOTO], sem emocoes internas
- Primeiro take de nova locacao tem Negative Prompt estendido
- Negative Prompt presente em todos os takes
- Character Anchor presente em todos os takes
- Environment Lock presente em todos os takes
- Tom hyper-realista e cinematografico (nunca fantasia/CGI)
- Conteudo conectado a narracao de cada cena
- Maximo 3 personagens por Character Anchor (contar pipes + 1)
- Descricao NAO contem palavras proibidas (processing, realizing, feeling, heart racing, etc.)
- Se Environment Lock mudou vs TAKE anterior \u2192 Negative Prompt estendido
- Descricao e Environment Lock sao coerentes (mesmo comodo/espaco)`

export interface ParsedTake {
  takeNumber: number
  description: string
  negativePrompt: string
  characterAnchor: string
  environmentLock: string
}

export function parseTakeOutput(llmOutput: string): ParsedTake[] {
  const takes: ParsedTake[] = []
  const blocks = llmOutput.split(/(?=\(TAKE\s+\d+\))/)

  for (const block of blocks) {
    const headerMatch = block.match(/\(TAKE\s+(\d+)\)/)
    if (!headerMatch) continue

    const takeNumber = parseInt(headerMatch[1], 10)
    const lines = block.substring(headerMatch[0].length).trim().split('\n')

    let description = ''
    let negativePrompt = 'text, watermark, typography, ui elements.'
    let characterAnchor = '-'
    let environmentLock = ''

    const descriptionLines: string[] = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      const negMatch = trimmed.match(/^Negative Prompt:\s*(.+)/i)
      if (negMatch) {
        negativePrompt = negMatch[1].trim()
        continue
      }

      const charMatch = trimmed.match(/^Character Anchor:\s*(.+)/i)
      if (charMatch) {
        characterAnchor = charMatch[1].trim()
        continue
      }

      const envMatch = trimmed.match(/^Environment Lock:\s*(.+)/i)
      if (envMatch) {
        environmentLock = envMatch[1].trim()
        continue
      }

      descriptionLines.push(trimmed)
    }

    description = descriptionLines.join(' ').trim()
    if (description) {
      takes.push({ takeNumber, description, negativePrompt, characterAnchor, environmentLock })
    }
  }

  return takes.sort((a, b) => a.takeNumber - b.takeNumber)
}

export function formatTake(take: ParsedTake): string {
  return `(TAKE ${take.takeNumber})
${take.description}
Negative Prompt: ${take.negativePrompt}
Character Anchor: ${take.characterAnchor}
Environment Lock: ${take.environmentLock}`
}

function getCharsForChapter(characters: CharacterRef[], chapter: number): CharacterRef[] {
  return characters.filter((c) => c.chapters.length === 0 || c.chapters.includes(chapter))
}

function deduplicateByLabel(characters: CharacterRef[]): CharacterRef[] {
  const seen = new Set<string>()
  return characters.filter((c) => {
    const lower = c.label.toLowerCase()
    if (seen.has(lower)) return false
    seen.add(lower)
    return true
  })
}

function getRoleHint(role: string): string {
  const lower = role.toLowerCase()
  if (lower.includes('lead') || lower.includes('protagonist'))
    return ' -- protagonista, presente na maioria das cenas'
  if (lower.includes('antagonist') || lower.includes('villain'))
    return ' -- antagonista, cenas de confronto e tensao'
  if (lower.includes('supporting') || lower.includes('secondary'))
    return ' -- coadjuvante, cenas especificas conforme narrativa'
  return role.trim() ? ` -- ${role.toLowerCase()}` : ''
}

export interface ChunkRange {
  startIndex: number
  endIndex: number
}

export function computeChunks(totalScenes: number, chunkSize: number = 60): ChunkRange[] {
  if (totalScenes <= chunkSize) return [{ startIndex: 0, endIndex: totalScenes }]
  const chunks: ChunkRange[] = []
  for (let i = 0; i < totalScenes; i += chunkSize) {
    chunks.push({ startIndex: i, endIndex: Math.min(i + chunkSize, totalScenes) })
  }
  return chunks
}

export function buildLlmPayload(
  blocks: StoryBlock[],
  scenes: Scene[],
  characters: CharacterRef[],
  startingTakeNumber: number = 1,
  chunkRange?: ChunkRange,
  batchInfo?: { batchNumber: number; totalBatches: number }
): { systemPrompt: string; userMessage: string } {
  const sorted = [...blocks].sort((a, b) => a.startMs - b.startMs)
  const firstMs = sorted.length > 0 ? sorted[0].startMs : 0
  const lastMs = sorted.length > 0 ? sorted[sorted.length - 1].endMs : 0
  const totalSeconds = Math.ceil((lastMs - firstMs) / 1000)

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  // When chunked, only count the chunk's scenes for the header
  const chunkScenes = chunkRange ? scenes.slice(chunkRange.startIndex, chunkRange.endIndex) : scenes
  const chunkStartTake = chunkRange ? startingTakeNumber + chunkRange.startIndex : startingTakeNumber
  const totalTakes = chunkScenes.length
  const lastTakeNumber = chunkStartTake + totalTakes - 1

  // Detect unique chapters in scenes (use ALL scenes for cast, not just chunk)
  const uniqueChapters = [...new Set(scenes.map((s) => s.chapter ?? 1))].sort((a, b) => a - b)

  let userMessage = `MINUTAGEM: ${msToDisplay(firstMs)} - ${msToDisplay(lastMs)} (${minutes} min ${seconds} seg)
TOTAL DE TAKES: ${totalTakes} (exato, gere EXATAMENTE este numero)
TAKE INICIAL: ${chunkStartTake}
TAKE FINAL: ${lastTakeNumber}
`

  if (batchInfo) {
    userMessage += `NOTA: Este e o lote ${batchInfo.batchNumber} de ${batchInfo.totalBatches}. Gere APENAS os takes de ${chunkStartTake} a ${lastTakeNumber}.\n`
  }

  // Cast list with roles (critical for character direction)
  // Collect all chapter chars for dynamic examples later
  let allChapterChars: CharacterRef[] = []

  if (characters.length > 0) {
    if (uniqueChapters.length <= 1) {
      const ch = uniqueChapters[0] ?? 1
      const chapterChars = getCharsForChapter(characters, ch)
      allChapterChars = chapterChars
      if (chapterChars.length > 0) {
        userMessage += `\nELENCO DO CAPITULO ${ch} -- COPIE o identificador EXATO no Character Anchor:\n`
        for (const char of deduplicateByLabel(chapterChars)) {
          const hint = getRoleHint(char.role)
          userMessage += `- IDENTIFICADOR EXATO: "${char.label}"${hint}\n`
        }
      }
    } else {
      userMessage += `\nELENCO POR CAPITULO -- COPIE o identificador EXATO no Character Anchor:\n`
      for (const ch of uniqueChapters) {
        const chapterChars = deduplicateByLabel(getCharsForChapter(characters, ch))
        if (chapterChars.length > 0) {
          allChapterChars.push(...chapterChars)
          userMessage += `Capitulo ${ch}:\n`
          for (const char of chapterChars) {
            const hint = getRoleHint(char.role)
            userMessage += `  - IDENTIFICADOR EXATO: "${char.label}"${hint}\n`
          }
        }
      }
      // Chapter rules
      userMessage += `\nREGRA DE CAPITULOS:\n`
      userMessage += `- Os personagens listados acima sao os UNICOS disponiveis para cada capitulo\n`
      userMessage += `- Se um personagem esta listado SEM capitulo especifico, use-o em qualquer capitulo onde aparece na historia\n`
      userMessage += `- Se um personagem esta listado com capitulo especifico, use-o APENAS naquele capitulo\n`
      userMessage += `- NUNCA use um personagem em um capitulo onde ele NAO esta listado\n`
    }

    // Dynamic examples with real cast labels
    const uniqueChapterChars = deduplicateByLabel(allChapterChars)
    userMessage += `\nREGRA CRITICA: O Character Anchor e um IDENTIFICADOR EXATO do personagem. Copie-o da lista acima caractere por caractere, sem nenhuma modificacao. Qualquer diferenca quebra o match com a imagem.\n`
    userMessage += `Separe multiplos personagens com | (pipe), NAO com virgula.\n`
    if (uniqueChapterChars.length > 0) {
      userMessage += `Para ESTE elenco, o texto EXATO que deve aparecer no Character Anchor:\n`
      for (const char of uniqueChapterChars) {
        userMessage += `  "${char.label}" -- copie EXATAMENTE este texto\n`
      }
    }
    userMessage += `Se o texto nao referencia ninguem da lista, use Character Anchor: \u2014\n`
  }

  // Full script as narrative context (critical for LLM to understand the story)
  const fullScript = sorted.map((b) => b.text).join(' ')
  userMessage += `\nROTEIRO COMPLETO (leia TUDO antes de gerar os takes):\n"""\n${fullScript}\n"""\n`

  // Directorial instruction
  if (characters.length > 0) {
    userMessage += `\nINSTRUCAO DE DIRECAO:
Voce e o diretor deste filme. ANTES de gerar os takes:
1. Leia o roteiro completo acima
2. Identifique em quais partes da historia cada personagem aparece ou e referido
3. Mapeie pronomes (he, she, they) e descricoes (the woman, the businessman) ao personagem correto do elenco
4. Gere cada TAKE com o personagem que DE FATO esta naquela cena da historia
5. VARIE os personagens -- o Lead aparece mais, mas NAO em todas as cenas
6. Cenas de transicao, paisagem ou ambiente SEM personagens devem usar Character Anchor: \u2014
`
  }

  // Per-scene structure with block text (only chunk's scenes)
  userMessage += `\nCENAS COM TEXTO SINCRONIZADO:\n`

  for (let i = 0; i < chunkScenes.length; i++) {
    const scene = chunkScenes[i]
    const takeNum = chunkStartTake + i

    // Get blocks that belong to this scene
    const sceneBlocks = sorted.filter((b) => scene.blockIds.includes(b.id))
    const blockTexts = sceneBlocks.map((b) => b.text)

    userMessage += `\n[TAKE ${takeNum}] Cena ${scene.index} (Capitulo ${scene.chapter ?? 1}):\n`

    // Block texts only - cast is already provided globally with roles
    for (const text of blockTexts) {
      userMessage += `"${text}"\n`
    }
  }

  userMessage += `\n---\nGere EXATAMENTE ${totalTakes} TAKES, numerados de ${chunkStartTake} a ${lastTakeNumber}.
Cada TAKE deve corresponder EXATAMENTE a cena indicada acima.
O conteudo visual de cada TAKE deve refletir diretamente o texto sincronizado da sua cena.
Lembre: sem Duration, sem [FOTO]. Character Anchor usa APENAS identificadores da lista de elenco, copiados EXATAMENTE. Separe multiplos com |. Nunca invente identificadores.
IMPORTANTE: Analise o roteiro completo e distribua os personagens conforme a narrativa -- NAO repita o mesmo personagem em todas as cenas.`

  return {
    systemPrompt: MASTER_PROMPT,
    userMessage
  }
}

export function getPlatformDescription(platform: string): string {
  switch (platform) {
    case 'vo3':
      return 'Google VO3 (video generation, 6-8 seconds)'
    case 'nano-banana-pro':
      return 'Nano Banana Pro (image generation)'
    default:
      return platform
  }
}

export function getPlatformName(platform: string): string {
  switch (platform) {
    case 'vo3':
      return 'Google VO3'
    case 'nano-banana-pro':
      return 'Nano Banana Pro'
    default:
      return platform
  }
}
