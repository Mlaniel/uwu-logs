<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useFetch } from '../composables/useFetch'
import BasePage from '../components/BasePage.vue'
import BossSelector from '../components/BossSelector.vue'
import ReportNav from '../components/ReportNav.vue'
import type { BossAttempt } from '../types/api'

interface SpecInfo {
  spec: string
  icon: string
  class: string
  name: string
}

interface TargetsApiResponse {
  TARGETS: Record<string, Record<string, string>>
  PLAYERS_SORTED: string[]
  SPECS: Record<string, SpecInfo>
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
  fetchTargets()
}

function clearBoss(): void {
  selectedHref.value = ''
  router.replace({ query: {} })
  fetchTargets()
}

const { data, loading: targetsLoading, error, execute } = useFetch<TargetsApiResponse>()

function fetchTargets(): void {
  const params = new URLSearchParams(bossQuery.value as Record<string, string>)
  execute(`/api/v2/reports/${reportId.value}/targets/?${params}`)
}

watch(reportId, fetchTargets, { immediate: true })

const loading = computed(() => reportLoading.value || targetsLoading.value)

// ── Class filter ──────────────────────────────────────────────────────────────

const hiddenClasses = ref<Set<string>>(new Set())

const availableClasses = computed<string[]>(() => {
  if (!data.value) return []
  return [...new Set(
    Object.values(data.value.SPECS).map(s => s.class)
  )].sort()
})

function toggleClass(cls: string): void {
  const s = new Set(hiddenClasses.value)
  if (s.has(cls)) s.delete(cls)
  else s.add(cls)
  hiddenClasses.value = s
}

// ── Table data ────────────────────────────────────────────────────────────────

const targetNames = computed<string[]>(() =>
  data.value ? Object.keys(data.value.TARGETS) : []
)

const visiblePlayers = computed<string[]>(() => {
  if (!data.value) return []
  return data.value.PLAYERS_SORTED.filter(guid => {
    const spec = data.value!.SPECS[guid]
    return spec && !hiddenClasses.value.has(spec.class)
  })
})

const totalRow = computed<string>(() => 'Total')

function cell(targetName: string, guid: string): string {
  return data.value?.TARGETS[targetName]?.[guid] ?? ''
}

function totalCell(targetName: string): string {
  return data.value?.TARGETS[targetName]?.['Total'] ?? ''
}
</script>

<template>
  <BasePage :title="reportTitle || 'Targets'" :loading="loading" :error="error ?? undefined">
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
      <div v-if="data" class="targets-wrap">
        <!-- Class filter -->
        <div v-if="availableClasses.length" class="class-filter">
          <button
            v-for="cls in availableClasses"
            :key="cls"
            :class="['class-btn', cls, { hidden: hiddenClasses.has(cls) }]"
            @click="toggleClass(cls)"
          >{{ cls }}</button>
        </div>

        <!-- Damage matrix -->
        <div class="table-scroll">
          <table class="targets-table">
            <thead>
              <tr>
                <th class="player-cell"></th>
                <th v-for="tgt in targetNames" :key="tgt">{{ tgt }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="guid in visiblePlayers" :key="guid">
                <td class="player-cell">
                  <img
                    v-if="data.SPECS[guid]"
                    :src="`/static/icons/${data.SPECS[guid].icon}.jpg`"
                    :title="data.SPECS[guid].spec"
                    class="spec-icon"
                  >
                  <router-link
                    v-if="data.SPECS[guid]"
                    :class="data.SPECS[guid].class"
                    :to="{ path: `/reports/${reportId}/player/${encodeURIComponent(data.SPECS[guid].name)}`, query: bossQuery }"
                  >{{ data.SPECS[guid].name }}</router-link>
                </td>
                <td v-for="tgt in targetNames" :key="tgt" class="num-cell">
                  {{ cell(tgt, guid) }}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td class="player-cell">Total</td>
                <td v-for="tgt in targetNames" :key="tgt" class="num-cell">
                  {{ totalCell(tgt) }}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </template>
  </BasePage>
</template>

<style scoped>
.targets-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.table-scroll {
  overflow-x: auto;
}

.targets-table {
  border-collapse: collapse;
  font-size: 0.85rem;
  white-space: nowrap;
}

.targets-table th,
.targets-table td {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--table-border);
}

.targets-table thead th {
  position: sticky;
  top: 0;
  background: var(--background);
  z-index: 1;
  text-align: center;
  max-width: 9rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-cell {
  text-align: left;
  position: sticky;
  left: 0;
  background: var(--background);
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 12rem;
}

.targets-table thead th.player-cell {
  z-index: 3;
}

.num-cell {
  text-align: right;
  min-width: 6rem;
}

tfoot td {
  border-top: 2px solid var(--primary);
  font-weight: bold;
}

.spec-icon {
  width: 1rem;
  height: 1rem;
  vertical-align: middle;
}

/* Class filter */
.class-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.25rem 0;
}

.class-btn {
  background: none;
  border: 1px solid currentColor;
  border-radius: 3px;
  padding: 0.1rem 0.5rem;
  cursor: pointer;
  font-size: 0.75rem;
  opacity: 1;
}

.class-btn.hidden {
  opacity: 0.3;
}
</style>
