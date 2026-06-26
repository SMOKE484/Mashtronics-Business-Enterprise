# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Mashtronics Platform — Claude Code Context

## Dev Commands

| Task | Command |
|------|---------|
| Client dev server | `cd client && npm run dev` (http://localhost:5174) |
| Server dev | `cd server && npm run dev` (http://localhost:3001) |
| Server tests | `cd server && npm test` |
| Seed database | `cd server && node scripts/seed.js` |
| Client build | `cd client && npm run build` |

## Business Rules (Source of Truth)

| Item | Rule |
|------|------|
| Residential CCTV packages | 4 cameras R12,000 \| 6 cameras R14,000 \| 8 cameras R16,000, all fully installed (NVR, HDD, cameras, cabling, accessories), prices include VAT |
| Residential pricing model (non-package) | Supplier material cost + 20% markup; installation at 30% of marked-up materials; minimum installation charge R3,000 |
| Corporate pricing model | Supplier material cost + 35% markup; installation at 30% of marked-up materials; minimum installation charge R5,000 |
| VAT | 15% — VAT number 4320284435 must appear on every quote |
| Quote output | On-screen only (no email/WhatsApp in Phase 1), branded with logo, "estimate only" disclaimer, call to action: 011 765 4148 / mashtronicsbe.co.za |

**The quote builder must never contain hardcoded prices; all pricing comes from the API per section 5 of the migration plan.**

Every quote must show VAT amount and grand total explicitly. Totals are always calculated server-side.

## Architecture

| Workspace | Stack | Purpose |
|-----------|-------|---------|
| server/ | Node.js, Express, Mongoose, MongoDB Atlas | REST API — public site, admin dashboard, future SecureWatch app |
| client/ | React (Vite), React Router, plain CSS | Public website: home, services, gallery, careers, contact, quote builder |
| admin/ | React (Vite), React Router | Admin dashboard: pricing, packages, quote leads, gallery, careers, enquiries |

- JWT in httpOnly cookies for admin auth; public quote builder requires no login
- Gallery images → Firebase Storage
- Quote numbers start at Q1004 (counters collection, atomic increment)
- CORS: `credentials: true` + `withCredentials` on client fetches — required for httpOnly JWT cookie in dev
- Pricing engine: pure functions in `server/services/pricing.js` — no DB calls, fully unit-testable
- Chatbot: DeepSeek SSE proxy in `server/routes/chat.js`, widget in `client/src/components/ChatBot/`

## Build Phases

| Phase | Scope | Done when |
|-------|-------|-----------|
| 1. Public site migration | Monorepo scaffold, React+Vite in client/, migrate pages one-by-one, brand colours, responsive, React Router, SEO basics | Feature parity with static site, every page verified in browser, no quote builder |
| 2. Backend foundation | Express, MongoDB models, JWT auth, pricing engine (tests FIRST) | All API endpoints pass tests; pricing engine matches business rules exactly |
| 3. Admin dashboard | Login, quote leads, pricing settings, package/service management | Admin can change a package price and see it via API |
| 4. Quote builder | 4-step wizard wired to live API, branded summary, lead capture | Real quote for each package type with correct VAT and grand total, no prices in frontend |
| 5. Content modules | Gallery upload, careers, enquiry form | Admin manages all public content without code changes |
| 6. Deploy & handover | API + MongoDB Atlas, both frontends, mashtronicsbe.co.za, HTTPS | Live on production domain |

## Phase 1 Rules (Complete)
- Brand colours in use: `--primary: #1F4E78`, `--dark: #1E2D3C` (see `client/src/index.css`)
- The old static site (old-site/) is the reference; do not delete it until Phase 6

## Contact / Identifiers
- Phone: 011 765 4148 | Mobile: 060 428 4818
- Email: walter@mashtronicsbe.co.za
- Domain: mashtronicsbe.co.za
- Address: Meadgate Unit 18 B, Meadgate Centre, Kingfisher Street, Helderkruin, Roodepoort, 1724
