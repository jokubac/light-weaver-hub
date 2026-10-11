import type { FixtureIcon } from "@/lib/fixture-icons";

/** Recognisable fixture bodies, with a stable common stage and model-relative tube lengths. */
export function FixtureGlyph({ model, icon = "auto", colour, pixels, className = "h-24 w-full" }: { model: string; icon?: FixtureIcon | undefined; colour: string; pixels?: string[] | undefined; className?: string }) {
  const m = model.toLowerCase();
  const auto = icon === "auto";
  const tube = auto ? /tube|titan|helios|hyperion|ax1|quasar|pavotube|infinibar|pixel strip/.test(m) : icon.startsWith("tube-");
  const panel = auto ? /panel|pavoslim|dyno|vortex|mat|nova|mixpanel|flex|litemat|gemini/.test(m) : icon === "panel";
  const bulb = auto ? /bulb|nyx|mc\b|pixelbrick|ax3|ax5/.test(m) : icon === "bulb";
  const width = tube ? (icon === "tube-small" || (auto && /helios/.test(m)) ? 62 : icon === "tube-huge" || (auto && /hyperion/.test(m)) ? 132 : 110) : panel ? 88 : 54;
  return <svg viewBox="0 0 160 100" className={className} data-fixture-icon={icon} role="img" aria-label={`${model} fixture icon`}>
    <g stroke="var(--color-muted-foreground)" strokeWidth="2" strokeLinejoin="round">
      {icon === "practical" ? <>
        <path d="M58 26h44l14 32H44z" fill={colour} />
        <path d="M80 58v26m-18 0h36" fill="none" />
      </> : icon === "balloon" ? <>
        <ellipse cx="80" cy="40" rx="37" ry="29" fill={colour} />
        <path d="M58 17q-15 25 0 46m44-46q15 25 0 46M80 69v20m-14 0h28" fill="none" />
      </> : icon === "carpet" ? <>
        <path d="M30 25q24-11 50 0t50 0v48q-24 11-50 0t-50 0z" fill="var(--color-surface-elevated)" />
        <path d="M37 31q21-8 43 0t43 0v35q-21 8-43 0t-43 0z" fill={colour} />
        <path d="M35 77l-8 9m98-9 8 9" fill="none" />
      </> : icon === "brick" ? <>
        <path d="M47 32l15-10h54v48l-15 10H47z" fill="var(--color-surface-elevated)" />
        <rect x="51" y="37" width="46" height="38" rx="3" fill={pixels?.[0] ?? colour} />
        <path d="M102 32l14-10m-14 10v48m5-40h5m-5 9h5m-5 9h5" fill="none" />
      </> : icon === "pocket" ? <>
        <rect x="51" y="29" width="58" height="43" rx="7" fill="var(--color-surface-elevated)" />
        <rect x="57" y="35" width="46" height="31" rx="4" fill={pixels?.[0] ?? colour} />
        <path d="M73 76h14m-7-4v4" fill="none" />
      </> : tube ? <>
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