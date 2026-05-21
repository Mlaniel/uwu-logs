<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useTimeline } from '../composables/useTimeline'
import { useFetch } from '../composables/useFetch'
import BasePage from '../components/BasePage.vue'
import BossSelector from '../components/BossSelector.vue'
import type { BossAttempt, DeathApiResponse, CastEvent } from '../types/api'

const route = useRoute()
const reportId = computed(() => route.params.id as string)

const { report, loading: reportLoading, fetchOverview } = useReport()
watch(reportId, id => fetchOverview(id), { immediate: true })

const { data, rows, loading: timelineLoading, error, fetchTimeline } = useTimeline()
const { data: deathData, execute: fetchDeaths } = useFetch<DeathApiResponse>()

const selectedAttempt = ref<BossAttempt | null>(null)
const selectedPlayer = ref<string>('')

const bosses = computed(() => report.value?.SEGMENTS_LINKS ?? [])
const reportTitle = computed(() => report.value?.REPORT_NAME ?? '')

const playerNames = computed<string[]>(() => {
  if (!report.value) return []
  return Object.keys(report.value.SPECS).filter(n => n !== 'Total').sort()
})

// Auto-select first kill attempt + first player when report loads
watch(() => bosses.value, bgs => {
  if (!selectedAttempt.value && bgs.length) {
    const firstKillGroup = bgs.find(bg => bg.boss_name !== 'all' && bg.segments.some(s => s.attempt_type === 'kill'))
    if (firstKillGroup) {
      const kill = [...firstKillGroup.segments].reverse().find(s => s.attempt_type === 'kill')
      if (kill) selectedAttempt.value = kill
    }
  }
}, { immediate: true })

watch(playerNames, names => {
  if (names.length && !selectedPlayer.value) selectedPlayer.value = names[0]
})

function selectAttempt(attempt: BossAttempt): void {
  selectedAttempt.value = attempt
}

function runFetch(): void {
  const attempt = selectedAttempt.value
  if (!attempt || !selectedPlayer.value) return
  fetchTimeline(reportId.value, attempt.encounter_name, attempt.attempt, selectedPlayer.value)
  fetchDeaths(`/api/v2/reports/${reportId.value}/deaths/${attempt.href}`)
}

watch([selectedAttempt, selectedPlayer], runFetch)

// ── Timeline rendering ────────────────────────────────────────────────────────
const duration = computed(() => data.value?.RDURATION ?? 0)

function toPercent(deltaMs: number): number {
  if (!duration.value) return 0
  return Math.min((deltaMs / (duration.value * 1000)) * 100, 100)
}

function fromStartMs(s: string): number {
  const dotIdx = s.indexOf('.')
  const msPart = dotIdx >= 0 ? Number(s.slice(dotIdx + 1)) : 0
  const timePart = dotIdx >= 0 ? s.slice(0, dotIdx) : s
  const [m, sec] = timePart.split(':').map(Number)
  return (m * 60 + (sec || 0)) * 1000 + msPart
}

// Deaths for this fight — all players, positioned as markers on the ruler
const deathMarkers = computed(() => {
  if (!deathData.value) return []
  return Object.values(deathData.value.DEATHS).map(d => ({
    player: d.player,
    ms: fromStartMs(d.from_start),
    label: d.from_start.split('.')[0], // "MM:SS" without ms
  }))
})

function castLabel(event: CastEvent): string {
  if (event[1].includes('MISS')) return 'M'
  return ''
}

function castClass(event: CastEvent): string {
  const flag = event[1]
  if (flag.includes('MISS')) return 'cast-miss'
  if (flag.includes('HEAL')) return 'cast-heal'
  if (flag.includes('AURA')) return 'cast-aura'
  return 'cast-dmg'
}

function fmtSeconds(s: number): string {
  const m = Math.floor(s / 60)
  const rem = Math.floor(s % 60)
  return `${m}:${String(rem).padStart(2, '0')}`
}

const ticks = computed<number[]>(() => {
  const result: number[] = []
  for (let t = 0; t <= duration.value; t += 30) result.push(t)
  return result
})

const selectedHref = computed(() => selectedAttempt.value?.href ?? '')
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
          @select="selectAttempt"
          @deselect="() => {}"
        />
      </BasePage>
      <nav class="sidebar-nav">
        <router-link :to="`/reports/${reportId}/timeline`" class="sidebar-nav-link">Timeline</router-link>
        <router-link :to="`/reports/${reportId}/compare`" class="sidebar-nav-link">Compare</router-link>
      </nav>
    </aside>

    <!-- Main content -->
    <main class="main-content">
      <!-- Player picker -->
      <div class="controls">
        <div class="control-group">
          <label class="ctrl-label">Player</label>
          <select v-model="selectedPlayer" class="ctrl-select">
            <option v-for="name in playerNames" :key="name" :value="name">
              {{ name }}
            </option>
          </select>
        </div>
        <div v-if="selectedAttempt" class="attempt-info">
          {{ selectedAttempt.encounter_name }} —
          {{ selectedAttempt.difficulty }} —
          {{ selectedAttempt.attempt_type === 'kill' ? 'Kill' : `Wipe ${selectedAttempt.attempt_from_last_kill}` }}
          ({{ selectedAttempt.duration_str }})
        </div>
      </div>

      <BasePage :loading="timelineLoading" :error="error">
        <div v-if="data" class="timeline-wrap">
          <!-- Ruler + death markers -->
          <div class="ruler-row">
            <div class="label-col" />
            <div class="ruler-track">
              <div
                v-for="t in ticks"
                :key="t"
                class="tick"
                :style="{ left: toPercent(t * 1000) + '%' }"
              >
                <span class="tick-label">{{ fmtSeconds(t) }}</span>
              </div>
              <!-- Death markers — red | at time of death -->
              <div
                v-for="(d, i) in deathMarkers"
                :key="'d' + i"
                class="death-mark"
                :style="{ left: toPercent(d.ms) + '%' }"
                :title="`${d.player} died at ${d.label}`"
              />
            </div>
          </div>

          <!-- Spell rows -->
          <div
            v-for="row in rows"
            :key="row.spell_id"
            class="spell-row"
          >
            <div class="label-col spell-label">
              <img
                v-if="row.spell.icon"
                :src="`/static/icons/${row.spell.icon}.jpg`"
                :alt="row.spell.name"
                class="spell-icon"
              />
              <span
                class="spell-name"
                :style="{ color: row.spell.color || undefined }"
              >{{ row.spell.name }}</span>
            </div>

            <div class="spell-track">
              <div
                v-for="(ev, i) in row.events"
                :key="i"
                class="cast-tick"
                :class="castClass(ev)"
                :style="{ left: toPercent(ev[0]) + '%' }"
                :title="`${row.spell.name} — ${(ev[0]/1000).toFixed(2)}s — ${ev[1]}`"
              >{{ castLabel(ev) }}</div>
            </div>
          </div>
        </div>

        <p v-else-if="!timelineLoading && selectedAttempt" class="empty">
          Select a player to load their timeline.
        </p>
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
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--table-border);
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ctrl-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.ctrl-select {
  background: var(--surface);
  border: 1px solid var(--table-border);
  color: var(--text);
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.875rem;
  padding: 4px 10px;
  min-width: 200px;
  cursor: pointer;
}

.ctrl-select:focus { outline: 1px solid var(--primary); }

.attempt-info {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.8125rem;
  color: var(--text-muted);
  align-self: flex-end;
  padding-bottom: 4px;
}

/* ── Timeline ──────────────────────────────────────────────── */
.timeline-wrap {
  overflow-x: auto;
}

.label-col {
  width: 180px;
  min-width: 180px;
  flex-shrink: 0;
}

.ruler-row,
.spell-row {
  display: flex;
  align-items: stretch;
  min-width: 700px;
}

.ruler-row {
  height: 24px;
  border-bottom: 1px solid var(--table-border);
  margin-bottom: 4px;
}

.ruler-track {
  position: relative;
  flex: 1;
  height: 100%;
}

.tick {
  position: absolute;
  top: 0;
  height: 100%;
  border-left: 1px solid var(--table-border);
  padding-left: 3px;
}

.tick-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-variant-numeric: tabular-nums;
  font-size: 0.625rem;
  color: var(--text-muted);
  line-height: 24px;
}

/* Death marker — thin red vertical line on the ruler */
.death-mark {
  position: absolute;
  top: 0;
  height: 100%;
  width: 2px;
  background: crimson;
  opacity: 0.85;
  transform: translateX(-50%);
  cursor: default;
  z-index: 1;
}

.death-mark:hover {
  opacity: 1;
  width: 2px;
}

.spell-row {
  height: 28px;
  border-bottom: 1px solid hsl(0, 0%, 4%);
}

.spell-row:hover {
  background: var(--hover-row);
}

.spell-label {
  display: flex;
  align-items: center;
  gap: 5px;
  padding-right: 8px;
  overflow: hidden;
}

.spell-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.spell-name {
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spell-track {
  position: relative;
  flex: 1;
  height: 100%;
  background: hsl(0, 0%, 3%);
}

.cast-tick {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 16px;
  cursor: default;
}

.cast-dmg  { background: var(--primary-dim); }
.cast-heal { background: var(--kill); }
.cast-aura { background: var(--link); opacity: 0.6; }
.cast-miss { background: var(--text-muted); opacity: 0.5; }

.empty {
  color: var(--text-muted);
  font-size: 0.875rem;
}
</style>
