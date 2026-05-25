<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useFetch } from '../composables/useFetch'
import BasePage from '../components/BasePage.vue'

interface SpecInfo {
  name: string
  class: string
  icon: string
  spec: string
}

interface TocValksApiResponse {
  TARGETS: string[]
  ATTEMPT_DATA: Record<string, string[]>
  SPECS: Record<string, SpecInfo>
}

const route = useRoute()
const reportId = computed(() => route.params.id as string)

const { report, loading: reportLoading, fetchOverview } = useReport()
watch(reportId, id => fetchOverview(id), { immediate: true })

const reportTitle = computed(() => report.value?.REPORT_NAME ?? '')

const { data, loading: dataLoading, error, execute } = useFetch<TocValksApiResponse>()

function fetchData(): void {
  execute(`/api/v2/reports/${reportId.value}/toc-valks/`)
}

watch(reportId, fetchData, { immediate: true })

const loading = computed(() => reportLoading.value || dataLoading.value)

const players = computed<string[]>(() =>
  data.value ? Object.keys(data.value.ATTEMPT_DATA) : []
)
</script>

<template>
  <BasePage :title="reportTitle || 'ToC Valk Shields'" :loading="loading" :error="error ?? undefined">
    <template #sidebar>
      <nav class="sidebar-nav">
        <router-link :to="`/reports/${reportId}`" class="sidebar-nav-link">Damage</router-link>
        <router-link :to="`/reports/${reportId}/toc-valks`" class="sidebar-nav-link">ToC Valk Shields</router-link>
      </nav>
    </template>

    <template #default>
      <div v-if="data">
        <p class="hint">Shield damage for each cast.</p>
        <div class="table-scroll">
          <table class="tocvalks-table">
            <thead>
              <tr>
                <th class="player-cell"></th>
                <th v-for="target in data.TARGETS" :key="target" class="num-cell">{{ target }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="guid in players" :key="guid">
                <td class="player-cell" :title="data.SPECS[guid]?.spec">
                  <img
                    v-if="data.SPECS[guid]"
                    :src="`/static/icons/${data.SPECS[guid].icon}.jpg`"
                    class="spec-icon"
                  >
                  <router-link
                    v-if="data.SPECS[guid]"
                    :class="data.SPECS[guid].class"
                    :to="`/reports/${reportId}/player/${encodeURIComponent(data.SPECS[guid].name)}`"
                  >{{ data.SPECS[guid].name }}</router-link>
                  <span v-else>{{ guid }}</span>
                </td>
                <td
                  v-for="(dmg, i) in data.ATTEMPT_DATA[guid]"
                  :key="i"
                  class="num-cell"
                >{{ dmg }}</td>
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

.tocvalks-table {
  border-collapse: collapse;
  font-size: 0.85rem;
  white-space: nowrap;
}

.tocvalks-table th,
.tocvalks-table td {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--table-border);
}

.tocvalks-table thead th {
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
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.tocvalks-table thead th.player-cell {
  z-index: 3;
}

.num-cell {
  text-align: right;
  min-width: 8rem;
}

.spec-icon {
  width: 1rem;
  height: 1rem;
  vertical-align: middle;
}
</style>
