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

interface ItemInfo {
  name: string
  icon: string
}

interface ConsumablesApiResponse {
  ITEM_INFO: Record<string, ItemInfo>
  ITEMS_TOTAL: Record<string, number>
  ITEMS: Record<string, Record<string, number>>
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
  fetchConsumables()
}

function clearBoss(): void {
  selectedHref.value = ''
  router.replace({ query: {} })
  fetchConsumables()
}

const { data, loading: dataLoading, error, execute } = useFetch<ConsumablesApiResponse>()

function fetchConsumables(): void {
  const params = new URLSearchParams(bossQuery.value as Record<string, string>)
  execute(`/api/v2/reports/${reportId.value}/consumables/?${params}`)
}

watch(reportId, fetchConsumables, { immediate: true })

const loading = computed(() => reportLoading.value || dataLoading.value)

const itemIds = computed<string[]>(() =>
  data.value ? Object.keys(data.value.ITEM_INFO) : []
)

const { sortKey, setSort, sortIcon, sorted } = useSort('total')

const sortedPlayers = computed<string[]>(() => {
  if (!data.value) return []
  return sorted(Object.keys(data.value.ITEMS_TOTAL), (player, key) => {
    if (key === 'name') return player
    if (key === 'total') return data.value!.ITEMS_TOTAL[player]
    return data.value!.ITEMS[key]?.[player] ?? ''
  })
})
</script>

<template>
  <BasePage :title="reportTitle || 'Consumables'" :loading="loading" :error="error ?? undefined">
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
      <div v-if="data" class="consumables-wrap">
        <div class="table-scroll">
          <table class="cons-table">
            <thead>
              <tr>
                <th
                  class="player-cell sortable"
                  :class="{ 'sort-active': sortKey === 'name' }"
                  @click="setSort('name')"
                >
                  <span class="sort-icon" :class="{ active: sortKey === 'name' }">{{ sortIcon('name') }}</span>
                </th>
                <th
                  class="num-cell sortable"
                  :class="{ 'sort-active': sortKey === 'total' }"
                  @click="setSort('total')"
                >
                  Total<span class="sort-icon" :class="{ active: sortKey === 'total' }">{{ sortIcon('total') }}</span>
                </th>
                <th
                  v-for="sid in itemIds"
                  :key="sid"
                  class="icon-cell sortable"
                  :class="{ 'sort-active': sortKey === sid }"
                  :title="data.ITEM_INFO[sid].name"
                  @click="setSort(sid)"
                >
                  <img
                    :src="`/static/icons/${data.ITEM_INFO[sid].icon}.jpg`"
                    :title="data.ITEM_INFO[sid].name"
                    class="item-icon"
                  >
                  <span class="sort-icon" :class="{ active: sortKey === sid }">{{ sortIcon(sid) }}</span>
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
                <td class="num-cell">{{ data.ITEMS_TOTAL[player] }}</td>
                <td v-for="sid in itemIds" :key="sid" class="num-cell">
                  {{ data.ITEMS[sid]?.[player] ?? '' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </BasePage>
</template>

<style scoped>
.consumables-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.table-scroll {
  overflow-x: auto;
}

.cons-table {
  border-collapse: collapse;
  font-size: 0.85rem;
  white-space: nowrap;
}

.cons-table th,
.cons-table td {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--table-border);
}

.cons-table thead th {
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
}

.cons-table thead th.player-cell {
  z-index: 3;
}

.num-cell {
  text-align: right;
  min-width: 4rem;
}

.icon-cell {
  text-align: center;
  min-width: 2.5rem;
  vertical-align: bottom;
}

.item-icon {
  width: 1.5rem;
  height: 1.5rem;
  display: block;
  margin: auto;
}
</style>
