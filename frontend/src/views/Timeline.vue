<script setup lang="ts">
import { computed, watch, ref, nextTick } from 'vue'
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

// After Vue renders new spell rows, tell the WoWhead widget to scan for new links.
watch(displayRows, async () => {
  await nextTick()
  ;(window as any).$WowheadPower?.refreshLinks?.()
})

// ── Timeline rendering ────────────────────────────────────────────────────────
const duration = computed(() => data.value?.RDURATION ?? 0)

const ownSpellsOnly = ref(false)

const displayRows = computed(() => {
  if (!ownSpellsOnly.value) return rows.value
  const self = data.value?.NAME
  if (!self) return rows.value
  return rows.value
    .map(r => ({ ...r, events: r.events.filter(ev => ev[2] === self) }))
    .filter(r => r.events.length > 0)
})

// How many seconds before 0:00 to show (0–60). Adjustable via slider.
const startOffset = ref(0)

const startOffsetMs  = computed(() => startOffset.value * 1000)
const totalWindowMs  = computed(() => startOffsetMs.value + duration.value * 1000)

function toPercent(deltaMs: number): number {
  if (!totalWindowMs.value) return 0
  return (deltaMs + startOffsetMs.value) / totalWindowMs.value * 100
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
  const sign = s < 0 ? '-' : ''
  const abs  = Math.abs(s)
  const m    = Math.floor(abs / 60)
  const rem  = Math.floor(abs % 60)
  return `${sign}${m}:${String(rem).padStart(2, '0')}`
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

interface TooltipState {
  x: number; y: number
  spellName: string
  target: string
  amount: string
  time: string
}

const tooltip = ref<TooltipState | null>(null)

function fmtAmount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

function parsedAmount(ev: CastEvent): string {
  const flag = ev[1]
  const etc  = String(ev[5] ?? '')
  const raw  = parseInt(etc.split(',')[0])
  if (!raw || isNaN(raw)) return ''
  const n = fmtAmount(raw)
  if (flag.includes('HEAL'))   return `+${n}`
  if (flag.includes('DAMAGE')) return `-${n}`
  return n
}

function fmtDeltaMs(ms: number): string {
  const sign = ms < 0 ? '-' : ''
  const abs  = Math.abs(ms)
  const m    = Math.floor(abs / 60_000)
  const s    = ((abs % 60_000) / 1000).toFixed(1)
  return `${sign}${m}:${s.padStart(4, '0')}`
}

function onCastEnter(ev: CastEvent, spellName: string, e: MouseEvent): void {
  tooltip.value = {
    x: e.clientX,
    y: e.clientY,
    spellName,
    target: ev[3] || '—',
    amount: parsedAmount(ev),
    time:   fmtDeltaMs(ev[0]),
  }
}

function onCastLeave(): void {
  tooltip.value = null
}

function onCastMove(e: MouseEvent): void {
  if (tooltip.value) {
    tooltip.value.x = e.clientX
    tooltip.value.y = e.clientY
  }
}

const ticks = computed<number[]>(() => {
  const result: number[] = []
  const startSec  = -startOffset.value
  const firstTick = Math.ceil(startSec / 30) * 30
  for (let t = firstTick; t <= duration.value; t += 30) result.push(t)
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
        <div class="control-group">
          <label class="ctrl-label">Pre-fight&thinsp;({{ startOffset }}s)</label>
          <input
            type="range"
            min="0"
            max="60"
            step="5"
            v-model.number="startOffset"
            class="offset-slider"
          />
        </div>
        <label class="own-spells-check">
          <input type="checkbox" v-model="ownSpellsOnly" />
          Own spells only
        </label>
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
              <!-- 0:00 fight-start line (visible when pre-fight offset > 0) -->
              <div
                v-if="startOffset > 0"
                class="zero-mark"
                :style="{ left: toPercent(0) + '%' }"
              />
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
            v-for="row in displayRows"
            :key="row.spell_id"
            class="spell-row"
          >
            <div class="label-col spell-label">
              <a
                class="spell-wh-link"
                :href="`https://www.wowhead.com/wotlk/spell=${row.spell_id}`"
                target="_blank"
                rel="noopener noreferrer"
              >
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
              </a>
            </div>

            <div class="spell-track">
              <!-- 0:00 fight-start line through every row -->
              <div
                v-if="startOffset > 0"
                class="zero-mark"
                :style="{ left: toPercent(0) + '%' }"
              />
              <div
                v-for="(ev, i) in row.events"
                :key="i"
                class="cast-tick"
                :class="castClass(ev)"
                :style="{ left: toPercent(ev[0]) + '%' }"
                @mouseenter="onCastEnter(ev, row.spell.name, $event)"
                @mousemove="onCastMove($event)"
                @mouseleave="onCastLeave"
              >{{ castLabel(ev) }}</div>
            </div>
          </div>
        </div>

        <p v-else-if="!timelineLoading && selectedAttempt" class="empty">
          Select a player to load their timeline.
        </p>
      </BasePage>

      <!-- Floating tooltip — outside BasePage so it doesn't break v-if/v-else-if -->
      <Teleport to="body">
        <div
          v-if="tooltip"
          class="cast-tooltip"
          :style="{ left: tooltip.x + 14 + 'px', top: tooltip.y - 10 + 'px' }"
        >
          <div class="tt-spell">{{ tooltip.spellName }}</div>
          <div class="tt-row">
            <span class="tt-label">Target</span>
            <span>{{ tooltip.target }}</span>
          </div>
          <div v-if="tooltip.amount" class="tt-row">
            <span class="tt-label">Amount</span>
            <span :class="tooltip.amount.startsWith('+') ? 'tt-heal' : tooltip.amount.startsWith('-') ? 'tt-dmg' : ''">{{ tooltip.amount }}</span>
          </div>
          <div class="tt-row">
            <span class="tt-label">Time</span>
            <span class="tt-time">{{ tooltip.time }}</span>
          </div>
        </div>
      </Teleport>
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

.offset-slider {
  width: 120px;
  accent-color: var(--primary);
  cursor: pointer;
}

.own-spells-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.8125rem;
  color: var(--text-muted);
  cursor: pointer;
  align-self: flex-end;
  padding-bottom: 4px;
}

.own-spells-check:hover { color: var(--text); }
.own-spells-check input { accent-color: var(--primary); cursor: pointer; }

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

/* 0:00 fight-start line — shown when pre-fight offset is active */
.zero-mark {
  position: absolute;
  top: 0;
  height: 100%;
  width: 1px;
  background: var(--text-muted);
  opacity: 0.55;
  pointer-events: none;
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
  padding-right: 8px;
  overflow: hidden;
}

.spell-wh-link {
  display: flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  flex: 1;
  min-width: 0;
  text-decoration: none;
  color: inherit;
}

.spell-wh-link:hover .spell-name {
  text-decoration: underline;
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
  overflow: hidden;
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

<style>
/* Tooltip is teleported to <body> — cannot be scoped */
.cast-tooltip {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  background: var(--surface, #1a1a1a);
  border: 1px solid var(--table-border, #333);
  border-radius: 4px;
  padding: 7px 10px;
  min-width: 160px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
}

.tt-spell {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 13px;
  color: var(--text, #e0e0e0);
  margin-bottom: 5px;
  white-space: nowrap;
}

.tt-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 12px;
  color: var(--text, #e0e0e0);
  line-height: 1.6;
}

.tt-label {
  color: var(--text-muted, #666);
  flex-shrink: 0;
}

.tt-heal { color: var(--kill, #48bb78); font-variant-numeric: tabular-nums; }
.tt-dmg  { color: #ef5454;              font-variant-numeric: tabular-nums; }
.tt-time { font-variant-numeric: tabular-nums; }
</style>
