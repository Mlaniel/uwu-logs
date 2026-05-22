<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReport } from '../composables/useReport'
import { usePlayer } from '../composables/usePlayer'
import BasePage from '../components/BasePage.vue'
import BossSelector from '../components/BossSelector.vue'
import DpsChart from '../components/DpsChart.vue'
import SpellBarTable from '../components/SpellBarTable.vue'
import type { BossAttempt } from '../types/api'
import type { PlayerView } from '../composables/usePlayer'

const route = useRoute()
const router = useRouter()

const reportId   = computed(() => route.params.id as string)
const playerName = computed(() => route.params.name as string)
const activeView = computed<PlayerView>(() => {
  const v = route.query.view as string
  return (v === 'heal' || v === 'taken') ? v : 'damage'
})

const { report, players, loading: reportLoading, fetchOverview } = useReport()
watch(reportId, id => fetchOverview(id), { immediate: true })

const bosses      = computed(() => report.value?.SEGMENTS_LINKS ?? [])
const reportTitle = computed(() => report.value?.REPORT_NAME ?? '')

// ── Boss selection ────────────────────────────────────────────────────────────

const selectedAttempt = ref<BossAttempt | null>(null)

watch(bosses, bgs => {
  if (selectedAttempt.value || !bgs.length) return
  const qs = route.query.s as string | undefined
  const qf = route.query.f as string | undefined
  if (!qs || !qf) return
  for (const bg of bgs) {
    const found = bg.segments.find(seg => {
      const p = new URLSearchParams(seg.href.slice(1))
      return p.get('s') === qs && p.get('f') === qf
    })
    if (found) { selectedAttempt.value = found; return }
  }
}, { immediate: true })

const bossQuery = computed<Record<string, string>>(() => {
  const href = selectedAttempt.value?.href
  if (!href) return {}
  return Object.fromEntries(new URLSearchParams(href.slice(1)))
})

const selectedHref = computed(() => selectedAttempt.value?.href ?? '')
const fightDuration = computed(() => selectedAttempt.value?.duration ?? 0)

function selectBoss(attempt: BossAttempt): void {
  selectedAttempt.value = attempt
  router.replace({ query: { ...bossQuery.value, view: activeView.value } })
}

function clearBoss(): void {
  selectedAttempt.value = null
  router.replace({ query: { view: activeView.value } })
}

function setView(v: PlayerView): void {
  router.replace({ query: { ...bossQuery.value, view: v } })
}

// ── Chart — filter the report's player list to just this player ───────────────

const chartPlayers = computed(() => {
  const p = players.value.find(pl => pl.name === playerName.value)
  return p ? [p] : []
})

// ── Data fetch ────────────────────────────────────────────────────────────────

const { data, spellRows, loading, error, fetchPlayer } = usePlayer()

watch(
  [reportId, playerName, activeView, selectedAttempt],
  ([id, name, view]) => {
    fetchPlayer(id, name, view, route.query.target as string | undefined, bossQuery.value)
  },
  { immediate: true },
)

watch(
  () => route.query.target,
  () => fetchPlayer(reportId.value, playerName.value, activeView.value, route.query.target as string | undefined, bossQuery.value),
)

// ── Display ───────────────────────────────────────────────────────────────────

const title = computed(() => data.value?.SOURCE_NAME ?? playerName.value)
</script>

<template>
  <div class="page-shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="report-title">{{ reportTitle }}</div>
      <BasePage :loading="reportLoading" :error="null">
        <BossSelector
          :bosses="bosses"
          :selected-href="selectedHref"
          @select="selectBoss"
          @deselect="clearBoss"
        />
      </BasePage>
      <nav class="sidebar-nav">
        <router-link :to="{ path: `/reports/${reportId}`, query: bossQuery }" class="sidebar-nav-link" active-class="" exact-active-class="router-link-exact-active">Damage</router-link>
        <router-link :to="{ path: `/reports/${reportId}/timeline`, query: bossQuery }" class="sidebar-nav-link">Timeline</router-link>
        <router-link :to="{ path: `/reports/${reportId}/compare`, query: bossQuery }" class="sidebar-nav-link">Compare</router-link>
      </nav>
    </aside>

    <!-- Main content -->
    <main class="main-content">
      <header class="player-header">
        <router-link :to="{ path: `/reports/${reportId}`, query: bossQuery }" class="back-link">← {{ reportTitle || 'Raid' }}</router-link>
        <h1 class="player-title">{{ title }}</h1>
        <div class="tab-bar">
          <button :class="{ active: activeView === 'damage' }" @click="setView('damage')">Damage done</button>
          <button :class="{ active: activeView === 'heal' }"   @click="setView('heal')">Healing done</button>
          <button :class="{ active: activeView === 'taken' }"  @click="setView('taken')">Damage taken</button>
        </div>
      </header>

      <!-- DPS chart — same as boss report, filtered to this player -->
      <DpsChart
        :players="chartPlayers"
        :view="activeView"
        :report-id="reportId"
        :selected-href="selectedHref"
      />

      <BasePage :loading="loading" :error="error">
        <!-- Target filter -->
        <div v-if="data?.TARGETS" class="targets-bar">
          <span class="targets-label">Filter target:</span>
          <router-link
            v-for="(name, guid) in { ...data.TARGETS.NPCS, ...data.TARGETS.Players }"
            :key="guid"
            :to="{ query: { ...bossQuery, view: activeView, target: guid } }"
            class="target-chip"
            :class="{ active: route.query.target === guid }"
          >{{ name }}</router-link>
          <router-link
            v-if="route.query.target"
            :to="{ query: { ...bossQuery, view: activeView } }"
            class="target-chip clear"
          >✕ All</router-link>
        </div>

        <SpellBarTable :spells="spellRows" :duration="fightDuration" />
      </BasePage>
    </main>
  </div>
</template>

<style scoped>
.player-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--table-border);
}

.back-link {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-decoration: none;
}

.back-link:hover {
  color: var(--text);
}

.player-title {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  letter-spacing: 0.04em;
}

/* ── Target filter bar ─────────────────────────────────────── */
.targets-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 6px 0;
  margin-bottom: 4px;
}

.targets-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.6875rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-right: 4px;
}

.target-chip {
  padding: 2px 8px;
  background: var(--surface);
  border: 1px solid var(--table-border);
  color: var(--text);
  text-decoration: none;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.75rem;
}

.target-chip:hover,
.target-chip.active {
  border-color: var(--primary);
  color: var(--primary-bright);
}

.target-chip.clear {
  color: var(--text-muted);
}
</style>
