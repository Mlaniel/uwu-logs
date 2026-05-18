<template>
  <div class="home-page">
    <div class="home-inner">
      <h1 class="home-title">WotLK Raid Log Analyzer</h1>

      <div class="upload-cta">
        <p class="upload-hint">Drop your <code>.7z</code> log file to parse it</p>
        <a href="/upload" class="upload-btn">Upload Log</a>
      </div>

      <section class="recent-logs">
        <h2 class="section-heading">Recent public logs</h2>

        <div v-if="loading" class="recent-loading">
          <div v-for="i in 5" :key="i" class="skeleton-row" />
        </div>

        <p v-else-if="error" class="recent-error">{{ error }}</p>

        <p v-else-if="!reports.length" class="recent-empty">No logs yet.</p>

        <table v-else class="recent-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Server</th>
              <th>Bosses</th>
              <th>Latest boss</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in reports"
              :key="r.id"
              class="recent-row"
              @click="go(r.id)"
            >
              <td class="col-name">{{ r.name }}</td>
              <td class="col-server">{{ r.server }}</td>
              <td class="col-bosses">{{ r.boss_count }}</td>
              <td class="col-latest">{{ r.latest_boss }}</td>
              <td class="col-date">{{ r.date }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useFetch } from '../composables/useFetch'
import type { RecentReport } from '../types/api'

const router = useRouter()
const { data, loading, error, execute } = useFetch<RecentReport[]>()

const reports = computed<RecentReport[]>(() => data.value ?? [])

onMounted(() => execute('/api/v2/recent_reports/'))

function go(id: string): void {
  router.push(`/reports/${id}`)
}
</script>

<style scoped>
.home-page {
  min-height: calc(100vh - var(--nav-height));
  display: flex;
  justify-content: center;
  padding: 3rem 1rem;
}

.home-inner {
  width: 100%;
  max-width: 760px;
}

.home-title {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 2rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* ── Upload CTA ─────────────────────────────────────────────── */
.upload-cta {
  border: 1px solid hsl(271, 30%, 20%);
  background: var(--surface);
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin-bottom: 3rem;
}

.upload-hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.upload-hint code {
  font-family: monospace;
  color: var(--text);
}

.upload-btn {
  display: inline-block;
  padding: 0.5rem 2rem;
  background: var(--primary);
  color: #fff;
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 0.875rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-decoration: none;
}

.upload-btn:hover {
  background: var(--primary-bright);
}

/* ── Recent logs section ────────────────────────────────────── */
.section-heading {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 0 0 0.75rem;
}

.recent-loading {
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

.recent-error,
.recent-empty {
  color: var(--text-muted);
  font-size: 0.875rem;
}

/* ── Table ─────────────────────────────────────────────────── */
.recent-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.recent-table th {
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

.recent-row {
  height: 36px;
  cursor: pointer;
  border-bottom: 1px solid var(--table-border);
}

.recent-row:hover {
  background: var(--hover-row);
}

.recent-row td {
  padding: 0 8px;
}

.col-bosses {
  font-family: 'Barlow Condensed', sans-serif;
  font-variant-numeric: tabular-nums;
  text-align: right;
  padding-right: 16px !important;
}

.col-date {
  color: var(--text-muted);
  font-size: 0.75rem;
  white-space: nowrap;
}
</style>
