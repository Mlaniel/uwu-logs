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

interface ValksApiResponse {
  ALL_GRABS: string[][]
  GRABS_TOTAL: Record<string, number>
  WAVES: number[]
  PLAYER_CLASSES: Record<string, string>
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
  fetchValks()
}

function clearBoss(): void {
  selectedHref.value = ''
  router.replace({ query: {} })
  fetchValks()
}

const { data, loading: dataLoading, error, execute } = useFetch<ValksApiResponse>()

function fetchValks(): void {
  const params = new URLSearchParams(bossQuery.value as Record<string, string>)
  execute(`/api/v2/reports/${reportId.value}/valks/?${params}`)
}

watch(reportId, fetchValks, { immediate: true })

const loading = computed(() => reportLoading.value || dataLoading.value)

const { sortKey, setSort, sortIcon, sorted } = useSort('total')

const sortedPlayers = computed<string[]>(() => {
  if (!data.value) return []
  return sorted(Object.keys(data.value.GRABS_TOTAL), (player, key) => {
    if (key === 'name') return player
    if (key === 'total') return data.value!.GRABS_TOTAL[player]
    // wave index key
    const idx = Number(key)
    return data.value!.ALL_GRABS[idx]?.includes(player) ? 1 : 0
  })
})

function wasGrabbed(player: string, waveIdx: number): boolean {
  return data.value?.ALL_GRABS[waveIdx]?.includes(player) ?? false
}
</script>

<template>
  <BasePage :title="reportTitle || 'Valk Grabs'" :loading="loading" :error="error ?? undefined">
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
      <div v-if="data">
        <p class="hint">Valk grabs per wave. Red = grabbed.</p>
        <div class="table-scroll">
          <table class="valks-table">
            <caption>Valk grabs per wave</caption>
            <thead>
              <tr>
                <th
                  class="player-cell sortable"
                  :class="{ 'sort-active': sortKey === 'name' }"
                  @click="setSort('name')"
                >
                  Name<span class="sort-icon" :class="{ active: sortKey === 'name' }">{{ sortIcon('name') }}</span>
                </th>
                <th
                  class="num-cell sortable"
                  :class="{ 'sort-active': sortKey === 'total' }"
                  @click="setSort('total')"
                >
                  Total<span class="sort-icon" :class="{ active: sortKey === 'total' }">{{ sortIcon('total') }}</span>
                </th>
                <th
                  v-for="(wave, idx) in data.WAVES"
                  :key="wave"
                  class="wave-cell sortable"
                  :class="{ 'sort-active': sortKey === String(idx) }"
                  @click="setSort(String(idx))"
                >
                  {{ wave }}<span class="sort-icon" :class="{ active: sortKey === String(idx) }">{{ sortIcon(String(idx)) }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="player in sortedPlayers" :key="player">
                <td class="player-cell">
                  <router-link
                    :class="data.PLAYER_CLASSES[player]"
                    :to="{ path: `/reports/${reportId}/player/${encodeURIComponent(player)}`, query: bossQuery }"
                  >{{ player }}</router-link>
                </td>
                <td class="num-cell">{{ data.GRABS_TOTAL[player] }}</td>
                <td
                  v-for="(_, idx) in data.WAVES"
                  :key="idx"
                  :class="['wave-cell', { grab: wasGrabbed(player, idx) }]"
                ></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </BasePage>
</template>

<style scoped>
.hint {
  font-size: 0.85rem;
  color: var(--text-muted, #aaa);
  margin-bottom: 0.5rem;
}

.table-scroll {
  overflow-x: auto;
}

.valks-table {
  border-collapse: collapse;
  font-size: 0.85rem;
  white-space: nowrap;
}

.valks-table th,
.valks-table td {
  padding: 0.2rem 0.4rem;
  border: 1px solid var(--table-border);
}

.valks-table thead th {
  position: sticky;
  top: 0;
  background: var(--background);
  z-index: 1;
  text-align: center;
}

.player-cell {
  text-align: left;
  position: sticky;
  left: 0;
  background: var(--background);
  z-index: 2;
  min-width: 12rem;
}

.valks-table thead th.player-cell {
  z-index: 3;
}

.num-cell {
  text-align: right;
  min-width: 4rem;
}

.wave-cell {
  min-width: 2rem;
  width: 2rem;
  text-align: center;
}

.grab {
  background-color: crimson;
}
</style>
