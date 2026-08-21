# HostWise — Marketing Site

A multi-page marketing site for **HostWise**, the local-first desktop app for
vacation-rental hosts. Lives at the repo root (same level as `docs/`) so it can
be deployed independently of the desktop app.

Pages (hash-routed, no router dependency):

- `#/` home: hero (boomerang video) + philosophy manifesto + screenshot gallery +
  powerful features + distro download + FAQ
- `#/docs`: Bun-inspired documentation (searchable sidebar, scroll-spy, code blocks)
- `#/feedback`: feedback form (opens prefilled email) + GitHub issues
- `#/404` (or any unknown `#/...`): creative architectural floor-plan 404 page

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS 3.4
- `lucide-react` (icons)
- `gsap` + ScrollTrigger (gallery entrance, philosophy word-reveal; honors
  `prefers-reduced-motion`)
- Fonts loaded in `index.html`: P22 Mackinac (serif display) + Inter (UI)

## Run it (bun)

```bash
cd landing
bun install
bun run dev          # http://localhost:5173
```

## Checks

```bash
bun run typecheck    # tsc --noEmit
bun run build        # typecheck + vite build (outputs to dist/)
bun run preview      # serve the production build
```

## Structure

```
landing/
  index.html                    # fonts + metadata
  public/
    logo.png                    # official HostWise mark (app/frontend/public/logo-1024.png)
    screenshots/*.jpg           # real app screenshots (resized 1600w)
    downloads/README.md         # where to drop installers (served at /downloads/*)
  src/
    main.tsx                    # React entry
    App.tsx                     # hash-router + page assembly
    index.css                   # Tailwind + Inter body + scrollbar-hide helper
    lib/
      constants.ts              # HERO_VIDEO_URL (user-managed) + tagline
      links.ts                  # real destinations (GitHub releases / repo / email / issues)
      router.ts                 # useHashRoute(): home | docs | feedback
      navigation.ts             # navigateToSection / scrollToId
    components/
      HostWiseLogo.tsx          # official HostWise logo image
      Navbar.tsx                # fixed transparent nav (section + page links)
      HostWiseVideoBg.tsx       # capture-to-canvas boomerang video background
      Hero.tsx                  # full-viewport hero (headline + CTA -> #product)
      Footer.tsx
      sections/
        Gallery.tsx             # horizontal snap gallery + lightbox (7 screenshots)
        Download.tsx            # distro cards (macOS / Windows / .deb / AppImage / AUR)
        Philosophy.tsx          # word-by-word scroll manifesto
        Faq.tsx                 # accessible <details> accordion
    pages/
      Docs.tsx                  # documentation (TOC sidebar + content)
      Feedback.tsx              # feedback form + support options
```

## Notes

- Brand tokens: ink `#191919` on white, HostWise accent purple `#7B39FC` used
  sparingly, soft surface `#F4F3F3`, borders `#E5E5E5`.
- Hero background is a capture-to-canvas boomerang: `HERO_VIDEO_URL` plays
  once while every frame is captured to offscreen canvases (960px cap), then
  ping-pongs forward -> reverse at 30fps on a display canvas. Honors
  `prefers-reduced-motion` (static first frame); falls back to a native loop
  if capture fails.
- Download distros link to **local installers** served from this site
  (`/downloads/*`), with filenames built from `DOWNLOAD_VERSION` in
  `src/lib/constants.ts` (currently 0.8.2). Drop built files into
  `public/downloads/` using the names listed in its README. macOS dmg, Windows
  exe, Linux .deb / .rpm / AppImage, and AUR `hostwise-bin` (Arch/Manjaro).
- Docs (`#/docs`) is a **user-facing guide** (not dev docs): overview,
  installation by OS, first run, importing data, dashboard & analytics,
  reports, AI Advisor, backups, FAQ, contact & licensing — written for hosts
  and buyers, with the Bun-inspired searchable sidebar + scroll-spy layout.
- Section anchors on home use `navigateToSection` (works cross-page); page
  routes use `#/docs` and `#/feedback`. Conversion path is the GitHub Releases
  download (`LINKS.download`).
