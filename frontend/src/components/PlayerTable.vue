<script setup lang="ts">
import type { Player } from '../types/api'
import type { SortKey } from '../composables/useFilters'
import { POINTS } from '../constants/bosses'

const props = defineProps<{
  players: Player[]
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
}>()

const emit = defineEmits<{
  sort: [key: SortKey]
  'player-click': [name: string]
}>()

function rankClass(pct: number): string {
  for (const t of POINTS) if (pct >= t) return `top${t}`
  return 'top0'
}

function rankBarColor(pct: number): string {
  if (pct >= 100) return 'rgba(229,204,128,0.55)'
  if (pct >= 99)  return 'rgba(226,104,168,0.55)'
  if (pct >= 95)  return 'rgba(255,128,0,0.55)'
  if (pct >= 90)  return 'rgba(255,60,0,0.55)'
  if (pct >= 75)  return 'rgba(163,53,238,0.55)'
  if (pct >= 50)  return 'rgba(0,112,255,0.55)'
  if (pct >= 25)  return 'rgba(30,255,0,0.55)'
  return 'rgba(102,102,102,0.55)'
}

function si(key: SortKey): string {
  if (props.sortKey !== key) return ''
  return props.sortDir === 'desc' ? ' ↓' : ' ↑'
}

function classSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-')
}

function fmtRate(v: number): string {
  if (!v || !isFinite(v)) return '0'
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M'
  if (v >= 1_000)     return (v / 1_000).toFixed(1) + 'k'
  return v.toFixed(0)
}
</script>

<template>
  <div class="player-table">

    <!-- Header -->
    <div class="row hdr">
      <div class="col-name sortable" @click="emit('sort', 'name')">Name{{ si('name') }}</div>
      <div class="col-sm  sortable" @click="emit('sort', 'active_pct')">Active%{{ si('active_pct') }}</div>
      <div class="col-sm  sortable" @click="emit('sort', 'casts')">Casts{{ si('casts') }}</div>
      <!-- Damage group -->
      <div class="col-val sortable gs" @click="emit('sort', 'useful_dmg')">Damage{{ si('useful_dmg') }}</div>
      <div class="col-bar" />
      <div class="col-rate sortable" @click="emit('sort', 'dps')">DPS{{ si('dps') }}</div>
      <!-- Heal group -->
      <div class="col-val sortable gs" @click="emit('sort', 'heal')">Heal{{ si('heal') }}</div>
      <div class="col-bar" />
      <div class="col-rate sortable" @click="emit('sort', 'hps')">HPS{{ si('hps') }}</div>
      <!-- Taken group -->
      <div class="col-val sortable gs" @click="emit('sort', 'taken')">Taken{{ si('taken') }}</div>
      <div class="col-bar" />
      <div class="col-rate sortable" @click="emit('sort', 'dtps')">DTPS{{ si('dtps') }}</div>
    </div>

    <!-- Data rows -->
    <div
      v-for="p in players"
      :key="p.name"
      class="row data-row"
      :class="{ healer: p.useful === null }"
      @click="emit('player-click', p.name)"
    >
      <!-- Name -->
      <div class="col-name">
        <img class="spec-icon" :src="`/static/icons/${p.spec_icon}.jpg`" :alt="p.spec_name" width="16" height="16" />
        <span :class="classSlug(p.class_name)">{{ p.name }}</span>
      </div>

      <!-- Active% -->
      <div class="col-sm num">{{ p.active_pct ? p.active_pct.toFixed(1) + '%' : '—' }}</div>

      <!-- Casts -->
      <div class="col-sm num">{{ p.casts || '—' }}</div>

      <!-- Damage group -->
      <div class="col-val gs">
        <span :class="rankClass(p.useful?.percent ?? 0)">
          {{ p.useful?.value || p.damage.value || '—' }}
        </span>
      </div>
      <div class="col-bar" :style="{ '--pct': (p.useful?.percent ?? 0) + '%', '--clr': rankBarColor(p.useful?.percent ?? 0) }">
        <div class="bar-fill" />
      </div>
      <div class="col-rate num">{{ fmtRate(p.useful?.per_second ?? p.damage.per_second) }}</div>

      <!-- Heal group -->
      <div class="col-val gs">
        <span :class="rankClass(p.heal.percent)">{{ p.heal.value || '—' }}</span>
      </div>
      <div class="col-bar" :style="{ '--pct': p.heal.percent + '%', '--clr': rankBarColor(p.heal.percent) }">
        <div class="bar-fill" />
      </div>
      <div class="col-rate num">{{ fmtRate(p.heal.per_second) }}</div>

      <!-- Taken group -->
      <div class="col-val gs">
        <span :class="rankClass(p.taken.percent)">{{ p.taken.value || '—' }}</span>
      </div>
      <div class="col-bar" :style="{ '--pct': p.taken.percent + '%', '--clr': rankBarColor(p.taken.percent) }">
        <div class="bar-fill" />
      </div>
      <div class="col-rate num">{{ fmtRate(p.taken.per_second) }}</div>
    </div>

  </div>
</template>

<style scoped>
.player-table {
  display: flex;
  flex-direction: column;
}

/* ── Shared row layout ───────────────────────────────────────────────────── */

.row {
  display: flex;
  align-items: center;
}

/* ── Header ──────────────────────────────────────────────────────────────── */

.hdr {
  height: 34px;
  border-bottom: 1px solid var(--table-border);
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  user-select: none;
}

.hdr .sortable { cursor: pointer; }
.hdr .sortable:hover { color: var(--text); }

/* ── Data rows ───────────────────────────────────────────────────────────── */

.data-row {
  height: 40px;
  border-bottom: 1px solid var(--table-border);
  cursor: pointer;
}
.data-row:hover { background: var(--hover-row); }
.data-row.healer { opacity: var(--healer-row-opacity); }

/* ── Columns ─────────────────────────────────────────────────────────────── */

/* Name — takes all remaining space */
.col-name {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  overflow: hidden;
  font-size: 17px;
}
.col-name span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Active% and Casts — compact */
.col-sm {
  width: 82px;
  flex-shrink: 0;
  padding: 0 10px;
  text-align: right;
}

/* Stat value (Damage / Heal / Taken) */
.col-val {
  width: 106px;
  flex-shrink: 0;
  padding: 0 10px;
  text-align: right;
}

/* Bar — widest column, shows rank fill */
.col-bar {
  width: 130px;
  flex-shrink: 0;
  padding: 0 8px;
  display: flex;
  align-items: center;
}

/* Rate (DPS / HPS / DTPS) */
.col-rate {
  width: 90px;
  flex-shrink: 0;
  padding: 0 10px;
  text-align: right;
}

/* Group separator — left border on first column of each stat group */
.gs {
  border-left: 1px solid hsl(0, 0%, 13%);
  padding-left: 10px;
}

/* ── Bar fill ────────────────────────────────────────────────────────────── */

.bar-fill {
  width: var(--pct, 0%);
  max-width: 100%;
  height: 13px;
  background: var(--clr, rgba(255,255,255,0.1));
  border-radius: 1px;
}

/* ── Text styles ─────────────────────────────────────────────────────────── */

.num,
.col-val span,
.col-rate {
  font-family: 'Barlow Condensed', sans-serif;
  font-variant-numeric: tabular-nums;
  font-size: 16px;
}

.spec-icon {
  flex-shrink: 0;
  border-radius: 2px;
  display: block;
}
</style>
