<script setup lang="ts">
import { computed, h } from 'vue'
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useVueTable,
  FlexRender,
} from '@tanstack/vue-table'
import type { VisibilityState } from '@tanstack/vue-table'
import type { Player } from '../types/api'
import { POINTS } from '../constants/bosses'
import { useTablePresets } from '../composables/useTablePresets'
import TableToolbar from './TableToolbar.vue'

const props = defineProps<{
  players: Player[]
}>()

const emit = defineEmits<{
  'player-click': [name: string]
}>()

// ── Utilities ──────────────────────────────────────────────────────────────

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

function classSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-')
}

function fmtRate(v: number): string {
  if (!v || !isFinite(v)) return '0'
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M'
  if (v >= 1_000)     return (v / 1_000).toFixed(1) + 'k'
  return v.toFixed(0)
}

// ── Presets (must be before columns so sortingFn can close over `sorting`) ──

const PRESETS: Record<string, VisibilityState> = {
  Default:        {},
  'DPS Focus':    { heal: false, heal_bar: false, hps: false, taken: false, taken_bar: false, dtps: false },
  'Healer Focus': { useful_dmg: false, dmg_bar: false, dps: false },
  Summary:        { active_pct: false, casts: false, taken: false, taken_bar: false, dtps: false },
}

const {
  columnVisibility, sorting, activePreset, importError,
  applyPreset, exportPreset, importPreset,
  onColumnVisibilityChange, onSortingChange,
} = useTablePresets({
  storageKey:     'uwu-player-cols',
  presets:        PRESETS,
  defaultPreset:  'Default',
  defaultSorting: [{ id: 'useful_dmg', desc: true }],
})

// Healer rows always sort last regardless of direction.
// TanStack multiplies sortingFn result by -1 for desc, which would flip healers
// to the top. Pre-multiply by -1 for desc to cancel the inversion.
function healerSortFn(
  a: { original: Player },
  b: { original: Player },
  columnId: string,
): number {
  const aNull = a.original.useful === null
  const bNull = b.original.useful === null
  if (aNull !== bNull) {
    const desc = sorting.value.find(s => s.id === columnId)?.desc ?? false
    return (desc ? -1 : 1) * (aNull ? 1 : -1)
  }
  return (a.original.useful?.per_second ?? a.original.damage.per_second) -
         (b.original.useful?.per_second ?? b.original.damage.per_second)
}

// ── Column definitions ─────────────────────────────────────────────────────

const ch = createColumnHelper<Player>()

const columns = [
  ch.accessor('name', {
    id: 'name',
    header: 'Name',
    meta: { cls: 'col-name', noHide: true },
    cell: ({ row }) => {
      const p = row.original
      return h('div', { style: 'display:contents' }, [
        h('img', { class: 'spec-icon', src: `/static/icons/${p.spec_icon}.jpg`, alt: p.spec_name, width: 16, height: 16 }),
        h('span', { class: classSlug(p.class_name) }, p.name),
      ])
    },
    sortingFn: (a, b) => a.original.name.localeCompare(b.original.name),
  }),
  ch.accessor('active_pct', {
    id: 'active_pct',
    header: 'Active%',
    meta: { cls: 'col-sm num' },
    cell: ({ getValue }) => {
      const v = getValue()
      return v ? v.toFixed(1) + '%' : '—'
    },
    sortingFn: (a, b) => a.original.active_pct - b.original.active_pct,
  }),
  ch.accessor('casts', {
    id: 'casts',
    header: 'Casts',
    meta: { cls: 'col-sm num' },
    cell: ({ getValue }) => getValue() || '—',
    sortingFn: (a, b) => a.original.casts - b.original.casts,
  }),

  // ── Damage group ───────────────────────────────────────────────────────────
  ch.accessor(r => r.useful?.per_second ?? r.damage.per_second, {
    id: 'useful_dmg',
    header: 'Damage',
    meta: { cls: 'col-val gs' },
    cell: ({ row }) => {
      const p   = row.original
      const pct = p.useful?.percent ?? 0
      return h('span', { class: rankClass(pct) }, p.useful?.value || p.damage.value || '—')
    },
    sortingFn: healerSortFn,
  }),
  ch.display({
    id: 'dmg_bar',
    header: '',
    enableSorting: false,
    meta: { cls: 'col-bar', noHide: true },
    cell: ({ row }) => {
      const p   = row.original
      const pct = p.useful?.percent ?? 0
      return h('div', {
        class: 'bar-fill',
        style: { width: pct + '%', background: rankBarColor(pct) },
      })
    },
  }),
  ch.accessor(r => r.useful?.per_second ?? r.damage.per_second, {
    id: 'dps',
    header: 'DPS',
    meta: { cls: 'col-rate num' },
    cell: ({ row }) => {
      const p = row.original
      return fmtRate(p.useful?.per_second ?? p.damage.per_second)
    },
    sortingFn: healerSortFn,
  }),

  // ── Heal group ─────────────────────────────────────────────────────────────
  ch.accessor(r => r.heal.per_second, {
    id: 'heal',
    header: 'Heal',
    meta: { cls: 'col-val gs' },
    cell: ({ row }) => {
      const p = row.original
      return h('span', { class: rankClass(p.heal.percent) }, p.heal.value || '—')
    },
  }),
  ch.display({
    id: 'heal_bar',
    header: '',
    enableSorting: false,
    meta: { cls: 'col-bar', noHide: true },
    cell: ({ row }) => {
      const p = row.original
      return h('div', {
        class: 'bar-fill',
        style: { width: p.heal.percent + '%', background: rankBarColor(p.heal.percent) },
      })
    },
  }),
  ch.accessor(r => r.heal.per_second, {
    id: 'hps',
    header: 'HPS',
    meta: { cls: 'col-rate num' },
    cell: ({ row }) => fmtRate(row.original.heal.per_second),
  }),

  // ── Taken group ────────────────────────────────────────────────────────────
  ch.accessor(r => r.taken.per_second, {
    id: 'taken',
    header: 'Taken',
    meta: { cls: 'col-val gs' },
    cell: ({ row }) => {
      const p = row.original
      return h('span', { class: rankClass(p.taken.percent) }, p.taken.value || '—')
    },
  }),
  ch.display({
    id: 'taken_bar',
    header: '',
    enableSorting: false,
    meta: { cls: 'col-bar', noHide: true },
    cell: ({ row }) => {
      const p = row.original
      return h('div', {
        class: 'bar-fill',
        style: { width: p.taken.percent + '%', background: rankBarColor(p.taken.percent) },
      })
    },
  }),
  ch.accessor(r => r.taken.per_second, {
    id: 'dtps',
    header: 'DTPS',
    meta: { cls: 'col-rate num' },
    cell: ({ row }) => fmtRate(row.original.taken.per_second),
    sortingFn: (a, b) => a.original.taken.per_second - b.original.taken.per_second,
  }),
]

const table = useVueTable({
  get data() { return props.players },
  columns,
  enableMultiSort: false,
  state: {
    get sorting()          { return sorting.value },
    get columnVisibility() { return columnVisibility.value },
  },
  onSortingChange,
  onColumnVisibilityChange,
  getCoreRowModel:    getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
})

const hideableCols = computed(() =>
  table.getAllLeafColumns().filter(c => !c.columnDef.meta?.noHide)
)
</script>

<template>
  <div class="player-table">

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
      @click="emit('player-click', row.original.name)"
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
.player-table {
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
  cursor: pointer;
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
  font-size: 17px;
}
.col-name span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-sm {
  width: 82px;
  flex-shrink: 0;
  padding: 0 10px;
  text-align: right;
}

.col-val {
  width: 106px;
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
  width: 90px;
  flex-shrink: 0;
  padding: 0 10px;
  text-align: right;
}

.gs {
  border-left: 1px solid hsl(0, 0%, 13%);
}

.bar-fill {
  max-width: 100%;
  height: 13px;
  border-radius: 1px;
  flex-shrink: 0;
}

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
