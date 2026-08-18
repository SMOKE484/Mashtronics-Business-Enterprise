# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Mashtronics Platform — Claude Code Context

## Workflow Rules (always follow, every session)

1. **Bugs: investigate before fixing.** When told about a bug, do not rush to patch it. First investigate and find the actual root cause, then propose the fix. The fix must be the correct, permanent fix — not a workaround or a fix that only masks the symptom.
2. **New features: plan before editing.** When asked for a new feature, do not jump straight into code. First lay out the plan — approach, files/areas touched, tradeoffs — and get alignment before making changes.
3. **Test after every fix.** After applying any fix, verify it works AND that no existing functionality broke — run relevant tests (and the broader suite when touching shared code) before calling the work done.
4. **All logic/functionality needs tests.** Every piece of business logic or functionality must have unit tests and integration tests. When adding new functionality, add tests for it as part of the same change — not as a follow-up. Cover edge cases, not just the happy path — invalid/missing input, boundary values, empty/null states, concurrent or out-of-order events, permission/auth failures — whatever is plausible for that piece of logic.
5. **Verify UI changes actually work.** Any change touching `client/`, `admin/`, or `mobile/` UI must be checked hands-on before it's called done — run the dev server and exercise the changed screen/flow in a browser (or Expo Go for mobile), not just type-check or unit-test it. Check the golden path and edge cases (empty states, long/overflowing content, error states), and watch for regressions in nearby UI, not just the thing that changed.
6. **Log every bug in `BUGS_AND_FIXES.md`** (repo root). When a bug is found, add an entry; when it's fixed, record the fix in that same entry. Before fixing a new bug, check this file so a previously-fixed bug doesn't get silently reintroduced.
7. **Update `HANDOFF.md` every 10-15 messages, and remind the user to start a new chat.** Proactively keep it current so a new chat can pick up the work without re-deriving context or hallucinating state — don't wait to be asked. Once it's updated, tell the user it's a good point to start a fresh chat so the next session isn't dragging a bloated context window.
8. **Hard-to-pin-down bugs: add logging to trace the real execution path before guessing at a fix.** When a bug's root cause isn't obvious from reading the code alone (e.g. something that appears to hang, fails silently, or only reproduces intermittently), add temporary diagnostic logging at the suspected points of failure and have the user reproduce it, rather than proposing fixes on speculation. Use what comes back to narrow down the actual cause before changing behavior. Keep the logging afterward if it has ongoing diagnostic value (e.g. a previously-silent failure path); strip it out if it was purely one-off scaffolding.
9. **Kill any dev server you started once you're done with it.** If you start `server/` (port 3001), `client/`/`admin/` (Vite), or `expo start` (port 8081) to verify a fix or feature, stop that process before ending the turn/session — find the PID holding the port (e.g. `netstat -ano | grep :3001`) and kill it, don't leave it running in the background. A stale process left holding a port makes the user's next `npm run dev` fail with `EADDRINUSE` and crash-loop under nodemon. Exception: if the user explicitly asks you to leave a server running (e.g. for their own manual testing), say so back to them and leave it — don't kill it in that case.

## UX Rules (applies to all UI: client/, admin/, mobile/)

**UI is what the app looks like; UX is how it behaves.** Good UI (colors, buttons, layout) attracts people; good UX keeps them. A beautiful app that's hard to use still loses users — friction causes people to leave, while predictable, graceful behavior builds trust in the product.

- **Every action must have a visible, predictable result.** A button that does nothing visible when clicked makes users retry, get confused, blame themselves, and leave. If something fails, the user finds out gracefully — never silently.
- **Never build only the happy path.** AI tools default to building what the screen looks like when everything goes perfectly. The builder knows the app inside-out and unconsciously uses it "correctly" — real users won't. Deliberately build for the user who takes the wrong path: the loading state, the empty state, the error state.
- **Users should be able to figure out what to do without instructions.** If a flow needs explaining, the flow is the problem.

### Loading states

**Every screen has four states, and all four must be designed and built: Loading, Success, Error, and Empty.** Don't ship a screen that only handles the success case — users hit the other three constantly, and a missing state reads as a broken app.

A good loader is invisible in the sense that users don't consciously notice it — but when it's *missing*, they notice immediately and assume something is broken. (Skeleton screens work because the brain starts processing the layout before the data arrives.)

Match the loading feedback to how long the wait actually is:

| Expected wait | What to show |
|---|---|
| < 1 second | Nothing — just show the result. A spinner that flashes for a split second makes the app feel *slower* and glitchy. |
| 1–5 seconds | A plain spinner (no text) is fine. |
| 5–10 seconds | Spinner + text. Static text ("Loading…", "Saving…") buys a little patience; **changing** text ("Connecting to your account…" → "Almost there…") buys significantly more, because it feels like progress is happening. |
| > 10 seconds | Looped animations stop working and start actively frustrating users — switch to a progress bar, step-by-step indicator, or similar determinate feedback. |

- Never show a blank screen with no feedback — users abandon within 2–3 seconds.
- On failure, surface the error immediately. Never leave the user staring at a spinner for 20 seconds only to then say "sorry, that didn't work."

Pick the loading pattern by what kind of thing is loading:

| Pattern | When to use it |
|---|---|
| Skeleton screen | A whole page or large content section is loading (feeds, lists, dashboards). Shows the layout first — "the structure is here, the data is coming" — then content fills in. |
| Progress bar | The duration/progress is knowable: file uploads, downloads, installs. Users need to see how far along they are; a spinner on an upload reads as "stuck". |
| Inline spinner | Small, contained actions — a button just clicked, one widget refreshing. A local "we're working on it", not a whole-page takeover. |
| Optimistic UI | Low-risk, likely-to-succeed actions (likes, toggles, marking read): apply the change in the UI immediately, sync with the server in the background, and roll back with a notice if it fails. Feels instant. |

### Graceful degradation (sections load and fail independently)

A page looks like one thing, but its sections usually come from different sources loading at different speeds (profile from one endpoint, feed from another, charts from a third). Like ordering delivery from three restaurants: if one order is late or missing, you don't throw away the food that arrived — you eat what showed up. **The app keeps working with whatever it has.**

- **Show what's ready as it becomes ready.** Don't gate the whole page behind a single loading screen that waits for every component — render the sidebar while the charts are still loading, the stories while the feed is coming in.
- **Each section owns its own data, its own loading state, and its own errors.** The profile section fetches its data; the feed fetches its own. If a section fails, it shows its *own* error message with its *own* retry button — one failed data source must never take down the whole page into a full-page error; the rest stays completely usable.
- **Serve cached/stale content while fresh content loads in the background.** Instagram's feed appears instantly because it's showing cached photos/videos from earlier; when the fresh data is ready it swaps in seamlessly — the user has been scrolling the whole time and never notices. Where a cached version of data exists, show it immediately rather than a loader, then refresh behind the scenes.
- **Plan for partial failure from the start**, in both design and development: build sections to operate individually, decide up front what the page looks like when some sections work and others don't, and make that state feel as seamless as possible.

### Success states

When an action completes — pressing a button, liking a photo, submitting a payment — the user must *know* it worked. Think of booking a flight: you pay a few hundred dollars, click Confirm, and… nothing happens. Did it go through? Did it charge me? Should I press it again? That uncertainty is the worst feeling for a user, and even a small success confirmation completely changes how they feel.

- **Scale the confirmation to the significance of the action.** Big moments (finishing a major task, a first milestone) can earn a full celebratory treatment — but don't overdo it or it loses meaning.
- **Most confirmations should be small, intuitive signals** — a quiet "yep, that worked". Often the cleanest confirmation is the visible result of the action itself: a card dragged from To-do to Done slides over and *stays* there — no banner needed, you just know.
- Pick by weight: high-stakes/ambiguous outcomes (payments, submissions) need an explicit confirmation; low-stakes actions need only the state change itself to be visible.

### Error states

A good error message does three things: **what happened, why it happened, and what to do next.** Instead of "Something went wrong" on a payment, say: "Your payment did not go through — your card was declined. Please check your card details or try a different payment method." The user knows exactly what happened, why, and what's next.

- **Never dump raw database/backend errors on screen.** A regular person can't parse them, and exposing backend internals (stack traces, query text, framework messages) is a security vulnerability. Log the technical detail server-side; show the user a human message.
- **But don't over-correct to a bare "Something went wrong" either.** It's especially bad when the outcome is ambiguous — after a payment or submission, the user must be told whether the action went through or not.
- **The worst error is a silent failure** — the user clicks submit, the button does nothing, the screen doesn't change, and they can't tell if it worked or broke. Every failure path must produce visible feedback. (AI tools generate silent failures by default unless explicitly told otherwise — check for this in generated code.)

**Error placement — choose by severity and proximity.** General rule: the closer the error appears to the thing that went wrong, the better.

| Placement | When to use it |
|---|---|
| Inline (right next to the source) | The default — use most often. Form fields: red border + message on the field needing attention. Action failures: right next to the button just clicked (Save fails → "Try again" appears beside Save — the user's eyes are already there). |
| Toast (pops at top/bottom, auto-dismisses in seconds) | Only for messages the user can safely miss. Litmus test: if they look away and miss it, are they still okay? Good for transient/self-resolving info like "Couldn't connect, retrying…". Never use a toast for an important error. |
| Modal (takes over the screen, blocks until addressed) | Sparingly — only when the user cannot continue without addressing the issue (payment failed, no access to this project). If you block the user, you MUST give a way forward: an action button ("Update payment method", "Request access"), never a dead-end message. |

### Empty states

Empty states aren't glamorous to build, but they're often the **first thing a new user sees** — a fresh account has no data anywhere. Make a good first impression. A good empty state does three things: **tells the user why it's empty, shows them what to do next, and doesn't feel broken.**

- **Never leave a blank screen or a bare "no items" message.** "You have no projects" with no action strands the user — they don't know what to do. Pair every empty state with the action that fills it: "Create your first project" + button, right there. For first-run onboarding, consider step-by-step (even gamified) guidance to get them started.
- **Every section of the app that doesn't have content yet** needs this treatment — say what the section is for and how to start using it, don't just render nothing.
- **Empty search results should keep the user moving.** Not just "No results" — say what was searched ("No results for *purple shoes*") and offer a next step, e.g. a suggested/corrected term as a clickable link that runs that search.
- **When empty is the goal, celebrate it.** Inbox-zero-style moments (all mail cleared, all jobs completed, no outstanding compliance items) should feel like an achievement — a pleasant animation or visual the user looks forward to seeing, not the same void as "no data yet".

### Forms

Nobody likes filling out forms — reduce the friction:

1. **Disable submit until the form is valid** — but make it obvious *why*: mark required fields clearly so the user is never guessing what's missing. A grayed-out button with no explanation is more frustrating than no gating at all.
2. **Validate inline, on field blur.** The moment someone leaves an email field with an invalid address, tell them — don't let them fill everything out, submit, wait for a load, and then scroll back up to hunt for the mistake.
3. **Show a live character count** on any field with a length limit, while they type — never let someone paste a paragraph and only then discover it gets cut off.
4. **Prefill what you already know.** If the user is logged in, don't make them retype their email or other info already on file.
5. **Show password requirements as they type**, checking off each rule as it's met — never reject a password only after submit ("needs a capital letter") when you could have said so live.

**Labor illusion — the one exception to "faster is better".** When a result represents high-stakes or thorough-feeling work, an instant answer can *undermine* trust: users rate a service higher when they see the effort (a travel site "searching each airline one by one" was rated better than instant identical results; TurboTax deliberately shows "checking for any possible tax breaks…" on a near-instant check, because a half-second tax return wouldn't feel trustworthy). Where this could apply here: quote calculation, compliance checks — a brief staged "working through it" moment that names what's being checked can make the result feel more credible. Use sparingly and keep it short (the duration rules above still apply); most loading should never be artificially padded.

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
| mobile/ (planned) | React Native (Expo), Supabase | SecureWatch client app — see features.md Track C |

- Stack decision (July 2026): MongoDB is the single system of record for all business data; Supabase is a services layer only (SecureWatch client auth, file storage, realtime); Expo Push for mobile notifications; Firebase dropped entirely. Full roadmap in `features.md`
- JWT in httpOnly cookies for admin auth; public quote builder requires no login
- Gallery images & complaint photos → Supabase Storage
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
