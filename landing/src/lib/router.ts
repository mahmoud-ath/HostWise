import { useEffect, useState } from "react";

export type Route = "home" | "docs" | "feedback" | "notfound";

export type RouteState = { route: Route; guideId: string | null };

function parseHash(hash: string): RouteState {
  // Guide sub-pages: #/docs/<module> (e.g. #/docs/dashboard)
  if (hash.startsWith("#/docs/")) {
    const id = hash.slice("#/docs/".length).split("/")[0].toLowerCase();
    return { route: "docs", guideId: id || null };
  }
  if (hash.startsWith("#/docs")) return { route: "docs", guideId: null };
  if (hash.startsWith("#/feedback")) return { route: "feedback", guideId: null };
  if (hash === "#/" || hash === "#" || hash === "") {
    return { route: "home", guideId: null };
  }
  // Unknown "#/..." pages fall through to the 404.
  if (hash.startsWith("#/")) return { route: "notfound", guideId: null };
  // In-page anchors like "#product" keep us on the home page.
  return { route: "home", guideId: null };
}

/**
 * Minimal hash-based router. Page routes look like #/docs, #/docs/<module>
 * and #/feedback; any other hash (e.g. a home section anchor) keeps us on
 * "home".
 */
export function useHashRoute(): RouteState {
  const [state, setState] = useState<RouteState>(() =>
    parseHash(window.location.hash)
  );

  useEffect(() => {
    const onChange = () => setState(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return state;
}
