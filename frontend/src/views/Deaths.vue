<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useFetch } from '../composables/useFetch'
import BasePage from '../components/BasePage.vue'
import BossSelector from '../components/BossSelector.vue'
import ReportNav from '../components/ReportNav.vue'
import type { BossAttempt, DeathApiResponse } from '../types/api'

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

const { data, loading: dataLoading, error, execute } = useFetch<DeathApiResponse>()

function fetchData(): void {
  const params = new URLSearchParams(bossQuery.value as Record<string, string>)
  execute(`/api/v2/reports/${reportId.value}/deaths/?${params}`)
}

watch(reportId, fetchData, { immediate: true })

const loading = computed(() => reportLoading.value || dataLoading.value)

const expanded = ref<Set<string>>(new Set())

function toggle(id: string): void {
  const s = new Set(expanded.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expanded.value = s
}

type DeathLogLine = (string | number)[]

function lineClass(line: DeathLogLine): string {
  return `${line[1] ?? ''} ${line[2] ?? ''}`.trim()
}

function guidName(guid: string): string {
  if (!data.value) return guid
  const g = data.value.GUIDS[guid]
  if (!g) return guid
  return typeof g === 'string' ? g : g.name
}

function guidClass(guid: string): string {
  return data.value?.CLASSES[guid] ?? ''
}
</script>

<template>
  <BasePage :title="reportTitle || 'Deaths'" :loading="loading" :error="error ?? undefined">
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
      <div v-if="data" id="deaths">
        <section
          v-for="(death, id) in data.DEATHS"
          :key="id"
          class="death-section"
        >
          <p class="panel-head" @click="toggle(String(id))">
            <span class="death-time">{{ death.from_start }}</span>
            <router-link
              :class="data.CLASSES[data.PLAYERS[death.player]] ?? ''"
              :to="{ path: `/reports/${reportId}/player/${encodeURIComponent(death.player)}`, query: bossQuery }"
              @click.stop
            >{{ death.player }}</router-link>
            <span class="toggle-icon">{{ expanded.has(String(id)) ? '▲' : '▼' }}</span>
          </p>

          <div v-if="expanded.has(String(id))" class="death-log-wrap">
            <div class="death-log-scroll">
              <table class="death-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Flag</th>
                    <th>Flag2</th>
                    <th>Source</th>
                    <th>Spell</th>
                    <th>Value</th>
                    <th>Overkill</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(line, i) in death.death"
                    :key="i"
                    :class="lineClass(line as DeathLogLine)"
                  >
                    <td class="timestamp">{{ line[0] }}</td>
                    <td class="flag">{{ line[1] }}</td>
                    <td class="flag">{{ line[2] }}</td>
                    <td class="unit" :class="guidClass(String(line[3]))">{{ guidName(String(line[3])) }}</td>
                    <td class="spell">
                      <router-link
                        v-if="line[5] && data.SPELLS[String(line[5])]"
                        :class="data.SPELLS[String(line[5])].color"
                        :to="{ path: `/reports/${reportId}/spell/${line[5]}`, query: bossQuery }"
                      >{{ data.SPELLS[String(line[5])].name }}</router-link>
                    </td>
                    <td class="value">{{ line[6] }}</td>
                    <td class="value">{{ line[7] }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </template>
  </BasePage>
</template>

<style scoped>
#deaths {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.death-section {
  border: 1px solid var(--table-border);
  border-radius: 3px;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0.75rem;
  background: #000;
  cursor: pointer;
  font-size: 1rem;
  font-family: 'Barlow Condensed', sans-serif;
  margin: 0;
}

.panel-head:hover {
  background: #111;
}

.death-time {
  color: var(--text-muted);
  font-size: 0.9rem;
  min-width: 5rem;
}

.toggle-icon {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 0.7rem;
}

.death-log-wrap {
  padding-left: 1rem;
  max-height: 20rem;
  overflow-y: auto;
  scrollbar-width: thin;
}

.death-log-scroll {
  overflow-x: auto;
}

.death-table {
  border-collapse: collapse;
  font-size: 0.78rem;
  white-space: nowrap;
}

.death-table th,
.death-table td {
  padding: 0.1rem 0.4rem;
  border: none;
}

.death-table thead th {
  position: sticky;
  top: 0;
  background: var(--background);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.timestamp { text-align: right; min-width: 5rem; }
.flag      { min-width: 6rem; }
.unit      { min-width: 10rem; }
.spell     { min-width: 14rem; }
.value     { min-width: 4rem; text-align: right; }

/* Row colors by event type */
:deep(.DAMAGE > td)      { background-color: hsl(348, 100%, 8%); }
:deep(.BUFF > td)        { background-color: hsl(170, 100%, 10%); }
:deep(.BUFF.REMOVED > td){ background-color: hsl(170, 100%, 6%); }
:deep(.DEBUFF > td)      { background-color: hsl(210, 100%, 10%); }
:deep(.DEBUFF.REMOVED > td){ background-color: hsl(210, 100%, 6%); }
:deep(.HEAL > td)        { background-color: hsl(135, 100%, 8%); }
</style>
