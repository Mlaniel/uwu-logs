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
import type { BossAttempt, AllGraphData, Player, RaidGraphData } from '../types/api'

const route = useRoute()
const router = useRouter()
const { report, players, loading, error, fetchOverview } = useReport()
const { activeView, specFilter, sortKey, sortDir, filteredPlayers, setSort, toggleSpec } = useFilters(players)

const reportId = computed(() => route.params.id as string)

const selectedHref = ref<string>('')

watch(reportId, id => {
  const q = route.query
  if (q.s && q.f) {
    const params: Record<string, string> = {}
    for (const [k, v] of Object.entries(q)) {
      if (v != null) params[k] = String(v)
    }
    selectedHref.value = '?' + new URLSearchParams(params).toString()
    fetchOverview(id, params)
  } else {
    fetchOverview(id)
  }
}, { immediate: true })

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
  router.push({
    path: `/reports/${reportId.value}/player/${encodeURIComponent(playerName)}`,
    query: bossQuery.value,
  })
}

const bosses        = computed(() => report.value?.SEGMENTS_LINKS ?? [])
const reportTitle   = computed(() => report.value?.REPORT_NAME ?? '')
const reportDuration = computed(() => report.value?.DURATION_STR ?? '')

const bossQuery = computed(() => {
  if (!selectedHref.value) return {}
  return Object.fromEntries(new URLSearchParams(selectedHref.value.slice(1)))
})

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

// ── Full-raid segment filter ───────────────────────────────────────────────

type RaidFilter = 'all' | 'boss' | 'trash'
const raidFilter = ref<RaidFilter>('all')
const raidGraphData = ref<RaidGraphData | null>(null)

function onRaidData(data: RaidGraphData | null): void {
  raidGraphData.value = data
}

function fmtValue(n: number): string {
  if (!n) return ''
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function computeFilteredRaidPlayers(base: Player[], rd: RaidGraphData, filter: RaidFilter): Player[] {
  const n = rd.labels.length
  const inBoss = new Uint8Array(n)
  for (const r of rd.boss_regions ?? []) {
    const end = Math.min(r.end_sec, n - 1)
    for (let s = r.start_sec; s <= end; s++) inBoss[s] = 1
  }

  function secActive(s: number): boolean {
    if (filter === 'boss')  return inBoss[s] === 1
    if (filter === 'trash') return inBoss[s] === 0
    return true
  }

  let duration = 0
  for (let s = 0; s < n; s++) if (secActive(s)) duration++
  if (duration === 0) return base

  function playerSum(pool: Record<string, number[]> | undefined, name: string): number {
    const arr = pool?.[name]
    if (!arr) return 0
    let total = 0
    for (let s = 0; s < n; s++) if (secActive(s)) total += arr[s] ?? 0
    return total
  }

  const dmgPool   = rd.players?.damage
  const healPool  = rd.players?.heal
  const takenPool = rd.players?.taken

  const derived = base.map(p => ({
    p,
    dmg:   playerSum(dmgPool,   p.name),
    heal:  playerSum(healPool,  p.name),
    taken: playerSum(takenPool, p.name),
  }))

  const maxDmg   = Math.max(1, ...derived.map(d => d.dmg))
  const maxHeal  = Math.max(1, ...derived.map(d => d.heal))
  const maxTaken = Math.max(1, ...derived.map(d => d.taken))

  return derived.map(({ p, dmg, heal, taken }) => ({
    ...p,
    useful: p.useful !== null
      ? { value: fmtValue(dmg), per_second: dmg/duration, percent: Math.round(dmg/maxDmg*100) }
      : null,
    damage:     { value: fmtValue(dmg),   per_second: dmg/duration,   percent: Math.round(dmg/maxDmg*100)     },
    heal:       { value: fmtValue(heal),  per_second: heal/duration,  percent: Math.round(heal/maxHeal*100)   },
    heal_total: { value: fmtValue(heal),  per_second: heal/duration,  percent: Math.round(heal/maxHeal*100)   },
    taken:      { value: fmtValue(taken), per_second: taken/duration, percent: Math.round(taken/maxTaken*100) },
  }))
}

// Derive per-player stats from cumulative graph data for the selected window.
// Falls back to the normal filtered list when no range is active.
const displayPlayers = computed<Player[]>(() => {
  // Full-raid filter: recompute from per-second arrays when filter is active
  if (!selectedHref.value && raidGraphData.value && raidFilter.value !== 'all') {
    return computeFilteredRaidPlayers(filteredPlayers.value, raidGraphData.value, raidFilter.value)
  }

  // Boss drag-select range
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
        <router-link :to="`/reports/${reportId}`" class="sidebar-nav-link" active-class="" exact-active-class="router-link-exact-active">Damage</router-link>
        <router-link :to="{ path: `/reports/${reportId}/timeline`, query: bossQuery }" class="sidebar-nav-link">Timeline</router-link>
        <router-link :to="{ path: `/reports/${reportId}/compare`, query: bossQuery }" class="sidebar-nav-link">Compare</router-link>
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

        <!-- Raid segment filter — full-raid view only -->
        <div v-if="!selectedHref" class="raid-filter">
          <button
            v-for="opt in (['boss', 'all', 'trash'] as const)"
            :key="opt"
            class="rf-btn"
            :class="{ active: raidFilter === opt }"
            @click="raidFilter = opt"
          >{{ opt === 'all' ? 'All' : opt === 'boss' ? 'Boss' : 'Trash' }}</button>
        </div>

        <!-- Chart: raid summary line (full-raid) or stacked area (boss) -->
        <DpsChart
          :players="filteredPlayers"
          :view="activeView"
          :report-id="reportId"
          :selected-href="selectedHref"
          :raid-filter="raidFilter"
          @range-change="onRangeChange"
          @graph-data="onGraphData"
          @raid-data="onRaidData"
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


/* ── Raid segment filter ─────────────────────────────────────────────────── */

.raid-filter {
  display: flex;
  gap: 4px;
  padding: 0 0 8px;
}

.rf-btn {
  background: none;
  border: 1px solid var(--table-border);
  border-radius: 3px;
  color: var(--text-muted);
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 3px 12px;
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s;
}

.rf-btn:hover {
  color: var(--text);
  border-color: var(--text-muted);
}

.rf-btn.active {
  color: var(--text);
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 12%, transparent);
}

</style>
