# Mashtronics Platform — Feature Roadmap

Phased build plan for the full Mashtronics platform: public website, admin dashboard,
Mashtronics Business Management System (MBMS), and the SecureWatch mobile app.
Business rules and dev commands live in [CLAUDE.md](CLAUDE.md); this file is the roadmap.

Decided: July 2026.

---

## Stack Decision (Option 1)

| Layer | Technology | Role |
|-------|-----------|------|
| System of record | MongoDB Atlas | **All** business data: clients, jobs, quotes, invoices, inventory, contracts, compliance docs |
| Business logic | Express API (`server/`) | Single source of truth — pricing, quote numbering, job workflow. Admin auth stays JWT in httpOnly cookies |
| Services layer | Supabase | **Services only, never a second business database.** Auth (SecureWatch client login), Storage (gallery images + complaint photos), Realtime (live job/status updates) |
| Mobile push | Expo Push Notifications | Replaces Firebase Cloud Messaging from the investment proposal |
| Mobile framework | React Native (Expo) | Single codebase for iOS and Android, in `mobile/` |
| ~~Firebase~~ | — | **Dropped from the stack entirely** (was never implemented in code) |

**Rule:** if data describes the business (a client, a job, money), it lives in MongoDB behind the
Express API. Supabase holds only files, client identities for the app, and realtime channels.

---

## Track A — Website Migration (Phases 3–6)

Continues the CLAUDE.md build phases. Phases 1 (public site) and 2 (backend foundation) are complete.

### Phase 3 — Admin dashboard completion
- Pricing settings management (markups, minimum charges, VAT display)
- Package management (create/edit/disable CCTV packages)
- Quote leads view (captured leads from the public quote builder)
- Remaining public pages: Services, Contact
- **Done when:** admin can change a package price and see it reflected via the API.

### Phase 4 — Public quote builder
- 4-step wizard on the public site wired to the live API
- Branded on-screen summary: logo, VAT number 4320284435, VAT amount, grand total, "estimate only" disclaimer, call to action
- Lead capture before totals are shown
- No hardcoded prices in the frontend; totals calculated server-side
- **Done when:** a real quote for each package type verifies with correct VAT and grand total.

### Phase 5 — Content modules
- Gallery upload via **Supabase Storage** (admin uploads, public site displays)
- Careers management (post/close vacancies)
- Enquiry form → `Enquiry` model, visible in admin
- **Done when:** admin manages all public content without code changes.

### Phase 6 — Deploy & handover
- API hosted + MongoDB Atlas production cluster
- Both frontends live on mashtronicsbe.co.za with HTTPS
- Retire `old-site/` and root static leftovers (index.html, css/, pages/, scripts/, PHPMailer/)
- **Done when:** live on the production domain.

---

## Track B — MBMS (Business Management System)

Follows the build order in the investment proposal §8.4. Extends the existing `server/`
(Mongoose models + routes) and `admin/` (React dashboard modules) workspaces.

### MBMS 1 — Operations core
- Client management: centralised client records, equipment history, contracts
- Job / work-order management: full lifecycle, real-time status
- Technician scheduling: assignment and calendar views
- New Mongoose models: `Client`, `Job`, `Technician`

### MBMS 2 — Revenue recovery
- Quote management: extends existing `Quote`/`Counter` models with follow-up tracking and conversion reporting
- Invoicing + payment tracking: auto-invoice on job completion, overdue reminders
- *The proposal calls this the single highest-return module — it closes the ~10% revenue leak.*

### MBMS 3 — Operational efficiency
- Inventory tracking: stock levels, per-job allocation
- Site & equipment records: installed equipment per site for faster diagnostics

### MBMS 4 — Contracts & compliance
- Maintenance contract scheduling: automated visit reminders (Transnet, Rand Water, STLM contracts)
- Compliance document tracking: B-BBEE, PSiRA, tax clearance expiry alerts

### MBMS 5 — Intelligence & integration
- Reporting dashboards: revenue, outstanding invoices, jobs, stock — Director and investor views
- SecureWatch integration endpoints: complaint → job creation, job status → app notification

---

## Track C — SecureWatch Mobile App

New `mobile/` workspace in this monorepo. React Native (Expo), Supabase services, Express API for business data.

**UI design prototype exists:** `mashtronics/` holds a clickable HTML/React (CDN + Babel standalone, no build step) mockup of the SecureWatch app — dark theme design system (`ui.jsx`), iPhone-frame preview (`ios-frame.jsx`), and 7 screens (home, cameras, activity, chat, profile, panic flow, complaint flow) with a live tweaks panel. Open `mashtronics/SecureWatch.html` directly in a browser to view it. The panic flow (arming countdown → active alert with map/timeline) and complaint/quote overlays are the most fully designed. This is reference design only — not React Native code — but it should be used as the visual/UX spec when SW1–SW2 are implemented, rather than designing those screens from scratch.

### SW 1 — Foundation
- Expo app scaffold in `mobile/`
- Supabase project setup: Auth, Storage buckets, Realtime channels
- Client login via Supabase Auth (admin auth stays JWT on the API — two separate identity systems by design)
- API client wired to `server/` endpoints

### SW 2 — Core safety & service features
- Panic button: live GPS alert to response team + SMS/push to personal emergency contacts
- Complaint logging: type, description, photo → Supabase Storage; auto-creates an MBMS job via the API
- Camera health dashboard: online/offline status per camera
- Installation tracker: live status via Supabase Realtime (technician on the way / in progress / completed)

### SW 3 — Full client experience
- Service history per property
- Subscription & contract info with renewal reminders
- SOS emergency contacts management
- In-app chat with the support team
- Quote requests from the app (feeds the same lead pipeline as the website)
- Expo push notifications for all alerts and status updates

### SW 4 — Live camera streaming (MVP: Dahua only)
- Live view, snapshot, recorded playback via Dahua's P2P/cloud relay (DEPP SDK/Open API — registration in progress, see `HANDOFF.md`)
- Server-mediated only: app never talks to camera devices directly; backend holds device credentials and proxies all camera actions (security decision from the 2026-07-10 Dahua hardware-integration research)
- Out of scope for MVP: PTZ, two-way audio, relay/gate control, facial recognition/ANPR, any non-Dahua vendor — see Future below

**Future — multi-vendor camera & security-system support (deferred past MVP, explicitly parked 2026-07-11):**
Installed client base is already mixed (Dahua, Hikvision, Bosch, Axis, Cathexis all confirmed present in the field), and the long-term positioning goal is vendor-agnostic client onboarding ("works with cameras you already have"), phased: Mashtronics-installed/supported brands first, bring-your-own-hardware later without a rebuild. `Camera.streamProvider`/`streamConfig` were already shaped as the adapter-selection seam for this. Architecture direction agreed so far: split vendor integration into a **session/reachability layer** (vendor-differentiated and hard — P2P/cloud relay access) and a **command-translation layer** (mechanical, per-vendor protocol formatting) — conflating these two was the main flaw found in an AI-generated research summary reviewed during this brainstorm.

Vendor research findings (2026-07-11):
- **Hikvision** — strongest second-vendor candidate: proven P2P (Hik-Connect) + confirmed third-party OpenAPI access (live view, playback, snapshot, alarm data, IO control), well-documented. ISAPI notably spans camera/NVR/access-control/alarm under one protocol.
- **Axis Communications** — most open public developer docs of any vendor (VAPIX, freely readable, no login wall), but its cloud remote-access API (Axis Cloud Connect) is "early access, selected partners" only — not buildable on demand today. (Was mistakenly referred to as "Axxis" and assumed alarm-specialist earlier in this research — it's actually a camera-first vendor with a separate access-control API line.)
- **Bosch** — has a real RCP+ protocol and a free outbound-only Remote Portal cloud service, but no confirmation either is exposed to third-party developers vs. Bosch's own apps only. Notably splits camera/access-control/intrusion-alarm into three separate SDKs, not one unified API.
- **Cathexis** (SA-based VMS) — weakest reachability story of the five: no confirmed default vendor-hosted P2P/cloud layer; listed remote-access options include port forwarding/UPnP, which were already ruled out on security grounds for Dahua.
- Whether "alarm/access-control" belongs in scope alongside cameras at all is unresolved — flagged mid-brainstorm as a much bigger scope jump (new data model, new event taxonomy, higher liability for remote arm/disarm) than originally framed, worth a deliberate scoping pass rather than folding in by default.

---

## Ordering

1. **Track A finishes first** — Phases 3–6 are in flight and the public site is the lead-generation engine.
2. **Track B starts alongside Phases 5–6** — MBMS 1–2 are the proposal's Day-1 priority (stop the revenue leak).
3. **Track C starts after MBMS 1–2 exist** — the app needs clients and jobs in the system to integrate with. Matches the proposal's residential rollout in Q3 of Year 1.
