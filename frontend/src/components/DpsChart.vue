<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js'
import type { Player } from '../types/api'
import type { PlayerView } from '../composables/useFilters'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

const props = defineProps<{
  players: Player[]
  view: PlayerView
}>()

const collapsed = ref(false)
const canvas = ref<HTMLCanvasElement | null>(null)

// Plain variable — NOT ref() or reactive(). Wrapping Chart.js in Vue proxy causes leaks.
let chartInstance: Chart | null = null

function buildChartData() {
  // When at least one player has useful data (specific boss fight), filter to dps only.
  // When useful is absent for everyone (full-raid view), show all players by damage.
  const hasSomeUseful = props.players.some(p => p.useful !== null)

  const sorted = [...props.players]
    .filter(p => {
      if (props.view === 'damage') {
        return hasSomeUseful ? p.useful !== null : p.damage.per_second > 0
      }
      return true
    })
    .sort((a, b) => {
      if (props.view === 'damage') return (b.useful?.per_second ?? b.damage.per_second) - (a.useful?.per_second ?? a.damage.per_second)
      if (props.view === 'heal') return b.heal.per_second - a.heal.per_second
      return b.taken.per_second - a.taken.per_second
    })
    .slice(0, 25)

  return {
    labels: sorted.map(p => p.name),
    values: sorted.map(p => {
      if (props.view === 'damage') return p.useful?.per_second ?? p.damage.per_second
      if (props.view === 'heal') return p.heal.per_second
      return p.taken.per_second
    }),
  }
}

function updateChart(): void {
  if (!chartInstance) return
  const { labels, values } = buildChartData()
  chartInstance.data.labels = labels
  chartInstance.data.datasets[0].data = values
  chartInstance.update()
}

onMounted(() => {
  if (!canvas.value) return
  const { labels, values } = buildChartData()
  chartInstance = new Chart(canvas.value, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: 'hsl(271, 76%, 43%)',
        borderWidth: 0,
        borderRadius: 0,
      }],
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
})

watch(() => [props.players, props.view], updateChart, { deep: false })

onUnmounted(() => {
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
    </div>
    <div v-show="!collapsed" class="chart-wrap">
      <canvas ref="canvas" />
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

.chart-wrap {
  height: 180px;
  position: relative;
}
</style>
