/**
 * @file useScrollReveal.js
 * @description Reveals cards and list rows as they scroll into view (see .fx-reveal in motion.css).
 * One IntersectionObserver for the whole app; a MutationObserver picks up elements rendered later.
 */

import { useEffect } from "react";
import { isSplashActive } from "../utils/splash";

/** What gets revealed: cards, race cards, admin rows, results and leaderboard rows */
const SELECTOR = [
  ".fx-card",
  ".admin-list > .list-group-item",
  ".results-page .res-list-row",
  ".leaderboard-card tbody tr",
].join(",");

/** Elements nested in a revealed one would otherwise animate twice */
const isNested = (el) => el.parentElement?.closest(SELECTOR) != null;

/**
 * Tags matching elements with .fx-reveal and adds .is-in once they enter the viewport.
 * Siblings entering in the same frame are staggered through --fx-i.
 */
export function useScrollReveal() {
  useEffect(() => {
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        let i = 0;
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.style.setProperty("--fx-i", String(Math.min(i++, 8)));
          el.classList.add("is-in");
          // After the transition the delay is dropped, so taps feel immediate
          setTimeout(() => el.classList.add("is-done"), 1400);
          io.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );

    const tag = (root) => {
      const nodes = root.matches?.(SELECTOR) ? [root] : [];
      root.querySelectorAll?.(SELECTOR).forEach((n) => nodes.push(n));
      nodes.forEach((el) => {
        if (el.classList.contains("fx-reveal") || isNested(el)) return;
        el.classList.add("fx-reveal");
        io.observe(el);
      });
    };

    const untag = (root) => {
      if (root.matches?.(".fx-reveal")) io.unobserve(root);
      root.querySelectorAll?.(".fx-reveal").forEach((n) => io.unobserve(n));
    };
    const mo = new MutationObserver((muts) => {
      muts.forEach((m) => {
        m.addedNodes.forEach((n) => n.nodeType === 1 && tag(n));
        m.removedNodes.forEach((n) => n.nodeType === 1 && untag(n));
      });
    });

    // Under the splash nothing is tagged: the first page reveals as the splash fades
    const start = () => {
      tag(document.body);
      mo.observe(document.body, { childList: true, subtree: true });
    };
    if (isSplashActive()) window.addEventListener("fantaf1:splash-hidden", start, { once: true });
    else start();

    return () => {
      window.removeEventListener("fantaf1:splash-hidden", start);
      mo.disconnect();
      io.disconnect();
    };
  }, []);
}
