<script setup lang="ts">
import { ref, computed } from 'vue'
import type { BossGroup, BossAttempt } from '../types/api'
import { IGNORED_ENCOUNTERS, IGNORED_ENCOUNTER_MODES } from '../constants/bosses'

const props = defineProps<{
  bosses: BossGroup[]
  selectedHref: string
}>()

const emit = defineEmits<{
  select: [attempt: BossAttempt]
  deselect: []
}>()

const showAll = ref(false)
const expanded = ref<Set<string>>(new Set())

const visibleBosses = computed(() => {
  return props.bosses.filter(bg => {
    if (bg.boss_name === 'all') return false
    if (!showAll.value && IGNORED_ENCOUNTERS.includes(bg.boss_name as typeof IGNORED_ENCOUNTERS[number])) {
      return false
    }
    return true
  })
})

function toggleExpand(bossName: string) {
  if (expanded.value.has(bossName)) {
    expanded.value.delete(bossName)
  } else {
    expanded.value.add(bossName)
  }
  // Trigger reactivity on the Set
  expanded.value = new Set(expanded.value)
}

function isKill(bg: BossGroup): boolean {
  return bg.segments.some(s => s.attempt_type === 'kill')
}

function latestAttempt(bg: BossGroup): BossAttempt {
  return bg.segments[bg.segments.length - 1]
}

function visibleAttempts(bg: BossGroup): BossAttempt[] {
  return bg.segments.filter(s => !IGNORED_ENCOUNTER_MODES.includes(s.difficulty as typeof IGNORED_ENCOUNTER_MODES[number]))
}
</script>

<template>
  <nav class="boss-selector">
    <button
      class="full-raid-row"
      :class="{ selected: !props.selectedHref }"
      @click="emit('deselect')"
    >
      Full Raid
    </button>

    <div
      v-for="bg in visibleBosses"
      :key="bg.boss_name"
      class="boss-group"
    >
      <button
        class="boss-row"
        :class="{
          selected: props.selectedHref.startsWith(bg.href),
          kill: isKill(bg),
          wipe: !isKill(bg),
        }"
        @click="emit('select', latestAttempt(bg))"
      >
        <span class="expand-toggle" @click.stop="toggleExpand(bg.boss_name)">
          {{ expanded.has(bg.boss_name) ? '▼' : '▶' }}
        </span>
        <span class="boss-name">{{ bg.boss_name }}</span>
        <span class="outcome-dot" :class="isKill(bg) ? 'kill' : 'wipe'">●</span>
      </button>

      <div v-if="expanded.has(bg.boss_name)" class="attempts">
        <button
          v-for="attempt in visibleAttempts(bg)"
          :key="attempt.attempt"
          class="attempt-row"
          :class="[attempt.attempt_type, { selected: selectedHref === attempt.href }]"
          @click="emit('select', attempt)"
        >
          {{ attempt.attempt_type === 'kill' ? 'Kill' : `Wipe ${attempt.attempt_from_last_kill}` }}
          <span class="attempt-duration">{{ attempt.duration_str }}</span>
        </button>
      </div>
    </div>

    <button class="show-all-toggle" @click="showAll = !showAll">
      {{ showAll ? 'Hide filtered' : 'Show all' }}
    </button>
  </nav>
</template>

<style scoped>
.boss-selector {
  display: flex;
  flex-direction: column;
  padding-top: 0.5rem;
}

.boss-row,
.attempt-row {
  width: 100%;
  background: none;
  border: none;
  color: var(--text);
  font-family: 'Barlow', sans-serif;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
}

.boss-row:hover,
.attempt-row:hover {
  background: var(--hover-row);
}

.boss-row.selected,
.attempt-row.selected {
  border-left: 3px solid var(--primary);
  padding-left: 9px;
}

.boss-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expand-toggle {
  font-size: 9px;
  color: var(--text-muted);
  width: 12px;
  flex-shrink: 0;
}

.outcome-dot.kill { color: var(--kill); }
.outcome-dot.wipe { color: var(--wipe); }

.attempts {
  display: flex;
  flex-direction: column;
}

.attempt-row {
  padding-left: 28px;
  font-size: 12px;
  color: var(--text-muted);
  height: 30px;
}

.attempt-row.kill { color: var(--kill); }
.attempt-row.wipe { color: var(--wipe); }

.attempt-duration {
  margin-left: auto;
  font-family: 'Barlow Condensed', sans-serif;
  font-variant-numeric: tabular-nums;
}

.show-all-toggle {
  margin-top: auto;
  width: 100%;
  background: none;
  border: none;
  border-top: 1px solid var(--table-border);
  color: var(--text-muted);
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 8px 12px;
  text-align: left;
  cursor: pointer;
}

.show-all-toggle:hover { color: var(--text); }

.full-raid-row {
  width: 100%;
  background: none;
  border: none;
  border-bottom: 1px solid var(--table-border);
  color: var(--text-muted);
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: left;
  cursor: pointer;
  height: 32px;
  padding: 0 12px;
  margin-bottom: 4px;
}

.full-raid-row:hover { color: var(--text); }

.full-raid-row.selected {
  color: var(--text);
  border-left: 3px solid var(--primary);
  padding-left: 9px;
}
</style>
