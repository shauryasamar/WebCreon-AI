import React from "react";

interface AiAvatarProps {
  size?: number;
  glow?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const AiAvatar: React.FC<AiAvatarProps> = ({
  size = 32,
  glow = true,
  className = "",
  style = {},
}) => {
  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        position: "relative",
        userSelect: "none",
        background: "transparent",
        border: "none",
        boxShadow: "none",
        padding: 0,
        margin: 0,
        ...style,
      }}
      title="WebNirmaan AI Assistant"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
      >
        <defs>
          {/* Electric Cyan & Royal Blue Gradient */}
          <linearGradient id="cyanRimGrad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#bae6fd" />
            <stop offset="30%" stopColor="#38bdf8" />
            <stop offset="70%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>

          {/* Helmet Titanium Cobalt Gradient */}
          <linearGradient id="cyberHelmetGrad" x1="12" y1="8" x2="32" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="35%" stopColor="#1d4ed8" />
            <stop offset="80%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>

          {/* OLED Visor Screen Gradient */}
          <linearGradient id="oledVisorGrad" x1="12" y1="14" x2="32" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#08101e" />
            <stop offset="50%" stopColor="#020617" />
            <stop offset="100%" stopColor="#0c1a30" />
          </linearGradient>

          {/* Electric Cyan Eyes Radial Glow */}
          <radialGradient id="cyanEyeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#7dd3fc" />
            <stop offset="80%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </radialGradient>

          {/* Curved Visor Specular Reflection */}
          <linearGradient id="cyberVisorReflect" x1="14" y1="13" x2="30" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.45)" />
            <stop offset="45%" stopColor="rgba(186, 230, 253, 0.15)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
          </linearGradient>

          {/* Ambient Glow */}
          <filter id="cyanSoftGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.9" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Subtle Drop Shadow for floating robot */}
          <filter id="botDropShadow" x="-15%" y="-10%" width="130%" height="125%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor="#0284c7" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* 1. ANTENNA & GLOWING NODE */}
        <path
          d="M 22 4.5 L 22 9.5"
          stroke="url(#cyanRimGrad)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <ellipse cx="22" cy="9.5" rx="3.5" ry="1.2" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.8" />
        <circle cx="22" cy="4" r="2.8" fill="url(#cyanEyeGlow)" filter="url(#cyanSoftGlow)" />
        <circle cx="21" cy="3" r="0.8" fill="#ffffff" />

        {/* 2. SIDE AUDIO TURBINES */}
        <rect x="4" y="16.5" width="3.5" height="9.5" rx="1.75" fill="#090d16" stroke="#38bdf8" strokeWidth="1" />
        <circle cx="5.75" cy="21.25" r="1.1" fill="#38bdf8" />

        <rect x="36.5" y="16.5" width="3.5" height="9.5" rx="1.75" fill="#090d16" stroke="#38bdf8" strokeWidth="1" />
        <circle cx="38.25" cy="21.25" r="1.1" fill="#38bdf8" />

        {/* 3. MAIN BOT HELMET */}
        <rect
          x="7"
          y="9"
          width="30"
          height="25"
          rx="8.5"
          fill="url(#cyberHelmetGrad)"
          stroke="#38bdf8"
          strokeWidth="1.2"
          filter="url(#botDropShadow)"
        />
        <path
          d="M 12 11 Q 22 9.5 32 11"
          stroke="rgba(255, 255, 255, 0.45)"
          strokeWidth="0.9"
          strokeLinecap="round"
        />

        {/* 4. OLED VISOR SCREEN */}
        <rect
          x="10.5"
          y="13"
          width="23"
          height="15"
          rx="5"
          fill="url(#oledVisorGrad)"
          stroke="#020617"
          strokeWidth="1.2"
        />
        <rect
          x="11"
          y="13.5"
          width="22"
          height="14"
          rx="4.5"
          fill="none"
          stroke="rgba(56, 189, 248, 0.25)"
          strokeWidth="0.8"
        />

        {/* 5. VISOR GLASS SHEEN */}
        <path
          d="M 12 14.5 C 16 13.8, 28 13.8, 32 14.5 C 32 17, 28 18.5, 12 18.5 Z"
          fill="url(#cyberVisorReflect)"
        />

        {/* 6. INTELLIGENT CYAN EYES */}
        <ellipse cx="16.5" cy="20" rx="3.4" ry="3.6" fill="#020617" />
        <circle cx="16.5" cy="20" r="2.8" fill="url(#cyanEyeGlow)" filter="url(#cyanSoftGlow)" />
        <circle cx="15.6" cy="18.8" r="0.9" fill="#ffffff" />
        <circle cx="17.4" cy="21.2" r="0.4" fill="#ffffff" opacity="0.85" />

        <ellipse cx="27.5" cy="20" rx="3.4" ry="3.6" fill="#020617" />
        <circle cx="27.5" cy="20" r="2.8" fill="url(#cyanEyeGlow)" filter="url(#cyanSoftGlow)" />
        <circle cx="26.6" cy="18.8" r="0.9" fill="#ffffff" />
        <circle cx="28.4" cy="21.2" r="0.4" fill="#ffffff" opacity="0.85" />

        {/* 7. DIGITAL WAVE SMILE */}
        <path
          d="M 19 24.5 Q 22 26.2 25 24.5"
          stroke="#38bdf8"
          strokeWidth="1.4"
          strokeLinecap="round"
          filter="url(#cyanSoftGlow)"
        />

        {/* 8. CHEST COLLAR & CORE */}
        <path
          d="M 14 34 L 17 38.5 L 27 38.5 L 30 34 Z"
          fill="#0f172a"
          stroke="url(#cyanRimGrad)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <circle cx="22" cy="36.5" r="1.3" fill="#38bdf8" filter="url(#cyanSoftGlow)" />
        <circle cx="21.8" cy="36.3" r="0.45" fill="#ffffff" />
      </svg>
    </div>
  );
};

export default AiAvatar;
