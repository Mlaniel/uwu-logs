<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useFetch } from '../composables/useFetch'
import BasePage from '../components/BasePage.vue'
import BossSelector from '../components/BossSelector.vue'
import type { BossAttempt } from '../types/api'

interface SpellInfo {
  name: string
  icon: string
}

interface AurasApiResponse {
  AURA_INFO: Record<string, SpellInfo>
  AURA_UPTIME: Record<string, Record<string, string>>
  AURA_COUNT: Record<string, Record<string, number>>
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
  fetchAuras()
}

function clearBoss(): void {
  selectedHref.value = ''
  router.replace({ query: {} })
  fetchAuras()
}

const { data, loading: dataLoading, error, execute } = useFetch<AurasApiResponse>()

function fetchAuras(): void {
  const params = new URLSearchParams(bossQuery.value as Record<string, string>)
  execute(`/api/v2/reports/${reportId.value}/auras/?${params}`)
}

watch(reportId, fetchAuras, { immediate: true })

const loading = computed(() => reportLoading.value || dataLoading.value)

const spellIds = computed<string[]>(() =>
  data.value ? Object.keys(data.value.AURA_INFO) : []
)

const players = computed<string[]>(() =>
  data.value ? Object.keys(data.value.AURA_UPTIME) : []
)
</script>

<template>
  <BasePage :title="reportTitle || 'Auras'" :loading="loading" :error="error ?? undefined">
    <template #sidebar>
      <BossSelector
        :bosses="bosses"
        :selected-href="selectedHref"
        @select="selectBoss"
        @clear="clearBoss"
      />
      <nav class="sidebar-nav">
        <router-link :to="`/reports/${reportId}`" class="sidebar-nav-link">Damage</router-link>
        <router-link :to="{ path: `/reports/${reportId}/auras`, query: bossQuery }" class="sidebar-nav-link">Auras</router-link>
        <router-link :to="{ path: `/reports/${reportId}/timeline`, query: bossQuery }" class="sidebar-nav-link">Timeline</router-link>
      </nav>
    </template>

    <template #default>
      <div v-if="data" class="auras-wrap">
        <div class="table-scroll">
          <table class="auras-table">
            <thead>
              <tr>
                <th class="player-cell"></th>
                <th
                  v-for="sid in spellIds"
                  :key="sid"
                  :title="data.AURA_INFO[sid].name"
                  colspan="2"
                  class="icon-cell"
                >
                  <img
                    :src="`/static/icons/${data.AURA_INFO[sid].icon}.jpg`"
                    :alt="sid"
                    class="spell-icon"
                  >
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="player in players" :key="player">
                <td class="player-cell">
                  <router-link
                    :class="data.PLAYER_CLASSES[player]"
                    :to="{ path: `/reports/${reportId}/player/${encodeURIComponent(player)}`, query: bossQuery }"
                  >{{ player }}</router-link>
                </td>
                <template v-for="sid in spellIds" :key="sid">
                  <td class="num-cell count-cell">{{ data.AURA_COUNT[player]?.[sid] ?? '' }}</td>
                  <td class="num-cell uptime-cell">
                    <template v-if="data.AURA_UPTIME[player]?.[sid]">
                      {{ data.AURA_UPTIME[player][sid] }}%
                    </template>
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </BasePage>
</template>

<style scoped>
.auras-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.table-scroll {
  overflow-x: auto;
}

.auras-table {
  border-collapse: collapse;
  font-size: 0.85rem;
  white-space: nowrap;
}

.auras-table th,
.auras-table td {
  padding: 0.2rem 0.4rem;
  border: 1px solid var(--table-border);
}

.auras-table thead th {
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

.auras-table thead th.player-cell {
  z-index: 3;
}

.icon-cell {
  min-width: 6rem;
}

.spell-icon {
  width: 1.5rem;
  height: 1.5rem;
  display: block;
  margin: auto;
}

.num-cell {
  text-align: right;
}

.count-cell {
  min-width: 2.5rem;
  color: var(--text-muted, #aaa);
  font-size: 0.8rem;
}

.uptime-cell {
  min-width: 4rem;
}
</style>
