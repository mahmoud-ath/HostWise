# HostWise Landing Page

A standalone, production-quality marketing page for **HostWise**, the
local-first desktop app for vacation-rental hosts. Lives at the repo root
(same level as `docs/`) so it can be deployed independently of the desktop app
frontend.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS 3.4
- `@phosphor-icons/react` (icons)
- `next/font` (Instrument Serif / Manrope / Inter / Cabin)

## Run it

```bash
cd landing
bun install
bun run dev          # http://localhost:3000
```

## Checks

```bash
bun run lint         # next lint
bun run typecheck    # tsc --noEmit
bun run build        # production build
```

## Structure

```
landing/
  public/logo.png            # official HostWise mark (copied from frontend)
  src/app/layout.tsx         # fonts + metadata + theme lock (dark)
  src/app/page.tsx           # page assembly
  src/app/globals.css        # tokens, keyframes, reduced-motion gating
  src/components/
    Navbar.tsx               # transparent nav + mobile menu (a11y)
    Hero.tsx                 # video hero (badge, headline, subtext, CTAs)
    HeroVideo.tsx            # muted autoplay video + gradient fallback
    AnnouncementBadge.tsx    # glass pill
    Logo.tsx / Reveal.tsx / Footer.tsx
    sections/                # Features, Analytics, Reports, HowItWorks, Contact
  src/lib/links.ts           # real destinations (GitHub Releases, issues, email)
  src/lib/constants.ts       # hero video URL + fallback gradient
```

## Notes

- **Conversion links are real.** HostWise is a local-first desktop app with no
  hosted web instance yet, so `Get HostWise`, `Sign In`, and `Get Started`
  all point at the GitHub Releases download. When a hosted build / sign-in
  ships, update `src/lib/links.ts`.
- **Theme is locked dark** (hero sits over video; all sections stay in the
  same dark-purple family).
- **Hero video** is muted + playsInline with a gradient fallback behind it.
  If mobile performance ever suffers, add a `poster` still in `HeroVideo.tsx`.
- **Below-fold sections** currently use typography + iconography (no product
  screenshots exist yet). Swap in real app screenshots under `public/` when
  available.
