/**
 * @file LogoLoader.jsx
 * @description FantaF1 logo loader, the same draw-in animation as the launch splash.
 * Replaces the generic spinners across the app.
 */

import React from "react";
import PropTypes from "prop-types";
import { useLanguage } from "../hooks/useLanguage";

// Logo geometry, shared with the splash in index.html (viewBox 0 0 500 250)
const UPPER_BAND = "M 50 190 L 100 140 Q 130 110 160 110 L 375 110 L 347 138 L 160 138 Q 137 138 115 160 L 85 190 Z";
const LOWER_BAND = "M 100 190 L 115 175 Q 137 153 160 153 L 305 153 L 277 181 L 170 181 Q 144 181 135 190 Z";
const ONE = "M 400 110 L 440 110 L 360 190 L 320 190 Z";

/**
 * Animated FantaF1 logo.
 * - `sm`: only the F1 mark, 1em tall in the current text color (inside buttons, inline)
 * - `md` / `lg`: the full logo drawing itself in the accent color (sections, pages)
 * @param {Object} props
 * @param {"sm"|"md"|"lg"} [props.size="md"] - Loader size
 * @param {string} [props.label] - Text shown under the logo (md/lg only)
 * @param {string} [props.className] - Extra classes
 * @param {Object} [props.style] - Inline styles
 * @returns {JSX.Element} Loader
 */
export default function LogoLoader({ size = "md", label, className = "", style }) {
  const { t } = useLanguage();
  const a11y = { role: "status", "aria-label": label || t("common.loading") };

  if (size === "sm") {
    return (
      <span className={`fx-loader-sm ${className}`} style={style} {...a11y}>
        <svg viewBox="45 105 400 90" aria-hidden="true">
          <path d={UPPER_BAND} />
          <path d={LOWER_BAND} />
          <path d={ONE} />
        </svg>
      </span>
    );
  }

  return (
    <div className={`fx-loader is-${size} ${className}`} style={style} {...a11y}>
      <svg viewBox="0 0 500 250" aria-hidden="true">
        <text
          x="250" y="95" textAnchor="middle"
          fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
          fontWeight="900" fontStyle="italic" fontSize="90"
        >
          Fanta
        </text>
        <path d={UPPER_BAND} pathLength="1" />
        <path d={LOWER_BAND} pathLength="1" />
        <path d={ONE} pathLength="1" />
      </svg>
      {label && <span className="fx-loader-label">{label}</span>}
    </div>
  );
}

LogoLoader.propTypes = {
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  label: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
};
