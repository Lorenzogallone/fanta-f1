/**
 * @file Disclosure.jsx
 * @description A section folded behind its title, opening with a grow animation (see .fx-disclosure in motion.css).
 * Used by the admin tabs to keep tools out of the way until needed.
 */

import React, { useId, useState } from "react";
import PropTypes from "prop-types";

/**
 * @param {Object} props
 * @param {React.ReactNode} props.title - Row title (always visible)
 * @param {React.ReactNode} [props.hint] - Short text next to the title, e.g. a status
 * @param {boolean} [props.defaultOpen=false] - Start open
 * @param {string} [props.className] - Extra classes on the wrapper
 * @param {React.ReactNode} props.children - Content shown when open
 * @returns {JSX.Element} Disclosure
 */
export default function Disclosure({ title, hint, defaultOpen = false, className = "", children }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className={`fx-disclosure${open ? " is-open" : ""} ${className}`}>
      <button
        type="button"
        className="fx-disclosure-head"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="fx-disclosure-title">{title}</span>
        {hint && <span className="fx-disclosure-hint">{hint}</span>}
        <span className="fx-disclosure-chevron" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      <div className="fx-disclosure-body" id={id} aria-hidden={!open}>
        <div>
          <div className="fx-disclosure-content">{children}</div>
        </div>
      </div>
    </div>
  );
}

Disclosure.propTypes = {
  title: PropTypes.node.isRequired,
  hint: PropTypes.node,
  defaultOpen: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};
