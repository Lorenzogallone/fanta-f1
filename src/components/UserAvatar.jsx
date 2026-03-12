/**
 * @file UserAvatar.jsx
 * @description Reusable avatar component that displays user's profile photo or initial fallback.
 * Used across Navigation, Leaderboard, PlayerStatsView, and ProfilePage.
 */
import React from "react";
import PropTypes from "prop-types";
import { useTheme } from "../contexts/ThemeContext";

/**
 * Displays a user avatar with photo or fallback initial.
 * @param {Object} props
 * @param {string} [props.photoURL] - URL of the user's profile photo
 * @param {string} [props.name] - User's display name (for initial fallback)
 * @param {number} [props.size] - Avatar diameter in px (default 34)
 * @param {string} [props.className] - Additional CSS classes
 * @param {Object} [props.style] - Additional inline styles
 */
export default function UserAvatar({ photoURL, name, size = 34, className = "", style = {} }) {
  const { isDark } = useTheme();
  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const initial = name?.charAt(0)?.toUpperCase() || "?";

  const baseStyle = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
    ...style,
  };

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name || "Avatar"}
        className={className}
        style={{
          ...baseStyle,
          objectFit: "cover",
        }}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        ...baseStyle,
        backgroundColor: accentColor,
        color: "#fff",
        fontWeight: 700,
        fontSize: `${Math.max(size * 0.4, 10)}px`,
      }}
    >
      {initial}
    </div>
  );
}

UserAvatar.propTypes = {
  photoURL: PropTypes.string,
  name: PropTypes.string,
  size: PropTypes.number,
  className: PropTypes.string,
  style: PropTypes.object,
};
