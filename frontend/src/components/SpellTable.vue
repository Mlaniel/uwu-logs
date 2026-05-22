<script setup lang="ts">
import { ref, h } from 'vue'
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useVueTable,
  FlexRender,
  type SortingState,
} from '@tanstack/vue-table'
import type { SpellRow } from '../types/api'

const props = defineProps<{
  spells: SpellRow[]
}>()

function parseNum(s: string | undefined): number {
  if (!s) return 0
  return parseFloat(s.replace(/\s/g, '')) || 0
}

// ── Column definitions ─────────────────────────────────────────────────
const ch = createColumnHelper<SpellRow>()

const columns = [
  ch.display({
    id: 'spell',
    header: 'Spell',
    enableSorting: false,
    meta: { cls: 'col-name' },
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
  ch.accessor('casts', {
    id: 'casts',
    header: 'Casts',
    meta: { cls: 'col-casts num' },
    cell: info => info.getValue() || '—',
    sortingFn: (a, b) => parseNum(a.original.casts) - parseNum(b.original.casts),
  }),
  ch.accessor('percent', {
    id: 'percent',
    header: '%',
    meta: { cls: 'col-pct num' },
    cell: ({ getValue }) => {
      const v = getValue()
      return v != null ? v + '%' : '—'
    },
    sortingFn: (a, b) => (a.original.percent ?? 0) - (b.original.percent ?? 0),
  }),
  ch.accessor('actual', {
    id: 'actual',
    header: 'Amount',
    meta: { cls: 'col-amount num' },
    cell: info => info.getValue() || '—',
    sortingFn: (a, b) => parseNum(a.original.actual) - parseNum(b.original.actual),
  }),
  ch.display({
    id: 'bar',
    header: '',
    enableSorting: false,
    meta: { cls: 'col-bar' },
    cell: ({ row }) => h('div', {
      class: 'bar-fill',
      style: { width: (row.original.percent ?? 0) + '%' },
    }),
  }),
]

const sorting = ref<SortingState>([{ id: 'percent', desc: true }])

const table = useVueTable({
  get data() { return props.spells },
  columns,
  enableMultiSort: false,
  state: {
    get sorting() { return sorting.value },
  },
  onSortingChange: upd => {
    sorting.value = typeof upd === 'function' ? upd(sorting.value) : upd
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
})
</script>

<template>
  <div class="spell-table">

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
.spell-table {
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  align-items: center;
  height: 38px;
  border-bottom: 1px solid var(--table-border);
}

/* ── Header ── */
.hdr {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  user-select: none;
}
.hdr .sortable { cursor: pointer; }
.hdr .sortable:hover { color: var(--text); }

/* ── Data rows ── */
.data-row:hover { background: var(--hover-row); }

/* ── Columns ── */
.col-name {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
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
  font-size: 15px;
}
.spell-link:hover { text-decoration: underline; }

.col-name span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
}

.col-casts {
  width: 64px;
  flex-shrink: 0;
  padding: 0 8px;
  text-align: right;
}

.col-pct {
  width: 52px;
  flex-shrink: 0;
  padding: 0 8px;
  text-align: right;
}

.col-amount {
  width: 100px;
  flex-shrink: 0;
  padding: 0 8px;
  text-align: right;
}

.col-bar {
  width: 100px;
  flex-shrink: 0;
  padding: 0 8px;
  display: flex;
  align-items: center;
}

.bar-fill {
  height: 6px;
  background: var(--primary-dim);
  border-radius: 1px;
  max-width: 100%;
  flex-shrink: 0;
}

.num {
  font-family: 'Barlow Condensed', sans-serif;
  font-variant-numeric: tabular-nums;
  font-size: 14px;
}
</style>
