import React, { useState } from "react";

export type WebCreonAnimatedLogoProps = {
  width?: string | number;
  height?: string | number;
  showText?: boolean;
  staticMode?: boolean;
};

export function WebCreonAnimatedLogo({
  width = "100%",
  height = "auto",
  showText = true,
  staticMode = false,
}: WebCreonAnimatedLogoProps) {
  const [key, setKey] = useState(0);

  const handleReplay = () => {
    setKey((prev) => prev + 1);
  };

  return (
    <div
      key={key}
      onClick={handleReplay}
      title="Click to replay animation"
      style={{
        width: width,
        height: height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      {!staticMode && (
        <style>{`
          /* STEP 1: Ground Shadow & Building Settle */
        @keyframes wnGroundShadow {
          0% { transform: scaleX(0.2); opacity: 0; }
          100% { transform: scaleX(1); opacity: 1; }
        }

        @keyframes wnBuildingSettle {
          0% { opacity: 0; transform: translateY(30px) scale(0.9); }
          50% { opacity: 1; transform: translateY(-6px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* STEP 2: "W" Drops & Roof Compresses on Impact */
        @keyframes wnWDropImpact {
          0% {
            opacity: 0;
            transform: translateY(-140px) scale(1.1);
          }
          60% {
            opacity: 1;
            transform: translateY(2px) scale(0.98);
          }
          75% {
            transform: translateY(-8px) scale(1.02);
          }
          90% {
            transform: translateY(1px) scale(0.99);
          }
          100% {
            opacity: 1;
            transform: translateY(0px) scale(1);
          }
        }

        @keyframes wnRoofSquish {
          0%, 55% { transform: scaleY(1); }
          63% { transform: scaleY(0.85) translateY(8px); }
          75% { transform: scaleY(1.04) translateY(-2px); }
          88% { transform: scaleY(0.98) translateY(1px); }
          100% { transform: scaleY(1) translateY(0); }
        }

        /* WATER DROPLET SPLASH ANIMATION */
        @keyframes wnSplashDroplets {
          0%, 59% {
            opacity: 0;
            transform: scale(0.1) translate(0px, 0px);
          }
          60% {
            opacity: 1;
            transform: scale(0.4) translate(0px, 0px);
          }
          85% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            /* The translation is handled by individual CSS variables in the elements */
            transform: scale(1) var(--splash-translate);
          }
        }

        /* STEP 3: Smooth Cursor Slide & Click */
        @keyframes wnCursorSlideClick {
          0% {
            opacity: 0;
            transform: translate(60px, 80px);
          }
          35% {
            opacity: 1;
            transform: translate(0px, 0px);
          }
          45% {
            transform: translate(0px, 0px) scale(0.85);
          }
          55% {
            transform: translate(0px, 0px) scale(1);
          }
          100% {
            opacity: 1;
            transform: translate(0px, 0px) scale(1);
          }
        }

        @keyframes wnRipple {
          0% { opacity: 0.8; transform: scale(0.2); }
          100% { opacity: 0; transform: scale(2); }
        }

        /* LOOPING ANIMATIONS */
        @keyframes wnGearSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes wnStoreGentleHum {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-4px) rotate(-0.5deg); }
          50% { transform: translateY(1px) rotate(0.3deg); }
          75% { transform: translateY(-2px) rotate(-0.2deg); }
        }

        @keyframes wnBagHover {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        @keyframes wnTextReveal {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        /* CSS Animation Target Classes */
        .wn-ground-shadow {
          transform-origin: 200px 305px;
          animation: wnGroundShadow 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .wn-building-root {
          animation: wnBuildingSettle 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .wn-store-vibrate-loop {
          animation: wnStoreGentleHum 4s ease-in-out infinite 2.6s;
        }

        .wn-roof-squish-anim {
          transform-origin: 200px 145px;
          animation: wnRoofSquish 1s ease-out forwards 0.8s;
        }

        .wn-w-drop-anim {
          opacity: 0;
          transform-origin: 200px 105px;
          animation: wnWDropImpact 1s cubic-bezier(0.34, 1.4, 0.64, 1) forwards 0.8s;
        }

        .wn-splash-drop {
          opacity: 0;
          transform-origin: 200px 100px;
          animation: wnSplashDroplets 1.1s ease-out forwards 0.8s;
        }

        .wn-cursor-anim {
          opacity: 0;
          animation: wnCursorSlideClick 1.4s ease-out forwards 1.6s;
        }

        .wn-cursor-ripple {
          opacity: 0;
          transform-origin: 242px 40px;
          animation: wnRipple 0.6s ease-out forwards 2.1s;
        }

        .wn-gear-spin-anim {
          transform-origin: 250px 224px;
          animation: wnGearSpin 5s linear infinite 2.8s;
        }

        .wn-bag-hover-anim {
          animation: wnBagHover 3s ease-in-out infinite 2.8s;
        }

        .wn-brand-text-reveal {
          opacity: 0;
          animation: wnTextReveal 0.8s ease-out forwards 0.3s;
        }
      `}</style>
      )}

      <svg
        viewBox="0 0 400 360"
        style={{
          width: "100%",
          maxWidth: "380px",
          height: "auto",
          overflow: "visible",
        }}
      >
        {/* GROUND SHADOW */}
        <g className={staticMode ? "" : "wn-ground-shadow"}>
          <ellipse cx="200" cy="315" rx="140" ry="12" fill="#091a38" opacity="0.12" />
          <path d="M 40 315 L 360 315" stroke="#091a38" strokeWidth="8" strokeLinecap="round" />
        </g>

        {/* FLOATING BUILDING ENSEMBLE */}
        <g className={staticMode ? "" : "wn-building-root"}>
          <g className={staticMode ? "" : "wn-store-vibrate-loop"}>
            
            {/* BUILDING BODY */}
            <rect
              x="75"
              y="160"
              width="250"
              height="150"
              rx="16"
              fill="#155f9f"
              stroke="#091a38"
              strokeWidth="4"
            />
            {/* INNER WINDOW */}
            <rect
              x="100"
              y="180"
              width="200"
              height="110"
              rx="10"
              fill="#dde6ef"
              stroke="#091a38"
              strokeWidth="3"
            />
            <path
              d="M 104 186 L 296 186"
              stroke="#091a38"
              strokeWidth="3"
              opacity="0.1"
            />

            {/* SHOPPING BAG */}
            <g className={staticMode ? "" : "wn-bag-hover-anim"}>
              <g transform="translate(150, 243) scale(1.25) translate(-165, -243)">
                <path
                  d="M 152 220 C 152 205, 178 205, 178 220"
                  fill="none"
                  stroke="#c45a08"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  d="M 144 218 L 186 218 L 192 268 L 138 268 Z"
                  fill="#d87d13"
                  stroke="#091a38"
                  strokeWidth="4"
                  strokeLinejoin="round"
                />
                <circle cx="154" cy="228" r="3" fill="#FFFFFF" />
                <circle cx="176" cy="228" r="3" fill="#FFFFFF" />
              </g>
            </g>

            {/* GEAR */}
            <g className={staticMode ? "" : "wn-gear-spin-anim"}>
              <g transform="translate(250, 224) scale(1.25) translate(-260, -224)">
                <path
                  d="M 260 196 L 265 196 L 267 202 L 273 204 L 278 200 L 281 203 L 279 209 L 283 213 L 289 212 L 290 217 L 285 220 L 285 226 L 290 229 L 289 234 L 283 233 L 279 237 L 281 243 L 278 246 L 273 242 L 267 244 L 265 250 L 260 250 L 258 244 L 252 242 L 247 246 L 244 243 L 246 237 L 242 233 L 236 234 L 235 229 L 240 226 L 240 220 L 235 217 L 236 212 L 242 213 L 246 209 L 244 203 L 247 200 L 252 204 L 258 202 Z"
                  fill="#2487c9"
                  stroke="#091a38"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
                <circle cx="260" cy="224" r="10" fill="#dde6ef" stroke="#091a38" strokeWidth="3" />
              </g>
            </g>

            {/* EXACT 5-STRIPE FLARED AWNING FROM REFERENCE IMAGE */}
            <g className={staticMode ? "" : "wn-roof-squish-anim"}>
              {/* Stripe 1 (Light Blue) */}
              <path d="M 80 110 L 128 110 L 101 150 L 101 155 Q 68 175 35 155 L 35 150 Z" fill="#4fa4e6" stroke="#091a38" strokeWidth="4" strokeLinejoin="round" />
              {/* Stripe 2 (Dark Blue) */}
              <path d="M 128 110 L 176 110 L 167 150 L 167 155 Q 134 175 101 155 L 101 150 Z" fill="#1b417d" stroke="#091a38" strokeWidth="4" strokeLinejoin="round" />
              {/* Stripe 3 (Light Blue) - Center */}
              <path d="M 176 110 L 224 110 L 233 150 L 233 155 Q 200 175 167 155 L 167 150 Z" fill="#4fa4e6" stroke="#091a38" strokeWidth="4" strokeLinejoin="round" />
              {/* Stripe 4 (Dark Blue) */}
              <path d="M 224 110 L 272 110 L 299 150 L 299 155 Q 266 175 233 155 L 233 150 Z" fill="#1b417d" stroke="#091a38" strokeWidth="4" strokeLinejoin="round" />
              {/* Stripe 5 (Light Blue) */}
              <path d="M 272 110 L 320 110 L 365 150 L 365 155 Q 332 175 299 155 L 299 150 Z" fill="#4fa4e6" stroke="#091a38" strokeWidth="4" strokeLinejoin="round" />
              
              {/* Top Support Bar */}
              <rect x="70" y="96" width="260" height="18" rx="9" fill="#155f9f" stroke="#091a38" strokeWidth="4" />
              
              {/* W Landing Indentation Shadow */}
              <ellipse cx="200" cy="96" rx="24" ry="6" fill="#091a38" opacity="0.4" />
            </g>
          </g>
        </g>

        {!staticMode && (
          <g>
            {/* CLEAN WATERY CIRCLE DROPS (Splashing in all directions, matching W colors) */}
          {/* Top Left */}
          <g className="wn-splash-drop" style={{ "--splash-translate": "translate(-40px, -50px)" } as any}>
            <circle cx="200" cy="100" r="6" fill="#ffaa00" stroke="#091a38" strokeWidth="3" />
          </g>
          {/* Top Center */}
          <g className="wn-splash-drop" style={{ "--splash-translate": "translate(0px, -60px)" } as any}>
            <circle cx="200" cy="100" r="7" fill="#ffaa00" stroke="#091a38" strokeWidth="3" />
          </g>
          {/* Top Right */}
          <g className="wn-splash-drop" style={{ "--splash-translate": "translate(40px, -50px)" } as any}>
            <circle cx="200" cy="100" r="6" fill="#ffaa00" stroke="#091a38" strokeWidth="3" />
          </g>
          {/* Middle Left */}
          <g className="wn-splash-drop" style={{ "--splash-translate": "translate(-60px, -10px)" } as any}>
            <circle cx="200" cy="100" r="4" fill="#ffaa00" stroke="#091a38" strokeWidth="2" />
          </g>
          {/* Middle Right */}
          <g className="wn-splash-drop" style={{ "--splash-translate": "translate(60px, -10px)" } as any}>
            <circle cx="200" cy="100" r="4" fill="#ffaa00" stroke="#091a38" strokeWidth="2" />
          </g>
          {/* Bottom Left (Falling down off roof) */}
          <g className="wn-splash-drop" style={{ "--splash-translate": "translate(-45px, 45px)" } as any}>
            <circle cx="200" cy="100" r="5" fill="#ffaa00" stroke="#091a38" strokeWidth="3" />
          </g>
          {/* Bottom Right (Falling down off roof) */}
          <g className="wn-splash-drop" style={{ "--splash-translate": "translate(45px, 45px)" } as any}>
            <circle cx="200" cy="100" r="5" fill="#ffaa00" stroke="#091a38" strokeWidth="3" />
          </g>
          </g>
        )}

        {/* THE CLEAN, YELLOW/ORANGE "W" WITH BLUE BORDER */}
        <g className={staticMode ? "" : "wn-w-drop-anim"}>
          {/* Outer Border (Thick Dark Blue) */}
          <path
            d="M 140 35 L 168 100 L 200 60 L 232 100 L 260 35"
            fill="none"
            stroke="#091a38"
            strokeWidth="30"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Inner Fill (Bright Yellow-Orange) */}
          <path
            d="M 140 35 L 168 100 L 200 60 L 232 100 L 260 35"
            fill="none"
            stroke="#ffaa00"
            strokeWidth="20"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>

        {/* HIGH-PRECISION CURSOR */}
        {!staticMode && (
          <g className="wn-cursor-anim">
            {/* CLICK RIPPLE */}
          <circle className="wn-cursor-ripple" cx="242" cy="40" r="10" fill="none" stroke="#ffaa00" strokeWidth="4" />
          
          <g transform="translate(242, 40)">
            <path
              d="M 2 2 L 2 28 L 9 21 L 17 30 L 21 28 L 13 19 L 22 19 Z"
              fill="#091a38"
              opacity="0.3"
            />
            <path
              d="M 0 0 L 0 26 L 7 19 L 15 28 L 19 26 L 11 17 L 20 17 Z"
              fill="#FFFFFF"
              stroke="#091a38"
              strokeWidth="4"
              strokeLinejoin="round"
            />
          </g>
        </g>
        )}
      </svg>

      {/* TYPOGRAPHY */}
      {showText && (
        <div
          className={staticMode ? "" : "wn-brand-text-reveal"}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: "-35px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "'Outfit', 'Inter', sans-serif",
              fontSize: "36px",
              fontWeight: 900,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
            }}
          >
            <span style={{ color: "#0f62ab" }}>WEB</span>
            <span style={{ color: "#ffaa00" }}>CREON</span>
          </div>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "0.15em",
              color: "#475569",
              textTransform: "uppercase",
              marginTop: "8px",
            }}
          >
            EASY WEBSITE BUILDER FOR SMALL VENDORS
          </div>
        </div>
      )}
    </div>
  );
}

export default WebCreonAnimatedLogo;
