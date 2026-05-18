<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayer } from '../composables/usePlayer'
import type { PlayerView } from '../composables/usePlayer'
import BasePage from '../components/BasePage.vue'
import SpellTable from '../components/SpellTable.vue'

const route = useRoute()
const router = useRouter()
const { data, spellRows, loading, error, fetchPlayer } = usePlayer()

const reportId = computed(() => route.params.id as string)
const playerName = computed(() => route.params.name as string)
const activeView = computed<PlayerView>(() => {
  const v = route.query.view as string
  return (v === 'heal' || v === 'taken') ? v : 'damage'
})

watch(
  [reportId, playerName, activeView],
  ([id, name, view]) => fetchPlayer(id, name, view),
  { immediate: true },
)

function setView(v: PlayerView): void {
  router.replace({ query: { ...route.query, view: v } })
}

const title = computed(() => data.value?.SOURCE_NAME ?? playerName.value)
const backHref = computed(() => `/reports/${reportId.value}`)
</script>

<template>
  <div class="player-page">
    <header class="player-header">
      <router-link :to="backHref" class="back-link">← Back</router-link>
      <h1 class="player-title">{{ title }}</h1>

      <div class="tab-bar">
        <button
          :class="{ active: activeView === 'damage' }"
          @click="setView('damage')"
        >Damage done</button>
        <button
          :class="{ active: activeView === 'heal' }"
          @click="setView('heal')"
        >Healing done</button>
        <button
          :class="{ active: activeView === 'taken' }"
          @click="setView('taken')"
        >Damage taken</button>
      </div>
    </header>

    <main class="player-main">
      <BasePage :loading="loading" :error="error">
        <div v-if="data?.TARGETS" class="targets-bar">
          <span class="targets-label">Filter target:</span>
          <router-link
            v-for="(name, guid) in { ...data.TARGETS.NPCS, ...data.TARGETS.Players }"
            :key="guid"
            :to="{ query: { ...route.query, target: guid } }"
            class="target-chip"
            :class="{ active: route.query.target === guid }"
          >{{ name }}</router-link>
          <router-link
            v-if="route.query.target"
            :to="{ query: { ...route.query, target: undefined } }"
            class="target-chip clear"
          >✕ All</router-link>
        </div>

        <SpellTable :spells="spellRows" />
      </BasePage>
    </main>
  </div>
</template>

<style scoped>
.player-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem;
}

.player-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.back-link {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.8125rem;
  color: var(--link);
  text-decoration: none;
  letter-spacing: 0.04em;
}

.back-link:hover {
  color: var(--link-hover);
}

.player-title {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  letter-spacing: 0.04em;
}

.tab-bar {
  display: flex;
  gap: 2px;
}

.tab-bar button {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 6px 12px;
  cursor: pointer;
}

.tab-bar button.active {
  border-bottom-color: var(--primary);
  color: var(--text);
}

.tab-bar button:hover:not(.active) {
  color: var(--text);
}

/* ── Target filter bar ─────────────────────────────────────── */
.targets-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 6px 0;
  font-size: 0.75rem;
  margin-bottom: 4px;
}

.targets-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.6875rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-right: 4px;
}

.target-chip {
  padding: 2px 8px;
  background: var(--surface);
  border: 1px solid var(--table-border);
  color: var(--text);
  text-decoration: none;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.75rem;
}

.target-chip:hover,
.target-chip.active {
  border-color: var(--primary);
  color: var(--primary-bright);
}

.target-chip.clear {
  color: var(--text-muted);
}
</style>
