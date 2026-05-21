<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useFilters } from '../composables/useFilters'
import BasePage from '../components/BasePage.vue'
import BossSelector from '../components/BossSelector.vue'
import SpecFilter from '../components/SpecFilter.vue'
import DpsChart from '../components/DpsChart.vue'
import RaidOverview from '../components/RaidOverview.vue'
import PlayerTable from '../components/PlayerTable.vue'
import type { BossAttempt, AllGraphData, Player } from '../types/api'

const route = useRoute()
const router = useRouter()
const { report, players, loading, error, fetchOverview } = useReport()
const { activeView, specFilter, sortKey, sortDir, filteredPlayers, setSort, toggleSpec } = useFilters(players)

const reportId = computed(() => route.params.id as string)

watch(reportId, id => fetchOverview(id), { immediate: true })

const selectedHref = ref<string>('')

function selectBoss(attempt: BossAttempt): void {
  specFilter.value = []
  selectedHref.value = attempt.href
  const params = Object.fromEntries(new URLSearchParams(attempt.href.slice(1)))
  router.replace({ query: params })
  fetchOverview(reportId.value, params)
}

function clearBoss(): void {
  specFilter.value = []
  selectedHref.value = ''
  router.replace({ query: { view: route.query.view } })
  fetchOverview(reportId.value)
}

function goPlayer(playerName: string): void {
  router.push(`/reports/${reportId.value}/player/${encodeURIComponent(playerName)}`)
}

const bosses        = computed(() => report.value?.SEGMENTS_LINKS ?? [])
const reportTitle   = computed(() => report.value?.REPORT_NAME ?? '')
const reportDuration = computed(() => report.value?.DURATION_STR ?? '')

// ── Time-range selection ───────────────────────────────────────────────────

interface RangeSelection { startIdx: number; endIdx: number }

const allGraphData = ref<AllGraphData | null>(null)
const selectedRange = ref<RangeSelection | null>(null)

function onGraphData(data: AllGraphData): void {
  allGraphData.value = data
  selectedRange.value = null   // clear stale range whenever graph data reloads
}

function onRangeChange(range: RangeSelection | null): void {
  selectedRange.value = range
}

function fmtValue(n: number): string {
  if (!n) return ''
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

// Derive per-player stats from cumulative graph data for the selected window.
// Falls back to the normal filtered list when no range is active.
const displayPlayers = computed<Player[]>(() => {
  const range = selectedRange.value
  const gd = allGraphData.value
  if (!range || !gd) return filteredPlayers.value

  const { startIdx, endIdx } = range
  const duration = endIdx - startIdx
  if (duration <= 0) return filteredPlayers.value

  const dmgP = gd.damage?.players
  const healP = gd.heal?.players
  const takenP = gd.taken?.players

  // Damage accumulated in the window: cumul[end] - cumul[start-1]
  function windowVal(pool: Record<string, number[]> | undefined, name: string): number {
    const c = pool?.[name]
    if (!c) return 0
    return (c[endIdx] ?? c.at(-1) ?? 0) - (startIdx > 0 ? (c[startIdx - 1] ?? 0) : 0)
  }

  const derived = filteredPlayers.value.map(p => ({
    player: p,
    dmg: windowVal(dmgP, p.name),
    heal: windowVal(healP, p.name),
    taken: windowVal(takenP, p.name),
  }))

  const maxDmg   = Math.max(1, ...derived.map(d => d.dmg))
  const maxHeal  = Math.max(1, ...derived.map(d => d.heal))
  const maxTaken = Math.max(1, ...derived.map(d => d.taken))

  return derived.map(({ player, dmg, heal, taken }) => {
    const dps  = dmg  / duration
    const hps  = heal / duration
    const dtps = taken / duration
    return {
      ...player,
      useful: player.useful !== null
        ? { value: fmtValue(dmg),   per_second: dps,  percent: Math.round(dmg   / maxDmg   * 100) }
        : null,
      damage:     { value: fmtValue(dmg),   per_second: dps,  percent: Math.round(dmg   / maxDmg   * 100) },
      heal:       { value: fmtValue(heal),  per_second: hps,  percent: Math.round(heal  / maxHeal  * 100) },
      heal_total: { value: fmtValue(heal),  per_second: hps,  percent: Math.round(heal  / maxHeal  * 100) },
      taken:      { value: fmtValue(taken), per_second: dtps, percent: Math.round(taken / maxTaken * 100) },
    }
  })
})
</script>

<template>
  <div class="page-shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="report-title">{{ reportTitle }}</div>
      <BossSelector
        :bosses="bosses"
        :selected-href="selectedHref"
        @select="selectBoss"
        @deselect="clearBoss"
      />
      <nav class="sidebar-nav">
        <router-link :to="`/reports/${reportId}/timeline`" class="sidebar-nav-link">Timeline</router-link>
        <router-link :to="`/reports/${reportId}/compare`" class="sidebar-nav-link">Compare</router-link>
      </nav>
    </aside>

    <!-- Main content -->
    <main class="main-content">
      <BasePage :loading="loading" :error="error">
        <!-- Spec filter -->
        <SpecFilter
          :players="players"
          :selected="specFilter"
          @toggle="toggleSpec"
        />

        <!-- Chart: raid summary line (full-raid) or stacked area (boss) -->
        <DpsChart
          :players="filteredPlayers"
          :view="activeView"
          :report-id="reportId"
          :selected-href="selectedHref"
          @range-change="onRangeChange"
          @graph-data="onGraphData"
        />

        <!-- Full Raid overview — below chart so chart is always the primary visual -->
        <RaidOverview
          v-if="!selectedHref"
          :bosses="bosses"
          :players="players"
          :duration="reportDuration"
        />

        <!-- Player table — receives range-derived stats when a range is active -->
        <PlayerTable
          :players="displayPlayers"
          :sort-key="sortKey"
          :sort-dir="sortDir"
          @sort="setSort"
          @player-click="goPlayer"
        />
      </BasePage>
    </main>
  </div>
</template>

<style scoped>
.report-title {
  padding: 10px 12px 6px;
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 15px;
  color: var(--text);
  border-bottom: 1px solid var(--table-border);
}

/* Sidebar navigation links (Timeline / Compare) */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  padding: 6px 0;
  border-top: 1px solid var(--table-border);
  margin-top: auto;
}

.sidebar-nav-link {
  padding: 7px 14px;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-decoration: none;
}

.sidebar-nav-link:hover,
.sidebar-nav-link.router-link-active {
  color: var(--text);
  background: var(--hover-row);
}

</style>
