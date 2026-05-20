<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import {
  Chart,
  BarController, BarElement,
  LineController, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip,
} from 'chart.js'
import type { Player } from '../types/api'
import type { DamageGraphData } from '../types/api'
import type { PlayerView } from '../composables/useFilters'
import { CLASS_COLORS } from '../constants/bosses'
import { useFetch } from '../composables/useFetch'

Chart.register(
  BarController, BarElement,
  LineController, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip,
)

const props = defineProps<{
  players: Player[]
  view: PlayerView
  reportId: string
  selectedHref: string   // "" = full-raid, "?boss=..." = specific fight
}>()

const collapsed = ref(false)
const canvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null
const stackLegend = ref<{ name: string; color: string }[]>([])

const { data: graphData, loading: graphLoading, execute: fetchGraph } = useFetch<DamageGraphData>()

// Parse boss from selectedHref; null = full-raid view
const bossParam = computed(() => {
  if (!props.selectedHref) return null
  return new URLSearchParams(props.selectedHref.slice(1)).get('boss')
})

// Stacked area mode activates for any view when a specific boss is selected
const isLineMode = computed(() => !!bossParam.value)

// ── data builders ──────────────────────────────────────────────────────────

function buildBarData() {
  const view = props.view

  if (view === 'heal') {
    const sorted = [...props.players]
      .filter(p => p.heal.per_second > 0)
      .sort((a, b) => b.heal.per_second - a.heal.per_second)
      .slice(0, 25)
    return {
      labels: sorted.map(p => p.name),
      values: sorted.map(p => p.heal.per_second),
    }
  }

  if (view === 'taken') {
    const sorted = [...props.players]
      .filter(p => p.taken.per_second > 0)
      .sort((a, b) => b.taken.per_second - a.taken.per_second)
      .slice(0, 25)
    return {
      labels: sorted.map(p => p.name),
      values: sorted.map(p => p.taken.per_second),
    }
  }

  // damage
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

// Players hidden from the stack (toggled off by user)
const hiddenPlayers = ref<Set<string>>(new Set())

function togglePlayer(name: string) {
  const next = new Set(hiddenPlayers.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  hiddenPlayers.value = next
  rebuildChart()
}

function buildStackedDatasets() {
  if (!graphData.value) return null
  const { labels, players } = graphData.value

  // Top 15 by final cumulative damage, bottom of stack first (lowest DPS)
  const sorted = Object.entries(players)
    .filter(([name]) => !hiddenPlayers.value.has(name))
    .sort(([, a], [, b]) => (a.at(-1) ?? 0) - (b.at(-1) ?? 0))
    .slice(0, 15)

  const datasets = sorted.map(([name, cumul]) => {
    const player = props.players.find(p => p.name === name)
    const color = CLASS_COLORS[player?.class_name ?? ''] ?? 'hsl(271, 76%, 43%)'
    // Convert cumulative → per-second DPS
    const dps = cumul.map((v, i) => i === 0 ? v : v - cumul[i - 1])
    return {
      label: name,
      data: dps,
      borderColor: color,
      backgroundColor: color + '99',   // semi-transparent fill
      borderWidth: 1,
      pointRadius: 0,
      pointHoverRadius: 0,
      tension: 0.3,
      fill: true,
    }
  })

  // All players sorted by total for the legend (highest first)
  const legendOrder = Object.entries(players)
    .sort(([, a], [, b]) => (b.at(-1) ?? 0) - (a.at(-1) ?? 0))
    .map(([name]) => name)

  return { labels, datasets, legendOrder }
}

// ── chart lifecycle ────────────────────────────────────────────────────────

function fmtDamage(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'k'
  return String(v)
}

function rebuildChart() {
  if (!canvas.value) return
  chartInstance?.destroy()
  chartInstance = null

  if (isLineMode.value) {
    const sd = buildStackedDatasets()
    if (!sd) return

    stackLegend.value = sd.legendOrder.map(name => {
      const player = props.players.find(p => p.name === name)
      return {
        name,
        color: CLASS_COLORS[player?.class_name ?? ''] ?? 'hsl(271, 76%, 43%)',
      }
    })

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

// Re-fetch whenever boss or view changes (view switches tabs within a boss fight)
watch([bossParam, () => props.view], ([boss]) => {
  graphData.value = null
  if (!boss) return
  fetchGraph(`/api/v2/reports/${props.reportId}/damage_graph/${props.selectedHref}&view=${props.view}`)
}, { immediate: true })

// Rebuild chart when data or mode changes
watch(
  [isLineMode, graphData, () => props.players, () => props.view],
  rebuildChart,
  { deep: false },
)

onMounted(rebuildChart)
onUnmounted(() => { chartInstance?.destroy(); chartInstance = null })
</script>

<template>
  <div class="dps-chart">
    <div class="chart-header">
      <button class="collapse-btn" @click="collapsed = !collapsed">
        {{ collapsed ? '▶ Show chart' : '▼ Hide chart' }}
      </button>
      <span v-if="graphLoading" class="loading-hint">Loading…</span>
    </div>
    <div v-show="!collapsed" class="chart-wrap">
      <canvas ref="canvas" />
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

.loading-hint {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.chart-wrap {
  height: 260px;
  position: relative;
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
