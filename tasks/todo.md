# getchunks v3.1 — SI design system + hardening

**Goal:** Adopt the Search Influence design system just launched on AI Website Grader and Ontologizer, and fix the bugs/security issues found in the 2026-07-21 full code review.

**Provenance note:** The grader's stylesheet is literally titled "GetChunks Design System — AI Website Grader" and ontologizer's tokens cite the grader as the canonical source. The theme started here and matured there; this brings it home. The grader kept getchunks' class names (`.header-content`, `.form-card`, `.view-toggle`, `.results-header`…), so this is a CSS swap, not a markup rewrite.

**Structure:** Two branches / two PRs so review stays clean:
1. `feature/si-design-system` — visual only, no behavior change
2. `fix/hardening-and-bugs` — security + bug fixes, no visual change

---

## Questions needing Will's decision before/while executing

- [ ] **GTM ID:** Committed ID is `GTM-4G43` (public/index.html:18) — 4 chars is short for a container ID. Confirm it's the real, complete ID. If yes, proposal: hardcode it and delete scripts/build.js + the vercel buildCommand entirely (GTM IDs are public; the injection step is what caused the source-mutation mess).
- [ ] **Rate limiting:** Approve enabling a Vercel WAF rate-limit rule on `/api/*` (dashboard config, zero code)? Code-level limiting in serverless is per-instance and mostly theater.
- [ ] **Legacy design files:** `getchunks-patterns.js`, `getchunks-styles.css`, `search-influence-*.{html,css}`, the two GUIDE.md files (~1,900 lines, unused by the app). Move to `docs/legacy/` or delete?

---

## PR 1 — `feature/si-design-system`

Source of truth: `ai-website-grader/app/globals.css` + `ontologizer-next/app/styles/tokens.css` (identical palettes).

### Tokens & typography
- [ ] Add the canonical SI `:root` token block to the inline `<style>` (si-dark-navy `#012c3a`, si-navy `#014a61`, si-orange `#f07a18`, si-slate `#34495e`, hero gradient `#43566d→#3c4e63`, report-green `#24ab59`, header-accent `#f28a22`, content/border/muted grays — copy verbatim from tokens.css)
- [ ] Add Open Sans (400/700/800) via Google Fonts `<link>` with preconnect; set `--font-stack` to match the other apps
- [ ] Replace all hardcoded legacy colors (`#2c3e50`, `#34495e`, `#e67e22`, `#f39c12`, `#3498db`, `#27ae60` gradients) with token references

### Component restyle (match grader 1:1)
- [ ] Body → si-dark-navy; main-section → si-slate
- [ ] Header → 90° hero gradient, 2px header-accent bottom border, drop the `::before` overlay; h1 3rem/800; tagline header-accent
- [ ] Form card → flat `--surface-slate` (#405466) with subtle border; drop glassmorphism blur + hover lift
- [ ] Inputs → white/6 bg, white/16 border, orange focus ring (grader's exact focus treatment)
- [ ] Extract button → flat si-orange, hover `--orange-dark` (#d96610), weight 800; drop gradient
- [ ] Results header → flat report-green (#24ab59); drop gradient
- [ ] Summary cards → repaint from blue gradient to grader surface treatment (si-medium-blue for info accents)
- [ ] Chunk badges, blockquote accents, small-chunk index → si-orange
- [ ] Feedback widget → `--orange-accent` now resolves to si-orange; modal bg → surface-slate
- [ ] Features + FAQ sections → grader treatment (flat cards on si-slate, 800-weight headings)
- [ ] Footer → si-dark-navy, orange links
- [ ] Serve the SI logo locally in `public/` instead of hotlinking searchinfluence.com wp-content (copy asset from grader)
- [ ] Version comments → 3.1.0
- [ ] Visual QA at 375px / 768px / desktop; verify all three views (Webpage/Chunks/JSON) + modal

## PR 2 — `fix/hardening-and-bugs`

### Security (ranked)
- [ ] **SSRF guards** in api/chunk.js: allow only `http:`/`https:`; resolve hostname and reject private/reserved ranges (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7); cap response at ~5MB; require `text/html`-ish content-type
- [ ] **Rate limiting** via Vercel WAF rule on `/api/*` (pending approval above)
- [ ] **escapeHtml quote fix** (index.html:1998): escape `"` too; audit the two attribute sinks (`title=` at :1943 — scraped-page XSS vector, `href=` at :1880)
- [ ] **Slack injection** (feedback.js): escape `&`, `<`, `>` in message/email/pageUrl before building blocks (kills `<!channel>` pings and link spoofing)
- [ ] **Error leak** (chunk.js:57): stop returning raw `error.message`; log server-side, return generic message + safe category
- [ ] **Input validation**: allowlist `chunkSize`/`strategy`/`tokenizer`/`format`; reject bad values with 400 instead of 500

### Bugs
- [ ] **Overlap slider stuck on Auto** (index.html:1528-1537): unreachable else branch — rework so dragging to a nonzero value exits auto mode, 0 returns to it
- [ ] **Dead fetch timeout** (chunk.js:84): node-fetch v3 ignores `timeout:` — replace with `AbortSignal.timeout(25000)`; drop node-fetch for native fetch (engines already >=18), removing a dependency
- [ ] **"Defuddle only" honored** (chunk.js:136): when `extract=defuddle`, fail with a clear error instead of silently falling back to cheerio

## PR 2 (or fold into 1) — Housekeeping
- [ ] README: license MIT (matches package.json), repo URLs → searchinfluence/getchunks, remove stale v1.2 sections, add v3 field reference
- [ ] index.html footer GitHub link → searchinfluence/getchunks
- [ ] FAQ "Is my data secure?" — reword: URLs appear in analytics events and server logs; don't claim zero storage
- [ ] GTM: hardcode confirmed ID, delete scripts/build.js + vercel buildCommand (pending answer above)
- [ ] Legacy design files → docs/legacy/ or delete (pending answer above)

## Explicitly NOT doing this round
- Tests/lint scaffolding (worth doing, but separate PR — fixture snapshot tests for split/merge/overlap)
- Nested-content extraction fix for the cheerio fallback path (real but invasive; Defuddle covers the common case)
- Headless rendering, batch mode, auth — unchanged known limitations

## Review section
(to be filled in when work completes)
