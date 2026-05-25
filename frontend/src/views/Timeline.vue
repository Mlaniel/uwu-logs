<script setup lang="ts">
import { computed, watch, ref, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useTimeline } from '../composables/useTimeline'
import { useFetch } from '../composables/useFetch'
import BasePage from '../components/BasePage.vue'
import BossSelector from '../components/BossSelector.vue'
import ReportNav from '../components/ReportNav.vue'
import type { BossAttempt, DeathApiResponse, CastEvent } from '../types/api'

const route = useRoute()
const router = useRouter()
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

// Restore boss + player from URL, or fall back to first kill attempt
watch(() => bosses.value, bgs => {
  if (selectedAttempt.value || !bgs.length) return
  const qs = route.query.s as string | undefined
  const qf = route.query.f as string | undefined
  if (qs && qf) {
    for (const bg of bgs) {
      const found = bg.segments.find(seg => {
        const p = new URLSearchParams(seg.href.slice(1))
        return p.get('s') === qs && p.get('f') === qf
      })
      if (found) { selectedAttempt.value = found; return }
    }
  }
  const firstKillGroup = bgs.find(bg => bg.boss_name !== 'all' && bg.segments.some(s => s.attempt_type === 'kill'))
  if (firstKillGroup) {
    const kill = [...firstKillGroup.segments].reverse().find(s => s.attempt_type === 'kill')
    if (kill) selectedAttempt.value = kill
  }
}, { immediate: true })

watch(playerNames, names => {
  if (!names.length || selectedPlayer.value) return
  const urlPlayer = route.query.player as string | undefined
  selectedPlayer.value = (urlPlayer && names.includes(urlPlayer)) ? urlPlayer : names[0]
})

// Keep URL in sync so navigating away and back preserves state
watch([selectedAttempt, selectedPlayer], ([attempt, player]) => {
  if (!attempt) return
  const params = Object.fromEntries(new URLSearchParams(attempt.href.slice(1)))
  if (player) params.player = player
  router.replace({ query: params })
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

const ownSpellsOnly = ref(false)

const displayRows = computed(() => {
  if (!ownSpellsOnly.value) return rows.value
  const self = data.value?.NAME
  if (!self) return rows.value
  return rows.value
    .map(r => ({ ...r, events: r.events.filter(ev => ev[2] === self) }))
    .filter(r => r.events.length > 0)
})

// After Vue renders new spell rows, tell the WoWhead widget to scan for new links.
watch(displayRows, async () => {
  await nextTick()
  ;(window as any).$WowheadPower?.refreshLinks?.()
})

// How many seconds before 0:00 to show (0–60). Adjustable via slider.
const startOffset = ref(0)

const startOffsetMs  = computed(() => startOffset.value * 1000)
const totalWindowMs  = computed(() => startOffsetMs.value + duration.value * 1000)

// ── Zoom ──────────────────────────────────────────────────────────────────────

interface ZoomRange { startMs: number; endMs: number }
const zoomRange = ref<ZoomRange | null>(null)

// Effective view window (unzoomed uses the full fight window)
const viewStartMs = computed(() => zoomRange.value?.startMs ?? -startOffsetMs.value)
const viewSpanMs  = computed(() => {
  if (zoomRange.value) return zoomRange.value.endMs - zoomRange.value.startMs
  return totalWindowMs.value
})

function toPercent(deltaMs: number): number {
  if (!viewSpanMs.value) return 0
  return (deltaMs - viewStartMs.value) / viewSpanMs.value * 100
}

// Drag-to-zoom state
interface DragZoom { startMs: number; endMs: number }
const dragZoom = ref<DragZoom | null>(null)

function msFromRuler(el: Element, clientX: number): number {
  const rect = el.getBoundingClientRect()
  const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  return viewStartMs.value + frac * viewSpanMs.value
}

function onRulerPointerDown(e: PointerEvent): void {
  if (e.button !== 0) return
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  const ms = msFromRuler(e.currentTarget as Element, e.clientX)
  dragZoom.value = { startMs: ms, endMs: ms }
}

function onRulerPointerMove(e: PointerEvent): void {
  if (!dragZoom.value) return
  dragZoom.value = { ...dragZoom.value, endMs: msFromRuler(e.currentTarget as Element, e.clientX) }
}

function onRulerPointerUp(e: PointerEvent): void {
  if (!dragZoom.value) return
  const lo = Math.min(dragZoom.value.startMs, dragZoom.value.endMs)
  const hi = Math.max(dragZoom.value.startMs, dragZoom.value.endMs)
  dragZoom.value = null
  if (hi - lo > 500) zoomRange.value = { startMs: lo, endMs: hi }
}

function resetZoom(): void {
  zoomRange.value = null
}

// Clear zoom when fight data reloads
watch(data, () => { zoomRange.value = null })

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
  const etc  = String(event[5] ?? '')
  if (flag.includes('MISS')) return 'cast-miss'
  if (flag.includes('HEAL')) return isCritEtc(etc) ? 'cast-heal cast-crit' : 'cast-heal'
  if (flag.includes('AURA')) return 'cast-aura'
  if (flag.includes('DAMAGE')) return isCritEtc(etc) ? 'cast-dmg cast-crit' : 'cast-dmg'
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
  result: string   // 'Hit' | 'Crit' | 'Miss' | 'Dodge' | 'Resist' | …
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
  const parts = etc.split(',')

  // SPELL_*/RANGE_* lines: etc = "spellSchool,amount,overkill,..."
  // SWING_DAMAGE lines:    etc = "overkill,..." — amount was in a separate field, not stored
  let raw: number
  if (flag === 'SWING_DAMAGE' || flag === 'SWING_MISSED') {
    return ''
  } else {
    raw = parseInt(parts[1])   // skip spellSchool at [0]
  }

  if (!raw || isNaN(raw)) return ''
  const n = fmtAmount(raw)
  if (flag.includes('HEAL'))   return `+${n}`
  if (flag.includes('DAMAGE')) return `-${n}`
  return n
}

// SPELL_DAMAGE etc layout: spellSchool,amount,overkill,school,resisted,blocked,absorbed,critical,...
// SPELL_MISSED etc layout: spellSchool,missType,...
// critical is '1' on a crit, 'nil' or '0' otherwise (both formats seen on private servers).
function isCritEtc(etc: string): boolean {
  const parts = etc.split(',')
  return parts[7] === '1'
}

function hitResult(ev: CastEvent): string {
  const flag = ev[1]
  const etc  = String(ev[5] ?? '')
  const parts = etc.split(',')
  if (flag.includes('MISS')) {
    const raw = parts[1] ?? ''
    return raw ? raw.charAt(0) + raw.slice(1).toLowerCase() : 'Miss'
  }
  if (flag.includes('DAMAGE') || flag.includes('HEAL')) {
    return isCritEtc(etc) ? 'Crit' : 'Hit'
  }
  return ''
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
    result: hitResult(ev),
    time:   fmtDeltaMs(ev[0]),
  }
}

function onCastLeave(): void {
  tooltip.value = null
}

// ── Cast grouping ─────────────────────────────────────────────────────────────
//
// Groups raw CastEvent[] for one spell into logical cast segments:
//   instant  – no CAST_START; each damage/heal/aura is its own point
//   cast     – CAST_START … SPELL_DAMAGE/MISSED (bar from start → landing)
//   channel  – CAST_START … CHANNEL_STOP (bar spans full channel; ticks inside)

interface CastSegment {
  type: 'instant' | 'cast' | 'channel'
  startMs: number
  endMs: number
  events: CastEvent[]   // damage/heal ticks to render as dots
}

const SKIP_FLAGS = new Set(['SPELL_CAST_SUCCESS'])   // bookkeeping only, no dot

function groupIntoCasts(events: CastEvent[]): CastSegment[] {
  const segs: CastSegment[] = []
  let cur: CastSegment | null = null

  for (const ev of events) {
    const flag = ev[1]
    const t    = ev[0]

    if (flag === 'SPELL_CAST_START') {
      if (cur) segs.push(cur)                      // interrupted cast — push as-is
      cur = { type: 'cast', startMs: t, endMs: t, events: [] }

    } else if (flag === 'SPELL_CHANNEL_START') {
      if (cur) segs.push(cur)
      cur = { type: 'channel', startMs: t, endMs: t, events: [] }

    } else if (flag === 'SPELL_CHANNEL_STOP') {
      if (cur) { cur.endMs = t; segs.push(cur); cur = null }

    } else if (SKIP_FLAGS.has(flag)) {
      // SPELL_CAST_SUCCESS: just advances the bar end for cast-type spells
      if (cur && cur.type === 'cast') cur.endMs = t

    } else {
      // Damage, heal, miss, aura — a visible event
      if (cur) {
        cur.events.push(ev)
        cur.endMs = t
        if (cur.type === 'cast') { segs.push(cur); cur = null }  // cast lands → close
      } else {
        segs.push({ type: 'instant', startMs: t, endMs: t, events: [ev] })
      }
    }
  }

  if (cur) segs.push(cur)   // trailing cast (e.g. still in channel at fight end)
  return segs
}

function onCastMove(e: MouseEvent): void {
  if (tooltip.value) {
    tooltip.value.x = e.clientX
    tooltip.value.y = e.clientY
  }
}

const ticks = computed<number[]>(() => {
  const startSec = viewStartMs.value / 1000
  const endSec   = (viewStartMs.value + viewSpanMs.value) / 1000
  const spanSec  = endSec - startSec
  const step     = spanSec > 120 ? 30 : spanSec > 30 ? 10 : spanSec > 10 ? 5 : 1
  const result: number[] = []
  const firstTick = Math.ceil(startSec / step) * step
  for (let t = firstTick; t <= endSec; t += step) result.push(t)
  return result
})

const selectedHref = computed(() => selectedAttempt.value?.href ?? '')

const damageRouteQuery = computed(() => {
  const href = selectedAttempt.value?.href
  if (!href) return {}
  return Object.fromEntries(new URLSearchParams(href.slice(1)))
})
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
      <ReportNav
        :report-id="reportId"
        :boss-query="damageRouteQuery"
        :bosses="bosses"
        :selected-href="selectedHref"
      />
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
        <button v-if="zoomRange" class="zoom-reset" @click="resetZoom">Reset zoom</button>
      </div>

      <BasePage :loading="timelineLoading" :error="error" :report="report" :selected-href="selectedHref">
        <div v-if="data" class="timeline-wrap">
          <!-- Ruler + death markers -->
          <div class="ruler-row">
            <div class="label-col" />
            <div
              class="ruler-track"
              :class="{ 'ruler-track--dragging': dragZoom }"
              @pointerdown="onRulerPointerDown"
              @pointermove="onRulerPointerMove"
              @pointerup="onRulerPointerUp"
              @pointercancel="dragZoom = null"
            >
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
                v-if="startOffset > 0 && !zoomRange"
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
              <!-- Drag-to-zoom selection highlight -->
              <div
                v-if="dragZoom"
                class="zoom-sel"
                :style="{
                  left:  Math.min(toPercent(dragZoom.startMs), toPercent(dragZoom.endMs)) + '%',
                  width: Math.abs(toPercent(dragZoom.endMs) - toPercent(dragZoom.startMs)) + '%',
                }"
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

              <template v-for="(seg, si) in groupIntoCasts(row.events)" :key="si">
                <!-- Bar for cast-time and channeled spells -->
                <div
                  v-if="seg.type !== 'instant'"
                  class="cast-bar"
                  :class="seg.type === 'channel' ? 'cast-bar--channel' : ''"
                  :style="{
                    left:  toPercent(seg.startMs) + '%',
                    width: Math.max(0.2, toPercent(seg.endMs) - toPercent(seg.startMs)) + '%',
                  }"
                />
                <!-- Dots for each damage/heal/miss event within the segment -->
                <div
                  v-for="(ev, ei) in seg.events"
                  :key="ei"
                  class="cast-tick"
                  :class="castClass(ev)"
                  :style="{ left: toPercent(ev[0]) + '%' }"
                  @mouseenter="onCastEnter(ev, row.spell.name, $event)"
                  @mousemove="onCastMove($event)"
                  @mouseleave="onCastLeave"
                >{{ castLabel(ev) }}</div>
              </template>
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
          <div v-if="tooltip.result" class="tt-row">
            <span class="tt-label">Result</span>
            <span :class="tooltip.result === 'Crit' ? 'tt-crit' : tooltip.result === 'Hit' ? '' : 'tt-miss'">{{ tooltip.result }}</span>
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

.zoom-reset {
  margin-left: auto;
  align-self: flex-end;
  padding: 3px 10px;
  padding-bottom: 4px;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  background: none;
  border: 1px solid var(--primary);
  color: var(--primary-bright);
  cursor: pointer;
}
.zoom-reset:hover { background: color-mix(in srgb, var(--primary) 15%, transparent); }

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
  cursor: crosshair;
  user-select: none;
}

.ruler-track--dragging { cursor: col-resize; }

/* Drag-to-zoom selection highlight */
.zoom-sel {
  position: absolute;
  top: 0;
  height: 100%;
  background: color-mix(in srgb, var(--primary) 25%, transparent);
  border: 1px solid var(--primary);
  pointer-events: none;
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

.cast-bar {
  position: absolute;
  top: 15%;
  height: 70%;
  background: hsl(271, 80%, 72%);
  opacity: 0.32;
  border-radius: 1px;
  pointer-events: none;
}

/* Channeled spells: slightly brighter/taller so they read as "sustained" */
.cast-bar--channel {
  top: 10%;
  height: 80%;
  background: hsl(200, 70%, 65%);
  opacity: 0.35;
}

.cast-dmg  { background: var(--primary-dim); }
.cast-heal { background: var(--kill); }
.cast-aura { background: var(--link); opacity: 0.6; }
.cast-miss { background: var(--text-muted); opacity: 0.5; }
.cast-crit { background: #ffd700; width: 5px; height: 20px; }

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
.tt-crit { color: #ffd700; font-weight: 600; }
.tt-miss { color: var(--text-muted); }
.tt-time { font-variant-numeric: tabular-nums; }
</style>
