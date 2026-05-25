<script setup lang="ts">
import { computed } from 'vue'
import type { ReportApiResponse, BossAttempt } from '../types/api'

const props = defineProps<{
  report: ReportApiResponse
  selectedHref: string
}>()

const attempt = computed<BossAttempt | null>(() => {
  if (!props.selectedHref) return null
  for (const bg of props.report.SEGMENTS_LINKS) {
    const a = bg.segments.find(s => s.href === props.selectedHref)
    if (a) return a
  }
  return null
})

function diffClass(diff: string): string {
  return diff.endsWith('H') ? 'diff-heroic' : 'diff-normal'
}
</script>

<template>
  <div class="report-info-bar">
    <template v-if="attempt">
      <span class="info-boss">{{ attempt.encounter_name }}</span>
      <span :class="['info-diff', diffClass(attempt.difficulty)]">{{ attempt.difficulty }}</span>
      <span class="info-sep">·</span>
      <span :class="['info-result', attempt.attempt_type]">
        {{ attempt.attempt_type === 'kill' ? 'Kill' : `Wipe ${attempt.attempt}` }}
      </span>
      <span class="info-sep">·</span>
      <span class="info-duration">{{ attempt.duration_str }}</span>
    </template>
    <template v-else>
      <span class="info-server">{{ report.SERVER }}</span>
      <span class="info-sep">·</span>
      <span class="info-duration">{{ report.DURATION_STR }}</span>
    </template>
  </div>
</template>

<style scoped>
.report-info-bar {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.35rem 0 0.5rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--table-border);
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.95rem;
  flex-wrap: wrap;
}

.info-boss {
  font-weight: 600;
  font-size: 1.05rem;
  color: var(--text);
}

.info-server {
  font-weight: 600;
  color: var(--text);
}

.info-diff {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.1em 0.4em;
  border-radius: 3px;
  line-height: 1.4;
}

.diff-heroic {
  background: color-mix(in srgb, #ff8c00 20%, transparent);
  color: #ff8c00;
  border: 1px solid #ff8c00;
}

.diff-normal {
  background: color-mix(in srgb, #ffd700 15%, transparent);
  color: #c8a800;
  border: 1px solid #c8a800;
}

.info-result.kill {
  color: #4caf50;
  font-weight: 600;
}

.info-result.wipe {
  color: #e57373;
}

.info-sep {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.info-duration {
  color: var(--text-muted);
}
</style>
