import React from "react";

export interface FestiveGraphicProps extends React.SVGProps<SVGSVGElement> {
  isDark?: boolean;
  variant?: "hero" | "navbar" | "footer" | "grid";
}

// ======================================================================
// 🎨 1. HOLI FESTIVAL GRAPHICS (World-Class Vector Suite)
// ======================================================================

/**
 * Holi Hero Banner Illustration:
 * - Bold graffiti-style Holi scene: a smashing clay Matki (pot) at center,
 *   with dynamic colour splash explosions, swirling gulal powder clouds,
 *   scattered marigold petals, and vivid abstract paint splatter art.
 * - 100% pure vector, zero external dependencies, sharp at all resolutions.
 */
export const HoliHeroScene: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 640 520" preserveAspectRatio="xMidYMid meet" style={style} {...props}>
      <defs>
        {/* Glow filter for paint splashes */}
        <filter id={`h-glow-${id}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Soft shadow for the Matki pot */}
        <filter id={`h-shadow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#7c2d12" floodOpacity={isDark ? 0.5 : 0.18} />
        </filter>

        {/* Matki terracotta body gradient */}
        <radialGradient id={`h-matki-body-${id}`} cx="38%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#fdba74" />
          <stop offset="40%" stopColor="#ea580c" />
          <stop offset="75%" stopColor="#c2410c" />
          <stop offset="100%" stopColor="#7c2d12" />
        </radialGradient>
        {/* Matki neck gradient */}
        <linearGradient id={`h-matki-neck-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#b45309" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>

        {/* Paint splash gradients - vibrant Holi colours */}
        <radialGradient id={`h-splash-pink-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fb7185" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#e11d48" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#be123c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`h-splash-cyan-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#0891b2" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0e7490" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`h-splash-yellow-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde047" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#eab308" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#a16207" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`h-splash-purple-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c084fc" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#9333ea" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#6b21a8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`h-splash-green-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#16a34a" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#14532d" stopOpacity="0" />
        </radialGradient>

        {/* Pichkari metallic body gradient */}
        <linearGradient id={`h-pich-body-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="20%" stopColor="#facc15" />
          <stop offset="55%" stopColor="#d97706" />
          <stop offset="80%" stopColor="#92400e" />
          <stop offset="100%" stopColor="#451a03" />
        </linearGradient>
        <linearGradient id={`h-pich-hl-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#92400e" />
          <stop offset="35%" stopColor="#fef08a" />
          <stop offset="55%" stopColor="#ffffff" />
          <stop offset="80%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        {/* Colour spray arc gradient */}
        <linearGradient id={`h-spray-arc-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
          <stop offset="30%" stopColor="#f43f5e" stopOpacity="0.88" />
          <stop offset="60%" stopColor="#facc15" stopOpacity="0.85" />
          <stop offset="85%" stopColor="#a855f7" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#4ade80" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* ─── BACKGROUND: Soft swirling gulal powder halos ─── */}
      <ellipse cx="310" cy="260" rx="220" ry="170" fill={`url(#h-splash-pink-${id})`} opacity="0.4" />
      <ellipse cx="180" cy="200" rx="160" ry="130" fill={`url(#h-splash-cyan-${id})`} opacity="0.35" />
      <ellipse cx="480" cy="210" rx="145" ry="120" fill={`url(#h-splash-yellow-${id})`} opacity="0.4" />
      <ellipse cx="440" cy="350" rx="130" ry="100" fill={`url(#h-splash-purple-${id})`} opacity="0.3" />
      <ellipse cx="150" cy="340" rx="110" ry="90" fill={`url(#h-splash-green-${id})`} opacity="0.3" />

      {/* ─── PAINT SPLATTER ART: Big organic colour blobs ─── */}
      {/* Pink left-top big blob */}
      <path
        d="M 100 95 C 60 50 30 80 55 120 C 20 125 15 165 60 155 C 45 185 75 200 100 175 C 110 200 145 195 145 165 C 175 180 185 150 160 130 C 190 110 165 75 135 90 C 125 65 100 70 100 95 Z"
        fill="#f43f5e"
        opacity="0.82"
        filter={`url(#h-glow-${id})`}
      />
      {/* Yellow upper-right blob */}
      <path
        d="M 490 60 C 455 25 430 55 450 90 C 420 88 405 120 435 130 C 415 150 435 178 460 162 C 465 185 500 185 510 160 C 535 172 555 148 538 125 C 562 110 555 78 528 82 C 520 58 495 50 490 60 Z"
        fill="#facc15"
        opacity="0.85"
        filter={`url(#h-glow-${id})`}
      />
      {/* Cyan bottom-left blob */}
      <path
        d="M 90 370 C 55 335 30 360 48 395 C 20 398 18 430 55 422 C 42 448 72 460 95 440 C 100 462 132 458 135 432 C 158 445 172 418 150 400 C 175 380 162 350 138 362 C 128 340 96 345 90 370 Z"
        fill="#06b6d4"
        opacity="0.78"
        filter={`url(#h-glow-${id})`}
      />
      {/* Purple right blob */}
      <path
        d="M 535 300 C 508 268 488 292 502 322 C 476 320 468 348 496 354 C 480 372 502 392 522 376 C 524 396 552 394 556 372 C 576 382 590 360 572 344 C 593 328 584 298 562 308 C 555 288 538 285 535 300 Z"
        fill="#a855f7"
        opacity="0.8"
        filter={`url(#h-glow-${id})`}
      />
      {/* Green right-top blob */}
      <path
        d="M 555 140 C 530 115 512 135 525 158 C 505 155 498 178 520 183 C 507 197 524 212 542 200 C 544 215 566 213 568 198 C 583 206 594 188 580 175 C 596 162 588 138 570 148 C 562 130 558 132 555 140 Z"
        fill="#22c55e"
        opacity="0.78"
        filter={`url(#h-glow-${id})`}
      />

      {/* ─── PAINT DRIPS & STREAKS ─── */}
      {/* Pink drip left */}
      <path d="M 102 175 C 98 195 100 220 95 240 C 93 250 96 260 92 270" fill="none" stroke="#f43f5e" strokeWidth="6" strokeLinecap="round" opacity="0.7" />
      <ellipse cx="92" cy="275" rx="6" ry="8" fill="#f43f5e" opacity="0.65" />
      {/* Yellow drip top-right */}
      <path d="M 508 183 C 510 200 506 220 508 242 C 509 252 505 262 507 276" fill="none" stroke="#facc15" strokeWidth="5.5" strokeLinecap="round" opacity="0.7" />
      <ellipse cx="507" cy="282" rx="5" ry="7" fill="#facc15" opacity="0.65" />
      {/* Cyan drip */}
      <path d="M 138 430 C 134 446 136 460 132 475" fill="none" stroke="#06b6d4" strokeWidth="5" strokeLinecap="round" opacity="0.65" />
      <ellipse cx="131" cy="481" rx="4.5" ry="6.5" fill="#06b6d4" opacity="0.6" />

      {/* ─── CENTRAL MATKI (CLAY POT) – bursting with colour ─── */}
      <g filter={`url(#h-shadow-${id})`}>
        {/* Pot body – rounded terracotta shape */}
        <path
          d="M 245 295 C 228 340 232 400 265 420 C 295 438 345 438 375 420 C 408 400 412 340 395 295 C 375 270 355 258 320 258 C 285 258 262 270 245 295 Z"
          fill={`url(#h-matki-body-${id})`}
        />
        {/* Traditional embossed ring bands */}
        <path d="M 240 305 C 265 325 375 325 400 305" fill="none" stroke="#c2410c" strokeWidth="4" opacity="0.5" />
        <path d="M 235 340 C 260 365 380 365 405 340" fill="none" stroke="#c2410c" strokeWidth="3.5" opacity="0.45" />
        {/* Specular luster highlight on left shoulder */}
        <path d="M 258 285 C 250 305 248 335 260 360" fill="none" stroke="#fdba74" strokeWidth="5" strokeLinecap="round" opacity="0.6" />
        {/* Crack / break line – the pot is smashing! */}
        <path d="M 300 258 C 310 275 295 290 305 310 C 315 330 300 345 312 365" fill="none" stroke="#7c2d12" strokeWidth="3.5" strokeLinecap="round" opacity="0.75" />
        <path d="M 320 258 C 325 272 335 285 328 302 C 320 318 330 338 320 358" fill="none" stroke="#7c2d12" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />

        {/* ── Coloured Holi water visible through opening ── */}
        <ellipse cx="320" cy="288" rx="50" ry="18" fill="#831843" opacity="0.85" />
        <ellipse cx="320" cy="278" rx="48" ry="15" fill="#be185d" opacity="0.6" />

        {/* ── Pot neck and golden rim (clean — no pichkaris inside) ── */}
        <ellipse cx="320" cy="266" rx="64" ry="23" fill={`url(#h-matki-neck-${id})`} />
        <ellipse cx="320" cy="261" rx="57" ry="16" fill="#fbbf24" />
        {/* Rim inner dark shadow */}
        <ellipse cx="320" cy="260" rx="50" ry="13" fill="#92400e" opacity="0.45" />
        {/* Pink water surface shimmer */}
        <ellipse cx="320" cy="259" rx="44" ry="11" fill="#f43f5e" opacity="0.65" />
        <ellipse cx="317" cy="257" rx="28" ry="6.5" fill="#fb7185" opacity="0.45" />
        <ellipse cx="314" cy="256" rx="14" ry="3.5" fill="#fda4af" opacity="0.4" />

      </g>

      {/* ─── 3 PICHKARIS leaning against the outside of the Matki ─── */}
      {/*
        Each pichkari stands fully outside the pot, leaning against its front face.
        Local y=0 = nozzle tip on the ground; pichkari extends UP (y becomes more negative).
        Anatomy (bottom→top): nozzle cap → barrel w/ colour rings → collar → neck → gold ball handle
      */}

      {/* ── PICHKARI 1 — RED, leaning right 22° against left wall ── */}
      <g transform="translate(240, 435) rotate(22)">
        {/* Barrel */}
        <rect x="-9" y="-130" width="18" height="130" rx="7"
          fill="#dc2626" stroke="#991b1b" strokeWidth="1.5" />
        {/* Specular streak */}
        <rect x="-7" y="-128" width="4" height="124" rx="2" fill="#ffffff" opacity="0.2" />
        {/* Colour rings */}
        <rect x="-9" y="-130" width="18" height="28" rx="6" fill="#fbbf24" />
        <rect x="-9" y="-100" width="18" height="28" rx="0" fill="#16a34a" />
        <rect x="-9" y="-70"  width="18" height="28" rx="0" fill="#0ea5e9" />
        <rect x="-9" y="-40"  width="18" height="28" rx="0" fill="#fbbf24" />
        {/* Nozzle cap at bottom */}
        <ellipse cx="0" cy="-6" rx="9" ry="5.5"
          fill={`url(#h-pich-body-${id})`} stroke="#92400e" strokeWidth="1" />
        <ellipse cx="0" cy="-4" rx="5" ry="3" fill="#1e293b" />
        {/* Collar (barrel top) */}
        <ellipse cx="0" cy="-130" rx="11" ry="6"
          fill={`url(#h-pich-hl-${id})`} stroke="#92400e" strokeWidth="1.2" />
        {/* Neck */}
        <rect x="-4.5" y="-152" width="9" height="25" rx="3.5"
          fill={`url(#h-pich-body-${id})`} stroke="#92400e" strokeWidth="1" />
        {/* Gold ball handle */}
        <circle cx="0" cy="-166" r="14"
          fill={`url(#h-pich-hl-${id})`} stroke="#92400e" strokeWidth="1.5" />
        <circle cx="-5" cy="-173" r="5.5" fill="#ffffff" opacity="0.55" />
        <circle cx="-6" cy="-175" r="2.5" fill="#ffffff" opacity="0.85" />
      </g>

      {/* ── PICHKARI 2 — BLUE, nearly vertical (−5°) in centre ── */}
      <g transform="translate(318, 444) rotate(-5)">
        <rect x="-9" y="-135" width="18" height="135" rx="7"
          fill="#1d4ed8" stroke="#1e3a8a" strokeWidth="1.5" />
        <rect x="-7" y="-133" width="4" height="129" rx="2" fill="#ffffff" opacity="0.2" />
        <rect x="-9" y="-135" width="18" height="28" rx="6" fill="#fbbf24" />
        <rect x="-9" y="-105" width="18" height="28" rx="0" fill="#e11d48" />
        <rect x="-9" y="-75"  width="18" height="28" rx="0" fill="#22c55e" />
        <rect x="-9" y="-45"  width="18" height="28" rx="0" fill="#a855f7" />
        <ellipse cx="0" cy="-6" rx="9" ry="5.5"
          fill={`url(#h-pich-body-${id})`} stroke="#92400e" strokeWidth="1" />
        <ellipse cx="0" cy="-4" rx="5" ry="3" fill="#1e293b" />
        <ellipse cx="0" cy="-135" rx="11" ry="6"
          fill={`url(#h-pich-hl-${id})`} stroke="#92400e" strokeWidth="1.2" />
        <rect x="-4.5" y="-158" width="9" height="26" rx="3.5"
          fill={`url(#h-pich-body-${id})`} stroke="#92400e" strokeWidth="1" />
        <circle cx="0" cy="-173" r="14"
          fill={`url(#h-pich-hl-${id})`} stroke="#92400e" strokeWidth="1.5" />
        <circle cx="-5" cy="-180" r="5.5" fill="#ffffff" opacity="0.55" />
        <circle cx="-6" cy="-182" r="2.5" fill="#ffffff" opacity="0.85" />
      </g>

      {/* ── PICHKARI 3 — GREEN, leaning left −22° against right wall ── */}
      <g transform="translate(400, 435) rotate(-22)">
        <rect x="-9" y="-130" width="18" height="130" rx="7"
          fill="#15803d" stroke="#14532d" strokeWidth="1.5" />
        <rect x="-7" y="-128" width="4" height="124" rx="2" fill="#ffffff" opacity="0.2" />
        <rect x="-9" y="-130" width="18" height="28" rx="6" fill="#fbbf24" />
        <rect x="-9" y="-100" width="18" height="28" rx="0" fill="#a855f7" />
        <rect x="-9" y="-70"  width="18" height="28" rx="0" fill="#f97316" />
        <rect x="-9" y="-40"  width="18" height="28" rx="0" fill="#06b6d4" />
        <ellipse cx="0" cy="-6" rx="9" ry="5.5"
          fill={`url(#h-pich-body-${id})`} stroke="#92400e" strokeWidth="1" />
        <ellipse cx="0" cy="-4" rx="5" ry="3" fill="#1e293b" />
        <ellipse cx="0" cy="-130" rx="11" ry="6"
          fill={`url(#h-pich-hl-${id})`} stroke="#92400e" strokeWidth="1.2" />
        <rect x="-4.5" y="-152" width="9" height="25" rx="3.5"
          fill={`url(#h-pich-body-${id})`} stroke="#92400e" strokeWidth="1" />
        <circle cx="0" cy="-166" r="14"
          fill={`url(#h-pich-hl-${id})`} stroke="#92400e" strokeWidth="1.5" />
        <circle cx="-5" cy="-173" r="5.5" fill="#ffffff" opacity="0.55" />
        <circle cx="-6" cy="-175" r="2.5" fill="#ffffff" opacity="0.85" />
      </g>


      {/* ─── SCATTERED PAINT DROPLETS & MINI BLOBS ─── */}
      {/* Pink */}
      <circle cx="155" cy="130" r="9" fill="#f43f5e" opacity="0.85" />
      <circle cx="135" cy="158" r="5.5" fill="#fb7185" opacity="0.8" />
      <circle cx="170" cy="155" r="7" fill="#e11d48" opacity="0.7" />
      {/* Yellow */}
      <circle cx="475" cy="100" r="10" fill="#facc15" opacity="0.85" />
      <circle cx="455" cy="125" r="6" fill="#fde047" opacity="0.8" />
      <circle cx="500" cy="125" r="7.5" fill="#eab308" opacity="0.75" />
      {/* Cyan */}
      <circle cx="195" cy="240" r="8" fill="#22d3ee" opacity="0.8" />
      <circle cx="175" cy="265" r="5" fill="#06b6d4" opacity="0.75" />
      <circle cx="218" cy="258" r="6.5" fill="#0891b2" opacity="0.7" />
      {/* Purple */}
      <circle cx="448" cy="250" r="9" fill="#c084fc" opacity="0.82" />
      <circle cx="472" cy="270" r="5.5" fill="#a855f7" opacity="0.75" />
      {/* Green */}
      <circle cx="555" cy="205" r="8.5" fill="#4ade80" opacity="0.8" />
      <circle cx="538" cy="225" r="5" fill="#22c55e" opacity="0.72" />

      {/* ─── FLOATING MARIGOLD PETALS ─── */}
      {/* Simple teardrop petal shapes */}
      <path d="M 80 290 C 73 278 90 268 93 280 Z" fill="#f97316" opacity="0.8" />
      <path d="M 105 310 C 98 296 116 288 118 302 Z" fill="#fbbf24" opacity="0.8" />
      <path d="M 540 350 C 533 338 550 328 553 342 Z" fill="#f97316" opacity="0.78" />
      <path d="M 562 375 C 555 360 572 352 575 366 Z" fill="#fbbf24" opacity="0.78" />
      <path d="M 200 430 C 193 418 210 410 212 424 Z" fill="#f97316" opacity="0.75" />
      <path d="M 430 440 C 423 428 440 420 442 434 Z" fill="#fbbf24" opacity="0.75" />

      {/* ─── GROUND COLOUR DUST ─── */}
      <ellipse cx="320" cy="432" rx="180" ry="22" fill="#7c2d12" opacity="0.1" />
      <ellipse cx="200" cy="435" rx="80" ry="14" fill="#e11d48" opacity="0.18" />
      <ellipse cx="340" cy="438" rx="90" ry="15" fill="#06b6d4" opacity="0.16" />
      <ellipse cx="455" cy="433" rx="75" ry="13" fill="#facc15" opacity="0.2" />
    </svg>
  );
};

export const HoliNavbarCluster: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 240 60" preserveAspectRatio="xMidYMid meet" style={style} {...props}>
      <defs>
        <filter id={`h-nav-glow-${id}`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`h-nav-brass-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>
      </defs>

      <circle cx="60" cy="30" r="22" fill="#f43f5e" opacity="0.35" />
      <circle cx="110" cy="26" r="25" fill="#facc15" opacity="0.35" />
      <circle cx="160" cy="32" r="20" fill="#06b6d4" opacity="0.35" />

      {/* Mini Brass Pichkari */}
      <g transform="translate(195, 30) rotate(-22)">
        <rect x="-42" y="-4.5" width="42" height="9" rx="2" fill={`url(#h-nav-brass-${id})`} />
        <polygon points="0,-4.5 12,-2 12,2 0,4.5" fill="#b45309" />
        <line x1="-58" y1="0" x2="-42" y2="0" stroke="#94a3b8" strokeWidth="2.5" />
        <circle cx="-58" cy="0" r="3" fill={`url(#h-nav-brass-${id})`} />
      </g>

      {/* Water Spray Droplets */}
      <g filter={`url(#h-nav-glow-${id})`}>
        <circle cx="185" cy="20" r="3" fill="#38bdf8" />
        <circle cx="170" cy="14" r="4" fill="#ec4899" />
        <circle cx="150" cy="10" r="3.5" fill="#facc15" />
        <circle cx="130" cy="14" r="2.5" fill="#4ade80" />
      </g>
    </svg>
  );
};

export const HoliDividerWave: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 1200 30" preserveAspectRatio="none" style={style} {...props}>
      <defs>
        <linearGradient id={`h-wave-grad1-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ec4899" stopOpacity="0.85" />
          <stop offset="25%" stopColor="#a855f7" stopOpacity="0.75" />
          <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.8" />
          <stop offset="75%" stopColor="#eab308" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#ec4899" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      <path
        d="M 0 15 Q 150 25 300 15 Q 450 5 600 15 Q 750 25 900 15 Q 1050 5 1200 15"
        fill="none"
        stroke={`url(#h-wave-grad1-${id})`}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx="150" cy="20" r="3.5" fill="#ec4899" opacity="0.8" />
      <circle cx="450" cy="10" r="4" fill="#06b6d4" opacity="0.8" />
      <circle cx="750" cy="20" r="3.5" fill="#facc15" opacity="0.8" />
      <circle cx="1050" cy="10" r="4" fill="#ec4899" opacity="0.8" />
    </svg>
  );
};

export const HoliFooterScene: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 1440 280" preserveAspectRatio="xMidYMid slice" style={style} {...props}>
      <defs>
        <radialGradient id={`h-foot-glow-l-${id}`} cx="10%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#ec4899" stopOpacity={isDark ? 0.35 : 0.18} />
          <stop offset="60%" stopColor="#8b5cf6" stopOpacity={isDark ? 0.15 : 0.08} />
          <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`h-foot-glow-r-${id}`} cx="90%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity={isDark ? 0.35 : 0.18} />
          <stop offset="60%" stopColor="#facc15" stopOpacity={isDark ? 0.2 : 0.08} />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </radialGradient>
        <filter id={`h-foot-blur-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {/* Ambient Color Washes */}
      <rect x="0" y="0" width="1440" height="280" fill={`url(#h-foot-glow-l-${id})`} />
      <rect x="0" y="0" width="1440" height="280" fill={`url(#h-foot-glow-r-${id})`} />

      {/* ── LEFT CORNER: Dynamic Gulal Powder Explosions & Paint Splatters ── */}
      <g transform="translate(10, 30)">
        {/* Soft Powder Puff */}
        <circle cx="90" cy="120" r="75" fill="#f43f5e" opacity={isDark ? 0.22 : 0.15} filter={`url(#h-foot-blur-${id})`} />
        <circle cx="160" cy="90" r="55" fill="#a855f7" opacity={isDark ? 0.22 : 0.15} filter={`url(#h-foot-blur-${id})`} />
        <circle cx="130" cy="170" r="60" fill="#facc15" opacity={isDark ? 0.22 : 0.15} filter={`url(#h-foot-blur-${id})`} />

        {/* Dynamic Vector Splash Streaks */}
        <path d="M 0 180 C 40 160 80 130 140 150 C 180 165 210 120 230 80 C 200 110 150 125 110 115 C 60 100 20 140 0 180 Z" fill="#ec4899" opacity="0.8" />
        <path d="M 20 220 C 60 200 110 210 160 180 C 200 150 240 180 270 140 C 230 160 180 140 130 160 C 80 180 40 190 20 220 Z" fill="#8b5cf6" opacity="0.75" />
        <path d="M 0 100 Q 60 70 110 90 Q 160 110 190 60 Q 130 75 90 60 Q 40 40 0 100 Z" fill="#facc15" opacity="0.85" />
        <path d="M 60 250 C 90 210 130 200 170 230 C 200 250 230 210 250 190 C 210 210 170 180 120 200 C 80 220 50 230 60 250 Z" fill="#06b6d4" opacity="0.75" />

        {/* Splatter Droplets */}
        <circle cx="250" cy="70" r="7" fill="#ec4899" opacity="0.85" />
        <circle cx="280" cy="110" r="5" fill="#facc15" opacity="0.9" />
        <circle cx="295" cy="150" r="6" fill="#8b5cf6" opacity="0.85" />
        <circle cx="265" cy="210" r="8" fill="#06b6d4" opacity="0.85" />
        <circle cx="180" cy="30" r="4.5" fill="#ec4899" opacity="0.8" />
        <circle cx="210" cy="45" r="3.5" fill="#facc15" opacity="0.85" />
        <circle cx="140" cy="20" r="5" fill="#10b981" opacity="0.8" />

        {/* Mini Gulal Bowl (Terracotta) */}
        <ellipse cx="60" cy="235" rx="35" ry="12" fill="#9a3412" opacity="0.9" />
        <ellipse cx="60" cy="230" rx="32" ry="9" fill="#ea580c" />
        <path d="M 32 230 Q 60 195 88 230 Z" fill="#ec4899" />
        <path d="M 40 228 Q 60 205 80 228 Z" fill="#f43f5e" />
      </g>

      {/* ── RIGHT CORNER: Pichkari Jet Stream, Splashes & Color Swirls ── */}
      <g transform="translate(1120, 20)">
        {/* Soft Powder Puff */}
        <circle cx="220" cy="110" r="75" fill="#06b6d4" opacity={isDark ? 0.22 : 0.15} filter={`url(#h-foot-blur-${id})`} />
        <circle cx="140" cy="160" r="65" fill="#facc15" opacity={isDark ? 0.22 : 0.15} filter={`url(#h-foot-blur-${id})`} />
        <circle cx="180" cy="80" r="55" fill="#10b981" opacity={isDark ? 0.22 : 0.15} filter={`url(#h-foot-blur-${id})`} />

        {/* Dynamic Inward Splash Arcs */}
        <path d="M 320 160 C 260 140 220 110 160 130 C 110 150 70 100 40 60 C 80 90 130 105 180 95 C 230 80 280 120 320 160 Z" fill="#06b6d4" opacity="0.8" />
        <path d="M 300 210 C 240 190 190 200 140 170 C 90 140 50 170 20 130 C 60 150 110 130 160 150 C 210 170 260 180 300 210 Z" fill="#facc15" opacity="0.85" />
        <path d="M 320 80 Q 250 60 200 80 Q 150 100 110 50 Q 170 65 220 50 Q 270 30 320 80 Z" fill="#ec4899" opacity="0.8" />
        <path d="M 270 240 C 220 200 180 210 130 180 C 100 160 60 200 30 180 C 80 190 120 170 170 190 C 210 210 240 220 270 240 Z" fill="#10b981" opacity="0.75" />

        {/* Splatter Droplets */}
        <circle cx="50" cy="60" r="7" fill="#06b6d4" opacity="0.85" />
        <circle cx="20" cy="110" r="5.5" fill="#facc15" opacity="0.9" />
        <circle cx="10" cy="160" r="6" fill="#ec4899" opacity="0.85" />
        <circle cx="45" cy="210" r="7.5" fill="#10b981" opacity="0.85" />
        <circle cx="130" cy="30" r="4.5" fill="#8b5cf6" opacity="0.8" />
        <circle cx="95" cy="45" r="3.5" fill="#06b6d4" opacity="0.85" />

        {/* Decorative Golden Pichkari Silhouette */}
        <g transform="translate(240, 210) rotate(-35)">
          <rect x="-6" y="-70" width="12" height="70" rx="4" fill="#fbbf24" stroke="#b45309" strokeWidth="1" />
          <rect x="-6" y="-60" width="12" height="14" fill="#ef4444" />
          <rect x="-6" y="-35" width="12" height="14" fill="#06b6d4" />
          <circle cx="0" cy="-80" r="7" fill="#f59e0b" />
          <polygon points="-5,0 5,0 2,14 -2,14" fill="#d97706" />
        </g>
      </g>

      {/* ── DRIFTING COLOR PARTICLES & MARIGOLD PETALS ALONG FOOTER ── */}
      {[
        { cx: 380, cy: 60, r: 4, fill: "#f43f5e" },
        { cx: 460, cy: 220, r: 5, fill: "#facc15" },
        { cx: 540, cy: 80, r: 3.5, fill: "#06b6d4" },
        { cx: 620, cy: 240, r: 4.5, fill: "#a855f7" },
        { cx: 720, cy: 50, r: 5, fill: "#f59e0b" },
        { cx: 810, cy: 230, r: 4, fill: "#ec4899" },
        { cx: 900, cy: 70, r: 5.5, fill: "#10b981" },
        { cx: 980, cy: 210, r: 3.5, fill: "#facc15" },
        { cx: 1060, cy: 80, r: 4.5, fill: "#06b6d4" },
      ].map((dot, idx) => (
        <circle key={idx} cx={dot.cx} cy={dot.cy} r={dot.r} fill={dot.fill} opacity={isDark ? 0.75 : 0.6} />
      ))}

      {/* Marigold Petals floating */}
      {[
        { cx: 420, cy: 150, rot: 25 },
        { cx: 680, cy: 190, rot: -40 },
        { cx: 780, cy: 90, rot: 60 },
        { cx: 1020, cy: 160, rot: -15 },
      ].map((petal, idx) => (
        <path
          key={`pet-${idx}`}
          d="M 0 -8 C 5 -4 5 4 0 8 C -5 4 -5 -4 0 -8 Z"
          fill="#f59e0b"
          opacity={isDark ? 0.7 : 0.55}
          transform={`translate(${petal.cx}, ${petal.cy}) rotate(${petal.rot}) scale(1.2)`}
        />
      ))}
    </svg>
  );
};

// ======================================================================
// 🪔 2. DIWALI FESTIVAL GRAPHICS (World-Class Vector Suite)
// ======================================================================

/**
 * Diwali Hero Banner Illustration:
 * - Magnificent, pure SVG Royal Temple Diya with 3D volumetric metallic warmth.
 * - Deep filigree oil bowl with pearl-beaded rim, twisted cotton wick, and hyper-realistic 4-tier luminous flame.
 * - Sacred blooming lotus petal base and floating golden sparkler embers.
 * - 100% pure vector, zero external dependencies, sharp at all resolutions.
 */
export const DiwaliHeroScene: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 600 500" preserveAspectRatio="xMidYMid meet" style={style} {...props}>
      <defs>
        {/* Rich Volumetric Terracotta / Brass Gradient */}
        <linearGradient id={`d-bowl-grad-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="25%" stopColor="#d97706" />
          <stop offset="60%" stopColor="#b45309" />
          <stop offset="85%" stopColor="#78350f" />
          <stop offset="100%" stopColor="#451a03" />
        </linearGradient>

        {/* Polished Gold Filigree Rim */}
        <linearGradient id={`d-gold-rim-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ca8a04" />
          <stop offset="25%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="75%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#854d0e" />
        </linearGradient>

        {/* Luminous Warm Light Glow */}
        <filter id={`d-flame-glow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <radialGradient id={`d-aura-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef08a" stopOpacity="0.4" />
          <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.2" />
          <stop offset="75%" stopColor="#ea580c" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 1. BACKGROUND: Soft Warm Light Aura behind the Flame */}
      <circle cx="300" cy="190" r="150" fill={`url(#d-aura-${id})`} />

      {/* 2. BASE: Sacred Blooming Lotus Foundation */}
      <g transform="translate(300, 395)">
        {/* Lotus Ground Shadow */}
        <ellipse cx="0" cy="22" rx="140" ry="14" fill="rgba(0,0,0,0.12)" />
        {/* Crimson Outer Petals */}
        <path d="M -130 0 C -90 35 90 35 130 0 C 80 48 -80 48 -130 0 Z" fill="#991b1b" />
        <path d="M -105 -5 C -65 28 65 28 105 -5 C 60 38 -60 38 -105 -5 Z" fill="#dc2626" />
        {/* Golden Inner Lotus Trim */}
        <path d="M -75 -8 C -45 20 45 20 75 -8 C 40 26 -40 26 -75 -8 Z" fill="#f59e0b" />
      </g>

      {/* 3. FLUTED PEDESTAL & MAIN DIYA BOWL */}
      <g>
        {/* Sculpted Fluted Pedestal Base */}
        <ellipse cx="300" cy="385" rx="65" ry="16" fill={`url(#d-bowl-grad-${id})`} />
        <path d="M 268 385 L 284 345 L 316 345 L 332 385 Z" fill={`url(#d-bowl-grad-${id})`} />
        <ellipse cx="300" cy="345" rx="32" ry="8" fill={`url(#d-gold-rim-${id})`} />

        {/* Main Volumetric Diya Body */}
        <path
          d="M 165 295 C 165 385 435 385 435 295 C 375 332 225 332 165 295 Z"
          fill={`url(#d-bowl-grad-${id})`}
        />

        {/* Decorative Scalloped Petal Engravings on the Diya Belly */}
        <path
          d="M 205 320 Q 300 372 395 320 Q 300 388 205 320 Z"
          fill="#dc2626"
          opacity="0.9"
        />
        <path
          d="M 235 330 Q 300 370 365 330 Q 300 380 235 330 Z"
          fill="#facc15"
          opacity="0.95"
        />

        {/* Golden Upper Rim */}
        <ellipse cx="300" cy="295" rx="135" ry="26" fill={`url(#d-gold-rim-${id})`} />

        {/* Beaded Pearl Ring along Rim */}
        {[...Array(15)].map((_, i) => {
          const angle = ((i + 1) / 16) * Math.PI;
          const bx = 300 - Math.cos(angle) * 128;
          const by = 295 + Math.sin(angle) * 22;
          return <circle key={i} cx={bx} cy={by} r="3" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.8" />;
        })}

        {/* Deep Oil Reservoir */}
        <ellipse cx="300" cy="297" rx="122" ry="20" fill="#78350f" />
        <ellipse cx="300" cy="299" rx="112" ry="15" fill="#451a03" />

        {/* Specular Oil Highlight Curve */}
        <path d="M 215 306 Q 300 322 385 306" fill="none" stroke="#ffffff" strokeWidth="2.5" opacity="0.6" />
      </g>

      {/* 4. COTTON WICK (*BAATI*) & RADIANT 4-TIER SACRED FLAME */}
      <g>
        {/* Cotton Wick with Glowing Ember Tip */}
        <path d="M 300 300 Q 288 265 300 245" fill="none" stroke="#262626" strokeWidth="5.5" strokeLinecap="round" />
        <circle cx="300" cy="245" r="4.5" fill="#f97316" />

        {/* Layer 1: Outer Fiery Orange/Red Flame */}
        <g filter={`url(#d-flame-glow-${id})`}>
          <path
            d="M 300 248 C 250 195 300 100 300 70 C 300 100 350 195 300 248 Z"
            fill="#ea580c"
          />
          {/* Layer 2: Radiant Golden Saffron Flame */}
          <path
            d="M 300 244 C 265 198 300 120 300 95 C 300 120 335 198 300 244 Z"
            fill="#facc15"
          />
          {/* Layer 3: Warm Luminous Lemon Flame */}
          <path
            d="M 300 240 C 278 202 300 148 300 128 C 300 148 322 202 300 240 Z"
            fill="#fef08a"
          />
          {/* Layer 4: White Hot Divine Flame Core */}
          <path
            d="M 300 236 C 288 210 300 170 300 155 C 300 170 312 210 300 236 Z"
            fill="#ffffff"
          />
        </g>
      </g>

      {/* 5. FLOATING GOLDEN SPARKS & FESTIVE STARBURSTS */}
      <g filter={`url(#d-flame-glow-${id})`}>
        <circle cx="255" cy="165" r="3.5" fill="#fef08a" />
        <circle cx="345" cy="150" r="3.5" fill="#fef08a" />
        <circle cx="230" cy="105" r="2.8" fill="#fde047" />
        <circle cx="365" cy="95" r="3" fill="#fef08a" />
        <circle cx="300" cy="45" r="3.2" fill="#ffffff" />
        <circle cx="275" cy="75" r="2.2" fill="#fde047" />
        <circle cx="325" cy="65" r="2.5" fill="#fef08a" />

        {/* Left Mini Sparkler Star */}
        <g transform="translate(195, 185) scale(0.7)">
          <line x1="-12" y1="0" x2="12" y2="0" stroke="#fef08a" strokeWidth="2.2" />
          <line x1="0" y1="-12" x2="0" y2="12" stroke="#fef08a" strokeWidth="2.2" />
          <line x1="-8" y1="-8" x2="8" y2="8" stroke="#fde047" strokeWidth="1.8" />
          <line x1="-8" y1="8" x2="8" y2="-8" stroke="#fde047" strokeWidth="1.8" />
          <circle cx="0" cy="0" r="3" fill="#ffffff" />
        </g>

        {/* Right Mini Sparkler Star */}
        <g transform="translate(405, 175) scale(0.7)">
          <line x1="-12" y1="0" x2="12" y2="0" stroke="#fef08a" strokeWidth="2.2" />
          <line x1="0" y1="-12" x2="0" y2="12" stroke="#fef08a" strokeWidth="2.2" />
          <line x1="-8" y1="-8" x2="8" y2="8" stroke="#fde047" strokeWidth="1.8" />
          <line x1="-8" y1="8" x2="8" y2="-8" stroke="#fde047" strokeWidth="1.8" />
          <circle cx="0" cy="0" r="3" fill="#ffffff" />
        </g>
      </g>
    </svg>
  );
};

export const DiwaliNavbarCluster: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 240 60" preserveAspectRatio="xMidYMid meet" style={style} {...props}>
      <defs>
        <filter id={`d-nav-glow-${id}`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`d-nav-gold-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>
      </defs>

      <path d="M 10 0 Q 70 30 130 0 Q 180 30 230 0" fill="none" stroke="#d97706" strokeWidth="1.5" />
      {[40, 70, 100, 160, 190].map((cx, idx) => (
        <g key={idx} transform={`translate(${cx}, ${idx % 2 === 0 ? 12 : 16})`}>
          <line x1="0" y1="-8" x2="0" y2="0" stroke="#ca8a04" strokeWidth="1" />
          <circle cx="0" cy="3" r="3.5" fill="#fef08a" filter={`url(#d-nav-glow-${id})`} />
          <circle cx="0" cy="1.5" fill="#ffffff" />
        </g>
      ))}

      <g transform="translate(205, 34)" filter={`url(#d-nav-glow-${id})`}>
        <path d="M -18 2 C -18 14 18 14 18 2 Z" fill={`url(#d-nav-gold-${id})`} />
        <ellipse cx="0" cy="2" rx="18" ry="4" fill="#78350f" />
        <path d="M 0 -2 C -5 -8 0 -20 0 -24 C 0 -20 5 -8 0 -2 Z" fill="#f59e0b" />
        <path d="M 0 -4 C -2 -8 0 -14 0 -17 C 0 -14 2 -8 0 -4 Z" fill="#ffffff" />
      </g>
    </svg>
  );
};

export const DiwaliDividerWave: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 1200 30" preserveAspectRatio="none" style={style} {...props}>
      <path
        d="M 0 12 Q 150 24 300 12 Q 450 24 600 12 Q 750 24 900 12 Q 1050 24 1200 12"
        fill="none"
        stroke="#ea580c"
        strokeWidth="2.5"
      />
      <path
        d="M 0 16 Q 150 26 300 16 Q 450 26 600 16 Q 750 26 900 16 Q 1050 26 1200 16"
        fill="none"
        stroke="#facc15"
        strokeWidth="1.8"
        strokeDasharray="6, 5"
      />
    </svg>
  );
};

export const DiwaliFooterScene: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 1440 280" preserveAspectRatio="xMidYMid slice" style={style} {...props}>
      <defs>
        <radialGradient id={`d-foot-amber-l-${id}`} cx="12%" cy="75%" r="55%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity={isDark ? 0.4 : 0.2} />
          <stop offset="50%" stopColor="#d97706" stopOpacity={isDark ? 0.18 : 0.08} />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`d-foot-amber-r-${id}`} cx="88%" cy="75%" r="55%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity={isDark ? 0.4 : 0.2} />
          <stop offset="50%" stopColor="#d97706" stopOpacity={isDark ? 0.18 : 0.08} />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`d-diya-flame-${id}`} cx="50%" cy="80%" r="80%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#fef08a" />
          <stop offset="60%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0.8" />
        </radialGradient>
        <filter id={`d-foot-glow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`d-gold-brass-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="40%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
      </defs>

      {/* Ambient Warm Golden Washes */}
      <rect x="0" y="0" width="1440" height="280" fill={`url(#d-foot-amber-l-${id})`} />
      <rect x="0" y="0" width="1440" height="280" fill={`url(#d-foot-amber-r-${id})`} />

      {/* ── TOP BORDER: Hanging Golden Bells & Marigold Garland Toran ── */}
      <g stroke="#f59e0b" strokeWidth="1.5" opacity={isDark ? 0.65 : 0.45} fill="none">
        <path d="M 0 15 Q 120 40 240 15 Q 360 40 480 15 Q 600 40 720 15 Q 840 40 960 15 Q 1080 40 1200 15 Q 1320 40 1440 15" />
      </g>
      {[120, 360, 600, 840, 1080, 1320].map((cx, idx) => (
        <g key={`toran-bell-${idx}`} transform={`translate(${cx}, 28)`}>
          <line x1="0" y1="0" x2="0" y2="18" stroke="#f59e0b" strokeWidth="1.2" />
          {/* Marigold flower bud */}
          <circle cx="0" cy="18" r="6" fill="#f59e0b" />
          <circle cx="0" cy="18" r="3.5" fill="#ea580c" />
          {/* Hanging Bell */}
          <path d="M -5 28 C -5 22 5 22 5 28 L 7 36 L -7 36 Z" fill={`url(#d-gold-brass-${id})`} />
          <circle cx="0" cy="38" r="2" fill="#fbbf24" />
        </g>
      ))}

      {/* ── LEFT CORNER: Grand Glowing Traditional Diya on Lotus Rangoli ── */}
      <g transform="translate(130, 205)">
        {/* Lotus Rangoli Base Petals */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => (
          <path
            key={`l-petal-${i}`}
            d="M 0 0 C 14 -18 24 -40 0 -55 C -24 -40 -14 -18 0 0 Z"
            fill={i % 2 === 0 ? "#ea580c" : "#facc15"}
            opacity={isDark ? 0.75 : 0.6}
            transform={`rotate(${angle}) scale(0.85)`}
          />
        ))}
        <circle cx="0" cy="0" r="28" fill="#991b1b" opacity="0.8" />
        <circle cx="0" cy="0" r="20" fill="#f59e0b" opacity="0.9" />

        {/* Diya Clay/Brass Bowl */}
        <ellipse cx="0" cy="-6" rx="42" ry="16" fill={`url(#d-gold-brass-${id})`} />
        <ellipse cx="0" cy="-10" rx="34" ry="11" fill="#78350f" />
        <ellipse cx="0" cy="-11" rx="30" ry="8" fill="#d97706" />

        {/* 3D Radiant Diya Flame */}
        <g filter={`url(#d-foot-glow-${id})`} transform="translate(0, -18)">
          <path d="M 0 -38 C 14 -22 14 -4 0 0 C -14 -4 -14 -22 0 -38 Z" fill={`url(#d-diya-flame-${id})`} />
          <circle cx="0" cy="-12" r="5" fill="#ffffff" />
        </g>

        {/* Sparkler Embers Rising */}
        <circle cx="-18" cy="-45" r="2.5" fill="#fef08a" opacity="0.9" filter={`url(#d-foot-glow-${id})`} />
        <circle cx="15" cy="-55" r="3" fill="#fef08a" opacity="0.9" filter={`url(#d-foot-glow-${id})`} />
        <circle cx="2" cy="-68" r="2" fill="#ffffff" opacity="0.95" />
      </g>

      {/* ── RIGHT CORNER: Secondary Diya with Marigold Genda Phool Garland ── */}
      <g transform="translate(1310, 205)">
        {/* Rangoli Base */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
          <path
            key={`r-petal-${i}`}
            d="M 0 0 C 12 -16 20 -36 0 -48 C -20 -36 -12 -16 0 0 Z"
            fill={i % 2 === 0 ? "#facc15" : "#dc2626"}
            opacity={isDark ? 0.75 : 0.6}
            transform={`rotate(${angle}) scale(0.85)`}
          />
        ))}
        <circle cx="0" cy="0" r="22" fill="#991b1b" opacity="0.8" />

        {/* Diya Bowl */}
        <ellipse cx="0" cy="-6" rx="38" ry="14" fill={`url(#d-gold-brass-${id})`} />
        <ellipse cx="0" cy="-9" rx="30" ry="9" fill="#78350f" />
        <ellipse cx="0" cy="-10" rx="26" ry="7" fill="#d97706" />

        {/* Flame */}
        <g filter={`url(#d-foot-glow-${id})`} transform="translate(0, -16)">
          <path d="M 0 -34 C 12 -20 12 -4 0 0 C -12 -4 -12 -20 0 -34 Z" fill={`url(#d-diya-flame-${id})`} />
          <circle cx="0" cy="-10" r="4.5" fill="#ffffff" />
        </g>

        {/* Sparkler Embers Rising */}
        <circle cx="-14" cy="-42" r="2.5" fill="#fef08a" opacity="0.9" filter={`url(#d-foot-glow-${id})`} />
        <circle cx="16" cy="-52" r="2" fill="#ffffff" opacity="0.95" />
      </g>

      {/* ── SACRED RANGOLI MANDALA BORDER PATTERNS ALONG BOTTOM ── */}
      <g fill="none" stroke="#f59e0b" strokeWidth="1.2" opacity={isDark ? 0.35 : 0.22}>
        <path d="M 280 270 Q 340 230 400 270 Q 460 230 520 270 Q 580 230 640 270 Q 700 230 760 270 Q 820 230 880 270 Q 940 230 1000 270 Q 1060 230 1120 270" />
      </g>

      {/* Floating Glowing Sparkle Embers */}
      {[
        { cx: 320, cy: 110, r: 3 },
        { cx: 440, cy: 190, r: 2 },
        { cx: 580, cy: 90, r: 3.5 },
        { cx: 720, cy: 170, r: 2.5 },
        { cx: 860, cy: 100, r: 3 },
        { cx: 980, cy: 200, r: 2 },
        { cx: 1120, cy: 80, r: 3.5 },
        { cx: 1220, cy: 150, r: 2.5 },
      ].map((star, idx) => (
        <g key={`sparkle-${idx}`} transform={`translate(${star.cx}, ${star.cy})`}>
          <circle cx="0" cy="0" r={star.r * 2} fill="#f59e0b" opacity={isDark ? 0.3 : 0.15} filter={`url(#d-foot-glow-${id})`} />
          <path d={`M 0 -${star.r * 2.5} L 0 ${star.r * 2.5} M -${star.r * 2.5} 0 L ${star.r * 2.5} 0`} stroke="#fef08a" strokeWidth="1" opacity="0.8" />
          <circle cx="0" cy="0" r={star.r * 0.7} fill="#ffffff" />
        </g>
      ))}
    </svg>
  );
};

// ======================================================================
// 🔱 3. DURGA PUJA / NAVRATRI GRAPHICS (World-Class Vector Suite)
// ======================================================================

/**
 * Durga Puja Hero Banner Illustration:
 * - Single iconic, clean, culturally authentic Durga Maa face vector artwork.
 * - Golden flaming Trishul at top, sacred red teardrop & crescent tilak, bindi,
 *   sweeping arched calligraphic eyebrows, winged almond kajal eyes,
 *   nose contour with circular Nath & 3 red beads, and traditional red Bengali lips.
 * - Clean, spacious, unclipped, with soft ambient divine aura.
 */
export const DurgaHeroScene: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 500 500" preserveAspectRatio="xMidYMid meet" style={style} {...props}>
      <defs>
        {/* Golden Flame Gradient for Trishul */}
        <linearGradient id={`dp-flame-gold-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="35%" stopColor="#facc15" />
          <stop offset="70%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
      </defs>

      {/* 1. TOP GOLDEN TRISHUL (TRIDENT FLAME) */}
      <g transform="translate(250, 68)">
        {/* Center Spear Blade */}
        <path
          d="M 0 -48 C -2 -30, -5 -15, 0 0 C 5 -15, 2 -30, 0 -48 Z"
          fill={`url(#dp-flame-gold-${id})`}
        />
        {/* Left Inward Hook Horn */}
        <path
          d="M 0 0 C -12 -3, -22 -15, -20 -32 C -17 -42, -9 -45, -9 -44 C -9 -42, -15 -36, -14 -24 C -13 -12, -6 -6, 0 0 Z"
          fill="#e11d48"
        />
        {/* Right Inward Hook Horn */}
        <path
          d="M 0 0 C 12 -3, 22 -15, 20 -32 C 17 -42, 9 -45, 9 -44 C 9 -42, 15 -36, 14 -24 C 13 -12, 6 -6, 0 0 Z"
          fill="#e11d48"
        />
      </g>

      {/* 2. SACRED RED TILAK, TEARDROP & BLACK CRESCENT */}
      {/* Central Red Vertical Line Passing Through Face */}
      <line x1="250" y1="68" x2="250" y2="330" stroke="#e11d48" strokeWidth="3.5" strokeLinecap="round" />

      {/* Slender Red Teardrop Loop */}
      <path
        d="M 250 95 C 230 135, 230 175, 250 198 C 270 175, 270 135, 250 95 Z"
        fill="none"
        stroke="#e11d48"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* Red Disc Inside Teardrop */}
      <circle cx="250" cy="162" r="9.5" fill="#e11d48" />

      {/* Black Crescent Cradle Supporting the Teardrop */}
      <path
        d="M 224 168 C 232 210, 268 210, 276 168 C 267 196, 233 196, 224 168 Z"
        fill="#0f172a"
      />

      {/* Central Forehead Red Kumkum Bindi */}
      <circle cx="250" cy="245" r="11" fill="#e11d48" />

      {/* Yellow/Gold Accent Dot on Nose Bridge & Red Dot at Tip */}
      <circle cx="250" cy="268" r="2.8" fill="#f59e0b" />
      <circle cx="250" cy="330" r="5.5" fill="#e11d48" />

      {/* 3. HIGH SOARING BENGALI EYEBROWS */}
      {/* Left Eyebrow */}
      <path
        d="M 234 235 C 185 180, 115 182, 55 208 C 110 192, 180 200, 234 235 Z"
        fill="#0f172a"
      />
      {/* Right Eyebrow */}
      <path
        d="M 266 235 C 315 180, 385 182, 445 208 C 390 192, 320 200, 266 235 Z"
        fill="#0f172a"
      />

      {/* 4. REFINED BENGALI ALMOND KAJAL EYES */}
      {/* Left Eye */}
      <g>
        {/* Upper Lash Line with Fierce Soaring Wing */}
        <path
          d="M 215 278 C 160 235, 110 235, 80 266 C 105 244, 155 244, 215 278 Z"
          fill="#0f172a"
        />
        {/* Lower Lash Line */}
        <path
          d="M 212 280 C 165 315, 120 315, 88 284 C 118 302, 160 302, 212 280 Z"
          fill="#0f172a"
        />
        {/* Iris/Pupil nested under upper lid with White Catchlight Crescent */}
        <circle cx="160" cy="272" r="16.5" fill="#0f172a" />
        <circle cx="167" cy="268" r="5" fill="#ffffff" />
      </g>

      {/* Right Eye */}
      <g>
        {/* Upper Lash Line with Fierce Soaring Wing */}
        <path
          d="M 285 278 C 340 235, 390 235, 420 266 C 395 244, 345 244, 285 278 Z"
          fill="#0f172a"
        />
        {/* Lower Lash Line */}
        <path
          d="M 288 280 C 335 315, 380 315, 412 284 C 382 302, 340 302, 288 280 Z"
          fill="#0f172a"
        />
        {/* Iris/Pupil nested under upper lid with White Catchlight Crescent */}
        <circle cx="340" cy="272" r="16.5" fill="#0f172a" />
        <circle cx="347" cy="268" r="5" fill="#ffffff" />
      </g>

      {/* 5. CONTINUOUS REFINED NOSE CONTOUR & NATH (NOSE RING) */}
      {/* Graceful Nose Outline */}
      <path
        d="M 220 335 C 218 350, 235 365, 246 362 C 248 362, 250 367, 252 367 C 255 367, 258 360, 268 355 C 278 350, 284 340, 282 335"
        fill="none"
        stroke="#0f172a"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Traditional Large Circular Nath (Nose Ring) */}
      {/* Originates naturally inside the right nostril curve */}
      <circle cx="304" cy="374" r="34" fill="none" stroke="#0f172a" strokeWidth="3" />
      {/* 3 Stacked Traditional Red Beads on the Outer Rim */}
      <circle cx="335" cy="358" r="8" fill="#e11d48" />
      <circle cx="340" cy="376" r="9" fill="#e11d48" />
      <circle cx="334" cy="394" r="8" fill="#e11d48" />

      {/* 6. DRAMATIC TRADITIONAL RED BENGALI LIPS */}
      {/* Upper Lip with Accentuated Cupid's Bow & Smiling Wings */}
      <path
        d="M 194 388 C 220 395, 236 376, 250 392 C 264 376, 280 395, 306 388 C 288 410, 266 405, 250 412 C 234 405, 212 410, 194 388 Z"
        fill="#e11d48"
      />
      {/* Full Voluptuous Lower Lip */}
      <path
        d="M 218 406 C 218 440, 282 440, 282 406 Z"
        fill="#e11d48"
      />
    </svg>
  );
};

export const DurgaNavbarCluster: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 240 60" preserveAspectRatio="xMidYMid meet" style={style} {...props}>
      <defs>
        <filter id={`dp-nav-glow-${id}`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`dp-nav-gold-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>
      </defs>

      <circle cx="30" cy="30" r="8" fill="#f59e0b" opacity="0.8" />
      <circle cx="50" cy="30" r="10" fill="#dc2626" opacity="0.85" />
      <circle cx="72" cy="30" r="8" fill="#f59e0b" opacity="0.8" />

      {/* Mini Trishul & Lotus Petals */}
      <g transform="translate(180, 30)" filter={`url(#dp-nav-glow-${id})`}>
        <path d="M -25 15 C -30 0 0 -10 0 -10 C 0 -10 30 0 25 15 Z" fill="#ec4899" />
        <line x1="0" y1="-22" x2="0" y2="18" stroke={`url(#dp-nav-gold-${id})`} strokeWidth="3" strokeLinecap="round" />
        <path d="M -16 -6 C -16 12 0 14 0 14 C 0 14 16 12 16 -6" fill="none" stroke={`url(#dp-nav-gold-${id})`} strokeWidth="2.5" />
        <polygon points="0,-25 4,-8 -4,-8" fill={`url(#dp-nav-gold-${id})`} />
        <circle cx="0" cy="2" r="3" fill="#dc2626" />
      </g>
    </svg>
  );
};

export const DurgaDividerWave: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 1200 30" preserveAspectRatio="none" style={style} {...props}>
      <defs>
        <linearGradient id={`dp-div-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#dc2626" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#eab308" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      <path
        d="M 0 15 Q 200 25 400 15 Q 600 25 800 15 Q 1000 25 1200 15"
        fill="none"
        stroke={`url(#dp-div-grad-${id})`}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const DurgaFooterScene: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 1440 280" preserveAspectRatio="xMidYMid slice" style={style} {...props}>
      <defs>
        <radialGradient id={`dp-foot-crimson-l-${id}`} cx="12%" cy="70%" r="60%">
          <stop offset="0%" stopColor="#dc2626" stopOpacity={isDark ? 0.4 : 0.22} />
          <stop offset="50%" stopColor="#991b1b" stopOpacity={isDark ? 0.2 : 0.1} />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`dp-foot-gold-r-${id}`} cx="88%" cy="70%" r="60%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity={isDark ? 0.4 : 0.2} />
          <stop offset="50%" stopColor="#b45309" stopOpacity={isDark ? 0.18 : 0.08} />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <filter id={`dp-foot-glow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`dp-gold-metal-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="35%" stopColor="#facc15" />
          <stop offset="70%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#854d0e" />
        </linearGradient>
      </defs>

      {/* Ambient Crimson & Golden Glows */}
      <rect x="0" y="0" width="1440" height="280" fill={`url(#dp-foot-crimson-l-${id})`} />
      <rect x="0" y="0" width="1440" height="280" fill={`url(#dp-foot-gold-r-${id})`} />

      {/* ── KASH PHOOL (Autumn White Grass Plumes) Swaying Across Background ── */}
      <g stroke={isDark ? "#ffffff" : "#cbd5e1"} strokeWidth="1.2" opacity={isDark ? 0.3 : 0.2} fill="none">
        {[80, 220, 360, 520, 720, 920, 1100, 1260, 1380].map((x, idx) => (
          <g key={`kash-${idx}`} transform={`translate(${x}, 280)`}>
            <path d={`M 0 0 Q ${idx % 2 === 0 ? 25 : -25} -60 ${idx % 2 === 0 ? 40 : -40} -130`} />
            {/* Feathery plume tips */}
            <path d={`M ${idx % 2 === 0 ? 30 : -30} -100 Q ${idx % 2 === 0 ? 45 : -45} -115 ${idx % 2 === 0 ? 55 : -55} -135`} strokeWidth="0.8" />
            <path d={`M ${idx % 2 === 0 ? 25 : -25} -90 Q ${idx % 2 === 0 ? 40 : -40} -105 ${idx % 2 === 0 ? 50 : -50} -120`} strokeWidth="0.8" />
          </g>
        ))}
      </g>

      {/* ── LEFT CORNER: Majestic Traditional Dhak Drum with Chomor Feathers ── */}
      <g transform="translate(140, 175)">
        {/* Traditional Dhak (Wood & Parchment Drum) */}
        {/* Chomor / Kash white feathers crest on top */}
        <g stroke="#ffffff" strokeWidth="1.5" opacity="0.85">
          <path d="M -15 -60 Q -30 -100 -55 -125" fill="none" />
          <path d="M 0 -65 Q 0 -110 -10 -135" fill="none" />
          <path d="M 15 -60 Q 30 -100 50 -125" fill="none" />
        </g>
        {/* Red decorative cloth wrap on Dhak */}
        <ellipse cx="0" cy="0" rx="44" ry="52" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="2" />
        <ellipse cx="0" cy="0" rx="38" ry="46" fill="#dc2626" />
        {/* Golden ropes / straps */}
        <path d="M -30 -35 L 30 35 M 30 -35 L -30 35" stroke={`url(#dp-gold-metal-${id})`} strokeWidth="2" />
        <path d="M 0 -45 L 0 45 M -40 0 L 40 0" stroke={`url(#dp-gold-metal-${id})`} strokeWidth="1.5" />
        {/* Drum heads */}
        <ellipse cx="0" cy="-45" rx="36" ry="12" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
        <ellipse cx="0" cy="45" rx="36" ry="12" fill="#ca8a04" />
        {/* Dhak drumsticks */}
        <line x1="-35" y1="-30" x2="-65" y2="-75" stroke="#fef08a" strokeWidth="3" strokeLinecap="round" />
        <line x1="35" y1="-30" x2="65" y2="-75" stroke="#fef08a" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* ── RIGHT CORNER: Sacred Dhunachi (Incense Burner) with Fragrant Smoke Swirls & Shankha ── */}
      <g transform="translate(1300, 185)">
        {/* Fragrant Aromatic Smoke Swirls */}
        <g stroke="#fef08a" strokeWidth="1.8" fill="none" opacity={isDark ? 0.6 : 0.4} filter={`url(#dp-foot-glow-${id})`}>
          <path d="M 0 -50 C -20 -80 15 -110 -10 -145 C -30 -170 10 -195 0 -220" />
          <path d="M 12 -50 C 30 -75 0 -105 25 -135 C 40 -160 15 -185 30 -210" strokeWidth="1.2" />
        </g>

        {/* Brass Dhunachi Clay Pot */}
        {/* Glowing Ember in pot */}
        <ellipse cx="0" cy="-40" rx="32" ry="12" fill="#ea580c" />
        <ellipse cx="0" cy="-42" rx="26" ry="8" fill="#fef08a" filter={`url(#dp-foot-glow-${id})`} />
        {/* Dhunachi Bowl */}
        <path d="M -35 -40 Q 0 -10 35 -40 L 22 10 Q 0 18 -22 10 Z" fill={`url(#dp-gold-metal-${id})`} />
        {/* Dhunachi Handle Stem */}
        <path d="M -10 12 L -6 45 L 6 45 L 10 12 Z" fill="#b45309" />
        <ellipse cx="0" cy="45" rx="20" ry="7" fill={`url(#dp-gold-metal-${id})`} />

        {/* Sacred Shankha (Conch Shell) beside Dhunachi */}
        <g transform="translate(-65, 15) rotate(-20) scale(0.7)">
          <path d="M 0 -20 C 25 -15 35 15 15 35 C 0 45 -20 30 -25 10 C -30 -10 -15 -25 0 -20 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
          <path d="M 0 -20 C 10 -10 15 10 5 25" stroke="#f59e0b" strokeWidth="1" fill="none" />
          <circle cx="5" cy="28" r="3" fill="#f59e0b" />
        </g>
      </g>

      {/* ── SACRED TRISHUL & CIRCULAR ALPONA MOTIFS ALONG BORDER ── */}
      {[420, 600, 780, 960, 1140].map((cx, idx) => (
        <g key={`alpona-circ-${idx}`} transform={`translate(${cx}, 245)`} opacity={isDark ? 0.35 : 0.22}>
          <circle cx="0" cy="0" r="18" fill="none" stroke="#f59e0b" strokeWidth="1.2" />
          <circle cx="0" cy="0" r="10" fill="none" stroke="#dc2626" strokeWidth="1" strokeDasharray="3, 2" />
          <circle cx="0" cy="0" r="3.5" fill="#fef08a" />
        </g>
      ))}

      {/* Auspicious Red & Gold Sparkles */}
      {[
        { cx: 280, cy: 90, r: 3 },
        { cx: 480, cy: 150, r: 2.5 },
        { cx: 680, cy: 80, r: 3 },
        { cx: 880, cy: 160, r: 2.5 },
        { cx: 1040, cy: 100, r: 3 },
      ].map((sp, idx) => (
        <circle key={`sp-durga-${idx}`} cx={sp.cx} cy={sp.cy} r={sp.r} fill="#fef08a" opacity="0.8" filter={`url(#dp-foot-glow-${id})`} />
      ))}
    </svg>
  );
};

// ======================================================================
// 🎄 4. CHRISTMAS FESTIVAL GRAPHICS (World-Class Vector Suite)
// ======================================================================

/**
 * Christmas Hero Banner Illustration:
 * - Lush evergreen Christmas tree with volumetric pine layers, frosted snow tips, and shiny glass baubles with specular catchlights.
 * - Multi-tiered wrapping micro-fairy light strands with golden star topper.
 * - Base: 2 luxury wrapped satin gift boxes and candy cane with clean ground integration.
 */
export const ChristmasHeroScene: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 700 480" preserveAspectRatio="xMidYMid meet" style={style} {...props}>
      <defs>
        <filter id={`c-shadow-${id}`} x="-30%" y="-10%" width="160%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000000" floodOpacity={isDark ? 0.18 : 0.06} />
        </filter>
        <filter id={`c-glow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <linearGradient id={`c-tree-tier-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#16a34a" />
          <stop offset="45%" stopColor="#15803d" />
          <stop offset="80%" stopColor="#166534" />
          <stop offset="100%" stopColor="#14532d" />
        </linearGradient>
        <radialGradient id={`c-bauble-red-${id}`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fca5a5" />
          <stop offset="35%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </radialGradient>
        <radialGradient id={`c-bauble-gold-${id}`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="35%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#854d0e" />
        </radialGradient>
        <radialGradient id={`c-bauble-blue-${id}`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="35%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </radialGradient>
      </defs>

      {/* 1. BACKGROUND: Floating Winter Snowflakes */}
      <g fill={isDark ? "#ffffff" : "#94a3b8"} opacity={isDark ? 0.8 : 0.6}>
        <circle cx="180" cy="80" r="4" />
        <circle cx="240" cy="50" r="5.5" />
        <circle cx="530" cy="70" r="5" />
        <circle cx="580" cy="130" r="3.5" />
      </g>

      {/* 2. MAIN FOCAL CENTERPIECE: Evergreen Christmas Tree */}
      <g transform="translate(370, 45)" filter={`url(#c-shadow-${id})`}>
        {/* Trunk */}
        <rect x="-18" y="275" width="36" height="65" rx="4" fill="#78350f" />

        {/* Tree Tiers */}
        <polygon points="0,170 140,295 -140,295" fill={`url(#c-tree-tier-${id})`} />
        <polygon points="0,110 115,225 -115,225" fill={`url(#c-tree-tier-${id})`} />
        <polygon points="0,55 90,155 -90,155" fill={`url(#c-tree-tier-${id})`} />
        <polygon points="0,0 65,90 -65,90" fill={`url(#c-tree-tier-${id})`} />

        {/* Snow-Frosted Branch Tips */}
        <path d="M -140 295 Q 0 310 140 295" fill="none" stroke="#f0fdf4" strokeWidth="4" opacity="0.85" />
        <path d="M -115 225 Q 0 240 115 225" fill="none" stroke="#f0fdf4" strokeWidth="3.5" opacity="0.85" />
        <path d="M -90 155 Q 0 170 90 155" fill="none" stroke="#f0fdf4" strokeWidth="3" opacity="0.85" />

        {/* Fairy Light Swags */}
        <g filter={`url(#c-glow-${id})`}>
          <circle cx="-25" cy="80" r="4" fill="#facc15" />
          <circle cx="18" cy="88" r="4" fill="#ef4444" />
          <circle cx="-45" cy="145" r="4.5" fill="#38bdf8" />
          <circle cx="10" cy="160" r="4.5" fill="#facc15" />
          <circle cx="50" cy="145" r="4.5" fill="#ef4444" />
          <circle cx="-70" cy="220" r="5" fill="#facc15" />
          <circle cx="-15" cy="235" r="5" fill="#ef4444" />
          <circle cx="40" cy="230" r="5" fill="#38bdf8" />
          <circle cx="75" cy="215" r="5" fill="#facc15" />
        </g>

        {/* Shiny Glass Baubles */}
        <circle cx="-32" cy="115" r="9.5" fill={`url(#c-bauble-red-${id})`} />
        <circle cx="32" cy="120" r="8.5" fill={`url(#c-bauble-gold-${id})`} />
        <circle cx="-60" cy="180" r="10.5" fill={`url(#c-bauble-blue-${id})`} />
        <circle cx="0" cy="195" r="11.5" fill={`url(#c-bauble-red-${id})`} />
        <circle cx="60" cy="185" r="9.5" fill={`url(#c-bauble-gold-${id})`} />
        <circle cx="-85" cy="255" r="11.5" fill={`url(#c-bauble-red-${id})`} />
        <circle cx="-30" cy="265" r="10.5" fill={`url(#c-bauble-gold-${id})`} />
        <circle cx="30" cy="265" r="11.5" fill={`url(#c-bauble-blue-${id})`} />
        <circle cx="85" cy="255" r="10.5" fill={`url(#c-bauble-red-${id})`} />

        {/* 3D Faceted Golden Star Topper */}
        <g transform="translate(0, -5)" filter={`url(#c-glow-${id})`}>
          <polygon
            points="0,-26 7,-8 24,-8 11,4 16,22 0,11 -16,22 -11,4 -24,-8 -7,-8"
            fill="#fef08a"
          />
          <circle cx="0" cy="0" r="5" fill="#ffffff" />
        </g>
      </g>

      {/* 3. BASE SUPPORTING: 2 Luxury Wrapped Gift Boxes — placed close together near tree base */}
      <g transform="translate(280, 325)" filter={`url(#c-shadow-${id})`}>
        <rect x="0" y="20" width="70" height="65" rx="4" fill="#dc2626" />
        <rect x="28" y="20" width="14" height="65" fill="#facc15" />
        <rect x="0" y="46" width="70" height="12" fill="#facc15" />
        <circle cx="30" cy="16" r="7.5" fill="#fde047" />
        <circle cx="40" cy="16" r="7.5" fill="#fde047" />
      </g>

      <g transform="translate(360, 338)" filter={`url(#c-shadow-${id})`}>
        <rect x="0" y="20" width="60" height="55" rx="4" fill="#eab308" />
        <rect x="24" y="20" width="12" height="55" fill="#15803d" />
        <rect x="0" y="42" width="60" height="10" fill="#15803d" />
        <circle cx="26" cy="16" r="6.5" fill="#22c55e" />
        <circle cx="34" cy="16" r="6.5" fill="#22c55e" />
      </g>
    </svg>
  );
};

export const ChristmasNavbarCluster: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 240 60" preserveAspectRatio="xMidYMid meet" style={style} {...props}>
      <path d="M 10 10 Q 70 35 130 10 Q 180 35 230 10" fill="none" stroke="#15803d" strokeWidth="4" strokeLinecap="round" />
      <circle cx="70" cy="26" r="4.5" fill="#dc2626" />
      <circle cx="180" cy="26" r="4.5" fill="#dc2626" />
    </svg>
  );
};

export const ChristmasDividerWave: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 1200 30" preserveAspectRatio="none" style={style} {...props}>
      <path
        d="M 0 12 Q 150 24 300 12 Q 450 24 600 12 Q 750 24 900 12 Q 1050 24 1200 12"
        fill="none"
        stroke="#15803d"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M 0 10 Q 150 22 300 10 Q 450 22 600 10 Q 750 22 900 10 Q 1050 22 1200 10"
        fill="none"
        stroke="#22c55e"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const ChristmasFooterScene: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 1440 280" preserveAspectRatio="xMidYMid slice" style={style} {...props}>
      <defs>
        <radialGradient id={`c-foot-pine-l-${id}`} cx="12%" cy="60%" r="60%">
          <stop offset="0%" stopColor="#15803d" stopOpacity={isDark ? 0.35 : 0.18} />
          <stop offset="60%" stopColor="#1e3a8a" stopOpacity={isDark ? 0.18 : 0.08} />
          <stop offset="100%" stopColor="#15803d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`c-foot-gold-r-${id}`} cx="88%" cy="60%" r="60%">
          <stop offset="0%" stopColor="#dc2626" stopOpacity={isDark ? 0.32 : 0.16} />
          <stop offset="60%" stopColor="#f59e0b" stopOpacity={isDark ? 0.18 : 0.08} />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`c-bauble-red-ft-${id}`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fca5a5" />
          <stop offset="35%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </radialGradient>
        <radialGradient id={`c-bauble-gold-ft-${id}`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="35%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#854d0e" />
        </radialGradient>
        <radialGradient id={`c-bauble-blue-ft-${id}`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="35%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </radialGradient>
        <filter id={`c-foot-glow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ambient Winter Evergreen Washes */}
      <rect x="0" y="0" width="1440" height="280" fill={`url(#c-foot-pine-l-${id})`} />
      <rect x="0" y="0" width="1440" height="280" fill={`url(#c-foot-gold-r-${id})`} />

      {/* ── TOP BORDER: Continuous Pine Garland Swag with Warm Fairy Lights ── */}
      <g fill="none" stroke="#166534" strokeWidth="6" strokeLinecap="round" opacity="0.9">
        <path d="M -20 10 Q 120 40 260 10 Q 400 40 540 10 Q 680 40 820 10 Q 960 40 1100 10 Q 1240 40 1380 10 Q 1460 30 1480 10" />
      </g>
      <g fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" opacity="0.75">
        <path d="M -20 8 Q 120 38 260 8 Q 400 38 540 8 Q 680 38 820 8 Q 960 38 1100 8 Q 1240 38 1380 8 Q 1460 28 1480 8" />
      </g>

      {/* Holly Berry Clusters on Garland */}
      {[120, 260, 400, 540, 680, 820, 960, 1100, 1240, 1380].map((cx, idx) => (
        <g key={`holly-${idx}`} transform={`translate(${cx}, ${idx % 2 === 0 ? 25 : 12})`}>
          {/* Green leaves */}
          <path d="M -6 -4 Q -12 -12 0 -16 Q 12 -12 6 -4 Z" fill="#15803d" />
          <path d="M -10 2 Q -18 6 -14 14 Q -4 12 0 4 Z" fill="#15803d" />
          {/* Red Holly Berries */}
          <circle cx="-3" cy="2" r="3.5" fill="#dc2626" />
          <circle cx="3" cy="2" r="3.5" fill="#dc2626" />
          <circle cx="0" cy="-3" r="3.5" fill="#ef4444" />
          <circle cx="-1" cy="-4" r="1.2" fill="#ffffff" />
        </g>
      ))}

      {/* Fairy Lights Twinkling on Garland */}
      {[60, 180, 320, 460, 600, 740, 880, 1020, 1160, 1300, 1420].map((cx, idx) => {
        const colors = ["#facc15", "#ef4444", "#38bdf8", "#4ade80"];
        const col = colors[idx % colors.length];
        return (
          <circle
            key={`fairy-${idx}`}
            cx={cx}
            cy={idx % 2 === 0 ? 22 : 14}
            r="4.5"
            fill={col}
            filter={`url(#c-foot-glow-${id})`}
          />
        );
      })}

      {/* ── LEFT CORNER: Hanging Shiny Glass Baubles & Pine Branch ── */}
      <g transform="translate(120, 0)">
        {/* Pine needles cluster */}
        <path d="M 0 0 L -40 60 M 0 0 L -20 70 M 0 0 L 20 70 M 0 0 L 40 60" stroke="#15803d" strokeWidth="2.5" />
        
        {/* Red Bauble on Golden String */}
        <line x1="-30" y1="0" x2="-30" y2="90" stroke="#facc15" strokeWidth="1.2" />
        <rect x="-34" y="85" width="8" height="6" fill="#facc15" rx="1" />
        <circle cx="-30" cy="115" r="24" fill={`url(#c-bauble-red-ft-${id})`} />
        <ellipse cx="-38" cy="107" rx="6" ry="3" fill="#ffffff" opacity="0.6" transform="rotate(-30, -38, 107)" />

        {/* Gold Bauble */}
        <line x1="25" y1="0" x2="25" y2="120" stroke="#facc15" strokeWidth="1.2" />
        <rect x="21" y="115" width="8" height="6" fill="#facc15" rx="1" />
        <circle cx="25" cy="142" r="20" fill={`url(#c-bauble-gold-ft-${id})`} />
        <ellipse cx="19" cy="135" rx="5" ry="2.5" fill="#ffffff" opacity="0.65" transform="rotate(-30, 19, 135)" />

        {/* Blue Bauble */}
        <line x1="75" y1="0" x2="75" y2="70" stroke="#facc15" strokeWidth="1.2" />
        <rect x="71" y="65" width="8" height="5" fill="#facc15" rx="1" />
        <circle cx="75" cy="88" r="17" fill={`url(#c-bauble-blue-ft-${id})`} />
      </g>

      {/* ── RIGHT CORNER: Wrapped Gift Box, Candy Cane & Pinecone ── */}
      <g transform="translate(1320, 170)">
        {/* Red & Gold Luxury Gift Box */}
        <rect x="-40" y="0" width="60" height="55" rx="4" fill="#dc2626" stroke="#991b1b" strokeWidth="1.5" />
        <rect x="-16" y="0" width="12" height="55" fill="#facc15" />
        <rect x="-40" y="22" width="60" height="10" fill="#facc15" />
        {/* Golden Satin Bow */}
        <circle cx="-14" cy="-3" r="6.5" fill="#fde047" />
        <circle cx="-6" cy="-3" r="6.5" fill="#fde047" />
        <circle cx="-10" cy="-1" r="3" fill="#ca8a04" />

        {/* Candy Cane Leaning */}
        <g transform="translate(30, 10) rotate(22)">
          <path d="M 0 45 L 0 -15 C 0 -30 18 -30 18 -15 L 18 -5" fill="none" stroke="#f8fafc" strokeWidth="7" strokeLinecap="round" />
          <path d="M 0 45 L 0 -15 C 0 -30 18 -30 18 -15 L 18 -5" fill="none" stroke="#dc2626" strokeWidth="7" strokeDasharray="5, 6" strokeLinecap="round" />
        </g>
      </g>

      {/* ── DELICATE CRYSTAL SNOWFLAKES FLOATING IN AIR ── */}
      {[
        { cx: 280, cy: 110, size: 10 },
        { cx: 450, cy: 180, size: 8 },
        { cx: 620, cy: 100, size: 12 },
        { cx: 780, cy: 190, size: 9 },
        { cx: 940, cy: 120, size: 11 },
        { cx: 1100, cy: 170, size: 8 },
        { cx: 1220, cy: 90, size: 10 },
      ].map((flake, idx) => (
        <g key={`flake-${idx}`} transform={`translate(${flake.cx}, ${flake.cy})`} stroke={isDark ? "#ffffff" : "#93c5fd"} strokeWidth="1.2" opacity={isDark ? 0.75 : 0.55}>
          <line x1={-flake.size} y1="0" x2={flake.size} y2="0" />
          <line x1="0" y1={-flake.size} x2="0" y2={flake.size} />
          <line x1={-flake.size * 0.7} y1={-flake.size * 0.7} x2={flake.size * 0.7} y2={flake.size * 0.7} />
          <line x1={-flake.size * 0.7} y1={flake.size * 0.7} x2={flake.size * 0.7} y2={-flake.size * 0.7} />
          <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
        </g>
      ))}
    </svg>
  );
};

// ======================================================================
// 🧵 5. RAKSHA BANDHAN GRAPHICS (World-Class Vector Suite)
// ======================================================================

/**
 * Raksha Bandhan Hero Banner Illustration:
 * - Luxury Kundan/Meenakari Designer Rakhi with ruby gemstone, seed pearls, and braided resham silk dori threads.
 * - Lower-Left: Silver Puja Thali with kumkum, akshat, kaju katli sweets, and lit mini diya.
 * - Lower-Right: Luxury gift box.
 */
export const RakhiHeroScene: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 700 480" preserveAspectRatio="xMidYMid meet" style={style} {...props}>
      <defs>
        <filter id={`r-shadow-${id}`} x="-30%" y="-10%" width="160%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000000" floodOpacity={isDark ? 0.18 : 0.06} />
        </filter>
        <filter id={`r-glow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <linearGradient id={`r-gold-metal-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="30%" stopColor="#eab308" />
          <stop offset="70%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#713f12" />
        </linearGradient>
        <radialGradient id={`r-ruby-gem-${id}`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </radialGradient>
      </defs>

      {/* 1. SILK DORI THREAD (Braided Kalava) Flowing Naturally */}
      <g filter={`url(#r-shadow-${id})`}>
        <path
          d="M 130 210 Q 250 115 370 185 Q 490 255 610 145"
          fill="none"
          stroke="#dc2626"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M 130 210 Q 250 115 370 185 Q 490 255 610 145"
          fill="none"
          stroke="#facc15"
          strokeWidth="2.5"
          strokeDasharray="8, 6"
        />
        {[190, 270, 470, 550].map((cx, idx) => (
          <circle key={idx} cx={cx} cy={idx < 2 ? 160 + idx * 12 : 215 - (idx - 2) * 22} r="5" fill="#fef08a" />
        ))}
      </g>

      {/* 2. MAIN FOCAL CENTERPIECE: Grand Ornate Kundan Rakhi Mandala */}
      <g transform="translate(370, 185)" filter={`url(#r-shadow-${id})`}>
        {/* Outer Filigree Petals */}
        {[...Array(16)].map((_, i) => (
          <path
            key={`r-p1-${i}`}
            d="M 0 -34 Q 18 -70 0 -92 Q -18 -70 0 -34 Z"
            fill={`url(#r-gold-metal-${id})`}
            transform={`rotate(${i * 22.5})`}
          />
        ))}
        {/* Inner Red Enamel Petals */}
        {[...Array(12)].map((_, i) => (
          <path
            key={`r-p2-${i}`}
            d="M 0 -24 Q 11 -54 0 -74 Q -11 -54 0 -24 Z"
            fill="#dc2626"
            transform={`rotate(${i * 30})`}
          />
        ))}

        {/* Golden Bead Ring & Ruby Centerpiece */}
        <circle cx="0" cy="0" r="45" fill="none" stroke={`url(#r-gold-metal-${id})`} strokeWidth="7" strokeDasharray="7, 4" />
        <circle cx="0" cy="0" r="32" fill="#fcd34d" />
        <circle cx="0" cy="0" r="26" fill="#991b1b" />
        <circle cx="0" cy="0" r="16" fill={`url(#r-ruby-gem-${id})`} filter={`url(#r-glow-${id})`} />
      </g>

      {/* 3. LOWER-LEFT SUPPORTING: Silver Puja Thali with Kumkum & Sweets */}
      <g transform="translate(270, 325)" filter={`url(#r-shadow-${id})`}>
        <ellipse cx="0" cy="38" rx="72" ry="24" fill="#cbd5e1" stroke="#64748b" strokeWidth="2.5" />
        <ellipse cx="0" cy="36" rx="64" ry="19" fill="#f8fafc" />

        {/* Kumkum Katori */}
        <circle cx="-28" cy="36" r="12" fill="#991b1b" />
        <circle cx="-28" cy="36" r="10" fill="#dc2626" />

        {/* Akshat Rice Katori */}
        <circle cx="28" cy="36" r="12" fill="#ca8a04" />
        <circle cx="28" cy="36" r="10" fill="#fef08a" />

        {/* Traditional Kaju Katli Sweet (Diamond) */}
        <polygon points="0,26 10,36 0,46 -10,36" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" />

        {/* Lit Mini Diya */}
        <ellipse cx="0" cy="20" rx="13" ry="5" fill={`url(#r-gold-metal-${id})`} />
        <path d="M 0 17 C -3 10 0 0 0 -4 C 0 0 3 10 0 17 Z" fill="#f59e0b" filter={`url(#r-glow-${id})`} />
      </g>

      {/* 4. LOWER-RIGHT SUPPORTING: Luxury Festive Gift Box — close to thali */}
      <g transform="translate(430, 330)" filter={`url(#r-shadow-${id})`}>
        <rect x="-32" y="0" width="64" height="48" rx="4" fill="#db2777" />
        <rect x="-8" y="0" width="16" height="48" fill="#facc15" />
        <rect x="-32" y="17" width="64" height="11" fill="#facc15" />
        <circle cx="-5" cy="-3" r="5.5" fill="#fde047" />
        <circle cx="5" cy="-3" r="5.5" fill="#fde047" />
      </g>
    </svg>
  );
};

export const RakhiNavbarCluster: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 240 60" preserveAspectRatio="xMidYMid meet" style={style} {...props}>
      <path d="M 10 30 Q 110 55 210 30" fill="none" stroke="#dc2626" strokeWidth="3" />
      <g transform="translate(180, 32)">
        <circle cx="0" cy="0" r="14" fill="#facc15" />
        <circle cx="0" cy="0" r="10" fill="#dc2626" />
        <circle cx="0" cy="0" r="5" fill="#fef08a" />
      </g>
    </svg>
  );
};

export const RakhiDividerWave: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 1200 30" preserveAspectRatio="none" style={style} {...props}>
      <path
        d="M 0 14 Q 200 24 400 14 Q 600 24 800 14 Q 1000 24 1200 14"
        fill="none"
        stroke="#dc2626"
        strokeWidth="2.5"
      />
      <path
        d="M 0 14 Q 200 24 400 14 Q 600 24 800 14 Q 1000 24 1200 14"
        fill="none"
        stroke="#facc15"
        strokeWidth="1.2"
        strokeDasharray="6, 4"
      />
    </svg>
  );
};

export const RakhiFooterScene: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 1440 280" preserveAspectRatio="xMidYMid slice" style={style} {...props}>
      <defs>
        <radialGradient id={`r-foot-red-l-${id}`} cx="12%" cy="60%" r="60%">
          <stop offset="0%" stopColor="#dc2626" stopOpacity={isDark ? 0.35 : 0.2} />
          <stop offset="50%" stopColor="#991b1b" stopOpacity={isDark ? 0.18 : 0.08} />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`r-foot-gold-r-${id}`} cx="88%" cy="60%" r="60%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity={isDark ? 0.35 : 0.2} />
          <stop offset="50%" stopColor="#b45309" stopOpacity={isDark ? 0.18 : 0.08} />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`r-gold-metal-ft-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="30%" stopColor="#eab308" />
          <stop offset="70%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#713f12" />
        </linearGradient>
        <filter id={`r-foot-glow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ambient Silk Saffron/Red Washes */}
      <rect x="0" y="0" width="1440" height="280" fill={`url(#r-foot-red-l-${id})`} />
      <rect x="0" y="0" width="1440" height="280" fill={`url(#r-foot-gold-r-${id})`} />

      {/* ── FLOWING BRAIDED RESHAM SILK DORI THREADS ACROSS FOOTER ── */}
      <g fill="none" strokeLinecap="round">
        {/* Red core thread */}
        <path
          d="M 0 35 Q 240 85 480 35 Q 720 -10 960 45 Q 1200 80 1440 25"
          stroke="#dc2626"
          strokeWidth="4"
          opacity="0.8"
        />
        {/* Golden yellow spiral twist thread */}
        <path
          d="M 0 35 Q 240 85 480 35 Q 720 -10 960 45 Q 1200 80 1440 25"
          stroke="#facc15"
          strokeWidth="2"
          strokeDasharray="7, 5"
          opacity="0.9"
        />
        {/* Secondary wave along bottom */}
        <path
          d="M 0 240 Q 240 190 480 235 Q 720 270 960 220 Q 1200 180 1440 230"
          stroke="#dc2626"
          strokeWidth="3"
          opacity={isDark ? 0.5 : 0.35}
        />
        <path
          d="M 0 240 Q 240 190 480 235 Q 720 270 960 220 Q 1200 180 1440 230"
          stroke="#facc15"
          strokeWidth="1.5"
          strokeDasharray="6, 5"
          opacity={isDark ? 0.6 : 0.4}
        />
      </g>

      {/* Golden Spacer Beads along the Thread */}
      {[160, 320, 580, 740, 900, 1120, 1280].map((cx, idx) => (
        <circle
          key={`bead-${idx}`}
          cx={cx}
          cy={idx % 2 === 0 ? 55 : 30}
          r="4.5"
          fill={`url(#r-gold-metal-ft-${id})`}
          filter={`url(#r-foot-glow-${id})`}
        />
      ))}

      {/* ── LEFT CORNER: Exquisite Kundan Floral Rakhi Medallion ── */}
      <g transform="translate(130, 145)">
        {/* Outer Filigree Petals */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => (
          <path
            key={`r-ft-p1-${i}`}
            d="M 0 -18 Q 10 -38 0 -50 Q -10 -38 0 -18 Z"
            fill={`url(#r-gold-metal-ft-${id})`}
            transform={`rotate(${angle}) scale(0.9)`}
          />
        ))}
        {/* Inner Red Enamel Petals */}
        {[15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345].map((angle, i) => (
          <path
            key={`r-ft-p2-${i}`}
            d="M 0 -12 Q 6 -28 0 -38 Q -6 -28 0 -12 Z"
            fill="#dc2626"
            transform={`rotate(${angle}) scale(0.9)`}
          />
        ))}
        {/* Golden Bead Ring & Ruby Gem Center */}
        <circle cx="0" cy="0" r="24" fill="none" stroke={`url(#r-gold-metal-ft-${id})`} strokeWidth="4" strokeDasharray="4, 3" />
        <circle cx="0" cy="0" r="16" fill="#fcd34d" />
        <circle cx="0" cy="0" r="12" fill="#991b1b" />
        <circle cx="0" cy="0" r="7" fill="#ef4444" filter={`url(#r-foot-glow-${id})`} />
      </g>

      {/* ── RIGHT CORNER: Silver Puja Thali with Sweets & Diya ── */}
      <g transform="translate(1310, 160)">
        {/* Silver Thali plate */}
        <ellipse cx="0" cy="20" rx="55" ry="20" fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />
        <ellipse cx="0" cy="18" rx="48" ry="15" fill="#f8fafc" />

        {/* Kumkum & Akshat bowls */}
        <circle cx="-20" cy="18" r="9" fill="#dc2626" />
        <circle cx="20" cy="18" r="9" fill="#facc15" />

        {/* Traditional Kaju Katli Sweet (Silver Foil Diamond) */}
        <polygon points="0,10 8,18 0,26 -8,18" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" />

        {/* Mini Lit Diya on Thali */}
        <ellipse cx="0" cy="6" rx="10" ry="4" fill={`url(#r-gold-metal-ft-${id})`} />
        <path d="M 0 4 C -2.5 -2 0 -10 0 -14 C 0 -10 2.5 -2 0 4 Z" fill="#f59e0b" filter={`url(#r-foot-glow-${id})`} />
        <circle cx="0" cy="-3" r="2" fill="#ffffff" />
      </g>

      {/* Floating Golden Shimmer & Petals */}
      {[
        { cx: 380, cy: 160 },
        { cx: 520, cy: 110 },
        { cx: 680, cy: 170 },
        { cx: 840, cy: 120 },
        { cx: 1020, cy: 180 },
        { cx: 1180, cy: 110 },
      ].map((shimmer, idx) => (
        <circle
          key={`rakhi-shimmer-${idx}`}
          cx={shimmer.cx}
          cy={shimmer.cy}
          r="3"
          fill="#fef08a"
          opacity={isDark ? 0.75 : 0.5}
          filter={`url(#r-foot-glow-${id})`}
        />
      ))}
    </svg>
  );
};

// ======================================================================
// 🌙 6. EID FESTIVAL GRAPHICS (World-Class Vector Suite)
// ======================================================================

/**
 * Eid Hero Banner Illustration:
 * - 3D Sculpted Golden Crescent Moon (Hilal) with soft lunar radiance, cradling a glowing 8-pointed star.
 * - Left: Hanging ornate Moroccan/Ottoman Fanous lantern with glowing candle.
 * - Bottom: Elegant Grand Mosque dome and minarets horizon.
 */
export const EidHeroScene: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 700 480" preserveAspectRatio="xMidYMid meet" style={style} {...props}>
      <defs>
        <filter id={`e-shadow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="16" floodColor="#000000" floodOpacity={isDark ? 0.45 : 0.12} />
        </filter>
        <filter id={`e-glow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <linearGradient id={`e-gold-moon-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="35%" stopColor="#facc15" />
          <stop offset="70%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#854d0e" />
        </linearGradient>
        <radialGradient id={`e-lunar-halo-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
          <stop offset="45%" stopColor="#fde047" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#eab308" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 1. BACKGROUND: Mosque Horizon along Bottom */}
      <g fill={isDark ? "#0f172a" : "#1e293b"} opacity={isDark ? 0.65 : 0.35}>
        <path d="M 190 410 C 190 280 290 250 290 230 C 290 250 390 280 390 410 Z" />
        <line x1="290" y1="230" x2="290" y2="195" stroke={`url(#e-gold-moon-${id})`} strokeWidth="3" />
        <circle cx="290" cy="195" r="4" fill={`url(#e-gold-moon-${id})`} />

        <rect x="150" y="190" width="22" height="220" />
        <polygon points="145,190 161,150 177,190" fill={`url(#e-gold-moon-${id})`} />

        <rect x="430" y="210" width="20" height="200" />
        <polygon points="425,210 440,175 455,210" fill={`url(#e-gold-moon-${id})`} />
      </g>

      {/* Twinkling 8-Pointed Stars */}
      <g fill="#fef08a" filter={`url(#e-glow-${id})`}>
        {[
          { cx: 220, cy: 90, r: 6 },
          { cx: 290, cy: 60, r: 4.5 },
          { cx: 520, cy: 70, r: 7 },
          { cx: 570, cy: 120, r: 5 },
          { cx: 170, cy: 140, r: 4.5 },
        ].map((star, idx) => (
          <polygon
            key={idx}
            points={`${star.cx},${star.cy - star.r} ${star.cx + star.r * 0.4},${star.cy - star.r * 0.4} ${star.cx + star.r},${star.cy} ${star.cx + star.r * 0.4},${star.cy + star.r * 0.4} ${star.cx},${star.cy + star.r} ${star.cx - star.r * 0.4},${star.cy + star.r * 0.4} ${star.cx - star.r},${star.cy} ${star.cx - star.r * 0.4},${star.cy - star.r * 0.4}`}
          />
        ))}
      </g>

      {/* 2. MAIN FOCAL CENTERPIECE: 3D Sculpted Golden Crescent Moon (Hilal) — high in the sky */}
      <g transform="translate(555, 85)" filter={`url(#e-shadow-${id})`}>
        <circle cx="0" cy="0" r="115" fill={`url(#e-lunar-halo-${id})`} filter={`url(#e-glow-${id})`} />
        <path
          d="M -60 -95 A 105 105 0 1 0 72 50 A 82 82 0 1 1 -60 -95 Z"
          fill={`url(#e-gold-moon-${id})`}
        />
        {/* Specular Edge */}
        <path d="M -56 -88 A 100 100 0 0 0 65 42" fill="none" stroke="#ffffff" strokeWidth="2.5" opacity="0.65" />
      </g>

      {/* 3. LEFT SUPPORTING: Ornate Moroccan Fanous (Lantern) */}
      <g transform="translate(230, 85)" filter={`url(#e-shadow-${id})`}>
        <line x1="0" y1="-85" x2="0" y2="0" stroke={`url(#e-gold-moon-${id})`} strokeWidth="3" strokeDasharray="5, 3" />
        <path d="M -24 0 L 24 0 L 16 -28 L -16 -28 Z" fill={`url(#e-gold-moon-${id})`} />
        <circle cx="0" cy="-32" r="5" fill={`url(#e-gold-moon-${id})`} />

        {/* Glass Body with Filigree */}
        <polygon points="-32,0 32,0 24,80 -24,80" fill="#fef08a" opacity="0.95" filter={`url(#e-glow-${id})`} />
        <polygon points="-32,0 32,0 24,80 -24,80" fill="none" stroke={`url(#e-gold-moon-${id})`} strokeWidth="4" />
        <line x1="0" y1="0" x2="0" y2="80" stroke={`url(#e-gold-moon-${id})`} strokeWidth="2.5" />

        {/* Candle Flame Inside */}
        <path d="M 0 48 C -4 40 0 28 0 24 C 0 28 4 40 0 48 Z" fill="#ea580c" />
        <circle cx="0" cy="38" r="3" fill="#ffffff" />

        {/* Bottom Finial */}
        <path d="M -24 80 L 24 80 L 0 108 Z" fill={`url(#e-gold-moon-${id})`} />
        <circle cx="0" cy="112" r="4" fill={`url(#e-gold-moon-${id})`} />
      </g>
    </svg>
  );
};

export const EidNavbarCluster: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 240 60" preserveAspectRatio="xMidYMid meet" style={style} {...props}>
      <g transform="translate(195, 30)">
        <path d="M -15 -20 A 24 24 0 1 0 18 12 A 19 19 0 1 1 -15 -20 Z" fill="#facc15" />
      </g>
    </svg>
  );
};

export const EidDividerWave: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 1200 30" preserveAspectRatio="none" style={style} {...props}>
      <path
        d="M 0 14 Q 200 24 400 14 Q 600 24 800 14 Q 1000 24 1200 14"
        fill="none"
        stroke="#0d9488"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const EidFooterScene: React.FC<FestiveGraphicProps> = ({ isDark = false, style, ...props }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 1440 280" preserveAspectRatio="xMidYMid slice" style={style} {...props}>
      <defs>
        <radialGradient id={`e-foot-teal-l-${id}`} cx="12%" cy="60%" r="60%">
          <stop offset="0%" stopColor="#0d9488" stopOpacity={isDark ? 0.4 : 0.22} />
          <stop offset="50%" stopColor="#115e59" stopOpacity={isDark ? 0.2 : 0.1} />
          <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`e-foot-gold-r-${id}`} cx="88%" cy="60%" r="60%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity={isDark ? 0.35 : 0.2} />
          <stop offset="50%" stopColor="#b45309" stopOpacity={isDark ? 0.18 : 0.08} />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`e-gold-brass-ft-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="35%" stopColor="#facc15" />
          <stop offset="70%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#854d0e" />
        </linearGradient>
        <filter id={`e-foot-glow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ambient Teal & Golden Radiance */}
      <rect x="0" y="0" width="1440" height="280" fill={`url(#e-foot-teal-l-${id})`} />
      <rect x="0" y="0" width="1440" height="280" fill={`url(#e-foot-gold-r-${id})`} />

      {/* ── BOTTOM EDGE: Elegant Grand Mosque Domes & Minarets Silhouette ── */}
      <g fill={isDark ? "#042f2e" : "#134e4a"} opacity={isDark ? 0.6 : 0.35}>
        {/* Main Central Dome */}
        <path d="M 640 280 C 640 210 720 180 720 160 C 720 180 800 210 800 280 Z" />
        <line x1="720" y1="160" x2="720" y2="135" stroke={`url(#e-gold-brass-ft-${id})`} strokeWidth="2.5" />
        <circle cx="720" cy="135" r="3.5" fill={`url(#e-gold-brass-ft-${id})`} />

        {/* Side Domes */}
        <path d="M 440 280 C 440 230 500 210 500 190 C 500 210 560 230 560 280 Z" />
        <path d="M 880 280 C 880 230 940 210 940 190 C 940 210 1000 230 1000 280 Z" />

        {/* Left Minaret */}
        <rect x="380" y="160" width="16" height="120" />
        <polygon points="375,160 388,125 401,160" fill={`url(#e-gold-brass-ft-${id})`} />

        {/* Right Minaret */}
        <rect x="1040" y="160" width="16" height="120" />
        <polygon points="1035,160 1048,125 1061,160" fill={`url(#e-gold-brass-ft-${id})`} />
      </g>

      {/* ── TOP LEFT: Hanging Ornate Moroccan Fanous Lantern ── */}
      <g transform="translate(120, 0)">
        {/* Hanging Golden Chain */}
        <line x1="0" y1="0" x2="0" y2="60" stroke={`url(#e-gold-brass-ft-${id})`} strokeWidth="2" strokeDasharray="4, 3" />
        {/* Top Lantern Cap */}
        <path d="M -18 60 L 18 60 L 12 40 L -12 40 Z" fill={`url(#e-gold-brass-ft-${id})`} />
        <circle cx="0" cy="36" r="4" fill={`url(#e-gold-brass-ft-${id})`} />
        {/* Glass Body */}
        <polygon points="-24,60 24,60 18,125 -18,125" fill="#fef08a" opacity="0.9" filter={`url(#e-foot-glow-${id})`} />
        <polygon points="-24,60 24,60 18,125 -18,125" fill="none" stroke={`url(#e-gold-brass-ft-${id})`} strokeWidth="3" />
        <line x1="0" y1="60" x2="0" y2="125" stroke={`url(#e-gold-brass-ft-${id})`} strokeWidth="2" />
        {/* Candle Flame */}
        <path d="M 0 100 C -3 92 0 82 0 78 C 0 82 3 92 0 100 Z" fill="#ea580c" />
        <circle cx="0" cy="92" r="2.5" fill="#ffffff" />
        {/* Bottom Finial */}
        <path d="M -18 125 L 18 125 L 0 150 Z" fill={`url(#e-gold-brass-ft-${id})`} />
        <circle cx="0" cy="154" r="3.5" fill={`url(#e-gold-brass-ft-${id})`} />
      </g>

      {/* ── TOP RIGHT: Secondary Hanging Fanous & Glowing Crescent Moon ── */}
      <g transform="translate(1320, 0)">
        {/* Hanging Lantern */}
        <line x1="0" y1="0" x2="0" y2="75" stroke={`url(#e-gold-brass-ft-${id})`} strokeWidth="2" strokeDasharray="4, 3" />
        <path d="M -16 75 L 16 75 L 10 58 L -10 58 Z" fill={`url(#e-gold-brass-ft-${id})`} />
        <polygon points="-20,75 20,75 15,130 -15,130" fill="#fef08a" opacity="0.9" filter={`url(#e-foot-glow-${id})`} />
        <polygon points="-20,75 20,75 15,130 -15,130" fill="none" stroke={`url(#e-gold-brass-ft-${id})`} strokeWidth="3" />
        <line x1="0" y1="75" x2="0" y2="130" stroke={`url(#e-gold-brass-ft-${id})`} strokeWidth="2" />
        <path d="M 0 110 C -3 102 0 94 0 90 C 0 94 3 102 0 110 Z" fill="#ea580c" />
        <circle cx="0" cy="103" r="2.5" fill="#ffffff" />
        <path d="M -15 130 L 15 130 L 0 152 Z" fill={`url(#e-gold-brass-ft-${id})`} />
      </g>

      {/* Floating Golden Crescent Moon (Upper Right Sky) */}
      <g transform="translate(1200, 70)" filter={`url(#e-foot-glow-${id})`}>
        <path
          d="M -25 -40 A 42 42 0 1 0 28 20 A 32 32 0 1 1 -25 -40 Z"
          fill={`url(#e-gold-brass-ft-${id})`}
        />
      </g>

      {/* ── TWINKLING 8-POINTED ISLAMIC STARS IN MIDNIGHT SKY ── */}
      {[
        { cx: 260, cy: 70, r: 5 },
        { cx: 340, cy: 120, r: 3.5 },
        { cx: 480, cy: 60, r: 4.5 },
        { cx: 600, cy: 110, r: 3.5 },
        { cx: 760, cy: 50, r: 5 },
        { cx: 880, cy: 100, r: 4 },
        { cx: 1020, cy: 65, r: 4.5 },
        { cx: 1120, cy: 120, r: 3.5 },
      ].map((star, idx) => (
        <polygon
          key={`star-ft-${idx}`}
          points={`${star.cx},${star.cy - star.r} ${star.cx + star.r * 0.4},${star.cy - star.r * 0.4} ${star.cx + star.r},${star.cy} ${star.cx + star.r * 0.4},${star.cy + star.r * 0.4} ${star.cx},${star.cy + star.r} ${star.cx - star.r * 0.4},${star.cy + star.r * 0.4} ${star.cx - star.r},${star.cy} ${star.cx - star.r * 0.4},${star.cy - star.r * 0.4}`}
          fill="#fef08a"
          opacity={isDark ? 0.85 : 0.65}
          filter={`url(#e-foot-glow-${id})`}
        />
      ))}
    </svg>
  );
};

// ======================================================================
// 🚀 UNIFIED FESTIVAL COMPONENT DISPATCHERS
// ======================================================================

export const HoliGraphics: React.FC<FestiveGraphicProps> = ({ variant = "hero", ...props }) => {
  switch (variant) {
    case "navbar":
      return <HoliNavbarCluster {...props} />;
    case "grid":
      return <HoliDividerWave {...props} />;
    case "footer":
      return <HoliFooterScene {...props} />;
    case "hero":
    default:
      return <HoliHeroScene {...props} />;
  }
};

export const DiwaliGraphics: React.FC<FestiveGraphicProps> = ({ variant = "hero", ...props }) => {
  switch (variant) {
    case "navbar":
      return <DiwaliNavbarCluster {...props} />;
    case "grid":
      return <DiwaliDividerWave {...props} />;
    case "footer":
      return <DiwaliFooterScene {...props} />;
    case "hero":
    default:
      return <DiwaliHeroScene {...props} />;
  }
};

export const DurgaGraphics: React.FC<FestiveGraphicProps> = ({ variant = "hero", ...props }) => {
  switch (variant) {
    case "navbar":
      return <DurgaNavbarCluster {...props} />;
    case "grid":
      return <DurgaDividerWave {...props} />;
    case "footer":
      return <DurgaFooterScene {...props} />;
    case "hero":
    default:
      return <DurgaHeroScene {...props} />;
  }
};

export const ChristmasGraphics: React.FC<FestiveGraphicProps> = ({ variant = "hero", ...props }) => {
  switch (variant) {
    case "navbar":
      return <ChristmasNavbarCluster {...props} />;
    case "grid":
      return <ChristmasDividerWave {...props} />;
    case "footer":
      return <ChristmasFooterScene {...props} />;
    case "hero":
    default:
      return <ChristmasHeroScene {...props} />;
  }
};

export const RakhiGraphics: React.FC<FestiveGraphicProps> = ({ variant = "hero", ...props }) => {
  switch (variant) {
    case "navbar":
      return <RakhiNavbarCluster {...props} />;
    case "grid":
      return <RakhiDividerWave {...props} />;
    case "footer":
      return <RakhiFooterScene {...props} />;
    case "hero":
    default:
      return <RakhiHeroScene {...props} />;
  }
};

export const EidGraphics: React.FC<FestiveGraphicProps> = ({ variant = "hero", ...props }) => {
  switch (variant) {
    case "navbar":
      return <EidNavbarCluster {...props} />;
    case "grid":
      return <EidDividerWave {...props} />;
    case "footer":
      return <EidFooterScene {...props} />;
    case "hero":
    default:
      return <EidHeroScene {...props} />;
  }
};

// Aliases for legacy direct component imports if any
export const DiwaliDiya = DiwaliHeroScene;
export const DiwaliLamp = DiwaliNavbarCluster;
export const HoliColors = HoliHeroScene;
export const DurgaTrinayani = DurgaHeroScene;
export const RakhiMandala = RakhiHeroScene;
export const ChristmasBaubles = ChristmasHeroScene;
export const EidLanternMoon = EidHeroScene;