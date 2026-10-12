/**
 * NOX logo — tamsus, kampuotas kvadratas, beraštas „N", oranžinis „O" kaip
 * įjungimo mygtukas (žiedas su įkirstu viršumi ir vertikalia linija) ir baltas
 * „X", o aplink „O" — švelnus oranžinis švytėjimas.
 *
 * `tile` (numatyta) — su tamsiu fonu, kaip programėlės piktograma.
 * `tile={false}` — skaidrus fonas, kai logotipas dedamas ant kitos spalvos.
 */
export function NoxLogo({
  className = "h-10 w-10",
  tile = true,
  title,
}: {
  className?: string;
  tile?: boolean;
  title?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {tile && <rect width="512" height="512" rx="115" fill="#17131c" />}

      {/* Švelnus šviesos šaltinio švytėjimas aplink „O" */}
      <circle cx="256" cy="250" r="90" fill="#ff5a00" opacity="0.15" />
      <circle cx="256" cy="250" r="130" fill="#ff5a00" opacity="0.05" />
      <circle cx="256" cy="250" r="170" fill="#ff5a00" opacity="0.025" />

      {/* „N" — masyvi, pramoninė geometrija, be jokių apvalių kampų */}
      <path
        d="M 76 336 V 164 L 144 336 V 164"
        stroke="#ffffff"
        strokeWidth="32"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        fill="none"
      />

      {/* „O" — įjungimo mygtukas: oranžžas žiedas su įkirstu viršumi */}
      <path
        d="M 240 182 A 70 70 0 1 0 272 182"
        stroke="#ff5a00"
        strokeWidth="32"
        strokeLinecap="butt"
        fill="none"
      />
      <line x1="256" y1="164" x2="256" y2="230" stroke="#ff5a00" strokeWidth="32" strokeLinecap="butt" />

      {/* „X" — griežtos, simetriškos linijos */}
      <path
        d="M 368 164 L 436 336 M 436 164 L 368 336"
        stroke="#ffffff"
        strokeWidth="32"
        strokeLinecap="butt"
        fill="none"
      />
    </svg>
  );
}
