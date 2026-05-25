<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useFetch } from '../composables/useFetch'
import BasePage from '../components/BasePage.vue'
import BossSelector from '../components/BossSelector.vue'
import ReportNav from '../components/ReportNav.vue'
import { CLASS_DISPLAY_NAMES } from '../constants/bosses'
import type { BossAttempt, SpellInfo } from '../types/api'

interface ComparePlayer {
  NAME: string
  SOURCE_NAME: string
  SPEC_ICON: string
  SPEC: string
  ACTUAL: Record<string, string>
  CASTS: Record<string, string>
  DOT_UPTIME: Record<string, string>  // spell_id -> "XX.XX" uptime %
  SPELLS_DATA: Record<string, SpellInfo>
}

interface CompareApiResponse {
  PLAYERS: ComparePlayer[]
  SPELLS: Record<string, SpellInfo>
  TARGETS: Record<string, unknown>
}

const route = useRoute()
const router = useRouter()
const reportId = computed(() => route.params.id as string)

const { report, loading: reportLoading, fetchOverview } = useReport()
watch(reportId, id => fetchOverview(id), { immediate: true })

const reportTitle = computed(() => report.value?.REPORT_NAME ?? '')

const availableClasses = computed<string[]>(() => {
  if (!report.value) return []
  return [...new Set(Object.values(report.value.PLAYER_CLASSES))].sort()
})

const selectedHref = ref('')

const bosses = computed(() => report.value?.SEGMENTS_LINKS ?? [])
watch(bosses, bgs => {
  if (selectedHref.value || !bgs.length) return
  const qs = route.query.s as string | undefined
  const qf = route.query.f as string | undefined
  if (!qs || !qf) return
  for (const bg of bgs) {
    const found = bg.segments.find(seg => {
      const p = new URLSearchParams(seg.href.slice(1))
      return p.get('s') === qs && p.get('f') === qf
    })
    if (found) { selectedHref.value = found.href; return }
  }
}, { immediate: true })

function selectBoss(attempt: BossAttempt): void {
  selectedHref.value = attempt.href
  router.replace({ query: Object.fromEntries(new URLSearchParams(attempt.href.slice(1))) })
  runCompare()
}

function clearBoss(): void {
  selectedHref.value = ''
  router.replace({ query: {} })
  runCompare()
}

const selectedClass = ref('')
watch(availableClasses, classes => {
  if (classes.length && !selectedClass.value) selectedClass.value = classes[0]
})

const { data, loading: compareLoading, error, execute } = useFetch<CompareApiResponse>()

const damageRouteQuery = computed(() => {
  if (!selectedHref.value) return {}
  return Object.fromEntries(new URLSearchParams(selectedHref.value.slice(1)))
})

function runCompare(): void {
  if (!selectedClass.value) return
  const url = selectedHref.value
    ? `/api/v2/reports/${reportId.value}/compare/${selectedHref.value}`
    : `/api/v2/reports/${reportId.value}/compare/`
  execute(url, { method: 'POST', body: { class: selectedClass.value } })
}

watch([selectedClass, selectedHref], runCompare)

interface SpellRow {
  id: string
  name: string
  icon: string
  color: string
  maxPct: number
}

const allSpellRows = computed<SpellRow[]>(() => {
  if (!data.value) return []
  const { SPELLS, PLAYERS } = data.value
  const spellIds = new Set<string>()
  for (const p of PLAYERS) {
    for (const id of Object.keys(p.ACTUAL)) {
      if (id !== 'Total') spellIds.add(id)
    }
  }
  function parseAmount(s: string | undefined): number {
    if (!s) return 0
    return parseFloat(s.replace(/[\s,]/g, '')) || 0
  }
  return [...spellIds]
    .map(id => ({
      id,
      name: SPELLS[id]?.name ?? id,
      icon: SPELLS[id]?.icon ?? '',
      color: SPELLS[id]?.color ?? '',
      maxAmount: Math.max(...PLAYERS.map(p => parseAmount(p.ACTUAL[id]))),
    }))
    .sort((a, b) => b.maxAmount - a.maxAmount)
})
</script>

<template>
  <BasePage :loading="reportLoading" :report="report" :selected-href="selectedHref">
    <template #sidebar>
      <div class="report-title">{{ reportTitle }}</div>
      <BossSelector
        :bosses="bosses"
        :selected-href="selectedHref"
        @select="selectBoss"
        @deselect="clearBoss"
      />
      <ReportNav
        :report-id="reportId"
        :boss-query="damageRouteQuery"
        :bosses="bosses"
        :selected-href="selectedHref"
      />
    </template>

    <template #default>
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

      <div v-if="compareLoading" class="cmp-loading">
        <div v-for="i in 6" :key="i" class="cmp-sk-row" />
      </div>
      <div v-else-if="error" class="cmp-error">{{ error }}</div>
      <template v-else-if="data && data.PLAYERS.length">
        <div class="cmp-table-wrap">
          <table class="cmp-table">
            <thead>
              <!-- Player name headers spanning 3 stat columns each -->
              <tr>
                <th class="th-spell" rowspan="2">Spell</th>
                <th
                  v-for="player in data.PLAYERS"
                  :key="player.NAME"
                  colspan="3"
                  class="th-player"
                >
                  <img
                    v-if="player.SPEC_ICON"
                    :src="`/static/icons/${player.SPEC_ICON}.jpg`"
                    :title="player.SPEC"
                    class="player-spec-icon"
                    width="18"
                    height="18"
                  />
                  {{ player.SOURCE_NAME || player.NAME }}
                </th>
              </tr>
              <!-- Stat sub-headers -->
              <tr>
                <template v-for="player in data.PLAYERS" :key="player.NAME">
                  <th class="th-stat">Casts</th>
                  <th class="th-stat">Amount</th>
                  <th class="th-stat th-pct">Uptime</th>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr v-for="spell in allSpellRows" :key="spell.id">
                <td class="td-spell">
                  <img
                    v-if="spell.icon"
                    :src="`/static/icons/${spell.icon}.jpg`"
                    class="spell-icon"
                    width="18"
                    height="18"
                  />
                  <a
                    :href="`https://www.wowhead.com/wotlk/spell=${spell.id}`"
                    target="_blank"
                    rel="noreferrer"
                    class="spell-link"
                    :style="spell.color ? { color: spell.color } : {}"
                  >{{ spell.name }}</a>
                </td>
                <template v-for="player in data.PLAYERS" :key="player.NAME">
                  <td class="td-num">{{ player.CASTS[spell.id] || '—' }}</td>
                  <td class="td-num">{{ player.ACTUAL[spell.id] || '—' }}</td>
                  <td
                    class="td-num td-pct"
                    :style="{ '--pct': (player.DOT_UPTIME[spell.id] ?? '0') + '%' }"
                  >{{ player.DOT_UPTIME[spell.id] ? player.DOT_UPTIME[spell.id] + '%' : '—' }}</td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <p v-else-if="data" class="empty">No players of this class in the log.</p>
    </template>
  </BasePage>
</template>

<style scoped>
.cmp-loading {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 1rem 0;
}

.cmp-sk-row {
  height: 36px;
  background: var(--surface);
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

.cmp-error {
  padding: 1rem 0;
  color: var(--wipe);
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
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

/* ── Table ─────────────────────────────────────────────────── */
.cmp-table-wrap {
  overflow-x: auto;
}

.cmp-table {
  border-collapse: collapse;
  width: max-content;
  font-size: 0.85rem;
  white-space: nowrap;
}

.cmp-table th,
.cmp-table td {
  border: 1px solid var(--table-border);
  padding: 0 10px;
}

.cmp-table tbody tr:hover {
  background: var(--hover-row);
}

/* ── Header ── */
.th-spell {
  text-align: left;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 6px 10px;
  position: sticky;
  left: 0;
  background: var(--background);
  z-index: 2;
}

.th-player {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-align: center;
  color: var(--text);
  padding: 6px 10px;
  border-bottom: 2px solid var(--primary);
}

.player-spec-icon {
  vertical-align: middle;
  border-radius: 2px;
  margin-right: 4px;
  margin-bottom: 1px;
}

.th-stat {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-align: right;
  padding: 4px 10px;
  min-width: 80px;
}

.th-pct {
  min-width: 100px;
}

/* ── Spell cell ── */
.td-spell {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 10px;
  position: sticky;
  left: 0;
  background: var(--background);
  z-index: 1;
}

.spell-icon {
  flex-shrink: 0;
  border-radius: 2px;
  display: block;
}

.spell-link {
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}
.spell-link:hover { text-decoration: underline; }

/* ── Numeric cells ── */
.td-num {
  text-align: right;
  font-family: 'Barlow Condensed', sans-serif;
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
  padding: 0 10px;
  height: 34px;
  min-width: 80px;
}

/* % cell: subtle background bar as a fill indicator */
.td-pct {
  min-width: 100px;
  background: linear-gradient(
    to right,
    color-mix(in srgb, var(--primary) 18%, transparent) var(--pct),
    transparent var(--pct)
  );
}

.empty {
  color: var(--text-muted);
  font-size: 0.875rem;
}
</style>
