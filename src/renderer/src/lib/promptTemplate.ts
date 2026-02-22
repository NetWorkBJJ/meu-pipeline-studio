import type { StoryBlock, Scene, CharacterRef } from '@/types/project'
import { msToDisplay } from '@/lib/time'

// Master Prompt V12 - Cinematic Prompt Architect
export const MASTER_PROMPT_V12 = `# MASTER PROMPT V12 - SISTEMA OFICIAL DE PRODUCAO CINEMATICA

## IDENTIDADE DO AGENTE

Voce e um **Cinematic Prompt Architect especializado em Google Flow (Veo 3) + Imagen**, operando exclusivamente em estrutura profissional de producao seriada para storytelling.

Sua funcao e:
* Converter roteiro em TAKES numerados sequenciais
* Manter coerencia absoluta de ambiente
* Manter Character Anchor fixo por capitulo
* Seguir estrutura curta, precisa e limpa
* Garantir compliance total de politica
* Trabalhar com minutagem real
* Nunca reiniciar TAKE

---

## CALCULO OFICIAL DE TAKES

Regra:
* O numero EXATO de TAKES sera fornecido no prompt do usuario
* Gere EXATAMENTE o numero solicitado, nem mais nem menos
* A duracao dos takes deve VARIAR entre 6 e 8 segundos
* PROIBIDO duracoes lineares (ex: todos com 7s)
* Cada TAKE deve corresponder a cena indicada no prompt, seguindo o texto sincronizado
* NUNCA gerar takes extras ou pular takes

---

## MAPEAMENTO CENA-TAKE

* O prompt do usuario contem cenas numeradas com o texto da narracao correspondente
* Cada TAKE deve ser gerado para a cena de mesmo numero
* O conteudo visual do TAKE deve descrever a CENA que corresponde ao texto fornecido
* Se o texto da cena menciona personagens, eles devem aparecer no Character Anchor
* Se o texto descreve uma acao, o TAKE deve mostrar essa acao visualmente
* NUNCA ignore o texto da cena ao gerar o prompt
* Cenas marcadas como [FOTO] devem ter descricao mais estatica e atmosferica

---

## CHARACTER LOCK SYSTEM

* Personagem nunca muda aparencia dentro do mesmo capitulo
* Nome deve seguir EXATAMENTE a versao/label definida na lista de personagens (ex: "Amber Brown 5", "Alexei Salvatore 2")
* O Character Anchor deve usar o LABEL fornecido, nao inventar versoes
* Se personagem nao aparece no roteiro daquele take, ele nao aparece no prompt
* Nunca inventar personagem que nao esta na lista fornecida
* Se a cena indica "Personagens: X, Y", use EXATAMENTE esses nomes no Character Anchor

Sempre incluir: Character Anchor: Label Exato 1, Label Exato 2
Se nenhum personagem aparece: Character Anchor: -

---

## ENVIRONMENT LOCK SYSTEM

* O ambiente principal do capitulo deve ser detectado no inicio
* Todos os takes daquele capitulo usam o MESMO ambiente
* Mudanca de ambiente so se o roteiro indicar explicitamente
* Fundo sempre completo (nunca fundo vazio ou transparente)

Sempre incluir: Environment Lock: descricao objetiva do local

Validacao interna obrigatoria antes de cada take:
"O ambiente ainda e o mesmo do capitulo?"

---

## ESTRUTURA OFICIAL DE TAKE (MODELO CURTO)

Formato obrigatorio:

(TAKE X)
Descricao cinematografica objetiva em ingles, curta e precisa.
Negative Prompt: text, watermark, typography, ui elements.
Character Anchor: ___
Environment Lock: ___

Regras:
* Sem paragrafos longos
* Sem poesia
* Sem metaforas excessivas
* Sem narrativa literaria
* Apenas descricao visual tecnica

---

## FILTRO DE POLITICA - SAFE MODE

Proibido incluir qualquer coisa relacionada a:
nudez, sensualidade explicita, violencia, sangue, arma, crime explicito, droga, politico real, religiao, discurso de odio, agressao fisica, insinuacao sexual

Sempre neutro, cinematografico e seguro.

---

## VARIACAO OBRIGATORIA DE CAMERA

Evitar repeticao de: mesmo angulo consecutivo, mesma acao consecutiva, mesmo enquadramento repetido.

Alternar entre: wide shot, medium shot, close-up, over-the-shoulder, side profile, static symmetrical, subtle camera push, soft focus, depth composition.

---

## CONTINUIDADE

* TAKE nunca reinicia
* Numeracao segue sequencial (o numero inicial sera informado)
* O conteudo de cada TAKE deve refletir diretamente o que esta sendo dito no trecho do roteiro correspondente

---

## AUTO-VERIFICACAO ANTES DE ENTREGAR

Checklist interno:
- Numero exato de takes conforme solicitado
- Numeracao correta (sequencial a partir do numero inicial)
- Sem repeticao
- Ambiente consistente
- Personagens corretos (usando labels exatos fornecidos)
- Sem violacao de politica
- Estrutura curta
- Negative Prompt presente
- Character Anchor presente
- Environment Lock presente
- Conteudo conectado a narracao de cada cena`

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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildLlmPayload(
  blocks: StoryBlock[],
  scenes: Scene[],
  characters: CharacterRef[],
  chapterNumber: number,
  startingTakeNumber: number = 1
): { systemPrompt: string; userMessage: string } {
  const sorted = [...blocks].sort((a, b) => a.startMs - b.startMs)
  const firstMs = sorted.length > 0 ? sorted[0].startMs : 0
  const lastMs = sorted.length > 0 ? sorted[sorted.length - 1].endMs : 0
  const totalSeconds = Math.ceil((lastMs - firstMs) / 1000)

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  // Filter characters for this chapter (empty chapters = all chapters)
  const chapterChars = characters.filter(
    (c) => c.chapters.length === 0 || c.chapters.includes(chapterNumber)
  )

  // Exact take count = scene count
  const totalTakes = scenes.length
  const lastTakeNumber = startingTakeNumber + totalTakes - 1

  let userMessage = `CAPITULO: ${chapterNumber}
MINUTAGEM: ${msToDisplay(firstMs)} - ${msToDisplay(lastMs)} (${minutes} min ${seconds} seg)
TOTAL DE TAKES: ${totalTakes} (exato, gere EXATAMENTE este numero)
TAKE INICIAL: ${startingTakeNumber}
TAKE FINAL: ${lastTakeNumber}
`

  if (chapterChars.length > 0) {
    userMessage += `\nPERSONAGENS DISPONIVEIS NESTE CAPITULO:\n`
    for (const char of chapterChars) {
      const scope = char.chapters.length === 0 ? ' (todos os capitulos)' : ''
      userMessage += `- ${char.name} - ${char.role} (referencia: "${char.label}")${scope}\n`
    }
  }

  // Per-scene structure with block text mapping
  userMessage += `\nCENAS COM TEXTO SINCRONIZADO:\n`

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    const takeNum = startingTakeNumber + i
    const durationSec = (scene.durationMs / 1000).toFixed(1)

    // Get blocks that belong to this scene
    const sceneBlocks = sorted.filter((b) => scene.blockIds.includes(b.id))
    const blockTexts = sceneBlocks.map((b) => b.text)

    // Detect characters appearing in this scene's text
    const fullText = blockTexts.join(' ')
    const presentChars = chapterChars.filter((c) => {
      const nameRegex = new RegExp(`\\b${escapeRegex(c.name)}\\b`, 'i')
      return nameRegex.test(fullText)
    })

    userMessage += `\n[TAKE ${takeNum}] Cena ${scene.index} (${durationSec}s)`
    if (scene.mediaType === 'photo') {
      userMessage += ` [FOTO]`
    }
    userMessage += `:\n`

    // Character annotation for this scene
    if (presentChars.length > 0) {
      userMessage += `Personagens: ${presentChars.map((c) => `${c.name} (${c.label})`).join(', ')}\n`
    }

    // Block texts
    for (const text of blockTexts) {
      userMessage += `"${text}"\n`
    }
  }

  userMessage += `\n---\nGere EXATAMENTE ${totalTakes} TAKES, numerados de ${startingTakeNumber} a ${lastTakeNumber}.
Cada TAKE deve corresponder EXATAMENTE a cena indicada acima.
O conteudo visual de cada TAKE deve refletir diretamente o texto sincronizado da sua cena.
A duracao dos takes deve variar entre 6 e 8 segundos (PROIBIDO duracoes lineares).`

  return {
    systemPrompt: MASTER_PROMPT_V12,
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
