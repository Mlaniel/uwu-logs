<script setup lang="ts">
import { computed } from 'vue'
import type { BossGroup, BossAttempt, Player } from '../types/api'
import { CLASS_DISPLAY_NAMES } from '../constants/bosses'

const props = defineProps<{
  bosses: BossGroup[]       // SEGMENTS_LINKS from report
  players: Player[]         // full unfiltered player list
  duration: string          // DURATION_STR from report
}>()

// ── Role detection ─────────────────────────────────────────────────────────

const TANK_SPECS = new Set([
  'Blood Death Knight',
  'Feral Combat Druid',
  'Protection Paladin',
  'Protection Warrior',
])

function getRole(p: Player): 'tank' | 'healer' | 'dps' {
  if (p.useful === null) return 'healer'
  if (TANK_SPECS.has(p.spec_name)) return 'tank'
  return 'dps'
}

// ── Helpers ────────────────────────────────────────────────────────────────

function classSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-')
}

function fmtRate(v: number): string {
  if (!v || !isFinite(v)) return '0'
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M'
  if (v >= 1_000)     return (v / 1_000).toFixed(1) + 'k'
  return v.toFixed(0)
}

// "Frost Death Knight" → "Frost", "Restoration Shaman" → "Resto", etc.
const SPEC_PREFIX_ABBREVS: Record<string, string> = {
  'Restoration': 'Resto',
  'Protection':  'Prot',
  'Discipline':  'Disc',
  'Enhancement': 'Enh',
  'Retribution': 'Ret',
  'Beast Mastery': 'BM',
  'Marksmanship':  'MM',
  'Affliction':    'Afflict',
  'Demonology':    'Demo',
  'Destruction':   'Destro',
  'Feral Combat':  'Feral',
  'Assassination': 'Sin',
  'Subtlety':      'Sub',
}

function specShort(player: Player): string {
  const cls = CLASS_DISPLAY_NAMES[player.class_name] ?? ''
  let prefix = cls && player.spec_name.endsWith(cls)
    ? player.spec_name.slice(0, -cls.length).trim()
    : player.spec_name
  if (!prefix) return cls
  return SPEC_PREFIX_ABBREVS[prefix] ?? prefix
}

// ── Boss helpers ───────────────────────────────────────────────────────────

function killAttempt(bg: BossGroup): BossAttempt | undefined {
  return bg.segments.find(s => s.attempt_type === 'kill')
}

function wipeCount(bg: BossGroup): number {
  return bg.segments.filter(s => s.attempt_type === 'wipe').length
}

// ── Computeds ──────────────────────────────────────────────────────────────

const activeBosses = computed(() =>
  props.bosses.filter(bg => bg.boss_name !== 'all')
)

const kills = computed(() =>
  activeBosses.value.filter(bg => bg.segments.some(s => s.attempt_type === 'kill'))
)

const wipesOnly = computed(() =>
  activeBosses.value.filter(bg => bg.segments.every(s => s.attempt_type === 'wipe'))
)

const totalWipes = computed(() =>
  activeBosses.value.reduce((n, bg) => n + wipeCount(bg), 0)
)

// Difficulty from the first non-TBD attempt
const difficulty = computed(() => {
  for (const bg of activeBosses.value) {
    for (const s of bg.segments) {
      if (s.difficulty && s.difficulty !== 'TBD' && s.difficulty !== 'All') {
        return s.difficulty
      }
    }
  }
  return ''
})

const tanks   = computed(() =>
  props.players.filter(p => getRole(p) === 'tank')
    .sort((a, b) => b.taken.per_second - a.taken.per_second)
)
const healers = computed(() =>
  props.players.filter(p => getRole(p) === 'healer')
    .sort((a, b) => b.heal.per_second - a.heal.per_second)
)
const dps = computed(() =>
  props.players.filter(p => getRole(p) === 'dps')
    .sort((a, b) =>
      (b.useful?.per_second ?? b.damage.per_second) -
      (a.useful?.per_second ?? a.damage.per_second)
    )
)
</script>

<template>
  <div class="raid-overview">

    <!-- ── Summary bar ──────────────────────────────────────────────────── -->
    <div class="summary-bar">
      <span class="stat">{{ kills.length }}<span class="dim"> kills</span></span>
      <span class="bull">·</span>
      <span class="stat">{{ totalWipes }}<span class="dim"> wipes</span></span>
      <span class="bull">·</span>
      <span class="stat">{{ players.length }}<span class="dim"> players</span></span>
      <span class="bull">·</span>
      <span class="stat dim">{{ duration }}</span>
      <template v-if="difficulty">
        <span class="bull">·</span>
        <span class="stat dim">{{ difficulty }}</span>
      </template>
    </div>

    <!-- ── Boss results ─────────────────────────────────────────────────── -->
    <div class="boss-section">

      <!-- Kills -->
      <div class="boss-col">
        <div class="col-title">Boss kills</div>
        <div v-for="bg in kills" :key="bg.boss_name" class="boss-row">
          <span class="outcome-dot kill-dot">●</span>
          <span class="boss-name">{{ bg.boss_name }}</span>
          <span class="boss-dur">{{ killAttempt(bg)?.duration_str }}</span>
          <span v-if="wipeCount(bg) > 0" class="wipe-badge">{{ wipeCount(bg) }}w</span>
        </div>
        <div v-if="!kills.length" class="dim empty">No kills</div>
      </div>

      <!-- Wipes only -->
      <div v-if="wipesOnly.length" class="boss-col">
        <div class="col-title">Not killed</div>
        <div v-for="bg in wipesOnly" :key="bg.boss_name" class="boss-row">
          <span class="outcome-dot wipe-dot">✕</span>
          <span class="boss-name">{{ bg.boss_name }}</span>
          <span class="dim">{{ wipeCount(bg) }}&nbsp;wipe{{ wipeCount(bg) !== 1 ? 's' : '' }}</span>
        </div>
      </div>

    </div>

    <!-- ── Roster ───────────────────────────────────────────────────────── -->
    <div class="roster-section">

      <div class="role-col">
        <div class="col-title">Tanks <span class="dim count">({{ tanks.length }})</span></div>
        <div v-for="p in tanks" :key="p.name" class="player-row">
          <img class="spec-icon" :src="`/static/icons/${p.spec_icon}.jpg`" :alt="p.spec_name" width="16" height="16" />
          <span class="pname" :class="classSlug(p.class_name)">{{ p.name }}</span>
          <span class="spec-label dim">{{ specShort(p) }}</span>
          <span class="pstat dim">{{ fmtRate(p.taken.per_second) }}&nbsp;dtps</span>
        </div>
      </div>

      <div class="role-col">
        <div class="col-title">Healers <span class="dim count">({{ healers.length }})</span></div>
        <div v-for="p in healers" :key="p.name" class="player-row">
          <img class="spec-icon" :src="`/static/icons/${p.spec_icon}.jpg`" :alt="p.spec_name" width="16" height="16" />
          <span class="pname" :class="classSlug(p.class_name)">{{ p.name }}</span>
          <span class="spec-label dim">{{ specShort(p) }}</span>
          <span class="pstat dim">{{ fmtRate(p.heal.per_second) }}&nbsp;hps</span>
        </div>
      </div>

      <div class="role-col dps-col">
        <div class="col-title">DPS <span class="dim count">({{ dps.length }})</span></div>
        <div v-for="p in dps" :key="p.name" class="player-row">
          <img class="spec-icon" :src="`/static/icons/${p.spec_icon}.jpg`" :alt="p.spec_name" width="16" height="16" />
          <span class="pname" :class="classSlug(p.class_name)">{{ p.name }}</span>
          <span class="spec-label dim">{{ specShort(p) }}</span>
          <span class="pstat dim">{{ fmtRate(p.useful?.per_second ?? p.damage.per_second) }}&nbsp;dps</span>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.raid-overview {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 0 8px;
  margin-bottom: 4px;
}

/* ── Summary bar ─────────────────────────────────────────────────────────── */

.summary-bar {
  display: flex;
  align-items: center;
  gap: 0;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 13px;
  color: var(--text);
}

.stat { white-space: nowrap; }
.bull { color: var(--text-muted); margin: 0 8px; }
.dim  { color: var(--text-muted); }
.count { font-size: 12px; }

/* ── Boss section ────────────────────────────────────────────────────────── */

.boss-section {
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
}

.boss-col {
  min-width: 180px;
  flex: 0 0 auto;
}

.col-title {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 4px;
  padding-bottom: 3px;
  border-bottom: 1px solid var(--table-border);
}

.boss-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 13px;
}

.outcome-dot { font-size: 9px; flex-shrink: 0; }
.kill-dot  { color: var(--kill); }
.wipe-dot  { color: var(--wipe); font-size: 10px; }

.boss-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.boss-dur {
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
  flex-shrink: 0;
}

.wipe-badge {
  font-size: 10px;
  color: var(--wipe);
  flex-shrink: 0;
}

.empty {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 12px;
  padding: 4px 0;
}

/* ── Roster ──────────────────────────────────────────────────────────────── */

.roster-section {
  display: flex;
  gap: 28px;
  flex-wrap: wrap;
  align-items: flex-start;
}

.role-col {
  flex: 0 0 auto;
  min-width: 160px;
}

.dps-col {
  flex: 1 1 auto;
  max-width: 560px;
}

.player-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
}

.spec-icon {
  flex-shrink: 0;
  border-radius: 2px;
  display: block;
}

.pname {
  font-size: 13px;
  flex-shrink: 0;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spec-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 11px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pstat {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  white-space: nowrap;
}
</style>
