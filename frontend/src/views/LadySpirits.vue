<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useFetch } from '../composables/useFetch'
import BasePage from '../components/BasePage.vue'
import BossSelector from '../components/BossSelector.vue'
import ReportNav from '../components/ReportNav.vue'
import type { BossAttempt } from '../types/api'

interface SpiritEntry {
  by: string
  targets_n: number
  damage: string
  prevented: string
}

interface LadySpiritsApiResponse {
  PULLS: SpiritEntry[][]
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
  fetchData()
}

function clearBoss(): void {
  selectedHref.value = ''
  router.replace({ query: {} })
  fetchData()
}

const { data, loading: dataLoading, error, execute } = useFetch<LadySpiritsApiResponse>()

function fetchData(): void {
  const params = new URLSearchParams(bossQuery.value as Record<string, string>)
  execute(`/api/v2/reports/${reportId.value}/lady-spirits/?${params}`)
}

watch(reportId, fetchData, { immediate: true })

const loading = computed(() => reportLoading.value || dataLoading.value)
</script>

<template>
  <BasePage :title="reportTitle || 'Lady Spirits'" :loading="loading" :error="error ?? undefined">
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
      <div v-if="data" class="spirits-wrap">
        <div
          v-for="(pull, pullIdx) in data.PULLS"
          :key="pullIdx"
          class="pull-section"
        >
          <table class="spirits-table">
            <thead>
              <tr>
                <th class="player-cell">Player</th>
                <th class="num-cell">Hit</th>
                <th class="num-cell">Caused</th>
                <th class="num-cell">Prevented</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(entry, i) in pull" :key="i">
                <td class="player-cell">
                  <router-link
                    :class="data.PLAYER_CLASSES[entry.by]"
                    :to="{ path: `/reports/${reportId}/player/${encodeURIComponent(entry.by)}`, query: bossQuery }"
                  >{{ entry.by }}</router-link>
                </td>
                <td class="num-cell">{{ entry.targets_n }}</td>
                <td class="num-cell">{{ entry.damage }}</td>
                <td class="num-cell">{{ entry.prevented }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </BasePage>
</template>

<style scoped>
.spirits-wrap {
  display: grid;
  gap: 1.5rem;
}

.spirits-table {
  border-collapse: collapse;
  font-size: 0.85rem;
  white-space: nowrap;
}

.spirits-table th,
.spirits-table td {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--table-border);
}

.spirits-table thead th {
  background: var(--background);
}

.player-cell {
  text-align: left;
  min-width: 12rem;
}

.num-cell {
  text-align: right;
  min-width: 7rem;
}
</style>
