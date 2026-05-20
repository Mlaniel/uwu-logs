<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import {
  Chart,
  BarController, BarElement,
  LineController, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip,
} from 'chart.js'
import type { Player, DamageGraphData, AllGraphData } from '../types/api'
import type { PlayerView } from '../composables/useFilters'
import { CLASS_COLORS } from '../constants/bosses'
import { useFetch } from '../composables/useFetch'

Chart.register(
  BarController, BarElement,
  LineController, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip,
)

interface RangeSelection { startIdx: number; endIdx: number }

const props = defineProps<{
  players: Player[]
  view: PlayerView
  reportId: string
  selectedHref: string
}>()

const emit = defineEmits<{
  'range-change': [range: RangeSelection | null]
  'graph-data': [data: AllGraphData]
}>()

const collapsed = ref(false)
const canvas = ref<HTMLCanvasElement | null>(null)
const chartWrap = ref<HTMLDivElement | null>(null)
let chartInstance: Chart | null = null
const stackLegend = ref<{ name: string; color: string }[]>([])
const graphLoading = ref(false)

// One fetch instance per stat type — all three pre-loaded when a boss is selected
const { data: dmgData, execute: fetchDmg } = useFetch<DamageGraphData>()
const { data: healData, execute: fetchHeal } = useFetch<DamageGraphData>()
const { data: takenData, execute: fetchTaken } = useFetch<DamageGraphData>()

// Graph data for the currently active chart view
const graphData = computed<DamageGraphData | null>(() =>
  props.view === 'heal' ? healData.value :
  props.view === 'taken' ? takenData.value :
  dmgData.value
)

const bossParam = computed(() => {
  if (!props.selectedHref) return null
  return new URLSearchParams(props.selectedHref.slice(1)).get('boss')
})

const isLineMode = computed(() => !!bossParam.value)

// ── Drag-select ────────────────────────────────────────────────────────────

const isDragging = ref(false)
const dragStartPx = ref(0)
const dragCurrentPx = ref(0)
const localRange = ref<RangeSelection | null>(null)

function getWrapX(e: MouseEvent): number {
  return e.clientX - (chartWrap.value?.getBoundingClientRect().left ?? 0)
}

// Linearly interpolate mouse X → data array index
function pixelToIdx(px: number): number {
  if (!chartInstance || !graphData.value) return 0
  const scale = chartInstance.scales.x
  const n = graphData.value.labels.length
  const clamped = Math.max(scale.left, Math.min(scale.right, px))
  return Math.round(((clamped - scale.left) / (scale.right - scale.left)) * (n - 1))
}

function commitRange(endPx: number): void {
  const delta = Math.abs(endPx - dragStartPx.value)
  if (delta < 5) { clearRange(); return }

  const startIdx = pixelToIdx(Math.min(dragStartPx.value, endPx))
  const endIdx = pixelToIdx(Math.max(dragStartPx.value, endPx))
  if (endIdx <= startIdx) { clearRange(); return }

  localRange.value = { startIdx, endIdx }
  emit('range-change', localRange.value)
  rebuildChart()
}

function onWrapMouseDown(e: MouseEvent) {
  if (!isLineMode.value || !chartInstance) return
  e.preventDefault()
  isDragging.value = true
  dragStartPx.value = getWrapX(e)
  dragCurrentPx.value = dragStartPx.value
  window.addEventListener('mousemove', onWinMouseMove)
  window.addEventListener('mouseup', onWinMouseUp, { once: true })
}

function onWinMouseMove(e: MouseEvent) {
  if (isDragging.value) dragCurrentPx.value = getWrapX(e)
}

function onWinMouseUp(e: MouseEvent) {
  window.removeEventListener('mousemove', onWinMouseMove)
  if (!isDragging.value) return
  isDragging.value = false
  commitRange(getWrapX(e))
}

function clearRange() {
  isDragging.value = false
  if (!localRange.value) return
  localRange.value = null
  emit('range-change', null)
  rebuildChart()
}

// Drag overlay — clamped to chart data area, shown only while dragging
const overlayStyle = computed((): Record<string, string> | null => {
  if (!isDragging.value || !chartInstance) return null
  const scale = chartInstance.scales.x
  const lo = Math.max(scale.left, Math.min(scale.right, Math.min(dragStartPx.value, dragCurrentPx.value)))
  const hi = Math.max(scale.left, Math.min(scale.right, Math.max(dragStartPx.value, dragCurrentPx.value)))
  return { left: lo + 'px', width: Math.max(1, hi - lo) + 'px' }
})

const rangeLabel = computed(() => {
  if (!localRange.value || !graphData.value) return ''
  const { labels } = graphData.value
  const s = labels[localRange.value.startIdx] ?? ''
  const e = labels[localRange.value.endIdx] ?? ''
  return `${s} – ${e}`
})

// ── Legend toggle ──────────────────────────────────────────────────────────

const hiddenPlayers = ref<Set<string>>(new Set())

function togglePlayer(name: string) {
  const next = new Set(hiddenPlayers.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  hiddenPlayers.value = next
  rebuildChart()
}

// ── Data builders ──────────────────────────────────────────────────────────

function fmtDamage(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'k'
  return String(v)
}

function buildBarData() {
  const view = props.view
  if (view === 'heal') {
    const sorted = [...props.players].filter(p => p.heal.per_second > 0)
      .sort((a, b) => b.heal.per_second - a.heal.per_second).slice(0, 25)
    return { labels: sorted.map(p => p.name), values: sorted.map(p => p.heal.per_second) }
  }
  if (view === 'taken') {
    const sorted = [...props.players].filter(p => p.taken.per_second > 0)
      .sort((a, b) => b.taken.per_second - a.taken.per_second).slice(0, 25)
    return { labels: sorted.map(p => p.name), values: sorted.map(p => p.taken.per_second) }
  }
  const hasSomeUseful = props.players.some(p => p.useful !== null)
  const sorted = [...props.players]
    .filter(p => hasSomeUseful ? p.useful !== null : p.damage.per_second > 0)
    .sort((a, b) =>
      (b.useful?.per_second ?? b.damage.per_second) -
      (a.useful?.per_second ?? a.damage.per_second)
    )
    .slice(0, 25)
  return {
    labels: sorted.map(p => p.name),
    values: sorted.map(p => p.useful?.per_second ?? p.damage.per_second),
  }
}

function buildStackedDatasets() {
  if (!graphData.value) return null
  const { labels: allLabels, players } = graphData.value

  const start = localRange.value?.startIdx ?? 0
  const end = localRange.value?.endIdx ?? allLabels.length - 1
  const labels = allLabels.slice(start, end + 1)

  // Damage accumulated within the selected window
  function rangeDmg(cumul: number[]): number {
    return (cumul[end] ?? 0) - (start > 0 ? (cumul[start - 1] ?? 0) : 0)
  }

  // Lowest range-damage first → bottom of stack
  const sorted = Object.entries(players)
    .filter(([name]) => !hiddenPlayers.value.has(name))
    .sort(([, a], [, b]) => rangeDmg(a) - rangeDmg(b))
    .slice(0, 15)

  const datasets = sorted.map(([name, cumul]) => {
    const color = CLASS_COLORS[props.players.find(p => p.name === name)?.class_name ?? ''] ?? 'hsl(271, 76%, 43%)'
    const baseline = start > 0 ? (cumul[start - 1] ?? 0) : 0
    const sliced = cumul.slice(start, end + 1)
    // Convert cumulative → per-second
    const dps = sliced.map((v, i) => v - (i === 0 ? baseline : sliced[i - 1]))
    return {
      label: name, data: dps,
      borderColor: color, backgroundColor: color + '99',
      borderWidth: 1, pointRadius: 0, pointHoverRadius: 0,
      tension: 0.3, fill: true,
    }
  })

  // Legend: highest range-damage first
  const legendOrder = Object.entries(players)
    .sort(([, a], [, b]) => rangeDmg(b) - rangeDmg(a))
    .map(([name]) => name)

  return { labels, datasets, legendOrder }
}

// ── Chart lifecycle ────────────────────────────────────────────────────────

function rebuildChart() {
  if (!canvas.value) return
  chartInstance?.destroy()
  chartInstance = null

  if (isLineMode.value) {
    const sd = buildStackedDatasets()
    if (!sd) return

    stackLegend.value = sd.legendOrder.map(name => ({
      name,
      color: CLASS_COLORS[props.players.find(p => p.name === name)?.class_name ?? ''] ?? 'hsl(271, 76%, 43%)',
    }))

    chartInstance = new Chart(canvas.value, {
      type: 'line',
      data: { labels: sd.labels, datasets: sd.datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            itemSort: (a, b) => (b.raw as number) - (a.raw as number),
            callbacks: {
              label: ctx => {
                const suffix = props.view === 'heal' ? 'HPS' : props.view === 'taken' ? 'DTPS' : 'DPS'
                return ` ${ctx.dataset.label}: ${fmtDamage(ctx.raw as number)} ${suffix}`
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#5e5e5e',
              font: { family: 'Barlow Condensed', size: 11 },
              maxTicksLimit: 12,
            },
            grid: { color: 'hsl(0, 0%, 8%)' },
          },
          y: {
            stacked: true,
            ticks: {
              color: '#5e5e5e',
              font: { family: 'Barlow Condensed', size: 11 },
              callback: v => fmtDamage(v as number),
            },
            grid: { color: 'hsl(0, 0%, 8%)' },
          },
        },
      },
    })
  } else {
    stackLegend.value = []
    localRange.value = null
    const { labels, values } = buildBarData()
    chartInstance = new Chart(canvas.value, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: 'hsl(271, 76%, 43%)', borderWidth: 0, borderRadius: 0 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: { color: 'gainsboro', font: { family: 'Barlow Condensed', size: 11 } },
            grid: { color: 'hsl(0, 0%, 8%)' },
          },
          y: {
            ticks: { color: '#5e5e5e', font: { family: 'Barlow Condensed', size: 11 } },
            grid: { color: 'hsl(0, 0%, 8%)' },
          },
        },
      },
    })
  }
}

// Fetch all 3 datasets when boss changes
watch(bossParam, (boss) => {
  localRange.value = null
  dmgData.value = null
  healData.value = null
  takenData.value = null
  emit('range-change', null)
  if (!boss) {
    emit('graph-data', { damage: null, heal: null, taken: null })
    return
  }
  graphLoading.value = true
  const base = `/api/v2/reports/${props.reportId}/damage_graph/${props.selectedHref}`
  Promise.all([
    fetchDmg(`${base}&view=damage`),
    fetchHeal(`${base}&view=heal`),
    fetchTaken(`${base}&view=taken`),
  ]).then(() => {
    graphLoading.value = false
    emit('graph-data', { damage: dmgData.value, heal: healData.value, taken: takenData.value })
  })
}, { immediate: true })

watch(
  [isLineMode, graphData, () => props.players, () => props.view],
  rebuildChart,
  { deep: false },
)

onMounted(rebuildChart)
onUnmounted(() => {
  window.removeEventListener('mousemove', onWinMouseMove)
  chartInstance?.destroy()
  chartInstance = null
})
</script>

<template>
  <div class="dps-chart">
    <div class="chart-header">
      <button class="collapse-btn" @click="collapsed = !collapsed">
        {{ collapsed ? '▶ Show chart' : '▼ Hide chart' }}
      </button>
      <span v-if="graphLoading" class="loading-hint">Loading…</span>
      <template v-if="localRange && !graphLoading">
        <span class="range-label">{{ rangeLabel }}</span>
        <button class="clear-range-btn" @click="clearRange">✕ Clear</button>
      </template>
      <span v-if="isLineMode && !localRange && !graphLoading" class="drag-hint">drag to select range</span>
    </div>
    <div
      v-show="!collapsed"
      ref="chartWrap"
      class="chart-wrap"
      :class="{ selectable: isLineMode }"
      @mousedown="onWrapMouseDown"
    >
      <canvas ref="canvas" />
      <div v-if="overlayStyle" class="select-overlay" :style="overlayStyle" />
    </div>
    <div v-if="!collapsed && stackLegend.length" class="stack-legend">
      <button
        v-for="entry in stackLegend"
        :key="entry.name"
        class="legend-btn"
        :class="{ hidden: hiddenPlayers.has(entry.name) }"
        @click="togglePlayer(entry.name)"
      >
        <span class="legend-swatch" :style="{ background: entry.color }" />
        {{ entry.name }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.dps-chart {
  margin-bottom: 0.5rem;
}

.chart-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}

.collapse-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  padding: 2px 0;
}
.collapse-btn:hover { color: var(--text); }

.loading-hint,
.drag-hint {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.range-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  letter-spacing: 0.04em;
}

.clear-range-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  padding: 0;
}
.clear-range-btn:hover { color: var(--text); }

.chart-wrap {
  height: 260px;
  position: relative;
}

.chart-wrap.selectable {
  cursor: crosshair;
}

/* Drag selection highlight */
.select-overlay {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.08);
  border-left: 1px solid rgba(255, 255, 255, 0.3);
  border-right: 1px solid rgba(255, 255, 255, 0.3);
  pointer-events: none;
}

.stack-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  padding: 4px 0 2px;
}

.legend-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--text);
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 11px;
  cursor: pointer;
  padding: 1px 4px;
  border-radius: 2px;
  transition: opacity 0.15s;
}
.legend-btn:hover { background: var(--table-border); }
.legend-btn.hidden { opacity: 0.35; }

.legend-swatch {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 1px;
  flex-shrink: 0;
}
</style>
