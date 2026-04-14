# getchunks Session Log

## 2026-04-14 — Research session: code-only improvements

**Goal:** Determine whether the current `getchunks` solution (cheerio + heading-based chunking) is still a strong approach, or whether code-only improvements (no AI tokens) could make it more useful.

**Project state at start of session:**
- v2.0.0 in `package.json`, but README still references v1.2.0
- Stack: Vercel serverless function, `node-fetch` + `cheerio`, vanilla JS frontend
- API: `POST /api/chunk` with `{ url, mode, chunkSize, overlap, strategy }`
- Strategies: `heading`, `recursive`, `fixed` with auto-detection based on heading density and word count
- Returns big_chunks/small_chunks with word counts, char counts, and token estimates (rough 0.75 multiplier)
- Live at https://getchunks.vercel.app and https://getchunks.searchinfluence.com
- Open feature branch noted in ENHANCEMENT_STATUS.md: `feature/enhanced-chunking`

**Known limitations (per README):**
- No JavaScript rendering (cheerio is static HTML only)
- No support for password-protected pages
- May not parse highly customized layouts

**Research underway:** parallel agents investigating (1) current state of web chunking for RAG, (2) top GitHub repos for content extraction + chunking, (3) tokenizer/semantic improvements that don't require AI inference.

## Research findings (2026-04-14)

**Verdict on heading-based chunking:** Yes, still reasonable in 2026. Structural/markdown-header chunking outperforms naive fixed-size by 5-10pp and matches or beats embedding-based semantic chunking on well-structured docs per NAACL 2025 (Vectara) and Vecta Feb 2026 benchmarks.

**Top code-only improvements identified:**
1. Swap cheerio traversal for Defuddle (active JS library, successor to Readability/Postlight) for main-content extraction
2. Add accurate token counting via gpt-tokenizer or js-tiktoken (0.75 word ratio holds ~±5% but real tokenizers are cheap now)
3. Parent/child hierarchical output (3-level cap per research) to enable AutoMergingRetriever patterns
4. Better sentence boundary detection (compromise or wink-nlp on node) instead of regex for recursive strategy
5. Tighter overlap guardrails (10-20% target, warn on excessive) - duplicate saturation is documented failure mode

**Libraries obviously missing from cheerio-only stack:** Defuddle, gpt-tokenizer, chonkie-ts (reference implementation), compromise/wink-nlp for sentence detection.

## Open items / next steps
- Synthesize research into recommendations — DONE
- Get user buy-in on which improvements (if any) to prioritize
- Update README to reflect actual v2.0.0 state if we proceed with changes

## 2026-04-14 — Sub-research: GitHub repo landscape audit

Pulled live GitHub stars + last-push dates and confirmed:
- **Defuddle (kepano):** 6,725 stars, pushed 2026-04-14 — actively maintained, has Node bundle
- **@mozilla/readability:** 11,099 stars but last push 2026-01-21 — barely maintained (kepano's stated reason for building Defuddle)
- **postlight/parser (Mercury):** 5,781 stars, last push 2024-07-10 — effectively abandoned
- **chonkie (Python):** 3,917 stars, daily commits. **chonkie-ts:** 325 stars, March 2026 — only credible JS port
- **gpt-tokenizer (niieani):** 766 stars, Feb 2026 — fastest sync JS BPE tokenizer
- **js-tiktoken (dqbd):** 1,040 stars, Aug 2025 — pure JS, edge-runtime safe but bigger bundle
- **anthropic-tokenizer-typescript:** 100 stars, last push **March 2024** — stale, do not rely on for Claude token counts
- **@sparticuz/chromium:** 1,583 stars, very active; chromium-min variant + Vercel Fluid Compute (default since Apr 2025) makes serverless Chromium viable but heavy
- **wink-nlp:** 1,364 stars, March 2026 — best maintained quality option for sentence segmentation
- **sbd:** 224 stars, last push 2023 — works but stagnant

Full structured report delivered to user inline.

## 2026-04-14 — Third-pass deep research (this session)

Ran deeper verification searches on tokenizers, TextTiling viability, Defuddle vs Readability, sentence segmentation, language detection, simhash/minhash, trafilatura port status, and LangChain/LlamaIndex output schemas. Delivered focused <1500-word opinionated report to user.

Key opinionated calls (additive to prior rounds):
- **Ship Phase 1:** Defuddle swap, gpt-tokenizer (niieani — single model, not ensemble), breadcrumb heading path, JSON-LD + OpenGraph capture, LangChain Document output mode, sbd for recursive-mode sentence splitting
- **Skip:** TextTiling/C99 (no maintained JS port, and heading-split already captures topic shifts on structured web content where the target users live), multi-tokenizer ensembles (overkill — one accurate counter is enough), language detection (franc-min 540KB isn't worth the bundle for an English-first tool), Flesch-Kincaid readability scores (vanity metric for RAG use cases)
- **Maybe Phase 2:** SimHash dedup (only useful for batch/multi-URL mode, which doesn't exist yet), content-type tagging (prose/list/code/table — trivial to add during cheerio traversal, low cost)

## 2026-04-14 — Feedback widget ported from ontologizer-next

### What was done
- Added `api/feedback.js` — Vercel serverless function that validates `{ type, message, email, pageUrl }`, posts Slack block payload matching the ontologizer-next format. Uses `FEEDBACK_PROJECT_NAME` (default `getchunks`) so the Slack header differentiates projects when the webhook is shared.
- Vanilla-JS + CSS widget in `public/index.html` (no React/Next — getchunks is static HTML + serverless). Floating orange pill bottom-right, modal with 4 types (Bug/Feature/Improvement/Other), optional email field, textarea capped at 4000 chars, Escape-to-close, backdrop-click-to-close, success state auto-closes after 1.8s.
- `vercel.json` now registers `api/feedback.js` with `maxDuration: 5`.
- README got a "Feedback Widget" section documenting `SLACK_FEEDBACK_WEBHOOK_URL` and `FEEDBACK_PROJECT_NAME` env vars.

### Decisions made
- **Reuse ontologizer's Slack webhook** — one channel, `FEEDBACK_PROJECT_NAME` differentiates the header. Can split later if the channel gets noisy.
- **Optional email field** (not in ontologizer's signed-in version) — getchunks has no auth, so this is the only way to enable follow-up on bug reports. Loose validation (no regex); Slack gets whatever the user typed.
- **Widget shown on every state** (landing, results, JSON view) — matches ontologizer behavior.
- **No Supabase / persistence** — Slack webhook is the audit trail, same as ontologizer.

### Open items / next steps
- Set `SLACK_FEEDBACK_WEBHOOK_URL` in Vercel (production + preview) — pull the value from the ontologizer Vercel project, or create a new webhook pointing at a separate channel if desired.
- Set `FEEDBACK_PROJECT_NAME=getchunks` in Vercel (optional; defaults in code).
- Ship to production and verify end-to-end delivery to Slack.

### Context for next session
- Files touched: `api/feedback.js` (new), `public/index.html` (widget markup + styles + script), `vercel.json`, `README.md`.
- Reference implementation still lives at `~/Development/ontologizer-next/` (`components/feedback/FeedbackWidget.tsx`, `app/api/feedback/route.ts`) if parity questions come up.
- Smoke-tested: `api/feedback.js` imports cleanly under Node ESM. HTML tag balance intact (5/5 script, 1/1 style).

## 2026-04-14 — v3.0 modernization executed

### What was done
- Branch `feature/v3-modernization` off clean main (feedback-widget WIP from main stashed as "WIP feedback widget (pre-v3)").
- Installed `defuddle`, `linkedom`, `gpt-tokenizer`, `sbd` (all MIT/ISC, zero AI/paid deps).
- Rewrote `api/chunk.js` end-to-end:
  - Pipeline: fetch → source-metadata scrape (JSON-LD, OG, Twitter, basic meta via cheerio on raw HTML) → Defuddle extraction via linkedom DOM, with cheerio fallback when Defuddle returns thin/empty content → heading walk with breadcrumb stack seeded by the document title (3-level cap per research) → strategy split (heading/recursive/fixed) → per-piece size cap + forceSplitByWords fallback for pathological inputs → per-chunk metadata (tokens via gpt-tokenizer o200k_base/cl100k_base, word_count, char_count, char_range, percent_through_doc, content_type, fragment) → format conversion (json/markdown/jsonl/langchain) → warnings array.
  - Backward-compat aliases kept: `token_estimate` and `total_tokens_estimate`.
- Updated `public/index.html`: v3.0.0 comments, added Extraction Engine + Output Format selectors to Advanced Options, surfaced Source block + Warnings + breadcrumb paths + content-type badges in Chunks view, added client-side conversion for copy/download so the selected format drives clipboard/file output without an extra API roundtrip.
- Bumped `package.json` to 3.0.0 with an updated description.
- Updated `README.md` header to reflect v3 (full rewrite deferred per plan).
- Plan + review captured in `tasks/todo.md`.

### Decisions made (beyond the original plan)
- **Defuddle's stripped H1**: seeded the heading stack with `source.title` as level 0 so breadcrumbs include the page title for Defuddle-extracted content. Added a consecutive-dup filter so pages where H1 == title don't render `[title, title]` paths.
- **Size cap in `heading` strategy**: NYT homepage exposed a 135KB JSON blob Defuddle extracted as one piece between headings. Heading strategy now splits any piece exceeding `target.max` via `recursiveSplit`. Added `forceSplitByWords` ultimate fallback so no chunk ever exceeds the target cap even when paragraph/sentence boundaries are absent.
- **Skipped `turndown`**: Defuddle's output + heading-breadcrumb markdown conversion was enough; client-side converter handles the download case without another dep.

### Test results
Smoke-tested 11 URL scenarios locally (example.com, Wikipedia RAG in all 4 formats, Wikipedia cheerio-only, searchinfluence.com, SI blog index, Hacker News, GitHub README, NYT homepage). All return status 200. Defuddle worked on 8/11 URLs, correctly fell back on example.com and cheerio-only mode, and HN returned 0 chunks as expected (table-only layout, no semantic headings — documented limitation). NYT test confirmed the size-cap fix works — the Videos section that was 1 massive chunk is now 4 properly-sized chunks.

### Files touched
- `api/chunk.js` (full rewrite, 451 → ~520 lines)
- `public/index.html` (version comments, two new selectors in Advanced Options, Source+Warnings+Breadcrumbs in Chunks view, client-side format converter replaces the old copy/download handlers)
- `package.json` (version + description + deps)
- `README.md` (header only; full rewrite deferred)
- `tasks/todo.md` (plan + review section filled in)

### Open items / next steps
- Unstash `WIP feedback widget (pre-v3)` and merge that work separately (`git stash list` to find it).
- Push `feature/v3-modernization` and open PR when ready.
- Full README rewrite to include v3 API reference (new fields: source, heading_path, fragment, content_type, tokens, char_range, percent_through_doc, warnings; new options: extract, format, tokenizer).
- Consider surfacing Source block in Webpage view (currently only Chunks view).
- If downstream consumers ask for it: LlamaIndex Node output shape (deferred from plan).

## 2026-04-14 — Feedback widget reapplied on top of v3

### What was done
- Reapplied the full feedback widget on `feature/v3-modernization` (stash was obsolete given the v3 index.html rewrite; cleaner to reapply fresh):
  - `api/feedback.js` — Vercel serverless function, posts Slack block payload via `SLACK_FEEDBACK_WEBHOOK_URL`, honors `FEEDBACK_PROJECT_NAME` (defaults to `getchunks`). Now returns `{ success, delivered }` so the frontend can distinguish webhook outages.
  - `vercel.json` — registers `api/feedback.js` with `maxDuration: 5`.
  - `public/index.html` — vanilla-JS floating button + modal (same anchors as before: style block near `--orange-accent`, widget markup before `</body>`). 4 types (Bug/Feature/Improvement/Other), optional email, 4000-char cap, Esc-to-close, backdrop-click-to-close.
  - `README.md` — Feedback Widget section above Error Handling documenting the two envs.
- Local smoke test passed end-to-end: signed + anonymous + empty-message + invalid-type all behave correctly; Slack returned 200 OK on both live posts (`delivered: true`).

### Root cause of earlier local-test failure
- `vercel dev` on a linked project does not reliably read `.env.local`. Fix: `set -a && source .env.local && set +a && vercel dev` — loads envs into the shell before Vercel CLI launches the function host.

### Open items / next steps
- **User paused here to pull in research updates from a separate chat before committing.** When ready: commit v3 + feedback widget together, push, open PR from `feature/v3-modernization`.
- Add envs to Vercel (production + preview) once on a deploy cadence: `vercel env add SLACK_FEEDBACK_WEBHOOK_URL` and `vercel env add FEEDBACK_PROJECT_NAME` (both interactive).
- Drop the `WIP feedback widget (pre-v3)` stash — now redundant (`git stash drop stash@{0}`). Waiting on user go-ahead.

### Context for next session
- Branch: `feature/v3-modernization` (uncommitted diff spans v3 chunk.js rewrite + feedback widget)
- Dev server stopped. Last-known-good launch: `set -a && source .env.local && set +a && vercel dev --listen 3001`
- `.env.local` at the repo root has `SLACK_FEEDBACK_WEBHOOK_URL` (pulled from ontologizer-next's .env.local) + `FEEDBACK_PROJECT_NAME=getchunks`. Gitignored.
- Reference feedback impl in ontologizer-next: `components/feedback/FeedbackWidget.tsx`, `app/api/feedback/route.ts`.
