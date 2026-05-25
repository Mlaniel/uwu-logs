<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useFetch } from '../composables/useFetch'
import BasePage from '../components/BasePage.vue'
import BossSelector from '../components/BossSelector.vue'
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

const tooltipFields = ['actual', 'overkill', 'pets'] as const
</script>

<template>
  <BasePage :title="reportTitle || 'UCM'" :loading="loading" :error="error ?? undefined">
    <template #sidebar>
      <BossSelector
        :bosses="bosses"
        :selected-href="selectedHref"
        @select="selectBoss"
        @clear="clearBoss"
      />
      <nav class="sidebar-nav">
        <router-link :to="`/reports/${reportId}`" class="sidebar-nav-link">Damage</router-link>
        <router-link :to="{ path: `/reports/${reportId}/ucm`, query: bossQuery }" class="sidebar-nav-link">UCM</router-link>
      </nav>
    </template>

    <template #default>
      <div v-if="data" class="ucm-wrap">
        <div
          v-for="(pull, pullIdx) in data.UCM"
          :key="pullIdx"
          class="pull-block"
        >
          <div class="table-scroll">
            <table class="ucm-table">
              <thead>
                <tr>
                  <th class="player-cell">Source</th>
                  <th class="num-cell">Time</th>
                  <th class="num-cell">Stacks</th>
                  <th class="num-cell">Hit</th>
                  <th class="num-cell">Actual</th>
                  <th class="num-cell">Full</th>
                  <th class="num-cell">Prevented</th>
                  <th class="num-cell">Overkill</th>
                  <th class="num-cell">Pets</th>
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

                  <!-- Actual with tooltip -->
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

                  <!-- Overkill with tooltip -->
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

                  <!-- Pets with tooltip -->
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
