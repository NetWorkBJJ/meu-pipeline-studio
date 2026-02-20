interface StyleSelectorProps {
  value: string
  onChange: (style: string) => void
}

const STYLE_DESCRIPTIONS: Record<string, string> = {
  Neutro: 'Narracao padrao, sem estilo especifico',
  Energetico: 'Tom vibrante e animado',
  Empolgado: 'Extremamente animado',
  Calmo: 'Tom relaxante e sereno',
  Sussurrado: 'Tom baixo e intimo',
  Intenso: 'Tom forte e determinado',
  Explosivo: 'Maximo entusiasmo',
  Profissional: 'Tom corporativo e formal',
  Jornalistico: 'Estilo de noticiario',
  'Locutor Radio': 'Estilo radio profissional',
  Documentario: 'Estilo Discovery/NatGeo',
  Educativo: 'Tom de aula/tutorial',
  Coach: 'Estilo motivacional',
  Influencer: 'Estilo redes sociais',
  Vendedor: 'Estilo comercial',
  Podcast: 'Estilo conversacional',
  'Apresentador TV': 'Estilo televisivo',
  Dramatico: 'Tom teatral com emocao',
  Misterioso: 'Tom de suspense/thriller',
  Romantico: 'Tom amoroso e poetico',
  Nostalgico: 'Tom de saudade',
  Esperancoso: 'Tom otimista',
  Melancolico: 'Tom triste e reflexivo',
  Raiva: 'Tom de indignacao',
  Surpreso: 'Tom de revelacao',
  Inspirador: 'Tom motivacional',
  Filosofico: 'Tom contemplativo',
  Storytelling: 'Narrativa envolvente',
  ASMR: 'Tom super relaxante',
  Comedia: 'Tom de humor',
  Terror: 'Tom sinistro',
  Epico: 'Tom grandioso',
  Cientifico: 'Tom academico',
  Infantil: 'Tom para criancas',
  Fantasia: 'Tom de mundo magico'
}

export function StyleSelector({ value, onChange }: StyleSelectorProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-text-muted">Estilo</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text outline-none transition-colors focus:border-primary"
      >
        <optgroup label="Energia">
          <option value="Neutro">Neutro</option>
          <option value="Energetico">Energetico</option>
          <option value="Empolgado">Empolgado</option>
          <option value="Calmo">Calmo</option>
          <option value="Sussurrado">Sussurrado</option>
          <option value="Intenso">Intenso</option>
          <option value="Explosivo">Explosivo</option>
        </optgroup>
        <optgroup label="Profissao">
          <option value="Profissional">Profissional</option>
          <option value="Jornalistico">Jornalistico</option>
          <option value="Locutor Radio">Locutor Radio</option>
          <option value="Documentario">Documentario</option>
          <option value="Educativo">Educativo</option>
          <option value="Coach">Coach</option>
          <option value="Influencer">Influencer</option>
          <option value="Vendedor">Vendedor</option>
          <option value="Podcast">Podcast</option>
          <option value="Apresentador TV">Apresentador TV</option>
        </optgroup>
        <optgroup label="Emocao">
          <option value="Dramatico">Dramatico</option>
          <option value="Misterioso">Misterioso</option>
          <option value="Romantico">Romantico</option>
          <option value="Nostalgico">Nostalgico</option>
          <option value="Esperancoso">Esperancoso</option>
          <option value="Melancolico">Melancolico</option>
          <option value="Raiva">Raiva</option>
          <option value="Surpreso">Surpreso</option>
          <option value="Inspirador">Inspirador</option>
          <option value="Filosofico">Filosofico</option>
        </optgroup>
        <optgroup label="Genero">
          <option value="Storytelling">Storytelling</option>
          <option value="ASMR">ASMR</option>
          <option value="Comedia">Comedia</option>
          <option value="Terror">Terror</option>
          <option value="Epico">Epico</option>
          <option value="Cientifico">Cientifico</option>
          <option value="Infantil">Infantil</option>
          <option value="Fantasia">Fantasia</option>
        </optgroup>
      </select>
      {value && STYLE_DESCRIPTIONS[value] && (
        <span className="text-[10px] text-text-muted/70">{STYLE_DESCRIPTIONS[value]}</span>
      )}
    </div>
  )
}
