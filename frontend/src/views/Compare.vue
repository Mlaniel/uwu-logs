<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useFetch } from '../composables/useFetch'
import BasePage from '../components/BasePage.vue'
import BossSelector from '../components/BossSelector.vue'
import SpellTable from '../components/SpellTable.vue'
import { CLASS_DISPLAY_NAMES } from '../constants/bosses'
import type { BossAttempt, SpellRow, SpellInfo } from '../types/api'

interface ComparePlayer {
  NAME: string
  SOURCE_NAME: string
  ACTUAL: Record<string, string>
  ACTUAL_PERCENT: Record<string, number>
  CASTS: Record<string, string>
  SPELLS_DATA: Record<string, SpellInfo>
}

interface CompareApiResponse {
  PLAYERS: ComparePlayer[]
  SPELLS: Record<string, SpellInfo>
  TARGETS: Record<string, unknown>
}

const route = useRoute()
const reportId = computed(() => route.params.id as string)

const { report, loading: reportLoading, fetchOverview } = useReport()
watch(reportId, id => fetchOverview(id), { immediate: true })

const bosses = computed(() => report.value?.SEGMENTS_LINKS ?? [])
const reportTitle = computed(() => report.value?.REPORT_NAME ?? '')

const availableClasses = computed<string[]>(() => {
  if (!report.value) return []
  return [...new Set(Object.values(report.value.PLAYER_CLASSES))].sort()
})

// Boss selection (drives compare query scope)
const selectedHref = ref('')

function selectBoss(attempt: BossAttempt): void {
  selectedHref.value = attempt.href
  runCompare()
}

function clearBoss(): void {
  selectedHref.value = ''
  runCompare()
}

const selectedClass = ref('')
watch(availableClasses, classes => {
  if (classes.length && !selectedClass.value) selectedClass.value = classes[0]
})

const { data, loading: compareLoading, error, execute } = useFetch<CompareApiResponse>()

function runCompare(): void {
  if (!selectedClass.value) return
  const url = selectedHref.value
    ? `/api/v2/reports/${reportId.value}/compare/${selectedHref.value}`
    : `/api/v2/reports/${reportId.value}/compare/`
  execute(url, { method: 'POST', body: { class: selectedClass.value } })
}

watch(selectedClass, runCompare)

function playerSpellRows(player: ComparePlayer): SpellRow[] {
  const spells = player.SPELLS_DATA ?? data.value?.SPELLS ?? {}
  return Object.entries(spells)
    .filter(([id]) => id !== 'Total')
    .map(([id, spell]) => ({
      spell_id: id,
      name: spell.name,
      icon: spell.icon,
      color: spell.color,
      actual: player.ACTUAL[id] ?? '',
      percent: player.ACTUAL_PERCENT[id] ?? 0,
      casts: player.CASTS[id] ?? '',
    }))
    .sort((a, b) => b.percent - a.percent)
}
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
        <router-link :to="`/reports/${reportId}/timeline`" class="sidebar-nav-link">Timeline</router-link>
        <router-link :to="`/reports/${reportId}/compare`" class="sidebar-nav-link">Compare</router-link>
      </nav>
    </aside>

    <!-- Main content -->
    <main class="main-content">
      <BasePage :loading="reportLoading" :error="null">
        <!-- Class picker -->
        <div class="controls">
          <div class="control-group">
            <label class="ctrl-label">Class</label>
            <div class="class-buttons">
              <button
                v-for="cls in availableClasses"
                :key="cls"
                class="class-btn"
                :class="{ active: selectedClass === cls }"
                @click="selectedClass = cls"
              >
                {{ CLASS_DISPLAY_NAMES[cls] ?? cls }}
              </button>
            </div>
          </div>
        </div>

        <BasePage :loading="compareLoading" :error="error">
          <div v-if="data && data.PLAYERS.length" class="players-compare">
            <div
              v-for="player in data.PLAYERS"
              :key="player.NAME"
              class="player-block"
            >
              <h2 class="player-block-name">{{ player.SOURCE_NAME || player.NAME }}</h2>
              <SpellTable :spells="playerSpellRows(player)" />
            </div>
          </div>
          <p v-else-if="data" class="empty">No players of this class in the log.</p>
        </BasePage>
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

/* ── Controls ──────────────────────────────────────────────── */
.controls {
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--table-border);
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ctrl-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.class-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.class-btn {
  background: var(--surface);
  border: 1px solid var(--table-border);
  color: var(--text-muted);
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 3px 10px;
  cursor: pointer;
}

.class-btn:hover { color: var(--text); }
.class-btn.active {
  border-color: var(--primary);
  color: var(--text);
  background: hsl(271, 76%, 10%);
}

/* ── Players ────────────────────────────────────────────────── */
.players-compare {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.player-block-name {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  letter-spacing: 0.04em;
}

.empty {
  color: var(--text-muted);
  font-size: 0.875rem;
}
</style>
