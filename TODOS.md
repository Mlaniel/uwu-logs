# TODOS

## Pre-Phase-1a

- [ ] **PlayerTable.vue: use RecycleScroller, not v-memo**
  - **What:** The plan currently says "PlayerTable.vue → v-memo rows (25 players max — no virtualisation needed)". This is wrong. Raids with player swaps can have 49+ players in a single log. Use RecycleScroller same as SpellTable.vue.
  - **Why:** Implementing with v-memo will cause visible lag on 40-50 player logs. The fix is a one-line component choice, but it's easy to miss because the spec says "25 max".
  - **Where to start:** Change `PlayerTable.vue` plan reference from v-memo to RecycleScroller. Item height: 36px. Do NOT use v-memo inside RecycleScroller (display corruption).
  - **Depends on:** vue-virtual-scroller TS compatibility verified (see below).

- [ ] **Add GET /apiv2/recent_reports/ to Z_SERVER.py (Phase 1)**
  - **What:** New endpoint returning last N public report summaries: `[{ id, name, server, boss_count, latest_boss, date }]`. Used by the home page recent logs feed.
  - **Why:** Home page (/) shows "recent public logs" below the upload CTA. Without this endpoint, the home page has no dynamic content.
  - **Where to start:** Add to `Z_SERVER.py` alongside other new `/apiv2/` routes. Query the existing report cache/storage (same source as `logs_list`). Return JSON, no auth needed (public logs only).
  - **Depends on:** /apiv2/ Blueprint scaffolded.

## Pre-Phase-1b

- [ ] **Verify vue-virtual-scroller v2 TypeScript strict mode compatibility**
  - **What:** Install vue-virtual-scroller v2 in a scratch branch, configure TypeScript strict mode, verify RecycleScroller works without type errors.
  - **Why:** Library has had no meaningful updates since 2022 and has open TS strict mode issues. SpellTable.vue is the central performance component for spell/cast tables (500+ rows). If broken, Phase 1b is blocked. PlayerTable.vue now also uses RecycleScroller (see above).
  - **Where to start:** `npm install vue3-virtual-scroller@next`, add `"strict": true` to tsconfig, render a RecycleScroller with a typed item list.
  - **Fallback:** `@tanstack/virtual` as alternative if issues found.
  - **Depends on:** Phase 1a scaffold complete.
