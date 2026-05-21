<script setup lang="ts">
import { computed } from 'vue'
import type { BossGroup, BossAttempt, Player } from '../types/api'
import { CLASS_DISPLAY_NAMES } from '../constants/bosses'

const props = defineProps<{
  bosses: BossGroup[]
  players: Player[]
  duration: string
}>()

// ── Role detection ─────────────────────────────────────────────────────────
// Spec-name matching is the primary signal — DATA.useful is empty in the
// full-raid view, so relying on useful === null would mark everyone a healer.

const TANK_SPECS = new Set([
  'Blood Death Knight',
  'Feral Combat Druid',
  'Protection Paladin',
  'Protection Warrior',
])

const HEALER_SPECS = new Set([
  'Restoration Druid',
  'Holy Paladin',
  'Discipline Priest',
  'Holy Priest',
  'Restoration Shaman',
])

function getRole(p: Player): 'tank' | 'healer' | 'dps' {
  if (HEALER_SPECS.has(p.spec_name)) return 'healer'
  if (TANK_SPECS.has(p.spec_name))   return 'tank'
  // Fallback for unrecognised specs — if heal >> damage, assume healer
  if (p.useful === null && p.heal.per_second > p.damage.per_second) return 'healer'
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

const SPEC_ABBREVS: Record<string, string> = {
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

function specShort(p: Player): string {
  const cls = CLASS_DISPLAY_NAMES[p.class_name] ?? ''
  const prefix = cls && p.spec_name.endsWith(cls)
    ? p.spec_name.slice(0, -cls.length).trim()
    : p.spec_name
  if (!prefix) return cls
  return SPEC_ABBREVS[prefix] ?? prefix
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

const difficulty = computed(() => {
  for (const bg of activeBosses.value) {
    for (const s of bg.segments) {
      if (s.difficulty && s.difficulty !== 'TBD' && s.difficulty !== 'All') return s.difficulty
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

    <!-- Summary bar -->
    <div class="summary-bar">
      <span>{{ kills.length }}<span class="dim"> kills</span></span>
      <span class="bull">·</span>
      <span>{{ totalWipes }}<span class="dim"> wipes</span></span>
      <span class="bull">·</span>
      <span>{{ players.length }}<span class="dim"> players</span></span>
      <span class="bull">·</span>
      <span class="dim">{{ duration }}</span>
      <template v-if="difficulty">
        <span class="bull">·</span>
        <span class="dim">{{ difficulty }}</span>
      </template>
    </div>

    <!-- Body: boss list (left) + roster (right) side-by-side -->
    <div class="body-row">

      <!-- Boss kills & wipes -->
      <div class="boss-section">
        <div class="col-title">Kills</div>
        <div v-for="bg in kills" :key="bg.boss_name" class="boss-row">
          <span class="kill-dot">●</span>
          <span class="boss-name">{{ bg.boss_name }}</span>
          <span class="boss-dur dim">{{ killAttempt(bg)?.duration_str }}</span>
          <span v-if="wipeCount(bg) > 0" class="wipe-badge">{{ wipeCount(bg) }}w</span>
        </div>
        <div v-if="!kills.length" class="dim empty">No kills</div>

        <template v-if="wipesOnly.length">
          <div class="col-title wipes-title">Not killed</div>
          <div v-for="bg in wipesOnly" :key="bg.boss_name" class="boss-row">
            <span class="wipe-dot">✕</span>
            <span class="boss-name">{{ bg.boss_name }}</span>
            <span class="dim">{{ wipeCount(bg) }}w</span>
          </div>
        </template>
      </div>

      <!-- Roster -->
      <div class="roster-section">

        <div class="role-col">
          <div class="col-title">Tanks <span class="dim">({{ tanks.length }})</span></div>
          <div v-for="p in tanks" :key="p.name" class="player-row">
            <img class="spec-icon" :src="`/static/icons/${p.spec_icon}.jpg`" :alt="p.spec_name" width="16" height="16" />
            <span class="pname" :class="classSlug(p.class_name)">{{ p.name }}</span>
            <span class="spec-label dim">{{ specShort(p) }}</span>
            <span class="pstat dim">{{ fmtRate(p.taken.per_second) }}&thinsp;dtps</span>
          </div>
        </div>

        <div class="role-col">
          <div class="col-title">Healers <span class="dim">({{ healers.length }})</span></div>
          <div v-for="p in healers" :key="p.name" class="player-row">
            <img class="spec-icon" :src="`/static/icons/${p.spec_icon}.jpg`" :alt="p.spec_name" width="16" height="16" />
            <span class="pname" :class="classSlug(p.class_name)">{{ p.name }}</span>
            <span class="spec-label dim">{{ specShort(p) }}</span>
            <span class="pstat dim">{{ fmtRate(p.heal.per_second) }}&thinsp;hps</span>
          </div>
        </div>

        <div class="role-col dps-col">
          <div class="col-title">DPS <span class="dim">({{ dps.length }})</span></div>
          <div v-for="p in dps" :key="p.name" class="player-row">
            <img class="spec-icon" :src="`/static/icons/${p.spec_icon}.jpg`" :alt="p.spec_name" width="16" height="16" />
            <span class="pname" :class="classSlug(p.class_name)">{{ p.name }}</span>
            <span class="spec-label dim">{{ specShort(p) }}</span>
            <span class="pstat dim">{{ fmtRate(p.useful?.per_second ?? p.damage.per_second) }}&thinsp;dps</span>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.raid-overview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0 8px;
  margin-bottom: 4px;
}

/* ── Summary bar ─────────────────────────────────────────────────────────── */

.summary-bar {
  display: flex;
  align-items: center;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 17px;
  color: var(--text);
}
.bull { color: var(--text-muted); margin: 0 8px; }
.dim  { color: var(--text-muted); }

/* ── Body row: boss list left, roster right ──────────────────────────────── */

.body-row {
  display: flex;
  gap: 28px;
  align-items: flex-start;
}

/* ── Boss section ────────────────────────────────────────────────────────── */

.boss-section {
  flex: 0 0 auto;
  width: 300px;
}

.col-title {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 15px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 4px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--table-border);
}
.wipes-title { margin-top: 8px; }

.boss-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 17px;
}

.kill-dot { color: var(--kill); font-size: 12px; flex-shrink: 0; }
.wipe-dot { color: var(--wipe); font-size: 13px; flex-shrink: 0; }

.boss-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.boss-dur { font-variant-numeric: tabular-nums; flex-shrink: 0; }
.wipe-badge { font-size: 13px; color: var(--wipe); flex-shrink: 0; }
.empty { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; padding: 4px 0; }

/* ── Roster section ──────────────────────────────────────────────────────── */

.roster-section {
  flex: 1;
  display: flex;
  gap: 24px;
  align-items: flex-start;
  min-width: 0;
}

.role-col {
  flex: 1 1 0;
  min-width: 0;
}

.dps-col {
  flex: 1 1 0;
  min-width: 0;
}

.player-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
}

.spec-icon {
  flex-shrink: 0;
  border-radius: 2px;
  display: block;
}

.pname {
  font-size: 17px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spec-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 15px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pstat {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  white-space: nowrap;
}
</style>
