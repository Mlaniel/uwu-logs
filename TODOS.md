# TODOS

## Pre-Phase-1a

- [x] **PlayerTable.vue: use RecycleScroller, not v-memo**
  - Done. `PlayerTable.vue` uses `RecycleScroller` from `vue-virtual-scroller` with `item-size=36`. No `v-memo` used.

- [x] **Add GET /api/v2/recent_reports/ to Z_SERVER.py (Phase 1)**
  - Done. Implemented in `api_v2.py` as `@apiv2_bp.route("/recent_reports/")`. Called by `Home.vue` on mount.

## Pre-Phase-1b

- [x] **Verify vue-virtual-scroller v2 TypeScript strict mode compatibility**
  - Done. `vue-virtual-scroller@2.0.1` installed and used in `PlayerTable.vue` and `SpellTable.vue`. No TS errors from the library (pre-existing errors in test files and vite.config are unrelated).
