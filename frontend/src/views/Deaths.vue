<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useFetch } from '../composables/useFetch'
import BasePage from '../components/BasePage.vue'
import BossSelector from '../components/BossSelector.vue'
import type { BossAttempt, DeathApiResponse, DeathEntry, DeathLogLine } from '../types/api'

const route = useRoute()
const router = useRouter()
const reportId = computed(() => route.params.id as string)

const { report, loading: reportLoading, fetchOverview } = useReport()
watch(reportId, id => fetchOverview(id), { immediate: true })

const reportTitle = computed(() => report.value?.REPORT_NAME ?? '')
const bosses = computed(() => report.value?.SEGMENTS_LINKS ?? [])

const { data, loading, error, execute } = useFetch<DeathApiResponse>()

// Boss selection — restored from URL on load
const selectedHref = ref('')

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
}

function clearBoss(): void {
  selectedHref.value = ''
  router.replace({ query: {} })
}

const damageRouteQuery = computed(() =>
  selectedHref.value
    ? Object.fromEntries(new URLSearchParams(selectedHref.value.slice(1)))
    : {}
)

watch([reportId, selectedHref], ([id, href]) => {
  const url = href
    ? `/api/v2/reports/${id}/deaths/${href}`
    : `/api/v2/reports/${id}/deaths/`
  execute(url)
}, { immediate: true })

const deaths = computed<[string, DeathEntry][]>(() =>
  data.value ? Object.entries(data.value.DEATHS) : []
)

// Expanded cards
const expanded = ref<Set<string>>(new Set())
function toggle(id: string): void {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

function classSlug(playerName: string): string {
  if (!data.value) return ''
  const guid = data.value.PLAYERS[playerName]
  if (!guid) return ''
  const cls = data.value.CLASSES[guid]
  if (!cls) return ''
  return cls.toLowerCase().replace(/\s+/g, '-')
}

function spellIcon(line: DeathLogLine): string {
  const spellId = String(line[4] ?? '')
  return data.value?.SPELLS[spellId]?.icon ?? ''
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

function eventLabel(line: DeathLogLine): string {
  const type = String(line[1])
  const sub  = String(line[2] ?? '')
  if (type === 'DIED')      return 'Died'
  if (type === 'INSTAKILL') return 'Instakill'
  if (type === 'RESURRECT') return 'Resurrected'
  if (type === 'HEAL')      return sub === 'HOT' ? 'HoT' : 'Heal'
  if (type === 'DAMAGE') {
    if (sub === 'SWING') return 'Hit'
    if (sub === 'DOT')   return 'DoT'
    return 'Hit'
  }
  if (type === 'MISS')  return 'Miss'
  if (type === 'AURA')  return sub
  if (type === 'CAST')  return 'Cast'
  return type
}

function spellName(line: DeathLogLine): string { return String(line[5] ?? '') }

function amount(line: DeathLogLine): string {
  const v = line[6]
  if (v == null || v === '' || v === 0) return ''
  return Number(v).toLocaleString('en-US')
}
</script>

<template>
  <div class="page-shell">
    <aside class="sidebar">
      <div class="report-title">{{ reportTitle }}</div>
      <BossSelector
        :bosses="bosses"
        :selected-href="selectedHref"
        @select="selectBoss"
        @deselect="clearBoss"
      />
      <nav class="sidebar-nav">
        <router-link
          :to="{ path: `/reports/${reportId}`, query: damageRouteQuery }"
          class="sidebar-nav-link"
          active-class=""
          exact-active-class="router-link-exact-active"
        >Damage</router-link>
        <router-link
          :to="{ path: `/reports/${reportId}/deaths`, query: damageRouteQuery }"
          class="sidebar-nav-link"
        >Deaths</router-link>
        <router-link
          :to="{ path: `/reports/${reportId}/timeline`, query: damageRouteQuery }"
          class="sidebar-nav-link"
        >Timeline</router-link>
        <router-link
          :to="{ path: `/reports/${reportId}/compare`, query: damageRouteQuery }"
          class="sidebar-nav-link"
        >Compare</router-link>
      </nav>
    </aside>

    <main class="main-content">
      <BasePage :loading="loading || reportLoading" :error="error">
        <p v-if="!deaths.length && !loading" class="empty">No deaths recorded.</p>

        <div v-else class="deaths-list">
          <div
            v-for="[id, entry] in deaths"
            :key="id"
            class="death-card"
          >
            <button class="death-summary" @click="toggle(id)">
              <span class="death-player" :class="classSlug(entry.player)">{{ entry.player }}</span>
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
                <span class="ll-spell">
                  <img
                    v-if="spellIcon(line)"
                    :src="`/static/icons/${spellIcon(line)}.jpg`"
                    class="spell-icon"
                    width="14"
                    height="14"
                    alt=""
                  />{{ spellName(line) }}
                </span>
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
.empty {
  color: var(--text-muted);
  font-size: 0.875rem;
  padding: 1rem 0;
}

.deaths-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* ── Death card ─────────────────────────────────────────────────────── */
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
.death-summary:hover { background: var(--hover-row); }

.death-player {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 15px;
  font-weight: 500;
}

.death-time {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}

.death-toggle {
  font-size: 10px;
  color: var(--text-muted);
}

/* ── Log lines ──────────────────────────────────────────────────────── */
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
  font-size: 12px;
}
.log-line:nth-child(odd) { background: hsl(0, 0%, 3%); }

.ll-ts {
  font-family: 'Barlow Condensed', sans-serif;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}

.ll-event {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.ll-spell {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.spell-icon {
  flex-shrink: 0;
  border-radius: 2px;
}

.ll-amount {
  font-family: 'Barlow Condensed', sans-serif;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* Event type accent colors */
.ev-damage  .ll-event { color: var(--wipe); }
.ev-heal    .ll-event { color: var(--kill); }
.ev-death   .ll-event { color: crimson; font-size: 12px; }
.ev-aura    .ll-event { color: var(--link); }
.ev-aura-off .ll-event { color: var(--text-muted); }
.ev-res     .ll-event { color: goldenrod; }
</style>
