<script setup lang="ts">
import { computed, h, watch } from 'vue'
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useVueTable,
  FlexRender,
} from '@tanstack/vue-table'
import type { VisibilityState } from '@tanstack/vue-table'
import type { SpellRow } from '../types/api'
import { SPELL_SCHOOL_COLORS } from '../constants/bosses'
import { useTablePresets } from '../composables/useTablePresets'
import TableToolbar from './TableToolbar.vue'


const props = defineProps<{
  spells: SpellRow[]
  duration: number
}>()

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
  const css = SPELL_SCHOOL_COLORS[color]
  if (!css) return 'rgba(163,53,238,0.45)'
  return `color-mix(in srgb, ${css} 55%, transparent)`
}

// ── Column definitions ─────────────────────────────────────────────────
const ch = createColumnHelper<SpellRow>()

function numCol(
  id: keyof SpellRow,
  header: string,
  cls = 'col-sm num',
  extraCls?: string,
) {
  return ch.accessor(id, {
    id,
    header,
    meta: { cls: extraCls ? `${cls} ${extraCls}` : cls },
    cell: info => (info.getValue() as string) || '—',
    sortingFn: (a, b) => parseNum(a.original[id] as string) - parseNum(b.original[id] as string),
  })
}

function pctCol(id: keyof SpellRow, header: string, extraCls?: string) {
  return ch.accessor(id, {
    id,
    header,
    meta: { cls: extraCls ? `col-sm num ${extraCls}` : 'col-sm num' },
    cell: info => (info.getValue() as string) || '—',
    sortingFn: (a, b) =>
      parseFloat((a.original[id] as string ?? '').replace('%', '') || '0') -
      parseFloat((b.original[id] as string ?? '').replace('%', '') || '0'),
  })
}

const columns = [
  ch.display({
    id: 'spell',
    header: 'Spell',
    enableSorting: false,
    meta: { cls: 'col-name', noHide: true },
    cell: ({ row }) => {
      const item = row.original
      const icon = item.icon
        ? h('img', {
            src: `/static/icons/${item.icon}.jpg`,
            alt: item.name,
            class: 'spell-icon',
            width: 20,
            height: 20,
          })
        : null
      const nameEl = item.spell_id && !item.spell_id.includes('--')
        ? h('a', {
            href: `https://www.wowhead.com/wotlk/spell=${item.spell_id}`,
            target: '_blank',
            rel: 'noreferrer',
            class: 'spell-link',
            style: item.color ? { color: item.color } : undefined,
          }, item.name)
        : h('span', { style: item.color ? { color: item.color } : undefined }, item.name)
      return h('div', { style: 'display:contents' }, [icon, nameEl].filter(Boolean))
    },
  }),

  // ── Casts ──────────────────────────────────────────────────────────────────
  numCol('casts', 'Casts'),

  // ── Direct hits ────────────────────────────────────────────────────────────
  numCol('hit_total',    'Hits'),
  numCol('direct_hits',  'D.Hits'),
  numCol('direct_crits', 'D.Crits',  'col-sm num', 'crit-val'),
  pctCol('crit_pct',     'Crit%',    'crit-pct'),
  numCol('avg_hit',      'Avg'),
  numCol('avg_crit',     'Avg↑',     'col-sm num', 'crit-val'),
  numCol('max_hit',      'Max'),
  numCol('max_crit',     'Max↑',     'col-sm num', 'crit-val'),

  // ── Periodic (DoT) ─────────────────────────────────────────────────────────
  numCol('dot_hits',     'DoT Hits'),
  numCol('dot_crits',    'DoT Crits', 'col-sm num', 'crit-val'),
  pctCol('dot_crit_pct', 'DoT Crit%', 'crit-pct'),
  numCol('dot_avg_hit',  'DoT Avg'),
  numCol('dot_avg_crit', 'DoT Avg↑',  'col-sm num', 'crit-val'),
  numCol('dot_max_hit',  'DoT Max'),

  // ── Misses ─────────────────────────────────────────────────────────────────
  numCol('misses',      'Misses'),
  numCol('miss',        'Miss'),
  numCol('dodge',       'Dodge'),
  numCol('parry',       'Parry'),
  numCol('glancing',    'Glance'),
  numCol('block',       'Block'),
  numCol('resist_miss', 'Resist'),
  numCol('absorb_miss', 'Absorb'),
  numCol('immune',      'Immune'),
  numCol('reflect',     'Reflect'),

  // ── Damage modifiers ───────────────────────────────────────────────────────
  numCol('overkill', 'Overkill'),
  numCol('absorbed', 'Absorbed'),
  numCol('resisted', 'Resisted'),

  // ── Bar + total ────────────────────────────────────────────────────────────
  ch.display({
    id: 'bar',
    header: '',
    enableSorting: false,
    meta: { cls: 'col-bar', noHide: true },
    cell: ({ row }) => {
      const item = row.original
      const pct = maxActual.value > 0 ? parseNum(item.actual) / maxActual.value * 100 : 0
      return h('div', {
        class: 'bar-fill',
        style: { width: pct + '%', background: barColor(item.color) },
      })
    },
  }),
  ch.accessor('actual', {
    id: 'total_dmg',
    header: 'Total',
    meta: { cls: 'col-val gs num', noHide: true },
    cell: info => info.getValue() || '—',
    sortingFn: (a, b) => parseNum(a.original.actual) - parseNum(b.original.actual),
  }),
  ch.display({
    id: 'rate',
    enableSorting: false,
    header: () => props.duration ? '/s' : '',
    meta: { cls: 'col-rate num', noHide: true },
    cell: ({ row }) => fmtRate(row.original.actual),
  }),
]

// ── Presets ────────────────────────────────────────────────────────────
const HIDDEN_BY_DEFAULT = {
  direct_hits: false, direct_crits: false,
  max_hit: false, max_crit: false,
  dot_hits: false, dot_crits: false, dot_crit_pct: false,
  dot_avg_hit: false, dot_avg_crit: false, dot_max_hit: false,
  miss: false, dodge: false, parry: false, glancing: false,
  block: false, resist_miss: false, absorb_miss: false,
  immune: false, reflect: false,
  overkill: false, absorbed: false, resisted: false,
}

const PRESETS: Record<string, VisibilityState> = {
  Default: {
    ...HIDDEN_BY_DEFAULT,
    misses: false,
  },
  Summary: {
    ...HIDDEN_BY_DEFAULT,
    casts: false, hit_total: false, crit_pct: false,
    avg_hit: false, avg_crit: false, misses: false,
  },
  'Hit Detail': {
    ...HIDDEN_BY_DEFAULT,
    direct_hits: true, direct_crits: true,
    max_hit: true, max_crit: true,
    misses: false,
  },
  'DoT Detail': {
    ...HIDDEN_BY_DEFAULT,
    dot_hits: true, dot_crits: true, dot_crit_pct: true,
    dot_avg_hit: true, dot_avg_crit: true,
    misses: false,
  },
  'Miss Detail': {
    ...HIDDEN_BY_DEFAULT,
    miss: true, dodge: true, parry: true, glancing: true,
    block: true, resist_miss: true, absorb_miss: true,
    immune: true, reflect: true,
    hit_total: false, crit_pct: false, avg_hit: false, avg_crit: false,
  },
  'Dmg Modifiers': {
    ...HIDDEN_BY_DEFAULT,
    overkill: true, absorbed: true, resisted: true,
    hit_total: false, crit_pct: false, avg_hit: false, avg_crit: false,
    misses: false,
  },
}

const {
  columnVisibility, sorting, activePreset, importError,
  applyPreset, exportPreset, importPreset,
  onColumnVisibilityChange, onSortingChange,
} = useTablePresets({
  storageKey:     'uwu-spell-cols',
  presets:        PRESETS,
  defaultPreset:  'Default',
  defaultSorting: [{ id: 'total_dmg', desc: true }],
})

const table = useVueTable({
  get data() { return props.spells },
  columns,
  enableMultiSort: false,
  state: {
    get sorting()          { return sorting.value },
    get columnVisibility() { return columnVisibility.value },
  },
  onSortingChange,
  onColumnVisibilityChange,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
})

const hideableCols = computed(() =>
  table.getAllLeafColumns().filter(c => !c.columnDef.meta?.noHide)
)

const maxActual = computed(() =>
  props.spells.reduce((max, r) => Math.max(max, parseNum(r.actual)), 0)
)

// Auto-hide columns where every row has no data.
// Only hides — never auto-shows — so user preset choices are preserved.
watch(() => props.spells, spells => {
  if (!spells.length) return
  const updates: VisibilityState = {}
  for (const col of hideableCols.value) {
    const id = col.id as keyof SpellRow
    const hasData = spells.some(r => {
      const v = r[id]
      return v !== undefined && v !== '' && v !== '0'
    })
    if (!hasData) updates[col.id] = false
  }
  if (Object.keys(updates).length) {
    columnVisibility.value = { ...columnVisibility.value, ...updates }
  }
}, { immediate: true })
</script>

<template>
  <div class="spell-bar-table">

    <TableToolbar
      :presets="PRESETS"
      :active-preset="String(activePreset ?? '')"
      :hideable-cols="hideableCols"
      :import-error="importError"
      @apply-preset="applyPreset"
      @export="exportPreset"
      @import="importPreset"
    />

    <!-- Header row -->
    <div class="row hdr">
      <template
        v-for="header in (table.getHeaderGroups()[0]?.headers ?? [])"
        :key="header.id"
      >
        <div
          :class="[header.column.columnDef.meta?.cls, { sortable: header.column.getCanSort() }]"
          @click="header.column.getToggleSortingHandler()?.($event)"
        >
          <FlexRender
            v-if="!header.isPlaceholder"
            :render="header.column.columnDef.header"
            :props="header.getContext()"
          />{{
            header.column.getIsSorted() === 'desc' ? ' ↓'
            : header.column.getIsSorted() === 'asc' ? ' ↑'
            : ''
          }}
        </div>
      </template>
    </div>

    <!-- Data rows -->
    <div
      v-for="row in table.getRowModel().rows"
      :key="row.id"
      class="row data-row"
    >
      <div
        v-for="cell in row.getVisibleCells()"
        :key="cell.id"
        :class="[cell.column.columnDef.meta?.cls]"
      >
        <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
      </div>
    </div>

  </div>
</template>

<style scoped>
.spell-bar-table {
  display: flex;
  flex-direction: column;
}

/* ── Table rows ── */
.row {
  display: flex;
  align-items: center;
}

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

.col-bar {
  width: 200px;
  flex-shrink: 0;
  padding: 0 8px;
  display: flex;
  align-items: center;
  border-left: 1px solid hsl(0, 0%, 13%);
}

.bar-fill {
  max-width: 100%;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

.col-val {
  width: 110px;
  flex-shrink: 0;
  padding: 0 10px;
  text-align: right;
}

.col-rate {
  width: 68px;
  flex-shrink: 0;
  padding: 0 10px;
  text-align: right;
}

/* Group separator */
.gs {
  border-left: 1px solid hsl(0, 0%, 13%);
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
