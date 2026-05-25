<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useFetch } from '../composables/useFetch'
import BasePage from '../components/BasePage.vue'
import BossSelector from '../components/BossSelector.vue'
import ReportNav from '../components/ReportNav.vue'
import type { BossAttempt } from '../types/api'

interface EntitiesApiResponse {
  ENTITIES: Record<string, [string, string][]>
}

const route = useRoute()
const reportId = computed(() => route.params.id as string)

const { report, loading: reportLoading, fetchOverview } = useReport()
watch(reportId, id => fetchOverview(id), { immediate: true })

const reportTitle = computed(() => report.value?.REPORT_NAME ?? '')
const bosses = computed(() => report.value?.SEGMENTS_LINKS ?? [])

const selectedHref = ref('')
const bossQuery = computed(() =>
  selectedHref.value
    ? Object.fromEntries(new URLSearchParams(selectedHref.value.slice(1)))
    : {}
)

function selectBoss(attempt: BossAttempt): void {
  selectedHref.value = attempt.href
}
function clearBoss(): void {
  selectedHref.value = ''
}

const { data, loading: dataLoading, error, execute } = useFetch<EntitiesApiResponse>()

function fetchEntities(): void {
  execute(`/api/v2/reports/${reportId.value}/entities/`)
}

watch(reportId, fetchEntities, { immediate: true })

const loading = computed(() => reportLoading.value || dataLoading.value)

const categories = computed<string[]>(() =>
  data.value ? Object.keys(data.value.ENTITIES) : []
)
</script>

<template>
  <BasePage :title="reportTitle || 'Entities'" :loading="loading" :error="error ?? undefined" :report="report" :selected-href="selectedHref">
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
      <div v-if="data" class="entities-wrap">
        <div
          v-for="category in categories"
          :key="category"
          class="entity-group"
        >
          <table class="entity-table">
            <thead>
              <tr>
                <th>{{ category }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="[name, guid] in data.ENTITIES[category]"
                :key="guid"
              >
                <td>
                  <router-link
                    v-if="category === 'PLAYERS'"
                    :to="`/reports/${reportId}/player/${encodeURIComponent(name)}`"
                  >{{ name }}</router-link>
                  <router-link
                    v-else
                    :to="`/reports/${reportId}/player/${encodeURIComponent(guid)}`"
                  >{{ name }}</router-link>
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
.entities-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
}

.entity-group {
  max-height: 80vh;
  overflow-y: auto;
  scrollbar-width: thin;
}

.entity-table {
  border-collapse: collapse;
  font-size: 0.85rem;
}

.entity-table th,
.entity-table td {
  padding: 0.2rem 0.75rem;
  border: 1px solid var(--table-border);
  white-space: nowrap;
  width: 14rem;
}

.entity-table thead th {
  position: sticky;
  top: 0;
  background: var(--background);
  font-weight: bold;
}
</style>
