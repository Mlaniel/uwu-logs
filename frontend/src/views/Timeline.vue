<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useTimeline } from '../composables/useTimeline'
import BasePage from '../components/BasePage.vue'
import type { BossAttempt } from '../types/api'
import type { CastEvent } from '../types/api'

const route = useRoute()
const reportId = computed(() => route.params.id as string)

const { report, loading: reportLoading, fetchOverview } = useReport()
watch(reportId, id => fetchOverview(id), { immediate: true })

const { data, rows, loading: timelineLoading, error, fetchTimeline } = useTimeline()

// Boss + attempt selection
const selectedAttempt = ref<BossAttempt | null>(null)
const selectedPlayer = ref<string>('')

const allAttempts = computed<BossAttempt[]>(() => {
  if (!report.value) return []
  return report.value.SEGMENTS_LINKS
    .filter(bg => bg.boss_name !== 'all')
    .flatMap(bg => bg.segments)
})

const playerNames = computed<string[]>(() => {
  if (!report.value) return []
  return Object.keys(report.value.SPECS).filter(n => n !== 'Total').sort()
})

// Auto-select first attempt + first player
watch(allAttempts, attempts => {
  if (attempts.length && !selectedAttempt.value) selectedAttempt.value = attempts[0]
})
watch(playerNames, names => {
  if (names.length && !selectedPlayer.value) selectedPlayer.value = names[0]
})

function runFetch() {
  const attempt = selectedAttempt.value
  if (!attempt || !selectedPlayer.value) return
  fetchTimeline(
    reportId.value,
    attempt.encounter_name,
    attempt.attempt,
    selectedPlayer.value,
  )
}

watch([selectedAttempt, selectedPlayer], runFetch)

// ── Timeline rendering ────────────────────────────────────────────────────────
const duration = computed(() => data.value?.RDURATION ?? 0)   // seconds

// Map a delta_ms value to a % position across the timeline track
function toPercent(deltaMs: number): number {
  if (!duration.value) return 0
  return Math.min((deltaMs / (duration.value * 1000)) * 100, 100)
}

function castLabel(event: CastEvent): string {
  const flag = event[1]
  // Condense common flags to short labels
  if (flag.includes('MISS')) return 'M'
  return ''
}

function castClass(event: CastEvent): string {
  const flag = event[1]
  if (flag.includes('MISS')) return 'cast-miss'
  if (flag.includes('HEAL')) return 'cast-heal'
  if (flag.includes('AURA')) return 'cast-aura'
  return 'cast-dmg'
}

// Format seconds → M:SS
function fmtSeconds(s: number): string {
  const m = Math.floor(s / 60)
  const rem = Math.floor(s % 60)
  return `${m}:${String(rem).padStart(2, '0')}`
}

// Ruler tick marks every 30s
const ticks = computed<number[]>(() => {
  const result: number[] = []
  for (let t = 0; t <= duration.value; t += 30) result.push(t)
  return result
})
</script>

<template>
  <div class="timeline-page">
    <header class="timeline-header">
      <router-link :to="`/reports/${reportId}`" class="back-link">← Back</router-link>
      <h1 class="timeline-title">Timeline</h1>
    </header>

    <BasePage :loading="reportLoading" :error="null">
      <!-- Controls -->
      <div class="controls">
        <div class="control-group">
          <label class="ctrl-label">Boss attempt</label>
          <select v-model="selectedAttempt" class="ctrl-select">
            <option
              v-for="a in allAttempts"
              :key="a.href"
              :value="a"
            >
              {{ a.encounter_name }} — {{ a.difficulty }} —
              {{ a.attempt_type === 'kill' ? 'Kill' : `Wipe ${a.attempt_from_last_kill}` }}
              ({{ a.duration_str }})
            </option>
          </select>
        </div>

        <div class="control-group">
          <label class="ctrl-label">Player</label>
          <select v-model="selectedPlayer" class="ctrl-select">
            <option v-for="name in playerNames" :key="name" :value="name">
              {{ name }}
            </option>
          </select>
        </div>
      </div>

      <BasePage :loading="timelineLoading" :error="error">
        <div v-if="data" class="timeline-wrap">
          <!-- Ruler -->
          <div class="ruler">
            <div class="ruler-label-col" />
            <div class="ruler-track">
              <div
                v-for="t in ticks"
                :key="t"
                class="tick"
                :style="{ left: toPercent(t * 1000) + '%' }"
              >
                <span class="tick-label">{{ fmtSeconds(t) }}</span>
              </div>
            </div>
          </div>

          <!-- Spell rows -->
          <div
            v-for="row in rows"
            :key="row.spell_id"
            class="spell-row"
          >
            <div class="spell-label">
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
    </BasePage>
  </div>
</template>

<style scoped>
.timeline-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.timeline-header {
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
}
.back-link:hover { color: var(--link-hover); }

.timeline-title {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  letter-spacing: 0.04em;
}

/* ── Controls ──────────────────────────────────────────────── */
.controls {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
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
  min-width: 280px;
  cursor: pointer;
}

.ctrl-select:focus { outline: 1px solid var(--primary); }

/* ── Timeline ──────────────────────────────────────────────── */
.timeline-wrap {
  overflow-x: auto;
}

.ruler,
.spell-row {
  display: grid;
  grid-template-columns: 180px 1fr;
  align-items: center;
  min-width: 700px;
}

.ruler {
  height: 24px;
  border-bottom: 1px solid var(--table-border);
  margin-bottom: 4px;
}

.ruler-label-col {
  /* spacer matching .spell-label width */
}

.ruler-track {
  position: relative;
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
