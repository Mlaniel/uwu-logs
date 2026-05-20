<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useFilters } from '../composables/useFilters'
import BasePage from '../components/BasePage.vue'
import BossSelector from '../components/BossSelector.vue'
import SpecFilter from '../components/SpecFilter.vue'
import DpsChart from '../components/DpsChart.vue'
import PlayerTable from '../components/PlayerTable.vue'
import type { BossAttempt } from '../types/api'

const route = useRoute()
const router = useRouter()
const { report, players, loading, error, fetchOverview } = useReport()
const { activeView, setView, specFilter, sortKey, sortDir, filteredPlayers, setSort, toggleSpec } = useFilters(players)

const reportId = computed(() => route.params.id as string)

// Fetch on mount and when the report ID changes
watch(reportId, id => fetchOverview(id), { immediate: true })

// Boss selector state — track the full href of the selected attempt.
// attempt.href is like "?boss=lich-king&mode=25H&attempt=0&s=268&f=340".
// BossSelector compares selectedHref against BossGroup.href ("?boss=lich-king")
// using startsWith, and against BossAttempt.href using ===.
const selectedHref = ref<string>('')

function selectBoss(attempt: BossAttempt): void {
  specFilter.value = []
  selectedHref.value = attempt.href
  // Parse href params — contains the HTML slug ("lich-king"), not the display name.
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

const bosses = computed(() => report.value?.SEGMENTS_LINKS ?? [])
const reportTitle = computed(() => report.value?.REPORT_NAME ?? '')
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

        <!-- Primary tab bar: DAMAGE | HEAL | TAKEN | DEATHS | COMPARE -->
        <div class="tab-bar">
          <button
            :class="{ active: activeView === 'damage' }"
            @click="setView('damage')"
          >Damage</button>
          <button
            :class="{ active: activeView === 'heal' }"
            @click="setView('heal')"
          >Heal</button>
          <button
            :class="{ active: activeView === 'taken' }"
            @click="setView('taken')"
          >Taken</button>
          <router-link
            :to="`/reports/${reportId}/deaths`"
            class="tab-link"
          >Deaths</router-link>
          <router-link
            :to="`/reports/${reportId}/timeline`"
            class="tab-link"
          >Timeline</router-link>
          <router-link
            :to="`/reports/${reportId}/compare`"
            class="tab-link"
          >Compare</router-link>
        </div>

        <!-- DPS chart -->
        <DpsChart
          :players="filteredPlayers"
          :view="activeView"
          :report-id="reportId"
          :selected-href="selectedHref"
        />

        <!-- Player table — click row to drill into player detail -->
        <PlayerTable
          :players="filteredPlayers"
          :view="activeView"
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

.tab-link {
  padding: 6px 12px;
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-decoration: none;
  border-bottom: 2px solid transparent;
}

.tab-link:hover,
.tab-link.router-link-active {
  color: var(--text);
  border-bottom-color: var(--primary);
}
</style>
