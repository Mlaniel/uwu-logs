<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReport } from '../composables/useReport'
import { useFetch } from '../composables/useFetch'
import BasePage from '../components/BasePage.vue'
import BossSelector from '../components/BossSelector.vue'
import type { BossAttempt } from '../types/api'

interface SpellApiResponse {
  SPELLS: Record<string, Record<string, Record<string, number>>>
  TARGETS: string[]
  SPELL_ID: string
  SPELL_NAME: string
  SPELL_ICON: string
  SPELL_COLOR: string
  PLAYER_CLASSES: Record<string, string>
}

const route = useRoute()
const router = useRouter()
const reportId = computed(() => route.params.id as string)
const spellId = computed(() => route.params.spell_id as string)

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

const { data, loading: dataLoading, error, execute } = useFetch<SpellApiResponse>()

function fetchData(): void {
  const params = new URLSearchParams(bossQuery.value as Record<string, string>)
  execute(`/api/v2/reports/${reportId.value}/spell/${spellId.value}/?${params}`)
}

watch([reportId, spellId], fetchData, { immediate: true })

const loading = computed(() => reportLoading.value || dataLoading.value)

const flags = computed<string[]>(() =>
  data.value ? Object.keys(data.value.SPELLS) : []
)

const activeFlag = ref('')
watch(flags, fs => {
  if (fs.length && !activeFlag.value) activeFlag.value = fs[0]
}, { immediate: true })

const pageTitle = computed(() =>
  data.value?.SPELL_NAME ? `${data.value.SPELL_ID} ${data.value.SPELL_NAME}` : 'Spell'
)
</script>

<template>
  <BasePage :title="reportTitle || pageTitle" :loading="loading" :error="error ?? undefined">
    <template #sidebar>
      <BossSelector
        :bosses="bosses"
        :selected-href="selectedHref"
        @select="selectBoss"
        @clear="clearBoss"
      />
    </template>

    <template #default>
      <div v-if="data">
        <div v-if="!flags.length" class="not-found">Spell not found in this log.</div>

        <template v-else>
          <header class="spell-header">
            <img
              :src="`/static/icons/${data.SPELL_ICON}.jpg`"
              class="spell-icon"
            >
            <h2>
              <a
                :class="data.SPELL_COLOR"
                :href="`https://wotlk.evowow.com/?spell=${data.SPELL_ID}`"
                target="_blank"
              >{{ data.SPELL_ID }} {{ data.SPELL_NAME }}</a>
            </h2>
          </header>

          <div v-if="flags.length > 1" class="tabs">
            <button
              v-for="flag in flags"
              :key="flag"
              :class="['tab-btn', { active: activeFlag === flag }]"
              @click="activeFlag = flag"
            >{{ flag }}</button>
          </div>

          <div v-if="activeFlag" class="table-scroll">
            <table class="spell-table">
              <thead>
                <tr>
                  <th class="player-cell"></th>
                  <th
                    v-for="target in data.TARGETS"
                    :key="target"
                    class="num-cell"
                  >
                    <router-link
                      v-if="data.PLAYER_CLASSES[target]"
                      :class="data.PLAYER_CLASSES[target]"
                      :to="{ path: `/reports/${reportId}/player/${encodeURIComponent(target)}`, query: bossQuery }"
                    >{{ target }}</router-link>
                    <span v-else>{{ target }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(targets, player) in data.SPELLS[activeFlag]"
                  :key="player"
                >
                  <td class="player-cell">
                    <router-link
                      :class="data.PLAYER_CLASSES[player]"
                      :to="{ path: `/reports/${reportId}/player/${encodeURIComponent(String(player))}`, query: bossQuery }"
                    >{{ player }}</router-link>
                  </td>
                  <td
                    v-for="target in data.TARGETS"
                    :key="target"
                    class="num-cell"
                  >{{ targets[target] ?? '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </template>
  </BasePage>
</template>

<style scoped>
.not-found {
  color: var(--text-muted, #aaa);
  padding: 1rem;
}

.spell-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.5rem;
  margin-bottom: 0.75rem;
}

.spell-header h2 {
  font-size: 1em;
  display: inline;
  margin: 0;
}

.spell-header h2 a {
  text-shadow: 0.1em 0.1em 0.5em #5d5d5d;
}

.spell-header h2 a:hover {
  text-shadow: 0.1em 0.1em 0.4em currentColor;
}

.spell-icon {
  width: 1.2em;
  height: 1.2em;
  vertical-align: middle;
}

.tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.tab-btn {
  background: none;
  border: 1px solid var(--primary);
  border-radius: 3px;
  padding: 0.2rem 0.6rem;
  cursor: pointer;
  font-size: 0.8rem;
  opacity: 0.5;
}

.tab-btn.active {
  opacity: 1;
}

.table-scroll {
  overflow-x: auto;
}

.spell-table {
  border-collapse: collapse;
  font-size: 0.85rem;
  white-space: nowrap;
}

.spell-table th,
.spell-table td {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--table-border);
}

.spell-table thead th {
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

.spell-table thead th.player-cell {
  z-index: 3;
}

.num-cell {
  text-align: right;
  min-width: 6rem;
}
</style>
