<script setup lang="ts">
import { computed } from 'vue'
import type { Player } from '../types/api'

const props = defineProps<{
  players: Player[]
  selected: string[]
}>()

const emit = defineEmits<{
  toggle: [spec: string]
}>()

// Only show specs present in the current player list
const presentSpecs = computed(() => {
  const seen = new Map<string, string>() // spec_name → spec_icon
  for (const p of props.players) {
    if (!seen.has(p.spec_name)) {
      seen.set(p.spec_name, p.spec_icon)
    }
  }
  return Array.from(seen.entries()).map(([name, icon]) => ({ name, icon }))
})

function isSelected(specName: string): boolean {
  return props.selected.length === 0 || props.selected.includes(specName)
}

function handleClick(specName: string): void {
  // If this is the only selected spec, clicking it resets to "all" (clear filter)
  if (props.selected.length === 1 && props.selected[0] === specName) {
    emit('toggle', specName) // removes it → selected becomes [] = all
    return
  }
  emit('toggle', specName)
}
</script>

<template>
  <div v-if="presentSpecs.length > 1" class="spec-filter">
    <button
      v-for="spec in presentSpecs"
      :key="spec.name"
      class="spec-btn"
      :class="{ unselected: !isSelected(spec.name) }"
      :title="spec.name"
      @click="handleClick(spec.name)"
    >
      <img
        :src="`/static/icons/${spec.icon}.jpg`"
        :alt="spec.name"
        width="28"
        height="28"
      />
    </button>
  </div>
</template>

<style scoped>
.spec-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 0;
  overflow-x: auto;
}

.spec-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  line-height: 0;
  outline: none;
}

.spec-btn img {
  display: block;
  width: 28px;
  height: 28px;
  outline: var(--spec-selected-outline);
  outline-offset: -1px;
}

.spec-btn.unselected img {
  opacity: var(--spec-unselected-opacity);
  outline: none;
}

.spec-btn:focus-visible img {
  outline: var(--spec-selected-outline);
}
</style>
