<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useFetch } from '../composables/useFetch'
import type { LogsApiResponse } from '../types/api'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: currentYear - 2021 }, (_, i) => currentYear - i)

const router = useRouter()
const route  = useRoute()

// ── Filter state (synced to URL) ──────────────────────────────────────────────

const q      = ref((route.query.q      as string) ?? '')
const server = ref((route.query.server as string) ?? '')
const realm  = ref((route.query.realm  as string) ?? '')
const year   = ref(route.query.year  ? Number(route.query.year)  : 0)
const month  = ref(route.query.month ? Number(route.query.month) : 0)
const day    = ref(route.query.day   ? Number(route.query.day)   : 0)

// ── Fetch ──────────────────────────────────────────────────────────────────────

const { data, loading, error, execute } = useFetch<LogsApiResponse>()

const results    = computed(() => data.value?.results ?? [])
const total      = computed(() => data.value?.total ?? 0)
const serversMap = computed(() => data.value?.servers ?? {})

const serverNames = computed(() => Object.keys(serversMap.value).sort())
const realmNames  = computed<string[]>(() => {
  if (!server.value) return []
  return serversMap.value[server.value] ?? []
})

// When the server changes, clear realm if it no longer belongs to the new server
watch(server, () => {
  if (realm.value && !realmNames.value.includes(realm.value)) {
    realm.value = ''
  }
})

// ── Fetch logic ────────────────────────────────────────────────────────────────

let debounceTimer = 0

function fetch() {
  const params = new URLSearchParams()
  if (q.value)      params.set('q',      q.value)
  if (server.value) params.set('server', server.value)
  if (realm.value)  params.set('realm',  realm.value)
  if (year.value)   params.set('year',   String(year.value))
  if (month.value)  params.set('month',  String(month.value))
  if (day.value)    params.set('day',    String(day.value))

  router.replace({ query: Object.fromEntries(params) })
  execute(`/api/v2/logs/?${params}`)
}

function onQInput() {
  clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(fetch, 300)
}

function onSelectChange() {
  fetch()
}

function clearFilters() {
  q.value      = ''
  server.value = ''
  realm.value  = ''
  year.value   = 0
  month.value  = 0
  day.value    = 0
  fetch()
}

const hasFilters = computed(() => !!(q.value || server.value || realm.value || year.value || month.value || day.value))

// Days available: constrain to the real month length when year+month are both set
const dayOptions = computed<number[]>(() => {
  if (year.value && month.value) {
    const daysInMonth = new Date(year.value, month.value, 0).getDate()
    return Array.from({ length: daysInMonth }, (_, i) => i + 1)
  }
  return Array.from({ length: 31 }, (_, i) => i + 1)
})

// When month or year changes, clear day if it's out of range
watch([year, month], () => {
  if (day.value && !dayOptions.value.includes(day.value)) {
    day.value = 0
  }
})

fetch()

// ── Navigation ────────────────────────────────────────────────────────────────

function go(id: string) {
  router.push(`/reports/${id}`)
}
</script>

<template>
  <div class="logs-page">
    <div class="logs-inner">
      <h1 class="page-title">Raid Logs</h1>

      <!-- Filter bar -->
      <div class="filter-bar">
        <div class="filter-search">
          <input
            v-model="q"
            class="search-input"
            type="search"
            placeholder="Search by author or player name…"
            @input="onQInput"
          />
        </div>

        <select v-model="server" class="filter-select" @change="onSelectChange">
          <option value="">All servers</option>
          <option v-for="s in serverNames" :key="s" :value="s">{{ s }}</option>
        </select>

        <select
          v-model="realm"
          class="filter-select"
          :disabled="!server"
          @change="onSelectChange"
        >
          <option value="">All realms</option>
          <option v-for="r in realmNames" :key="r" :value="r">{{ r }}</option>
        </select>

        <select v-model="year" class="filter-select filter-select--narrow" @change="onSelectChange">
          <option :value="0">Year</option>
          <option v-for="y in YEARS" :key="y" :value="y">{{ y }}</option>
        </select>

        <select v-model="month" class="filter-select filter-select--narrow" @change="onSelectChange">
          <option :value="0">Month</option>
          <option v-for="(name, i) in MONTHS" :key="i" :value="i + 1">{{ name }}</option>
        </select>

        <select
          v-model="day"
          class="filter-select filter-select--narrow"
          :disabled="!month"
          @change="onSelectChange"
        >
          <option :value="0">Day</option>
          <option v-for="d in dayOptions" :key="d" :value="d">{{ d }}</option>
        </select>

        <button v-if="hasFilters" class="clear-btn" @click="clearFilters">Clear</button>
      </div>

      <!-- Results -->
      <div v-if="loading" class="list-loading">
        <div v-for="i in 8" :key="i" class="skeleton-row" />
      </div>

      <p v-else-if="error" class="state-msg">{{ error }}</p>

      <p v-else-if="!results.length" class="state-msg">No logs found.</p>

      <template v-else>
        <div class="results-header">
          <span class="results-count">{{ total.toLocaleString() }} result{{ total === 1 ? '' : 's' }}</span>
          <span v-if="total > 200" class="results-cap-note">— showing first 200, narrow your search</span>
        </div>

        <table class="logs-table">
          <thead>
            <tr>
              <th class="col-date">Date</th>
              <th>Author</th>
              <th>Server</th>
              <th>Realm</th>
              <th class="col-bosses">Bosses</th>
              <th>Latest boss</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in results"
              :key="r.id"
              class="logs-row"
              @click="go(r.id)"
            >
              <td class="col-date">{{ r.date }}</td>
              <td>{{ r.name }}</td>
              <td class="col-server">{{ r.server }}</td>
              <td class="col-server">{{ r.realm }}</td>
              <td class="col-bosses">{{ r.boss_count }}</td>
              <td class="col-latest">{{ r.latest_boss }}</td>
            </tr>
          </tbody>
        </table>

      </template>
    </div>
  </div>
</template>

<style scoped>
.logs-page {
  min-height: calc(100vh - var(--nav-height));
  display: flex;
  justify-content: center;
  padding: 2.5rem 1rem;
}

.logs-inner {
  width: 100%;
  max-width: 960px;
}

.page-title {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text);
  margin: 0 0 1.5rem;
}

/* ── Filter bar ─────────────────────────────────────────────── */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 1.25rem;
}

.filter-search {
  flex: 1 1 220px;
}

.search-input {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--table-border);
  color: var(--text);
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.875rem;
  padding: 6px 10px;
  outline: none;
  box-sizing: border-box;
}

.search-input::placeholder { color: var(--text-muted); }
.search-input:focus         { border-color: var(--primary); }

.filter-select {
  background: var(--surface);
  border: 1px solid var(--table-border);
  color: var(--text);
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.8125rem;
  padding: 6px 8px;
  outline: none;
  cursor: pointer;
  min-width: 120px;
}

.filter-select:disabled {
  opacity: 0.4;
  cursor: default;
}

.filter-select--narrow { min-width: 80px; }
.filter-select:focus   { border-color: var(--primary); }

.clear-btn {
  background: transparent;
  border: 1px solid var(--table-border);
  color: var(--text-muted);
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 6px 12px;
  cursor: pointer;
}

.clear-btn:hover {
  color: var(--text);
  border-color: var(--text-muted);
}

/* ── Loading skeleton ───────────────────────────────────────── */
.list-loading {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.skeleton-row {
  height: 36px;
  background: var(--surface);
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 0.8; }
}

/* ── State messages ─────────────────────────────────────────── */
.state-msg { color: var(--text-muted); font-size: 0.875rem; margin: 1rem 0 0; }

.results-header {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 6px;
}

.results-count {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.results-cap-note {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.75rem;
  color: hsl(35, 80%, 55%);
}

/* ── Table ──────────────────────────────────────────────────── */
.logs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.logs-table th {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 0.6875rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-align: left;
  padding: 0 8px 6px;
  border-bottom: 1px solid var(--table-border);
}

.logs-row {
  height: 36px;
  cursor: pointer;
  border-bottom: 1px solid var(--table-border);
}

.logs-row:hover { background: var(--hover-row); }
.logs-row td    { padding: 0 8px; }

.col-date {
  color: var(--text-muted);
  font-size: 0.75rem;
  white-space: nowrap;
  width: 96px;
}

.col-server { color: var(--text-muted); }

.col-bosses {
  font-family: 'Barlow Condensed', sans-serif;
  font-variant-numeric: tabular-nums;
  text-align: right;
  padding-right: 20px !important;
  width: 64px;
}

.col-latest { color: var(--text-muted); }
</style>
