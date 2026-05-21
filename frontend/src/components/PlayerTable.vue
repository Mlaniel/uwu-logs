<script setup lang="ts">
import { computed } from 'vue'
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

// ── helpers ────────────────────────────────────────────────────────────────

function rankClass(pct: number): string {
  for (const threshold of POINTS) {
    if (pct >= threshold) return `top${threshold}`
  }
  return 'top0'
}

function rankBarColor(pct: number): string {
  if (pct >= 100) return 'rgba(229,204,128,0.35)'
  if (pct >= 99)  return 'rgba(226,104,168,0.35)'
  if (pct >= 95)  return 'rgba(255,128,0,0.35)'
  if (pct >= 90)  return 'rgba(255,60,0,0.35)'
  if (pct >= 75)  return 'rgba(163,53,238,0.35)'
  if (pct >= 50)  return 'rgba(0,112,255,0.35)'
  if (pct >= 25)  return 'rgba(30,255,0,0.35)'
  return 'rgba(102,102,102,0.35)'
}

const NEUTRAL = 'rgba(255,255,255,0.07)'

function sortIndicator(key: SortKey): string {
  if (props.sortKey !== key) return ''
  return props.sortDir === 'desc' ? ' ↓' : ' ↑'
}

function classSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-')
}

function fmtRate(v: number): string {
  if (!v || !isFinite(v)) return '0'
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'k'
  return v.toFixed(0)
}

// ── per-second bar normalization ───────────────────────────────────────────

const maxDps = computed(() =>
  Math.max(1, ...props.players.map(p => p.useful?.per_second ?? p.damage.per_second))
)
const maxHps = computed(() =>
  Math.max(1, ...props.players.map(p => p.heal.per_second))
)
const maxDtps = computed(() =>
  Math.max(1, ...props.players.map(p => p.taken.per_second))
)
</script>

<template>
  <div class="player-table">
    <!-- Header row -->
    <div class="table-header">
      <div class="col-name-hdr" @click="emit('sort', 'name')">
        Name{{ sortIndicator('name') }}
      </div>
      <div class="col-stat-hdr sortable" @click="emit('sort', 'useful_dmg')">
        Damage{{ sortIndicator('useful_dmg') }}
      </div>
      <div class="col-rate-hdr sortable" @click="emit('sort', 'dps')">
        DPS{{ sortIndicator('dps') }}
      </div>
      <div class="col-stat-hdr sortable" @click="emit('sort', 'heal')">
        Heal{{ sortIndicator('heal') }}
      </div>
      <div class="col-rate-hdr sortable" @click="emit('sort', 'hps')">
        HPS{{ sortIndicator('hps') }}
      </div>
      <div class="col-stat-hdr sortable" @click="emit('sort', 'taken')">
        Taken{{ sortIndicator('taken') }}
      </div>
      <div class="col-rate-hdr sortable" @click="emit('sort', 'dtps')">
        DTPS{{ sortIndicator('dtps') }}
      </div>
      <div class="col-sm-hdr sortable" @click="emit('sort', 'active_pct')">
        Active%{{ sortIndicator('active_pct') }}
      </div>
      <div class="col-sm-hdr sortable" @click="emit('sort', 'casts')">
        Casts{{ sortIndicator('casts') }}
      </div>
    </div>

    <!-- Player rows -->
    <div
      v-for="player in players"
      :key="player.name"
      class="player-row"
      :class="{ healer: player.useful === null }"
      @click="emit('player-click', player.name)"
    >
      <!-- Name + spec icon -->
      <div class="col-name">
        <img
          class="spec-icon"
          :src="`/static/icons/${player.spec_icon}.jpg`"
          :alt="player.spec_name"
          width="16"
          height="16"
        />
        <span :class="classSlug(player.class_name)">{{ player.name }}</span>
      </div>

      <!-- Damage -->
      <div
        class="bar-cell col-stat"
        :style="{
          '--pct': (player.useful?.percent ?? 0) + '%',
          '--bar': rankBarColor(player.useful?.percent ?? 0),
        }"
      >
        <div class="bar" />
        <span :class="rankClass(player.useful?.percent ?? 0)">
          {{ player.useful?.value || player.damage.value || '—' }}
        </span>
      </div>

      <!-- DPS -->
      <div
        class="bar-cell col-rate"
        :style="{
          '--pct': ((player.useful?.per_second ?? player.damage.per_second) / maxDps) * 100 + '%',
          '--bar': NEUTRAL,
        }"
      >
        <div class="bar" />
        <span>{{ fmtRate(player.useful?.per_second ?? player.damage.per_second) }}</span>
      </div>

      <!-- Heal -->
      <div
        class="bar-cell col-stat"
        :style="{
          '--pct': player.heal.percent + '%',
          '--bar': rankBarColor(player.heal.percent),
        }"
      >
        <div class="bar" />
        <span :class="rankClass(player.heal.percent)">{{ player.heal.value || '—' }}</span>
      </div>

      <!-- HPS -->
      <div
        class="bar-cell col-rate"
        :style="{
          '--pct': (player.heal.per_second / maxHps) * 100 + '%',
          '--bar': NEUTRAL,
        }"
      >
        <div class="bar" />
        <span>{{ fmtRate(player.heal.per_second) }}</span>
      </div>

      <!-- Taken -->
      <div
        class="bar-cell col-stat"
        :style="{
          '--pct': player.taken.percent + '%',
          '--bar': rankBarColor(player.taken.percent),
        }"
      >
        <div class="bar" />
        <span :class="rankClass(player.taken.percent)">{{ player.taken.value || '—' }}</span>
      </div>

      <!-- DTPS -->
      <div
        class="bar-cell col-rate"
        :style="{
          '--pct': (player.taken.per_second / maxDtps) * 100 + '%',
          '--bar': NEUTRAL,
        }"
      >
        <div class="bar" />
        <span>{{ fmtRate(player.taken.per_second) }}</span>
      </div>

      <!-- Active% -->
      <div class="plain-cell col-sm">
        <span>{{ player.active_pct ? player.active_pct.toFixed(1) + '%' : '—' }}</span>
      </div>

      <!-- Casts -->
      <div class="plain-cell col-sm">
        <span>{{ player.casts || '—' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.player-table {
  display: flex;
  flex-direction: column;
}

/* ── Header ──────────────────────────────────────────────────────────────── */

.table-header {
  display: flex;
  align-items: center;
  height: 26px;
  border-bottom: 1px solid var(--table-border);
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  user-select: none;
}

.col-name-hdr {
  flex: 1;
  min-width: 0;
  padding: 0 8px;
  cursor: pointer;
}
.col-name-hdr:hover { color: var(--text); }

.col-stat-hdr {
  width: 90px;
  flex-shrink: 0;
  text-align: right;
  padding: 0 8px;
}

.col-rate-hdr {
  width: 72px;
  flex-shrink: 0;
  text-align: right;
  padding: 0 8px;
}

.col-sm-hdr {
  width: 64px;
  flex-shrink: 0;
  text-align: right;
  padding: 0 8px;
}

.col-stat-hdr.sortable,
.col-rate-hdr.sortable,
.col-sm-hdr.sortable {
  cursor: pointer;
}
.col-stat-hdr.sortable:hover,
.col-rate-hdr.sortable:hover,
.col-sm-hdr.sortable:hover {
  color: var(--text);
}

/* ── Rows ────────────────────────────────────────────────────────────────── */

.player-row {
  display: flex;
  align-items: center;
  height: 30px;
  border-bottom: 1px solid var(--table-border);
  cursor: pointer;
}
.player-row:hover { background: var(--hover-row); }
.player-row.healer { opacity: var(--healer-row-opacity); }

/* Name cell */
.col-name {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  overflow: hidden;
}

.spec-icon {
  flex-shrink: 0;
  border-radius: 2px;
  display: block;
}

.col-name span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

/* ── Bar cells ───────────────────────────────────────────────────────────── */

.bar-cell {
  flex-shrink: 0;
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 8px;
  overflow: hidden;
}

.col-stat { width: 90px; }
.col-rate { width: 72px; }

.bar {
  position: absolute;
  inset: 0 0 0 0;
  width: var(--pct, 0%);
  background: var(--bar, rgba(255,255,255,0.07));
  pointer-events: none;
}

.bar-cell span {
  position: relative;
  font-family: 'Barlow Condensed', sans-serif;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  line-height: 1;
}

/* ── Plain cells (no bar) ────────────────────────────────────────────────── */

.plain-cell {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 8px;
}

.col-sm { width: 64px; }

.plain-cell span {
  font-family: 'Barlow Condensed', sans-serif;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
