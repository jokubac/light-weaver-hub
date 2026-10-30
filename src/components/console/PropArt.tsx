import { useId } from "react";
/** Top-down architectural drawings for PLOT set props; scales to the prop's own footprint. */
const S = "var(--muted-foreground)";
const F = "var(--surface-elevated)";
const F2 = "var(--muted)";

export function PropArt({ id, w, h, glow }: { id?: string | undefined; w: number; h: number; glow?: string | undefined }) {
  const gid = useId().replace(/:/g, "");
  const W = Math.max(10, w * 100), H = Math.max(10, h * 100), m = Math.min(W, H);
  const sw = Math.max(1.5, m * 0.025);
  const p = { stroke: S, strokeWidth: sw, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  const lamp = (r: number, shade: number) => (<>
    {glow && <circle cx={W / 2} cy={H / 2} r={m * 0.5} fill={`url(#${gid})`} />}
    <circle cx={W / 2} cy={H / 2} r={m * shade} fill={F} {...p} />
    <circle cx={W / 2} cy={H / 2} r={m * r} fill={glow ?? F2} stroke={S} strokeWidth={sw * 0.7} />
  </>);
  let body: React.ReactNode;
  switch (id) {
    case "floor-lamp": body = <>{lamp(0.12, 0.4)}<circle cx={W / 2} cy={H / 2} r={m * 0.28} fill="none" stroke={S} strokeWidth={sw * 0.5} strokeDasharray={`${sw * 2} ${sw * 2}`} /></>; break;
    case "table-lamp": body = lamp(0.13, 0.34); break;
    case "pendant": body = <>{lamp(0.1, 0.3)}<path d={`M${W / 2} ${H / 2 - m * 0.3}V${H * 0.04}`} {...p} strokeDasharray={`${sw} ${sw * 1.5}`} /></>; break;
    case "practical": body = <>{lamp(0.16, 0.3)}{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => { const r = (a * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r); return <path key={a} d={`M${W / 2 + c * m * 0.34} ${H / 2 + s * m * 0.34}L${W / 2 + c * m * 0.44} ${H / 2 + s * m * 0.44}`} {...p} />; })}</>; break;
    case "sconce": body = <>{glow && <ellipse cx={W / 2} cy={H * 0.3} rx={W * 0.45} ry={H * 0.7} fill={`url(#${gid})`} />}<rect x={W * 0.1} y={H * 0.05} width={W * 0.8} height={H * 0.18} rx={sw} fill={F2} {...p} /><path d={`M${W * 0.22} ${H * 0.23}A${W * 0.28} ${H * 0.6} 0 0 0 ${W * 0.78} ${H * 0.23}Z`} fill={F} {...p} /><circle cx={W / 2} cy={H * 0.4} r={m * 0.14} fill={glow ?? F2} stroke={S} strokeWidth={sw * 0.7} /></>; break;
    case "sofa": body = <><rect x={sw} y={sw} width={W - 2 * sw} height={H - 2 * sw} rx={m * 0.18} fill={F} {...p} /><rect x={sw} y={sw} width={W - 2 * sw} height={H * 0.28} rx={m * 0.14} fill={F2} {...p} /><rect x={sw} y={sw} width={W * 0.1} height={H - 2 * sw} rx={m * 0.1} fill={F2} {...p} /><rect x={W * 0.9 - sw} y={sw} width={W * 0.1} height={H - 2 * sw} rx={m * 0.1} fill={F2} {...p} />{[1, 2].map((k) => <path key={k} d={`M${W * 0.1 + (W * 0.8 * k) / 3} ${H * 0.3}V${H - 2 * sw}`} {...p} strokeWidth={sw * 0.6} />)}</>; break;
    case "table": body = <><rect x={m * 0.2} y={m * 0.2} width={W - m * 0.4} height={H - m * 0.4} rx={sw * 2} fill={F2} {...p} />{[[0.5, 0.08], [0.5, 0.92], [0.08, 0.5], [0.92, 0.5]].map(([x, y], k) => <rect key={k} x={W * x - m * 0.12} y={H * y - m * 0.08} width={m * 0.24} height={m * 0.16} rx={sw} fill={F} {...p} strokeWidth={sw * 0.7} transform={x !== 0.5 ? `rotate(90 ${W * x} ${H * y})` : undefined} />)}<rect x={m * 0.3} y={m * 0.3} width={W - m * 0.6} height={H - m * 0.6} rx={sw} fill="none" stroke={S} strokeWidth={sw * 0.4} opacity={0.5} /></>; break;
    case "chair": body = <><rect x={W * 0.15} y={H * 0.25} width={W * 0.7} height={H * 0.65} rx={m * 0.1} fill={F} {...p} /><rect x={W * 0.12} y={H * 0.08} width={W * 0.76} height={H * 0.2} rx={m * 0.08} fill={F2} {...p} /></>; break;
    case "bed": body = <><rect x={sw} y={sw} width={W - 2 * sw} height={H - 2 * sw} rx={m * 0.05} fill={F} {...p} /><rect x={sw} y={sw} width={W - 2 * sw} height={H * 0.06} fill={F2} {...p} /><rect x={W * 0.1} y={H * 0.1} width={W * 0.36} height={H * 0.15} rx={m * 0.06} fill={F2} {...p} /><rect x={W * 0.54} y={H * 0.1} width={W * 0.36} height={H * 0.15} rx={m * 0.06} fill={F2} {...p} /><path d={`M${sw} ${H * 0.36}H${W - sw}`} {...p} /><path d={`M${W * 0.7} ${H * 0.36}L${W - sw} ${H * 0.5}`} {...p} strokeWidth={sw * 0.6} /></>; break;
    case "desk": body = <><rect x={sw} y={sw} width={W - 2 * sw} height={H - 2 * sw} rx={sw * 2} fill={F2} {...p} /><rect x={W * 0.35} y={H * 0.15} width={W * 0.3} height={H * 0.1} rx={sw} fill={S} /><rect x={W * 0.3} y={H * 0.5} width={W * 0.4} height={H * 0.18} rx={sw} fill={F} {...p} strokeWidth={sw * 0.6} /><circle cx={W * 0.5} cy={H * 1.05} r={m * 0.3} fill={F} {...p} /></>; break;
    case "plant": body = <><circle cx={W / 2} cy={H / 2} r={m * 0.2} fill={F2} {...p} />{Array.from({ length: 7 }, (_, k) => { const a = (k / 7) * Math.PI * 2; return <ellipse key={k} cx={W / 2 + Math.cos(a) * m * 0.27} cy={H / 2 + Math.sin(a) * m * 0.27} rx={m * 0.18} ry={m * 0.08} fill="color-mix(in srgb, var(--success, #4ade80) 45%, var(--surface-elevated))" {...p} strokeWidth={sw * 0.6} transform={`rotate(${(a * 180) / Math.PI} ${W / 2 + Math.cos(a) * m * 0.27} ${H / 2 + Math.sin(a) * m * 0.27})`} />; })}</>; break;
    case "door": body = <><rect x={0} y={H * 0.3} width={W} height={H * 0.4} fill={F2} {...p} strokeWidth={sw * 0.6} /><path d={`M${W * 0.08} ${H * 0.5}H${W * 0.92}`} {...p} /></>; break;
    case "window": body = <><rect x={0} y={H * 0.2} width={W} height={H * 0.6} fill={F} {...p} strokeWidth={sw * 0.6} /><path d={`M0 ${H * 0.5}H${W}`} stroke="var(--primary)" strokeWidth={sw} /></>; break;
    case "camera": body = <><path d={`M${W * 0.5} ${H * 0.55}L${W * 0.05} ${H * 0.02}M${W * 0.5} ${H * 0.55}L${W * 0.95} ${H * 0.02}`} {...p} strokeWidth={sw * 0.5} strokeDasharray={`${sw * 2} ${sw * 2}`} /><rect x={W * 0.3} y={H * 0.45} width={W * 0.4} height={H * 0.42} rx={sw * 2} fill={F2} {...p} /><rect x={W * 0.4} y={H * 0.32} width={W * 0.2} height={H * 0.15} rx={sw} fill={S} /></>; break;
    case "actor": body = <><ellipse cx={W / 2} cy={H / 2} rx={W * 0.4} ry={H * 0.22} fill={F2} {...p} /><circle cx={W / 2} cy={H / 2} r={m * 0.17} fill={F} {...p} /><path d={`M${W / 2} ${H / 2 - m * 0.17}l${-m * 0.06} ${-m * 0.08}h${m * 0.12}z`} fill={S} /></>; break;
    case "car": body = <><rect x={sw} y={H * 0.08} width={W - 2 * sw} height={H * 0.84} rx={m * 0.35} fill={F} {...p} /><path d={`M${W * 0.28} ${H * 0.18}Q${W * 0.22} ${H / 2} ${W * 0.28} ${H * 0.82}L${W * 0.36} ${H * 0.76}V${H * 0.24}Z`} fill={F2} {...p} strokeWidth={sw * 0.7} /><path d={`M${W * 0.78} ${H * 0.2}Q${W * 0.84} ${H / 2} ${W * 0.78} ${H * 0.8}L${W * 0.72} ${H * 0.74}V${H * 0.26}Z`} fill={F2} {...p} strokeWidth={sw * 0.7} /><rect x={W * 0.38} y={H * 0.22} width={W * 0.32} height={H * 0.56} rx={m * 0.08} fill="none" stroke={S} strokeWidth={sw * 0.6} /></>; break;
    default: body = <rect x={sw} y={sw} width={W - 2 * sw} height={H - 2 * sw} rx={m * 0.1} fill={F} {...p} />;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden>
      {glow && <defs><radialGradient id={gid}><stop offset="0%" stopColor={glow} stopOpacity={0.85} /><stop offset="100%" stopColor={glow} stopOpacity={0} /></radialGradient></defs>}
      {body}
    </svg>
  );
}
