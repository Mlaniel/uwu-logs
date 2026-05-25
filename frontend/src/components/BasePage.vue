<script setup lang="ts">
import ReportInfoBar from './ReportInfoBar.vue'
import type { ReportApiResponse } from '../types/api'

defineProps<{
  title?: string
  loading?: boolean
  error?: string | null
  report?: ReportApiResponse | null
  selectedHref?: string
}>()
</script>

<template>
  <div class="page-shell">
    <aside v-if="$slots.sidebar" class="sidebar">
      <slot name="sidebar" />
    </aside>

    <main class="main-content">
      <ReportInfoBar v-if="report" :report="report" :selected-href="selectedHref ?? ''" />
      <div v-if="error" class="base-error">{{ error }}</div>
      <div v-else-if="loading" class="base-skeleton">
        <div class="skeleton sk-title" />
        <div v-for="i in 8" :key="i" class="skeleton sk-row" />
      </div>
      <slot v-else />
    </main>
  </div>
</template>

<style scoped>
.base-error {
  padding: 2rem;
  color: var(--wipe);
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 14px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.base-skeleton {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 1rem;
}

.sk-title {
  height: 18px;
  width: 40%;
  margin-bottom: 8px;
}

.sk-row {
  height: 36px;
  width: 100%;
}
</style>
