/** Recognisable fixture bodies, with a stable common stage and model-relative tube lengths. */
export function FixtureGlyph({ model, colour, pixels }: { model: string; colour: string; pixels?: string[] }) {
  const m = model.toLowerCase();
  const tube = /tube|titan|helios|hyperion|ax1|quasar|pavotube|infinibar|pixel strip/.test(m);
  const panel = /panel|pavoslim|dyno|vortex|mat|nova|mixpanel|flex|litemat|gemini/.test(m);
  const bulb = /bulb|nyx|mc\b|pixelbrick|ax3|ax5/.test(m);
  const width = tube ? (/helios/.test(m) ? 62 : /hyperion/.test(m) ? 132 : 110) : panel ? 88 : 54;
  return <svg viewBox="0 0 160 100" className="h-24 w-full" role="img" aria-label={`${model} fixture icon`}>
    <g stroke="var(--color-muted-foreground)" strokeWidth="2" strokeLinejoin="round">
      {tube ? <>
        <rect x={(160-width)/2-5} y="39" width={width+10} height="22" rx="4" fill="var(--color-surface-elevated)" />
        <rect x={(160-width)/2} y="43" width={width} height="14" rx="3" fill={colour} stroke="var(--color-border)" />
        {pixels?.map((c,i) => <rect key={i} x={(160-width)/2+i*width/pixels.length} y="44" width={width/pixels.length} height="12" fill={c} stroke="none" />)}
        <path d={`M${(160-width)/2+8} 63v5m${width-16} -5v5`} />
      </> : panel ? <>
        <path d="M30 34v40h100V34M80 74v12m-13 0h26" fill="none" />
        <rect x="32" y="18" width="96" height="52" rx="4" fill="var(--color-surface-elevated)" />
        <rect x="37" y="23" width="86" height="42" rx="2" fill={colour} stroke="var(--color-border)" />
        {pixels?.map((c,i) => <rect key={i} x={37+(i%4)*21.5} y={23+Math.floor(i/4)*42/Math.ceil(pixels.length/4)} width={21.5} height={42/Math.ceil(pixels.length/4)} fill={c} stroke="var(--color-border)" strokeWidth=".5" />)}
      </> : bulb ? <>
        <path d="M70 65h20v14H70zm3 17h14" fill="var(--color-surface-elevated)" />
        <circle cx="80" cy="44" r="24" fill={pixels?.[0] ?? colour} />
      </> : <>
        <path d="M47 29h45l21 12v30L92 77H47z" fill="var(--color-surface-elevated)" />
        <path d="M49 23v-5h35v9m-41 18h-8v20h8M56 77v8h47V72M79 85v9" fill="none" />
        <ellipse cx="99" cy="52" rx="23" ry="28" fill="var(--color-background)" />
        <ellipse cx="101" cy="52" rx="17" ry="22" fill={pixels?.[0] ?? colour} stroke="var(--color-border)" />
        <path d="M49 36h14m-14 7h14m-14 7h14m-14 7h14m-14 7h14" />
      </>}
    </g>
  </svg>;
}