<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useFetch } from '../composables/useFetch'
import BasePage from '../components/BasePage.vue'
import type { DeathApiResponse, DeathEntry, DeathLogLine } from '../types/api'

const route = useRoute()
const { data, loading, error, execute } = useFetch<DeathApiResponse>()

const reportId = computed(() => route.params.id as string)
watch(reportId, id => execute(`/api/v2/reports/${id}/deaths/`), { immediate: true })

const deaths = computed<[string, DeathEntry][]>(() => {
  if (!data.value) return []
  return Object.entries(data.value.DEATHS)
})

// Expanded death ids
const expanded = ref<Set<string>>(new Set())
function toggle(id: string): void {
  if (expanded.value.has(id)) {
    expanded.value.delete(id)
  } else {
    expanded.value.add(id)
  }
}

function eventClass(line: DeathLogLine): string {
  const type = String(line[1])
  if (type === 'DAMAGE') return 'ev-damage'
  if (type === 'HEAL') return 'ev-heal'
  if (type === 'DIED' || type === 'INSTAKILL') return 'ev-death'
  if (type === 'AURA') return String(line[2]) === 'REMOVED' ? 'ev-aura-off' : 'ev-aura'
  if (type === 'RESURRECT') return 'ev-res'
  return ''
}

function spellName(line: DeathLogLine): string {
  return String(line[5] ?? '')
}

function amount(line: DeathLogLine): string {
  const v = line[6]
  if (v == null || v === '' || v === 0) return ''
  return String(v)
}

function eventLabel(line: DeathLogLine): string {
  const type = String(line[1])
  const sub = String(line[2] ?? '')
  if (type === 'DIED') return 'Died'
  if (type === 'INSTAKILL') return 'Instakill'
  if (type === 'RESURRECT') return 'Resurrected'
  if (type === 'HEAL') return sub === 'HOT' ? 'HoT' : 'Heal'
  if (type === 'DAMAGE') {
    if (sub === 'SWING') return 'Hit'
    if (sub === 'DOT') return 'DoT'
    return 'Hit'
  }
  if (type === 'MISS') return 'Miss'
  if (type === 'AURA') return sub
  if (type === 'CAST') return 'Cast'
  return type
}
</script>

<template>
  <div class="deaths-page">
    <header class="deaths-header">
      <router-link :to="`/reports/${reportId}`" class="back-link">← Back</router-link>
      <h1 class="deaths-title">Deaths</h1>
    </header>

    <main class="deaths-main">
      <BasePage :loading="loading" :error="error">
        <p v-if="!deaths.length" class="empty">No deaths recorded for this boss segment.</p>

        <div v-else class="deaths-list">
          <div
            v-for="[id, entry] in deaths"
            :key="id"
            class="death-card"
          >
            <button class="death-summary" @click="toggle(id)">
              <span class="death-player">{{ entry.player }}</span>
              <span class="death-time">{{ entry.from_start }}</span>
              <span class="death-toggle">{{ expanded.has(id) ? '▼' : '▶' }}</span>
            </button>

            <div v-if="expanded.has(id)" class="death-log">
              <div
                v-for="(line, i) in entry.death"
                :key="i"
                class="log-line"
                :class="eventClass(line)"
              >
                <span class="ll-ts">{{ line[0] }}</span>
                <span class="ll-event">{{ eventLabel(line) }}</span>
                <span class="ll-source">{{ line[3] }}</span>
                <span class="ll-spell">{{ spellName(line) }}</span>
                <span class="ll-amount">{{ amount(line) }}</span>
              </div>
            </div>
          </div>
        </div>
      </BasePage>
    </main>
  </div>
</template>

<style scoped>
.deaths-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem;
}

.deaths-header {
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

.deaths-title {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  letter-spacing: 0.04em;
}

.empty {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.deaths-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* ── Death card ────────────────────────────────────────────── */
.death-card {
  background: var(--surface);
}

.death-summary {
  display: grid;
  grid-template-columns: 1fr auto 20px;
  align-items: center;
  width: 100%;
  padding: 0 12px;
  height: 36px;
  background: none;
  border: none;
  border-left: 3px solid var(--wipe);
  color: var(--text);
  cursor: pointer;
  text-align: left;
  gap: 8px;
}

.death-summary:hover {
  background: var(--hover-row);
}

.death-player {
  font-size: 0.8125rem;
  font-weight: 500;
}

.death-time {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}

.death-toggle {
  font-size: 0.625rem;
  color: var(--text-muted);
}

/* ── Log lines ─────────────────────────────────────────────── */
.death-log {
  padding: 4px 0;
  border-left: 3px solid var(--table-border);
}

.log-line {
  display: grid;
  grid-template-columns: 80px 64px 130px 1fr auto;
  align-items: center;
  height: 24px;
  padding: 0 12px;
  gap: 8px;
  font-size: 0.75rem;
}

.log-line:nth-child(odd) {
  background: hsl(0, 0%, 3%);
}

.ll-ts {
  font-family: 'Barlow Condensed', sans-serif;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}

.ll-event {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.ll-amount {
  font-family: 'Barlow Condensed', sans-serif;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* Event type colors */
.ev-damage .ll-event  { color: var(--wipe); }
.ev-heal .ll-event    { color: var(--kill); }
.ev-death .ll-event   { color: crimson; font-size: 0.75rem; }
.ev-aura .ll-event    { color: var(--link); }
.ev-aura-off .ll-event { color: var(--text-muted); }
.ev-res .ll-event     { color: goldenrod; }
</style>
