import React, { useState } from "react";

interface UserAvatarProps {
  size?: number;
  avatarUrl?: string;
  variant?: "transparent" | "yellow";
  className?: string;
  style?: React.CSSProperties;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  size = 32,
  avatarUrl,
  variant = "transparent",
  className = "",
  style = {},
}) => {
  const [imgError, setImgError] = useState(false);
  const isYellow = variant === "yellow";

  const defaultSrc = isYellow ? "/user_avatar_yellow.png" : "/user_avatar_chat.png";
  const imageSource = avatarUrl || defaultSrc;

  if (!imgError && imageSource) {
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
          background: isYellow ? "#ffaa00" : "transparent",
          borderRadius: isYellow ? "50%" : "0",
          border: isYellow ? "1.5px solid rgba(255, 170, 0, 0.5)" : "none",
          boxShadow: isYellow ? "0 2px 8px rgba(255, 170, 0, 0.28)" : "none",
          overflow: isYellow ? "hidden" : "visible",
          padding: 0,
          margin: 0,
          ...style,
        }}
        title="User Profile"
      >
        <img
          src={imageSource}
          alt="User Profile"
          onError={() => setImgError(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: isYellow ? "cover" : "contain",
            borderRadius: isYellow ? "50%" : "0",
            display: "block",
            filter: isYellow ? "none" : "drop-shadow(0 2px 5px rgba(0, 0, 0, 0.12))",
          }}
        />
      </div>
    );
  }

  // Pure Vector Fallback
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
        background: isYellow ? "#ffaa00" : "transparent",
        borderRadius: isYellow ? "50%" : "0",
        border: isYellow ? "1.5px solid rgba(255, 170, 0, 0.5)" : "none",
        overflow: isYellow ? "hidden" : "visible",
        padding: 0,
        margin: 0,
        ...style,
      }}
      title="User Profile"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <circle cx="50" cy="50" r="50" fill={isYellow ? "#ffaa00" : "#eff6ff"} />
        <path d="M 15 100 C 15 78, 25 74, 50 74 C 75 74, 85 78, 85 100 Z" fill="#18181b" />
        <ellipse cx="50" cy="42" rx="16" ry="20" fill="#fde0cc" />
        <path d="M 28 35 C 20 18, 30 8, 50 8 C 70 8, 80 18, 72 35 C 68 25, 60 22, 50 22 C 40 22, 32 25, 28 35 Z" fill="#18181b" />
      </svg>
    </div>
  );
};

export default UserAvatar;
