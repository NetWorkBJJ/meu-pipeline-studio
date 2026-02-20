interface VoiceSelectorProps {
  value: string
  onChange: (voice: string) => void
}

export function VoiceSelector({ value, onChange }: VoiceSelectorProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-text-muted">Voz</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text outline-none transition-colors focus:border-primary"
      >
        <optgroup label="Higher pitch">
          <option value="Zephyr">Zephyr</option>
          <option value="Leda">Leda</option>
          <option value="Laomedeia">Laomedeia</option>
          <option value="Achernar">Achernar</option>
        </optgroup>
        <optgroup label="Middle pitch">
          <option value="Puck">Puck</option>
          <option value="Kore">Kore</option>
          <option value="Aoede">Aoede</option>
          <option value="Callirrhoe">Callirrhoe</option>
          <option value="Autonoe">Autonoe</option>
          <option value="Despina">Despina</option>
          <option value="Erinome">Erinome</option>
          <option value="Rasalgethi">Rasalgethi</option>
          <option value="Gacrux">Gacrux</option>
          <option value="Pulcherrima">Pulcherrima</option>
          <option value="Vindemiatrix">Vindemiatrix</option>
          <option value="Sadaltager">Sadaltager</option>
          <option value="Sulafat">Sulafat</option>
        </optgroup>
        <optgroup label="Lower middle pitch">
          <option value="Fenrir">Fenrir</option>
          <option value="Orus">Orus</option>
          <option value="Iapetus">Iapetus</option>
          <option value="Umbriel">Umbriel</option>
          <option value="Alnilam">Alnilam</option>
          <option value="Schedar">Schedar</option>
          <option value="Achird">Achird</option>
          <option value="Zubenelgenubi">Zubenelgenubi</option>
        </optgroup>
        <optgroup label="Lower pitch">
          <option value="Charon">Charon</option>
          <option value="Enceladus">Enceladus</option>
          <option value="Algieba">Algieba</option>
          <option value="Algenib">Algenib</option>
          <option value="Sadachbia">Sadachbia</option>
        </optgroup>
      </select>
    </div>
  )
}
