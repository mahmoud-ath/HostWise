import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

gsap.registerPlugin(ScrollToPlugin);

const HEADER_OFFSET = 96;

function prefersReduced() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Smooth-scroll to an element id using GSAP's ScrollToPlugin, offset for the
 * floating pill header (and any sticky page toolbar via `offset`). Falls back
 * to an instant native scroll for prefers-reduced-motion.
 */
export function scrollToId(id: string, offset = HEADER_OFFSET) {
  const el = document.getElementById(id);
  if (!el) return;
  if (prefersReduced()) {
    el.scrollIntoView({ behavior: "auto", block: "start" });
    return;
  }
  gsap.to(window, {
    duration: 1.2,
    scrollTo: { y: el, offsetY: offset },
    ease: "expo.inOut",
  });
}

/**
 * Scroll to a section id. If the element is not mounted yet (e.g. we are on a
 * different route), go home first and scroll once it has rendered.
 */
export function navigateToSection(id: string) {
  if (document.getElementById(id)) {
    scrollToId(id);
    return;
  }
  window.location.hash = "/";
  window.setTimeout(() => scrollToId(id), 80);
}
