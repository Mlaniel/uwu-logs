<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useFilters } from '../composables/useFilters'
import BasePage from '../components/BasePage.vue'
import BossSelector from '../components/BossSelector.vue'
import SpecFilter from '../components/SpecFilter.vue'
import DpsChart from '../components/DpsChart.vue'
import PlayerTable from '../components/PlayerTable.vue'
import type { BossAttempt } from '../types/api'

const route = useRoute()
const { report, players, loading, error, fetchOverview } = useReport()
const { activeView, setView, specFilter, sortKey, sortDir, filteredPlayers, setSort, toggleSpec } = useFilters(players)

const reportId = computed(() => route.params.id as string)

// Fetch on mount and when the report ID changes
watch(reportId, id => fetchOverview(id), { immediate: true })

// Boss selector state — track the selected segment href
const selectedHref = computed(() => {
  if (!route.query.boss) return ''
  const parts = [`?boss=${route.query.boss}`]
  if (route.query.mode) parts.push(`mode=${route.query.mode}`)
  if (route.query.attempt) parts.push(`attempt=${route.query.attempt}`)
  if (route.query.s) parts.push(`s=${route.query.s}`)
  if (route.query.f) parts.push(`f=${route.query.f}`)
  return parts.join('&')
})

function selectBoss(attempt: BossAttempt): void {
  // When switching bosses, clear spec filter
  specFilter.value = []
  fetchOverview(reportId.value, {
    boss: attempt.encounter_name,
    mode: attempt.difficulty,
    attempt: String(attempt.attempt),
    s: String(attempt.duration),
  })
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

        <!-- View tabs: DAMAGE | HEAL | TAKEN -->
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
        </div>

        <!-- DPS chart -->
        <DpsChart :players="filteredPlayers" :view="activeView" />

        <!-- Player table -->
        <PlayerTable
          :players="filteredPlayers"
          :view="activeView"
          :sort-key="sortKey"
          :sort-dir="sortDir"
          @sort="setSort"
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
</style>
