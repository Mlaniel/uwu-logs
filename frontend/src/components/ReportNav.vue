<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { BossGroup } from '../types/api'

const props = defineProps<{
  reportId: string
  bossQuery: Record<string, string>
  bosses: BossGroup[]
  selectedHref: string
}>()

const router = useRouter()

// ── Boss name detection ──────────────────────────────────────────────────────

const selectedBossName = computed<string>(() => {
  if (!props.selectedHref || !props.bosses.length) return ''
  for (const bg of props.bosses) {
    if (bg.segments.some(s => s.href === props.selectedHref)) return bg.boss_name
  }
  return ''
})

const showGrabs    = computed(() => selectedBossName.value === 'The Lich King')
const showSpirits  = computed(() => selectedBossName.value === 'Lady Deathwhisper')
const showUCM      = computed(() => selectedBossName.value === 'Sindragosa')
const showShields  = computed(() => selectedBossName.value === "Twin Val'kyr")

// ── Spell search ─────────────────────────────────────────────────────────────

const spellQuery = ref('')
const spellResults = ref<Record<string, string>>({})
let spellTimer: ReturnType<typeof setTimeout> | null = null

async function searchSpells(q: string): Promise<void> {
  if (q.length < 3) { spellResults.value = {}; return }
  try {
    const res = await fetch(`/reports/${props.reportId}/spellsearch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter: q }),
    })
    spellResults.value = res.ok ? await res.json() : {}
  } catch {
    spellResults.value = {}
  }
}

function onSpellInput(): void {
  if (spellTimer) clearTimeout(spellTimer)
  spellTimer = setTimeout(() => searchSpells(spellQuery.value), 400)
}

function goSpell(spellId: string): void {
  spellQuery.value = ''
  spellResults.value = {}
  router.push({ path: `/reports/${props.reportId}/spell/${spellId}`, query: props.bossQuery })
}
</script>

<template>
  <nav class="report-nav">
    <!-- Core -->
    <div class="nav-group">
      <router-link
        :to="{ path: `/reports/${reportId}`, query: bossQuery }"
        class="nav-link"
        active-class=""
        exact-active-class="nav-link--active"
      >Damage</router-link>
      <router-link
        :to="{ path: `/reports/${reportId}/timeline`, query: bossQuery }"
        class="nav-link"
      >Timeline</router-link>
      <router-link
        :to="{ path: `/reports/${reportId}/compare`, query: bossQuery }"
        class="nav-link"
      >Compare</router-link>
      <router-link
        :to="{ path: `/reports/${reportId}/deaths`, query: bossQuery }"
        class="nav-link"
      >Deaths</router-link>
    </div>

    <!-- Analysis -->
    <div class="nav-group">
      <span class="nav-group-label">Analysis</span>
      <router-link
        :to="{ path: `/reports/${reportId}/targets`, query: bossQuery }"
        class="nav-link"
      >Targets</router-link>
      <router-link
        :to="{ path: `/reports/${reportId}/consumables`, query: bossQuery }"
        class="nav-link"
      >Consumables</router-link>
      <router-link
        :to="{ path: `/reports/${reportId}/entities`, query: bossQuery }"
        class="nav-link"
      >Entities</router-link>
      <router-link
        :to="{ path: `/reports/${reportId}/auras`, query: bossQuery }"
        class="nav-link"
      >Auras</router-link>
      <router-link
        :to="{ path: `/reports/${reportId}/powers`, query: bossQuery }"
        class="nav-link"
      >Powers</router-link>
    </div>

    <!-- Boss-specific (conditional) -->
    <div v-if="showGrabs || showSpirits || showUCM || showShields" class="nav-group">
      <span class="nav-group-label">Mechanic</span>
      <router-link
        v-if="showGrabs"
        :to="{ path: `/reports/${reportId}/valks`, query: bossQuery }"
        class="nav-link nav-link--special"
      >Grabs</router-link>
      <router-link
        v-if="showSpirits"
        :to="{ path: `/reports/${reportId}/lady-spirits`, query: bossQuery }"
        class="nav-link nav-link--special"
      >Spirits</router-link>
      <router-link
        v-if="showUCM"
        :to="{ path: `/reports/${reportId}/ucm`, query: bossQuery }"
        class="nav-link nav-link--special"
      >UCM</router-link>
      <router-link
        v-if="showShields"
        :to="{ path: `/reports/${reportId}/toc-valks`, query: bossQuery }"
        class="nav-link nav-link--special"
      >Shields</router-link>
    </div>

    <!-- Spell search -->
    <div class="spell-search">
      <input
        v-model="spellQuery"
        type="text"
        maxlength="32"
        placeholder="Find spell…"
        class="spell-input"
        @input="onSpellInput"
      >
      <div v-if="Object.keys(spellResults).length" class="spell-results">
        <button
          v-for="(name, id) in spellResults"
          :key="id"
          class="spell-result-item"
          @click="goSpell(String(id))"
        >
          <span class="spell-result-id">{{ id }}</span>
          <span class="spell-result-name">{{ name }}</span>
        </button>
      </div>
      <div v-else-if="spellQuery.length >= 3" class="spell-no-results">No spells found</div>
    </div>
  </nav>
</template>

<style scoped>
.report-nav {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0;
}

.nav-group {
  display: flex;
  flex-direction: column;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--table-border);
}

.nav-group:last-of-type {
  border-bottom: none;
}

.nav-group-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 0.35rem 12px 0.1rem;
}

.nav-link {
  display: block;
  padding: 0.3rem 12px;
  font-size: 0.8rem;
  color: var(--text-muted);
  text-decoration: none;
  border-left: 2px solid transparent;
  transition: color 0.1s, border-color 0.1s;
}

.nav-link:hover,
.nav-link.router-link-active {
  color: var(--text);
  border-left-color: var(--primary);
}

.nav-link--active {
  color: var(--text);
  border-left-color: var(--primary);
}

.nav-link--special {
  color: var(--primary-bright, var(--primary));
}

.nav-link--special:hover,
.nav-link--special.router-link-active {
  color: #fff;
  border-left-color: var(--primary-bright, var(--primary));
}

/* Spell search */
.spell-search {
  padding: 0.5rem 10px;
  position: relative;
}

.spell-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--surface, #1a1a2e);
  border: 1px solid var(--table-border);
  border-radius: 3px;
  color: var(--text);
  font-size: 0.75rem;
  padding: 0.25rem 0.4rem;
  outline: none;
}

.spell-input:focus {
  border-color: var(--primary);
}

.spell-results {
  position: absolute;
  left: 10px;
  right: 10px;
  top: calc(100% - 0.5rem);
  background: var(--surface, #1a1a2e);
  border: 1px solid var(--primary);
  border-radius: 3px;
  z-index: 50;
  max-height: 14rem;
  overflow-y: auto;
  scrollbar-width: thin;
}

.spell-result-item {
  display: flex;
  gap: 0.5rem;
  width: 100%;
  padding: 0.25rem 0.5rem;
  background: none;
  border: none;
  border-bottom: 1px solid var(--table-border);
  color: var(--text);
  font-size: 0.75rem;
  text-align: left;
  cursor: pointer;
}

.spell-result-item:last-child {
  border-bottom: none;
}

.spell-result-item:hover {
  background: var(--primary-dim, rgba(120, 80, 200, 0.15));
}

.spell-result-id {
  color: var(--text-muted);
  flex-shrink: 0;
  min-width: 3rem;
}

.spell-result-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spell-no-results {
  padding: 0.25rem 0;
  font-size: 0.75rem;
  color: var(--text-muted);
}
</style>
