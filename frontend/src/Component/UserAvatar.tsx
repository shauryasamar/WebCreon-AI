import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../config/api";

export function resolveAvatarUrl(url?: string | null): string {
  if (!url) return "";
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  ) {
    return url;
  }
  if (url.startsWith("/uploads/")) {
    const base = API_BASE_URL.replace(/\/$/, "");
    return `${base}${url}`;
  }
  return url;
}

interface UserAvatarProps {
  size?: number;
  avatarUrl?: string;
  gender?: string;
  variant?: "transparent" | "yellow";
  className?: string;
  style?: React.CSSProperties;
}

const CHAT_AVATAR_MAP: Record<string, string> = {
  "/user_avatar_yellow.png": "/user_avatar_chat.png",
  "/user_avatar_women_yellow.png": "/user_avatar_women_chat.png",
  "/user_avatar_male_30s_yellow.png": "/user_avatar_male_30s_chat.png",
  "/user_avatar_female_30s_yellow.png": "/user_avatar_female_30s_chat.png",
  "/user_avatar_male_senior_yellow.png": "/user_avatar_male_senior_chat.png",
  "/user_avatar_female_senior_yellow.png": "/user_avatar_female_senior_chat.png",
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  size = 32,
  avatarUrl,
  gender,
  variant = "transparent",
  className = "",
  style = {},
}) => {
  const [imgError, setImgError] = useState(false);
  const isYellow = variant === "yellow";

  // Reset img error if avatarUrl changes
  useEffect(() => {
    setImgError(false);
  }, [avatarUrl, gender, variant]);

  const isFemale = (gender || "").toLowerCase() === "female";

  const defaultStockSrc = isFemale
    ? isYellow
      ? "/user_avatar_women_yellow.png"
      : "/user_avatar_women_chat.png"
    : isYellow
      ? "/user_avatar_yellow.png"
      : "/user_avatar_chat.png";

  let imageSource = avatarUrl || defaultStockSrc;

  if (!isYellow && avatarUrl && CHAT_AVATAR_MAP[avatarUrl]) {
    imageSource = CHAT_AVATAR_MAP[avatarUrl];
  } else if (!avatarUrl) {
    imageSource = defaultStockSrc;
  }

  const resolvedSource = imgError
    ? defaultStockSrc
    : resolveAvatarUrl(imageSource);

  const isStockYellow =
    Boolean(avatarUrl) && Object.keys(CHAT_AVATAR_MAP).includes(avatarUrl!);

  const isCustomPhoto =
    Boolean(avatarUrl) &&
    !isStockYellow &&
    !avatarUrl?.startsWith("https://api.dicebear.com");

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
        background: isYellow || isCustomPhoto ? "#ffaa00" : "transparent",
        borderRadius: isYellow || isCustomPhoto ? "50%" : "0",
        border: isYellow ? "1.5px solid rgba(255, 170, 0, 0.5)" : "none",
        boxShadow: isYellow ? "0 2px 8px rgba(255, 170, 0, 0.28)" : "none",
        overflow: isYellow || isCustomPhoto ? "hidden" : "visible",
        padding: 0,
        margin: 0,
        ...style,
      }}
      title="User Profile"
    >
      <img
        src={resolvedSource}
        alt="User Profile"
        onError={() => setImgError(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: isYellow || isCustomPhoto ? "cover" : "contain",
          borderRadius: isYellow || isCustomPhoto ? "50%" : "0",
          display: "block",
          filter: isYellow || isCustomPhoto ? "none" : "drop-shadow(0 2px 5px rgba(0, 0, 0, 0.12))",
        }}
      />
    </div>
  );
};

export default UserAvatar;
