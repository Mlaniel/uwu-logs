<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// ── State ─────────────────────────────────────────────────────────────────────

const servers = ref<string[]>([])
const inputName = ref((route.params.name as string) ?? (route.query.name as string) ?? '')
const inputServer = ref((route.params.server as string) ?? (route.query.server as string) ?? '')

const loading = ref(false)
const error = ref('')
const charData = ref<any>(null)

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchServers() {
  try {
    const res = await fetch('/api/v2/servers/')
    servers.value = await res.json()
    if (!inputServer.value && servers.value.length) {
      inputServer.value = servers.value.includes('Lordaeron') ? 'Lordaeron' : servers.value[0]
    }
  } catch {
    // ignore
  }
}

async function search() {
  const name = inputName.value.trim()
  const server = inputServer.value.trim()
  if (!name || !server) return

  loading.value = true
  error.value = ''
  charData.value = null

  router.replace({ path: '/character', query: { name, server } })

  try {
    const res = await fetch(`/character/${encodeURIComponent(server)}/${encodeURIComponent(name)}/0`)
    if (!res.ok) {
      const text = await res.text()
      error.value = `Error ${res.status}: ${text}`
      return
    }
    const data = await res.json()
    if (data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length) {
      charData.value = data
    } else {
      error.value = 'Character not found.'
    }
  } catch (e: any) {
    error.value = e?.message ?? 'Unknown error'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchServers()
  if (inputName.value && inputServer.value) {
    search()
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const CLASSES = ["Death Knight", "Druid", "Hunter", "Mage", "Paladin", "Priest", "Rogue", "Shaman", "Warlock", "Warrior"]

const SPECS_BY_CLASS: Record<string, string[]> = {
  "Death Knight": ["Blood", "Frost", "Unholy"],
  "Druid":        ["Balance", "Feral Combat", "Restoration"],
  "Hunter":       ["Beast Mastery", "Marksmanship", "Survival"],
  "Mage":         ["Arcane", "Fire", "Frost"],
  "Paladin":      ["Holy", "Protection", "Retribution"],
  "Priest":       ["Discipline", "Holy", "Shadow"],
  "Rogue":        ["Assassination", "Combat", "Subtlety"],
  "Shaman":       ["Elemental", "Enhancement", "Restoration"],
  "Warlock":      ["Affliction", "Demonology", "Destruction"],
  "Warrior":      ["Arms", "Fury", "Protection"],
}

function className(classI: number): string {
  return CLASSES[classI] ?? 'Unknown'
}

function classSlug(classI: number): string {
  return (CLASSES[classI] ?? '').toLowerCase().replace(' ', '-')
}

function specName(specI: number): string {
  const classI = Math.floor(specI / 4)
  const s = specI % 4
  if (!s) return CLASSES[classI] ?? 'Unknown'
  return SPECS_BY_CLASS[CLASSES[classI]]?.[s - 1] ?? 'Unknown'
}

function fmtPoints(v: number): string {
  if (v === null || v === undefined) return '-'
  return typeof v === 'number' ? v.toFixed(2) : String(v)
}

function reportLink(data: any): string | null {
  const id = data?.report_id
  return id ? `/reports/${id}/` : null
}

function raidGroups(data: any): Array<[string, Array<[string, any]>]> {
  if (!data?.bosses) return []
  return Object.entries(data.bosses).map(([raid, bosses]) => [raid, Object.entries(bosses as any)])
}
</script>

<template>
  <div class="char-page">
    <div class="char-inner">
      <h1 class="page-title">Characters</h1>

      <!-- Search form -->
      <div class="search-bar">
        <input
          v-model="inputName"
          class="search-input"
          placeholder="Character name"
          @keydown.enter="search"
        />
        <select v-model="inputServer" class="server-select">
          <option v-for="s in servers" :key="s" :value="s">{{ s }}</option>
        </select>
        <button class="search-btn" @click="search" :disabled="loading">
          {{ loading ? 'Loading…' : 'Search' }}
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="loading-rows">
        <div v-for="i in 6" :key="i" class="skeleton-row" />
      </div>

      <!-- Error -->
      <p v-else-if="error" class="err-msg">{{ error }}</p>

      <!-- Results -->
      <template v-else-if="charData">
        <div class="char-header">
          <span :class="`char-name cls-${classSlug(charData.class_i)}`">{{ inputName }}</span>
          <span class="char-meta">
            {{ className(charData.class_i) }} &mdash; {{ specName(charData.spec_i) }} &mdash; {{ inputServer }}
          </span>
          <div class="char-overall">
            <span class="stat-label">Overall rank</span>
            <span class="stat-val">{{ charData.overall_rank ?? '-' }}</span>
            <span class="stat-label">Overall points</span>
            <span class="stat-val">{{ fmtPoints(charData.overall_points) }}</span>
          </div>
        </div>

        <template v-if="raidGroups(charData).length">
          <div v-for="([raid, bosses]) in raidGroups(charData)" :key="raid" class="raid-group">
            <div v-if="raid" class="raid-label">{{ raid }}</div>
            <table class="boss-table">
              <thead>
                <tr>
                  <th>Boss</th>
                  <th class="th-num">Rank</th>
                  <th class="th-num">Points</th>
                  <th class="th-raid">Raid</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="([boss, info]) in bosses"
                  :key="boss"
                  class="boss-row"
                  :class="{ 'row-other': !info?.is_for_points }"
                >
                  <td class="td-boss">{{ boss }}</td>
                  <td class="td-num">{{ info?.rank_players ?? '-' }}</td>
                  <td class="td-num">{{ info?.points !== undefined ? fmtPoints(info.points) : '-' }}</td>
                  <td class="td-raid">
                    <a v-if="reportLink(info)" :href="reportLink(info)!" target="_blank" class="raid-link">
                      {{ info.report_id?.split('--')[0] }}
                    </a>
                    <span v-else class="td-muted">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <p v-else class="empty-msg">No boss data available.</p>
      </template>

      <!-- Empty state -->
      <p v-else-if="!loading && !charData && !error" class="empty-msg">
        Enter a character name and server to look up their rankings.
      </p>
    </div>
  </div>
</template>

<style scoped>
.char-page {
  min-height: calc(100vh - var(--nav-height));
  padding: 2rem 1rem;
  display: flex;
  justify-content: center;
}

.char-inner {
  width: 100%;
  max-width: 760px;
}

.page-title {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 1.25rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text);
  margin: 0 0 1.5rem;
}

/* ── Search ──────────────────────────────────────────────── */
.search-bar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 160px;
  background: var(--bg);
  border: 1px solid hsl(271, 20%, 20%);
  color: var(--text);
  font-size: 0.8125rem;
  padding: 4px 10px;
  height: 32px;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.server-select {
  background: var(--bg);
  border: 1px solid hsl(271, 20%, 20%);
  color: var(--text);
  font-size: 0.8125rem;
  padding: 4px 8px;
  height: 32px;
  min-width: 140px;
}

.search-btn {
  height: 32px;
  padding: 0 1.25rem;
  background: var(--primary);
  color: #fff;
  border: none;
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 0.8125rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}

.search-btn:hover:not(:disabled) {
  background: var(--primary-bright);
}

.search-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

/* ── Loading / states ────────────────────────────────────── */
.loading-rows {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.skeleton-row {
  height: 34px;
  background: var(--surface);
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 0.8; }
}

.err-msg, .empty-msg {
  color: var(--text-muted);
  font-size: 0.875rem;
}

/* ── Character header ────────────────────────────────────── */
.char-header {
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.char-name {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 1.5rem;
  font-weight: 600;
}

.char-meta {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.char-overall {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-top: 0.25rem;
  font-size: 0.8125rem;
}

.stat-label {
  color: var(--text-muted);
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stat-val {
  font-weight: 600;
  color: var(--text);
}

/* ── Boss table ──────────────────────────────────────────── */
.raid-group {
  margin-bottom: 1.5rem;
}

.raid-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  margin-bottom: 0.4rem;
}

.boss-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.boss-table th {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-align: left;
  padding: 0 8px 6px;
  border-bottom: 1px solid var(--table-border);
}

.th-num, .td-num {
  text-align: right;
}

.th-raid, .td-raid {
  text-align: right;
  white-space: nowrap;
}

.boss-row {
  height: 34px;
  border-bottom: 1px solid var(--table-border);
}

.boss-row:hover {
  background: var(--hover-row);
}

.boss-row td {
  padding: 0 8px;
}

.td-boss {
  color: var(--text);
}

.row-other .td-boss {
  color: var(--text-muted);
}

.td-muted {
  color: var(--text-muted);
}

.raid-link {
  color: var(--text-muted);
  font-size: 0.75rem;
  text-decoration: none;
}

.raid-link:hover {
  color: var(--text);
  text-decoration: underline;
}

/* Class colours */
.cls-death-knight { color: #C41E3A; }
.cls-druid        { color: #FF7C0A; }
.cls-hunter       { color: #AAD372; }
.cls-mage         { color: #3FC7EB; }
.cls-paladin      { color: #F48CBA; }
.cls-priest       { color: #FFFFFF; }
.cls-rogue        { color: #FFF468; }
.cls-shaman       { color: #0070DD; }
.cls-warlock      { color: #8788EE; }
.cls-warrior      { color: #C69B3A; }
</style>
