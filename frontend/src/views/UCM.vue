<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useFetch } from '../composables/useFetch'
import { useSort } from '../composables/useSort'
import BasePage from '../components/BasePage.vue'
import BossSelector from '../components/BossSelector.vue'
import ReportNav from '../components/ReportNav.vue'
import type { BossAttempt } from '../types/api'

interface SpecInfo {
  name: string
  class: string
  icon: string
  spec: string
}

interface UCMEntry {
  source: string
  timestamp: string
  stacks: number
  players_hit: number
  actual_total: string
  actual: Record<string, string>
  full_total: string
  full: Record<string, string>
  prevented_total: string
  prevented: Record<string, string>
  overkill_total: string
  overkill: Record<string, string>
  pets_total: string
  pets: Record<string, string>
}

interface UCMApiResponse {
  UCM: UCMEntry[][]
  SPECS: Record<string, SpecInfo>
  GUID_NAMES: Record<string, string>
}

const route = useRoute()
const router = useRouter()
const reportId = computed(() => route.params.id as string)

const { report, loading: reportLoading, fetchOverview } = useReport()
watch(reportId, id => fetchOverview(id), { immediate: true })

const reportTitle = computed(() => report.value?.REPORT_NAME ?? '')
const bosses = computed(() => report.value?.SEGMENTS_LINKS ?? [])

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

const bossQuery = computed(() =>
  selectedHref.value
    ? Object.fromEntries(new URLSearchParams(selectedHref.value.slice(1)))
    : {}
)

function selectBoss(attempt: BossAttempt): void {
  selectedHref.value = attempt.href
  router.replace({ query: Object.fromEntries(new URLSearchParams(attempt.href.slice(1))) })
  fetchData()
}

function clearBoss(): void {
  selectedHref.value = ''
  router.replace({ query: {} })
  fetchData()
}

const { data, loading: dataLoading, error, execute } = useFetch<UCMApiResponse>()

function fetchData(): void {
  const params = new URLSearchParams(bossQuery.value as Record<string, string>)
  execute(`/api/v2/reports/${reportId.value}/ucm/?${params}`)
}

watch(reportId, fetchData, { immediate: true })

const loading = computed(() => reportLoading.value || dataLoading.value)

function resolveClass(guid: string): string {
  return data.value?.SPECS[guid]?.class ?? ''
}

function resolveName(guid: string): string {
  if (data.value?.SPECS[guid]) return data.value.SPECS[guid].name
  return data.value?.GUID_NAMES[guid] ?? guid
}

function playerLink(guid: string): string {
  const name = resolveName(guid)
  return `/reports/${reportId.value}/player/${encodeURIComponent(name)}`
}

const { sortKey, setSort, sortIcon, sorted } = useSort('actual_total')

const sortedPulls = computed<UCMEntry[][]>(() => {
  if (!data.value) return []
  return data.value.UCM.map(pull =>
    sorted(pull, (entry, key) => {
      if (key === 'source') return resolveName(entry.source)
      if (key === 'timestamp') return entry.timestamp
      if (key === 'stacks') return entry.stacks
      if (key === 'players_hit') return entry.players_hit
      return (entry as Record<string, string | number>)[key] as string ?? ''
    })
  )
})
</script>

<template>
  <BasePage :title="reportTitle || 'UCM'" :loading="loading" :error="error ?? undefined">
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
        :boss-query="bossQuery"
        :bosses="bosses"
        :selected-href="selectedHref"
      />
    </template>

    <template #default>
      <div v-if="data" class="ucm-wrap">
        <div
          v-for="(pull, pullIdx) in sortedPulls"
          :key="pullIdx"
          class="pull-block"
        >
          <div class="table-scroll">
            <table class="ucm-table">
              <thead>
                <tr>
                  <th
                    class="player-cell sortable"
                    :class="{ 'sort-active': sortKey === 'source' }"
                    @click="setSort('source')"
                  >
                    Source<span class="sort-icon" :class="{ active: sortKey === 'source' }">{{ sortIcon('source') }}</span>
                  </th>
                  <th
                    class="num-cell sortable"
                    :class="{ 'sort-active': sortKey === 'timestamp' }"
                    @click="setSort('timestamp')"
                  >
                    Time<span class="sort-icon" :class="{ active: sortKey === 'timestamp' }">{{ sortIcon('timestamp') }}</span>
                  </th>
                  <th
                    class="num-cell sortable"
                    :class="{ 'sort-active': sortKey === 'stacks' }"
                    @click="setSort('stacks')"
                  >
                    Stacks<span class="sort-icon" :class="{ active: sortKey === 'stacks' }">{{ sortIcon('stacks') }}</span>
                  </th>
                  <th
                    class="num-cell sortable"
                    :class="{ 'sort-active': sortKey === 'players_hit' }"
                    @click="setSort('players_hit')"
                  >
                    Hit<span class="sort-icon" :class="{ active: sortKey === 'players_hit' }">{{ sortIcon('players_hit') }}</span>
                  </th>
                  <th
                    class="num-cell sortable"
                    :class="{ 'sort-active': sortKey === 'actual_total' }"
                    @click="setSort('actual_total')"
                  >
                    Actual<span class="sort-icon" :class="{ active: sortKey === 'actual_total' }">{{ sortIcon('actual_total') }}</span>
                  </th>
                  <th
                    class="num-cell sortable"
                    :class="{ 'sort-active': sortKey === 'full_total' }"
                    @click="setSort('full_total')"
                  >
                    Full<span class="sort-icon" :class="{ active: sortKey === 'full_total' }">{{ sortIcon('full_total') }}</span>
                  </th>
                  <th
                    class="num-cell sortable"
                    :class="{ 'sort-active': sortKey === 'prevented_total' }"
                    @click="setSort('prevented_total')"
                  >
                    Prevented<span class="sort-icon" :class="{ active: sortKey === 'prevented_total' }">{{ sortIcon('prevented_total') }}</span>
                  </th>
                  <th
                    class="num-cell sortable"
                    :class="{ 'sort-active': sortKey === 'overkill_total' }"
                    @click="setSort('overkill_total')"
                  >
                    Overkill<span class="sort-icon" :class="{ active: sortKey === 'overkill_total' }">{{ sortIcon('overkill_total') }}</span>
                  </th>
                  <th
                    class="num-cell sortable"
                    :class="{ 'sort-active': sortKey === 'pets_total' }"
                    @click="setSort('pets_total')"
                  >
                    Pets<span class="sort-icon" :class="{ active: sortKey === 'pets_total' }">{{ sortIcon('pets_total') }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(entry, i) in pull" :key="i">
                  <td class="player-cell" :title="data.SPECS[entry.source]?.spec">
                    <img
                      v-if="data.SPECS[entry.source]"
                      :src="`/static/icons/${data.SPECS[entry.source].icon}.jpg`"
                      class="spec-icon"
                    >
                    <router-link
                      v-if="data.SPECS[entry.source]"
                      :class="resolveClass(entry.source)"
                      :to="{ path: playerLink(entry.source), query: bossQuery }"
                    >{{ resolveName(entry.source) }}</router-link>
                  </td>
                  <td class="num-cell">{{ entry.timestamp }}</td>
                  <td class="num-cell">{{ entry.stacks }}</td>
                  <td class="num-cell">{{ entry.players_hit }}</td>

                  <td class="num-cell has-tooltip">
                    {{ entry.actual_total }}
                    <div v-if="Object.keys(entry.actual ?? {}).length" class="tooltip">
                      <table>
                        <tr v-for="(val, guid) in entry.actual" :key="guid">
                          <td :class="resolveClass(String(guid))">{{ resolveName(String(guid)) }}</td>
                          <td class="tt-num">{{ val }}</td>
                        </tr>
                      </table>
                    </div>
                  </td>

                  <td class="num-cell">{{ entry.full_total }}</td>
                  <td class="num-cell">{{ entry.prevented_total }}</td>

                  <td class="num-cell has-tooltip">
                    {{ entry.overkill_total }}
                    <div v-if="Object.keys(entry.overkill ?? {}).length" class="tooltip">
                      <table>
                        <tr v-for="(val, guid) in entry.overkill" :key="guid">
                          <td :class="resolveClass(String(guid))">{{ resolveName(String(guid)) }}</td>
                          <td class="tt-num">{{ val }}</td>
                        </tr>
                      </table>
                    </div>
                  </td>

                  <td class="num-cell has-tooltip">
                    {{ entry.pets_total }}
                    <div v-if="Object.keys(entry.pets ?? {}).length" class="tooltip">
                      <table>
                        <tr v-for="(val, guid) in entry.pets" :key="guid">
                          <td>{{ resolveName(String(guid)) }}</td>
                          <td class="tt-num">{{ val }}</td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </BasePage>
</template>

<style scoped>
.ucm-wrap {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.table-scroll {
  overflow-x: auto;
}

.ucm-table {
  border-collapse: collapse;
  font-size: 0.85rem;
  white-space: nowrap;
}

.ucm-table th,
.ucm-table td {
  padding: 0.2rem 0.4rem;
  border: 1px solid var(--table-border);
}

.ucm-table thead th {
  position: sticky;
  top: 0;
  background: var(--background);
  z-index: 1;
}

.player-cell {
  text-align: left;
  position: sticky;
  left: 0;
  background: var(--background);
  z-index: 2;
  min-width: 12rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.num-cell {
  text-align: right;
  min-width: 7rem;
}

.spec-icon {
  width: 1rem;
  height: 1rem;
  vertical-align: middle;
}

.has-tooltip {
  position: relative;
}

.tooltip {
  visibility: hidden;
  position: absolute;
  top: 75%;
  left: 95%;
  max-height: 10rem;
  padding: 0.1rem;
  border-radius: 0.25rem;
  background: var(--background);
  box-shadow: inset 0 0 0.25rem 0.1rem var(--primary), 0 0 0.5rem 0.1rem var(--primary);
  overflow-y: auto;
  scrollbar-width: thin;
  overscroll-behavior: contain;
  z-index: 10;
}

.has-tooltip:hover .tooltip {
  visibility: visible;
}

.tooltip td {
  padding: 0.1rem 0.3rem;
  min-width: 7rem;
  text-align: left;
}

.tt-num {
  text-align: right;
  min-width: 4rem;
}
</style>
