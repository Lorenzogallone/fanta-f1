/**
 * @file splash.js
 * @description Utility to gracefully fade out and remove the global splash screen
 */

let splashRemoved = false;

/**
 * Hides and removes the global splash screen (#global-splash).
 * Safe to call multiple times.
 */
export const hideSplash = () => {
    if (splashRemoved) return;

    const splashEl = document.getElementById("global-splash");
    if (splashEl) {
        // Remove the .active class to trigger the CSS opacity transition
        splashEl.classList.remove("active");
        splashRemoved = true;

        // Wait for the transition (0.5s) before removing from DOM
        setTimeout(() => {
            if (splashEl.parentNode) {
                splashEl.parentNode.removeChild(splashEl);
            }
        }, 500);
    }
};
