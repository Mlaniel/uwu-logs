<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useFetch } from '../composables/useFetch'
import BasePage from '../components/BasePage.vue'
import BossSelector from '../components/BossSelector.vue'
import ReportNav from '../components/ReportNav.vue'
import type { BossAttempt } from '../types/api'

interface SpellInfo {
  name: string
  icon: string
  value: string
}

interface PowersApiResponse {
  LABELS: [number, string][]
  SPELLS: Record<string, Record<string, SpellInfo>>
  POWERS: Record<string, Record<string, Record<string, string>>>
  TOTAL: Record<string, Record<string, string>>
  PLAYER_CLASSES: Record<string, string>
}

const POWER_COLORS: Record<string, string> = {
  mana: 'mediumturquoise',
  rage: 'orangered',
  energy: 'gold',
  runic: 'crimson',
  focus: 'limegreen',
  happiness: 'chartreuse',
  runes: 'darkmagenta',
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
  fetchPowers()
}

function clearBoss(): void {
  selectedHref.value = ''
  router.replace({ query: {} })
  fetchPowers()
}

const { data, loading: dataLoading, error, execute } = useFetch<PowersApiResponse>()

function fetchPowers(): void {
  const params = new URLSearchParams(bossQuery.value as Record<string, string>)
  execute(`/api/v2/reports/${reportId.value}/powers/?${params}`)
}

watch(reportId, fetchPowers, { immediate: true })

const loading = computed(() => reportLoading.value || dataLoading.value)

const activeTab = ref('')

watch(data, d => {
  if (d && d.LABELS.length && !activeTab.value) {
    activeTab.value = d.LABELS[0][1]
  }
}, { immediate: true })
</script>

<template>
  <BasePage :title="reportTitle || 'Powers'" :loading="loading" :error="error ?? undefined">
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
      <div v-if="data && data.LABELS.length" class="powers-wrap">
        <div class="tabs">
          <button
            v-for="[, name] in data.LABELS"
            :key="name"
            :class="['tab-btn', { active: activeTab === name }]"
            :style="{ color: POWER_COLORS[name] ?? 'inherit' }"
            @click="activeTab = name"
          >{{ name }}</button>
        </div>

        <div v-if="activeTab" class="table-scroll">
          <table class="powers-table">
            <thead>
              <tr>
                <th class="player-cell"></th>
                <th class="num-cell">Total</th>
                <th
                  v-for="sid in Object.keys(data.SPELLS[activeTab])"
                  :key="sid"
                  :title="data.SPELLS[activeTab][sid].name"
                  class="icon-cell"
                >
                  <img
                    :src="`/static/icons/${data.SPELLS[activeTab][sid].icon}.jpg`"
                    :alt="sid"
                    class="spell-icon"
                  >
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(playerData, player) in data.POWERS[activeTab]"
                :key="player"
              >
                <td class="player-cell">
                  <router-link
                    :class="data.PLAYER_CLASSES[player]"
                    :to="{ path: `/reports/${reportId}/player/${encodeURIComponent(player)}`, query: bossQuery }"
                  >{{ player }}</router-link>
                </td>
                <td class="num-cell">{{ data.TOTAL[activeTab][player] }}</td>
                <td
                  v-for="sid in Object.keys(data.SPELLS[activeTab])"
                  :key="sid"
                  class="num-cell"
                >{{ playerData[sid] ?? '' }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td class="player-cell">Total</td>
                <td class="num-cell"></td>
                <td
                  v-for="sid in Object.keys(data.SPELLS[activeTab])"
                  :key="sid"
                  class="num-cell"
                >{{ data.SPELLS[activeTab][sid].value }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </template>
  </BasePage>
</template>

<style scoped>
.powers-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tabs {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.tab-btn {
  background: none;
  border: 1px solid currentColor;
  border-radius: 3px;
  padding: 0.2rem 0.75rem;
  cursor: pointer;
  font-size: 0.8rem;
  text-transform: uppercase;
  opacity: 0.5;
}

.tab-btn.active {
  opacity: 1;
  background: color-mix(in srgb, currentColor 15%, transparent);
}

.table-scroll {
  overflow-x: auto;
}

.powers-table {
  border-collapse: collapse;
  font-size: 0.85rem;
  white-space: nowrap;
}

.powers-table th,
.powers-table td {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--table-border);
}

.powers-table thead th {
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

.powers-table thead th.player-cell {
  z-index: 3;
}

.num-cell {
  text-align: right;
  min-width: 6rem;
}

.icon-cell {
  min-width: 2.5rem;
  text-align: center;
}

.spell-icon {
  width: 1.5rem;
  height: 1.5rem;
  display: block;
  margin: auto;
}

tfoot td {
  border-top: 2px solid var(--primary);
  font-weight: bold;
}
</style>
