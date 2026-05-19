<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useFetch } from '../composables/useFetch'
import BasePage from '../components/BasePage.vue'
import SpellTable from '../components/SpellTable.vue'
import { CLASS_DISPLAY_NAMES } from '../constants/bosses'
import type { SpellRow, SpellInfo } from '../types/api'

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

// Load the report so we can get available class names
const { report, loading: reportLoading, fetchOverview } = useReport()
watch(reportId, id => fetchOverview(id), { immediate: true })

const availableClasses = computed<string[]>(() => {
  if (!report.value) return []
  return [...new Set(Object.values(report.value.PLAYER_CLASSES))].sort()
})

const selectedClass = ref('')
watch(availableClasses, classes => {
  if (classes.length && !selectedClass.value) selectedClass.value = classes[0]
})

// Compare fetch
const { data, loading: compareLoading, error, execute } = useFetch<CompareApiResponse>()

function runCompare(): void {
  if (!selectedClass.value) return
  execute(`/api/v2/reports/${reportId.value}/compare/`, {
    method: 'POST',
    body: { class: selectedClass.value },
  })
}

watch(selectedClass, runCompare)

// Assemble spell rows per player
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
  <div class="compare-page">
    <header class="compare-header">
      <router-link :to="`/reports/${reportId}`" class="back-link">← Back</router-link>
      <h1 class="compare-title">Compare</h1>
    </header>

    <main class="compare-main">
      <BasePage :loading="reportLoading" :error="null">
        <div class="class-picker">
          <label class="picker-label">Class</label>
          <select v-model="selectedClass" class="class-select">
            <option v-for="cls in availableClasses" :key="cls" :value="cls">
              {{ CLASS_DISPLAY_NAMES[cls] ?? cls }}
            </option>
          </select>
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
.compare-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem;
}

.compare-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.back-link {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.8125rem;
  color: var(--link);
  text-decoration: none;
  letter-spacing: 0.04em;
}

.back-link:hover {
  color: var(--link-hover);
}

.compare-title {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  letter-spacing: 0.04em;
}

.class-picker {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 1.5rem;
}

.picker-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.class-select {
  background: var(--surface);
  border: 1px solid var(--table-border);
  color: var(--text);
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.875rem;
  padding: 4px 10px;
  cursor: pointer;
}

.class-select:focus {
  outline: 1px solid var(--primary);
}

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
