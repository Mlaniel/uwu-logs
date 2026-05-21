<script setup lang="ts">
import { ref, computed } from 'vue'
import type { SpellRow } from '../types/api'

const props = defineProps<{
  spells: SpellRow[]
  duration: number   // fight seconds for /s column; 0 = omit
}>()

type SortKey = 'name' | 'casts' | 'hits' | 'crit_pct' | 'avg_hit' | 'avg_crit' | 'amount'

const sortKey = ref<SortKey>('amount')
const sortDir = ref<'asc' | 'desc'>('desc')

function toggleSort(key: SortKey): void {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortKey.value = key
    sortDir.value = 'desc'
  }
}

function si(key: SortKey): string {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'desc' ? ' ↓' : ' ↑'
}

function parseNum(s: string | undefined): number {
  if (!s) return 0
  return parseFloat(s.replace(/\s/g, '')) || 0
}

function fmtRate(actual: string): string {
  if (!props.duration) return ''
  const ps = parseNum(actual) / props.duration
  if (ps >= 1_000_000) return (ps / 1_000_000).toFixed(2) + 'M'
  if (ps >= 1_000)     return (ps / 1_000).toFixed(1) + 'k'
  return ps.toFixed(0)
}

function barColor(color: string): string {
  if (!color) return 'rgba(163,53,238,0.45)'
  return `color-mix(in srgb, ${color} 55%, transparent)`
}

const sorted = computed<SpellRow[]>(() => {
  const rows = [...props.spells]
  const dir = sortDir.value === 'desc' ? -1 : 1
  rows.sort((a, b) => {
    switch (sortKey.value) {
      case 'name':     return dir * a.name.localeCompare(b.name)
      case 'casts':    return dir * (parseNum(a.casts) - parseNum(b.casts))
      case 'hits':     return dir * (parseNum(a.hit_total) - parseNum(b.hit_total))
      case 'crit_pct': return dir * (parseFloat(a.crit_pct ?? '0') - parseFloat(b.crit_pct ?? '0'))
      case 'avg_hit':  return dir * (parseNum(a.avg_hit) - parseNum(b.avg_hit))
      case 'avg_crit': return dir * (parseNum(a.avg_crit) - parseNum(b.avg_crit))
      case 'amount':
      default:         return dir * (a.percent - b.percent)
    }
  })
  return rows
})
</script>

<template>
  <div class="spell-bar-table">

    <!-- Header -->
    <div class="row hdr">
      <div class="col-name sortable" @click="toggleSort('name')">Spell{{ si('name') }}</div>
      <div class="col-sm  sortable" @click="toggleSort('casts')">Casts{{ si('casts') }}</div>
      <div class="col-sm  sortable" @click="toggleSort('hits')">Hits{{ si('hits') }}</div>
      <div class="col-sm  sortable" @click="toggleSort('crit_pct')">Crit%{{ si('crit_pct') }}</div>
      <div class="col-sm  sortable" @click="toggleSort('avg_hit')">Avg{{ si('avg_hit') }}</div>
      <div class="col-sm  sortable" @click="toggleSort('avg_crit')">Avg↑{{ si('avg_crit') }}</div>
      <div class="col-val sortable gs" @click="toggleSort('amount')">Amount{{ si('amount') }}</div>
      <div class="col-bar" />
      <div class="col-rate">{{ duration ? '/s' : '' }}</div>
    </div>

    <!-- Rows -->
    <div
      v-for="item in sorted"
      :key="item.spell_id"
      class="row data-row"
    >
      <div class="col-name">
        <img
          v-if="item.icon"
          :src="`/static/icons/${item.icon}.jpg`"
          :alt="item.name"
          class="spell-icon"
          width="20"
          height="20"
        />
        <a
          v-if="item.spell_id && !item.spell_id.includes('--')"
          :href="`https://www.wowhead.com/wotlk/spell=${item.spell_id}`"
          target="_blank"
          rel="noreferrer"
          class="spell-link"
          :style="{ color: item.color || undefined }"
        >{{ item.name }}</a>
        <span v-else :style="{ color: item.color || undefined }">{{ item.name }}</span>
      </div>

      <div class="col-sm num">{{ item.casts || '—' }}</div>
      <div class="col-sm num">{{ item.hit_total || '—' }}</div>
      <div class="col-sm num crit-pct">{{ item.crit_pct || '—' }}</div>
      <div class="col-sm num">{{ item.avg_hit || '—' }}</div>
      <div class="col-sm num crit-val">{{ item.avg_crit || '—' }}</div>

      <div class="col-val gs num">{{ item.actual || '—' }}</div>
      <div
        class="col-bar"
        :style="{ '--pct': item.percent + '%', '--clr': barColor(item.color) }"
      >
        <div class="bar-fill" />
      </div>
      <div class="col-rate num">{{ fmtRate(item.actual) }}</div>
    </div>

  </div>
</template>

<style scoped>
.spell-bar-table {
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  align-items: center;
}

/* ── Header ── */
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

/* ── Data rows ── */
.data-row {
  height: 40px;
  border-bottom: 1px solid var(--table-border);
}
.data-row:hover { background: var(--hover-row); }

/* ── Columns ── */
.col-name {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  overflow: hidden;
}

.spell-icon {
  flex-shrink: 0;
  border-radius: 2px;
  display: block;
}

.spell-link {
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 17px;
}
.spell-link:hover { text-decoration: underline; }

.col-name span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 17px;
}

.col-sm {
  width: 82px;
  flex-shrink: 0;
  padding: 0 10px;
  text-align: right;
}

.col-val {
  width: 110px;
  flex-shrink: 0;
  padding: 0 10px;
  text-align: right;
}

.col-bar {
  width: 130px;
  flex-shrink: 0;
  padding: 0 8px;
  display: flex;
  align-items: center;
}

.col-rate {
  width: 80px;
  flex-shrink: 0;
  padding: 0 10px;
  text-align: right;
}

/* Group separator */
.gs {
  border-left: 1px solid hsl(0, 0%, 13%);
}

/* Bar fill */
.bar-fill {
  width: var(--pct, 0%);
  max-width: 100%;
  height: 13px;
  background: var(--clr, rgba(163,53,238,0.45));
  border-radius: 1px;
}

/* Numbers */
.num,
.col-rate {
  font-family: 'Barlow Condensed', sans-serif;
  font-variant-numeric: tabular-nums;
  font-size: 16px;
}

.crit-pct { color: #ffd700; }
.crit-val { color: #ffd700; }
</style>
