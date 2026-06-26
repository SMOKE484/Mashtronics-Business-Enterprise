# Mashtronics — Session Handoff

**Date:** 2026-06-15  
**Branch:** main  
**Dev server:** `cd client && npm run dev` → http://localhost:5174

---

## What Was Built

A premium scroll-driven landing page replacing the old static site. The entire build lives inside `client/` (React + Vite). The design follows `mashtronics-design-prompt.md` — cinematic surveillance aesthetic, 800vh+ single-scroll page, editorial side-aligned layout, no glassmorphism, no cards.

---

## Current State

### Phase 1 complete (public site migration)
All 8 sections built and verified in browser. Light theme applied. ScrollHero text stacking fixed.

### Phase 2 not started
Backend (Express, MongoDB, JWT, pricing engine) has not been touched.

---

## Architecture

| Workspace | Stack | Status |
|-----------|-------|--------|
| `client/` | React 19 + Vite 8 | Active — home page fully built |
| `admin/` | React + Vite | Scaffolded, not developed |
| `server/` | Node.js + Express + Mongoose | Scaffolded, not developed |

---

## Files Changed This Session

| File | What changed |
|------|-------------|
| `client/index.html` | Google Fonts: Bebas Neue + IBM Plex Mono (replaced Poppins/Montserrat) |
| `client/src/index.css` | CSS variables flipped to light theme; scrollbar updated |
| `client/src/pages/Home.jsx` | Full rewrite — 8-section scroll page with all GSAP animations |
| `client/src/pages/Home.css` | Full rewrite — editorial styles, light theme, no glassmorphism |
| `client/src/components/Navbar.jsx` | CTA button scrolls to `#cta` instead of `#contact` |
| `client/src/components/Navbar.css` | Light navbar (white semi-transparent bg, dark text) |
| `client/src/components/ScrollHero/index.jsx` | Reveal threshold lowered (30→8 frames); timeline rewritten to fix text stacking |

**Not changed:** `WhyChooseUs`, `Gallery`, `Careers` pages, `Footer`, `admin/`, `server/`, `old-site/`

---

## Colour Palette (Current — Light Theme)

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#FAFBFC` | Page base |
| `--bg-alt` | `#EFF3F7` | Alternate sections (about, clients) |
| `--bg-deep` | `#F4F7FA` | Services, Why Us sections |
| `--text` | `#1E2D3C` | Body text |
| `--text-dim` | `#4B6478` | Labels, captions, dim text |
| `--dark` | `#1E2D3C` | Dark anchors, CTA bg |
| `--accent` | `#8CB822` | Lime green — all highlights, separators, counters |
| `--bg-cinematic` | `#08111A` | ScrollHero canvas background only |
| CTA section | `#1E2D3C` bg, `#EDF2F7` text | Stays dark for contrast |

---

## Fonts

- **Display:** Bebas Neue (Google Fonts CDN) — headings, stats, service names, marquee
- **Body/Labels:** IBM Plex Mono (Google Fonts CDN) — all body text, labels, CTA copy

---

## Home Page Section Map

| # | ID | Layout | GSAP animation |
|---|----|--------|----------------|
| 001 | `#hero` | Full vh, content bottom-left | Word-split stagger on load |
| — | `<ScrollHero />` | Full vh canvas, pinned 300vh | Circle-wipe reveal → frame scrub |
| 002 | `#about` | `.align-left` (42vw) | Slide-left |
| 003 | `#stats` | Centred | Scale-up + counter 0→target |
| 004 | `#services` | `.align-right` (42vw) | Clip-reveal per list item |
| 005 | `#marquee` | Full width | Horizontal scroll-driven translate |
| 006 | `#clients` | `.align-left` (42vw) | Slide-right + hover colour |
| 007 | `#why` | `.align-right` (42vw) | Stagger-up numbered list |
| 008 | `#cta` | Centred, pinned to bottom | Fade-up + data-persist pin |

---

## GSAP Setup

- **Lenis** smooth scroll: globally initialised in `client/src/main.jsx`, exposed as `window.lenis`
- **GSAP + ScrollTrigger**: globally registered; Lenis integrated via `lenis.on('scroll', ScrollTrigger.update)`
- **`@gsap/react` `useGSAP`**: used in `Home.jsx` with `scope: pageRef` — all animations live in one `useGSAP` block
- **Background shifts**: `gsap.to('body', { backgroundColor })` on `onEnter`/`onEnterBack` per section

### ScrollHero Timeline (fixed)
All three overlay texts are `position: absolute` at the same center. The fix was explicit non-overlapping timeline positions:
- text1: 0.5→2.5s (visible), 2.5→3.0s (fade out)
- text2: 3.5→5.5s (visible), 5.5→6.0s (fade out)
- text3: 6.5s→end (visible, stays)
- `scrub: 1` (was `scrub: true`) adds cinematic smoothing

---

## Canvas Frame Sequence

- 150 desktop frames at `client/public/frames/frame_0001.jpg` → `frame_0150.jpg`
- 75 mobile frames at `client/public/frames-mobile/frame_0001.jpg` → `frame_0075.jpg`
- Reveal threshold: 8 frames (desktop), 5 frames (mobile) — canvas appears fast
- Handled entirely by `client/src/components/ScrollHero/index.jsx`

---

## Client Logos

Five real client logos in `client/src/assets/images/`:
- `NTTDATA.jpg` — NTT Data
- `transnet.jpg` — Transnet
- `Samacor.jpg` — Samacor
- `RandWater.jpg` — Rand Water
- `STLM.jpg` — STLM

Filter at rest: `grayscale(1) brightness(0.5)` (dark on light bg)  
Filter on hover: `grayscale(0) brightness(1)` (full colour)

---

## Business Rules (from CLAUDE.md)

| Item | Rule |
|------|------|
| Residential CCTV packages | 4 cams R12,000 / 6 cams R14,000 / 8 cams R16,000 — fully installed, VAT incl. |
| Residential non-package | Supplier cost + 20% markup; install at 30% of marked-up materials; min R3,000 |
| Corporate | Supplier cost + 35% markup; install at 30%; min R5,000 |
| VAT | 15% — VAT number 4320284435 on every quote |
| Quote builder | On-screen only, server-side totals, no hardcoded prices in frontend |

---

## Contact Details

- Phone: 011 765 4148 | Mobile: 060 428 4818
- Email: walter@mashtronicsbe.co.za
- Address: Meadgate Unit 18B, Meadgate Centre, Kingfisher Street, Helderkruin, Roodepoort, 1724
- Domain: mashtronicsbe.co.za

---

## What's Next (Phase 2)

1. **Commit Phase 1** — git commit the completed home page build
2. **Backend foundation** (`server/`):
   - Express + MongoDB Atlas connection
   - Mongoose models: Quote, Package, PricingSetting, Enquiry, GalleryItem, Career
   - JWT auth for admin (httpOnly cookies)
   - Pricing engine (tests first) — must match business rules exactly
   - REST endpoints: `/api/packages`, `/api/quote`, `/api/enquiries`
3. **Verify inner pages** — check `/why-choose-us`, `/gallery`, `/careers` haven't broken due to font/colour changes in `index.css`
4. **Mobile QA** — test at 375px viewport; mobile ScrollHero frames path

---

## Known Issues / Watch Out For

- The `WhyChooseUs.html` in `pages/` (old static site) shows as modified in git status — this is the OLD static site in `old-site/`, not the React page. Do not delete `old-site/` until Phase 6.
- `css/main.css` also shows modified in git status — same old static site, leave it.
- ScrollHero will be blank until 8 frames load on the dev server (fast locally, slower on prod). The loading bar shows progress.
- The circle-wipe (`clipPath`) on `.scroll-hero` is applied from `Home.jsx`, not `ScrollHero/index.jsx`. This is intentional — keeps the wipe scoped to the page-level GSAP context.
- CTA pin uses `endTrigger: 'html', end: 'bottom bottom'` — it pins to the very bottom of the document.
