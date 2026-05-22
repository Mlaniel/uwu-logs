<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import {
  Chart,
  LineController, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler,
} from 'chart.js'
import type { Player, DamageGraphData, AllGraphData, RaidGraphData, DeathApiResponse } from '../types/api'
import type { PlayerView } from '../composables/useFilters'
import { CLASS_COLORS } from '../constants/bosses'
import { useFetch } from '../composables/useFetch'

Chart.register(
  LineController, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler,
)

interface RangeSelection { startIdx: number; endIdx: number }

const props = defineProps<{
  players: Player[]
  view: PlayerView
  reportId: string
  selectedHref: string
  raidFilter?: 'all' | 'boss' | 'trash'
}>()

const emit = defineEmits<{
  'range-change': [range: RangeSelection | null]
  'graph-data': [data: AllGraphData]
  'raid-data': [data: RaidGraphData | null]
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

// Full-raid line chart data — fetched once when no boss is selected
const { data: raidData, execute: fetchRaid } = useFetch<RaidGraphData>()

// Death/revive data — fetched alongside graph data in boss mode
const { data: deathData, execute: fetchDeaths } = useFetch<DeathApiResponse>()

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

// ── Death / revive markers ─────────────────────────────────────────────────

interface DeathMark {
  sec: number        // seconds from fight start
  player: string
  classSlug: string  // CSS class e.g. "death-knight"
  cause: string      // "Source — Spell"
  amount: string     // killing blow formatted
}

interface ReviveMark {
  sec: number
  target: string     // revived player
  caster: string     // who cast the rez
  spell: string
}

const deathMarks = computed<DeathMark[]>(() => {
  if (!deathData.value || !isLineMode.value) return []
  return Object.entries(deathData.value.DEATHS)
    .filter(([, entry]) => {
      const first = entry.death[0]
      return first && String(first[1]) !== 'RESURRECT'
    })
    .map(([key, entry]) => {
      const sec = Math.round(parseFloat(key))
      const guid = deathData.value!.PLAYERS[entry.player]
      const cls  = guid ? (deathData.value!.CLASSES[guid] ?? '') : ''
      const kb   = entry.death[1]
      let cause = '', amount = ''
      if (kb && String(kb[1]) === 'DAMAGE') {
        const src   = String(kb[3] ?? '')
        const spell = String(kb[5] ?? '')
        cause = (src && src !== entry.player) ? `${src} — ${spell}` : spell
        const v = kb[6]
        if (v != null && v !== '' && v !== 0)
          amount = Number(v).toLocaleString('en-US')
      }
      return {
        sec,
        player:    entry.player,
        classSlug: cls.toLowerCase().replace(/\s+/g, '-'),
        cause,
        amount,
      }
    })
})

const reviveMarks = computed<ReviveMark[]>(() => {
  if (!deathData.value || !isLineMode.value) return []
  return Object.entries(deathData.value.DEATHS)
    .filter(([, entry]) => {
      const first = entry.death[0]
      return first && String(first[1]) === 'RESURRECT'
    })
    .map(([key, entry]) => {
      const sec  = Math.round(parseFloat(key))
      const line = entry.death[0]
      return {
        sec,
        target: entry.player,
        caster: String(line[3] ?? ''),
        spell:  String(line[5] ?? ''),
      }
    })
})

// Tooltip shown on hover near a marker
interface MarkerTooltip { x: number; y: number; lines: string[] }
const markerTooltip = ref<MarkerTooltip | null>(null)

// Hit-test rects populated by the canvas plugin each draw cycle
let markerHits: Array<{ x: number; lines: string[] }> = []

function onTooltipMove(e: MouseEvent): void {
  if (!isLineMode.value || !chartInstance) { markerTooltip.value = null; return }
  const rect = chartWrap.value!.getBoundingClientRect()
  const mx   = e.clientX - rect.left
  const my   = e.clientY - rect.top
  for (const h of markerHits) {
    if (Math.abs(mx - h.x) <= 9) {
      markerTooltip.value = { x: h.x, y: my, lines: h.lines }
      return
    }
  }
  markerTooltip.value = null
}

function onTooltipLeave(): void {
  markerTooltip.value = null
}

function makeMarkerPlugin() {
  return {
    id: 'deathRevive',
    afterDraw(chart: Chart) {
      const { ctx, scales, chartArea } = chart as any
      const xScale = scales.x
      const start  = localRange.value?.startIdx ?? 0
      markerHits   = []
      ctx.save()

      for (const mark of deathMarks.value) {
        const idx = mark.sec - start
        const x   = xScale.getPixelForValue(idx)
        if (x < chartArea.left - 6 || x > chartArea.right + 6) continue

        // Dashed red vertical line
        ctx.strokeStyle = 'rgba(220,55,55,0.5)'
        ctx.lineWidth   = 1
        ctx.setLineDash([2, 4])
        ctx.beginPath()
        ctx.moveTo(x, chartArea.top)
        ctx.lineTo(x, chartArea.bottom)
        ctx.stroke()
        ctx.setLineDash([])

        // Red circle at top
        ctx.fillStyle = 'rgba(220,55,55,0.92)'
        ctx.beginPath()
        ctx.arc(x, chartArea.top + 7, 4.5, 0, Math.PI * 2)
        ctx.fill()

        const lines = [`☠ ${mark.player}`]
        if (mark.cause)  lines.push(mark.cause)
        if (mark.amount) lines.push(`${mark.amount} dmg`)
        markerHits.push({ x, lines })
      }

      for (const mark of reviveMarks.value) {
        const idx = mark.sec - start
        const x   = xScale.getPixelForValue(idx)
        if (x < chartArea.left - 6 || x > chartArea.right + 6) continue

        // Green upward triangle at bottom
        const by = chartArea.bottom - 4
        ctx.fillStyle = 'rgba(72,187,120,0.92)'
        ctx.beginPath()
        ctx.moveTo(x,     by - 11)
        ctx.lineTo(x - 5, by)
        ctx.lineTo(x + 5, by)
        ctx.closePath()
        ctx.fill()

        markerHits.push({
          x,
          lines: [
            `+ ${mark.target}`,
            `${mark.caster} — ${mark.spell}`,
          ],
        })
      }

      ctx.restore()
    },
  }
}

// ── Data builders ──────────────────────────────────────────────────────────

function fmtDamage(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'k'
  return String(v)
}

// Kill boundary markers for the full-raid chart — set by buildRaidLineData.
const raidKillBoundaries = ref<{ name: string; idx: number; end_idx: number; is_kill: boolean }[]>([])

// Full-raid continuous timeline: single flat per-second arrays from raid start to end.
function buildRaidLineData() {
  const rd = raidData.value
  if (!rd?.labels?.length) return null

  const playerNames = new Set(props.players.map(p => p.name))
  const filter = props.raidFilter ?? 'all'

  // Build a per-second inclusion mask from boss_regions
  const n = rd.labels.length
  const inBoss = new Uint8Array(n)
  for (const r of rd.boss_regions ?? []) {
    const end = Math.min(r.end_sec, n - 1)
    for (let s = r.start_sec; s <= end; s++) inBoss[s] = 1
  }

  function secActive(s: number): boolean {
    if (filter === 'all')   return true
    if (filter === 'boss')  return inBoss[s] === 1
    return inBoss[s] === 0
  }

  function sumFiltered(pool: Record<string, number[]> | undefined, fallback: number[], s: number): number {
    if (!secActive(s)) return 0
    if (!pool) return fallback[s] ?? 0
    let total = 0
    for (const [name, arr] of Object.entries(pool)) {
      if (playerNames.has(name)) total += arr[s] ?? 0
    }
    return total
  }

  const dps: number[] = []
  const hps: number[] = []
  const dtps: number[] = []

  for (let s = 0; s < n; s++) {
    dps.push(sumFiltered(rd.players?.damage, rd.damage, s))
    hps.push(sumFiltered(rd.players?.heal,   rd.heal,   s))
    dtps.push(sumFiltered(rd.players?.taken,  rd.taken,  s))
  }

  raidKillBoundaries.value = (rd.boss_regions ?? []).map(r => ({
    name:    r.name,
    idx:     r.start_sec,
    end_idx: r.end_sec,
    is_kill: r.is_kill,
  }))

  const datasets = [
    {
      label: 'DPS',
      data: dps,
      borderColor: 'rgba(167,99,247,0.9)',
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.3,
    },
    {
      label: 'HPS',
      data: hps,
      borderColor: 'rgba(72,187,120,0.9)',
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.3,
    },
    {
      label: 'DTPS',
      data: dtps,
      borderColor: 'rgba(239,84,84,0.9)',
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.3,
    },
  ]
  return { labels: rd.labels, datasets }
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

  const filteredNames = new Set(props.players.map(p => p.name))

  // Lowest range-damage first → bottom of stack (highest DPS renders on top)
  const sorted = Object.entries(players)
    .filter(([name]) => !hiddenPlayers.value.has(name) && filteredNames.has(name))
    .sort(([, a], [, b]) => rangeDmg(a) - rangeDmg(b))

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

  // Legend: highest range-damage first, filtered to visible players
  const legendOrder = Object.entries(players)
    .filter(([name]) => filteredNames.has(name))
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
      plugins: [makeMarkerPlugin()],
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
    const rd = buildRaidLineData()
    if (!rd) return

    const killLabelPlugin = {
      id: 'killLabels',
      beforeDraw(chart: Chart) {
        const { ctx, scales, chartArea } = chart as any
        ctx.save()
        for (const { idx, end_idx, is_kill } of raidKillBoundaries.value) {
          const x0 = Math.max(chartArea.left, scales.x.getPixelForValue(idx))
          const x1 = Math.min(chartArea.right, scales.x.getPixelForValue(end_idx))
          if (x1 <= x0) continue
          ctx.fillStyle = is_kill ? 'rgba(72,187,120,0.04)' : 'rgba(239,84,84,0.04)'
          ctx.fillRect(x0, chartArea.top, x1 - x0, chartArea.bottom - chartArea.top)
        }
        ctx.restore()
      },
      afterDraw(chart: Chart) {
        const { ctx, scales, chartArea } = chart as any
        ctx.save()
        for (const { name, idx, end_idx, is_kill } of raidKillBoundaries.value) {
          const x0 = scales.x.getPixelForValue(idx)
          const x1 = scales.x.getPixelForValue(end_idx)
          const lineColor  = is_kill ? 'rgba(72,187,120,0.45)' : 'rgba(239,84,84,0.30)'
          const labelColor = is_kill ? 'rgba(180,240,200,0.85)' : 'rgba(239,150,150,0.55)'
          const dash       = is_kill ? [] : [3, 5]

          // Start line + label
          if (x0 >= chartArea.left - 1 && x0 <= chartArea.right) {
            ctx.strokeStyle = lineColor
            ctx.lineWidth = 1
            ctx.setLineDash(dash)
            ctx.beginPath()
            ctx.moveTo(x0, chartArea.top)
            ctx.lineTo(x0, chartArea.bottom)
            ctx.stroke()
            ctx.setLineDash([])
            ctx.fillStyle = labelColor
            ctx.font = `${is_kill ? '600' : '400'} 12px "Barlow Condensed", sans-serif`
            ctx.textAlign = 'left'
            ctx.fillText(name, x0 + 4, chartArea.top + 14)
          }

          // End line
          if (x1 >= chartArea.left && x1 <= chartArea.right + 1) {
            ctx.strokeStyle = lineColor
            ctx.lineWidth = 1
            ctx.setLineDash(dash)
            ctx.beginPath()
            ctx.moveTo(x1, chartArea.top)
            ctx.lineTo(x1, chartArea.bottom)
            ctx.stroke()
            ctx.setLineDash([])
          }
        }
        ctx.restore()
      },
    }

    chartInstance = new Chart(canvas.value, {
      type: 'line',
      data: { labels: rd.labels, datasets: rd.datasets },
      plugins: [killLabelPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: {
              color: '#9e9e9e',
              font: { family: 'Barlow Condensed', size: 11 },
              boxWidth: 10,
              boxHeight: 10,
              padding: 12,
            },
          },
          tooltip: {
            itemSort: (a, b) => (b.raw as number) - (a.raw as number),
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${fmtDamage(ctx.raw as number)}`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#5e5e5e',
              font: { family: 'Barlow Condensed', size: 11 },
              maxTicksLimit: 20,
              maxRotation: 0,
            },
            grid: { color: 'hsl(0, 0%, 8%)' },
          },
          y: {
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
  }
}

// Fetch data when boss selection changes
watch(bossParam, (boss) => {
  localRange.value = null
  dmgData.value = null
  healData.value = null
  takenData.value = null
  emit('range-change', null)

  if (!boss) {
    emit('graph-data', { damage: null, heal: null, taken: null })
    if (!raidData.value) {
      graphLoading.value = true
      fetchRaid(`/api/v2/reports/${props.reportId}/raid_graph/`).then(() => {
        graphLoading.value = false
        emit('raid-data', raidData.value)
      })
    } else {
      emit('raid-data', raidData.value)
    }
    return
  }

  graphLoading.value = true
  const base = `/api/v2/reports/${props.reportId}/damage_graph/${props.selectedHref}`
  Promise.all([
    fetchDmg(`${base}&view=damage`),
    fetchHeal(`${base}&view=heal`),
    fetchTaken(`${base}&view=taken`),
    fetchDeaths(`/api/v2/reports/${props.reportId}/deaths/${props.selectedHref}`),
  ]).then(() => {
    graphLoading.value = false
    emit('graph-data', { damage: dmgData.value, heal: healData.value, taken: takenData.value })
  })
}, { immediate: true })

watch(
  [isLineMode, graphData, raidData, () => props.players, () => props.view, () => props.raidFilter, deathMarks, reviveMarks],
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
      @mousemove="onTooltipMove"
      @mouseleave="onTooltipLeave"
    >
      <canvas ref="canvas" />
      <div v-if="overlayStyle" class="select-overlay" :style="overlayStyle" />
      <div
        v-if="markerTooltip && isLineMode"
        class="marker-tooltip"
        :style="{ left: markerTooltip.x + 'px', top: (markerTooltip.y - 10) + 'px' }"
      >
        <div v-for="line in markerTooltip.lines" :key="line" class="tt-line">{{ line }}</div>
      </div>
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

/* ── Death / revive tooltip ── */
.marker-tooltip {
  position: absolute;
  transform: translate(-50%, -100%);
  pointer-events: none;
  background: hsl(0, 0%, 10%);
  border: 1px solid hsl(0, 0%, 20%);
  border-radius: 4px;
  padding: 5px 8px;
  white-space: nowrap;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 12px;
  line-height: 1.55;
  z-index: 10;
}
.tt-line:first-child { font-weight: 600; }
</style>
