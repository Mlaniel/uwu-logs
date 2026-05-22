<script setup lang="ts">
import { ref } from 'vue'
import type { Column, VisibilityState } from '@tanstack/vue-table'

defineProps<{
  presets:      Record<string, VisibilityState>
  activePreset: string | null
  hideableCols: Column<unknown, unknown>[]
  importError?: string | null
}>()

const emit = defineEmits<{
  'apply-preset': [name: string]
  'export':       []
  'import':       [encoded: string]
}>()

const showImport  = ref(false)
const importInput = ref('')
const toast       = ref<string | null>(null)

let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = null }, 2000)
}

async function handleExport() {
  emit('export')
  showToast('Preset copied!')
}

function handleImport() {
  emit('import', importInput.value)
}
</script>

<template>
  <div class="table-toolbar">

    <!-- Preset buttons -->
    <div class="presets">
      <button
        v-for="(_, name) in presets"
        :key="name"
        :class="['preset-btn', { active: activePreset === name }]"
        @click="emit('apply-preset', String(name))"
      >{{ name }}</button>
    </div>

    <!-- Right side: export, import, column picker -->
    <div class="toolbar-right">

      <!-- Toast -->
      <span v-if="toast" class="toast">{{ toast }}</span>

      <!-- Export button -->
      <button class="icon-btn" title="Copy preset to clipboard" @click="handleExport">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>

      <!-- Import toggle -->
      <button class="icon-btn" title="Import preset from string" @click="showImport = !showImport">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>

      <!-- Column picker -->
      <details class="col-picker">
        <summary class="col-picker-toggle">Columns ▾</summary>
        <div class="col-picker-dropdown">
          <label v-for="col in hideableCols" :key="col.id" class="col-toggle">
            <input
              type="checkbox"
              :checked="col.getIsVisible()"
              @change="col.toggleVisibility()"
            />
            {{ typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id }}
          </label>
        </div>
      </details>
    </div>

  </div>

  <!-- Import input (expands below toolbar) -->
  <div v-if="showImport" class="import-row">
    <input
      v-model="importInput"
      class="import-input"
      placeholder="Paste preset string…"
      @keydown.enter="handleImport"
    />
    <button class="preset-btn" @click="handleImport">Apply</button>
    <span v-if="importError" class="import-error">{{ importError }}</span>
  </div>
</template>

<style scoped>
.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0 8px;
}

.presets {
  display: flex;
  gap: 4px;
}

/* ── Preset buttons ── */
.preset-btn {
  padding: 2px 10px;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  background: hsl(0, 0%, 14%);
  border: 1px solid hsl(0, 0%, 22%);
  border-radius: 3px;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}
.preset-btn:hover { background: hsl(0, 0%, 19%); color: var(--text); }
.preset-btn.active {
  background: hsl(266, 45%, 26%);
  border-color: hsl(266, 45%, 38%);
  color: #ccc;
}

/* ── Right cluster ── */
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toast {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 12px;
  color: hsl(120, 50%, 60%);
  letter-spacing: 0.04em;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: hsl(0, 0%, 14%);
  border: 1px solid hsl(0, 0%, 22%);
  border-radius: 3px;
  color: var(--text-muted);
  cursor: pointer;
}
.icon-btn:hover { background: hsl(0, 0%, 19%); color: var(--text); }

/* ── Column picker ── */
.col-picker {
  position: relative;
}
.col-picker-toggle {
  list-style: none;
  cursor: pointer;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 2px 10px;
  background: hsl(0, 0%, 14%);
  border: 1px solid hsl(0, 0%, 22%);
  border-radius: 3px;
  color: var(--text-muted);
  user-select: none;
  height: 26px;
  display: flex;
  align-items: center;
}
.col-picker-toggle::-webkit-details-marker { display: none; }
.col-picker-toggle:hover { color: var(--text); background: hsl(0, 0%, 19%); }
.col-picker[open] .col-picker-toggle { background: hsl(0, 0%, 19%); color: var(--text); }

.col-picker-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 20;
  background: hsl(0, 0%, 11%);
  border: 1px solid hsl(0, 0%, 22%);
  border-radius: 4px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 130px;
}
.col-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 13px;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 2px;
  white-space: nowrap;
}
.col-toggle:hover { color: var(--text); background: hsl(0, 0%, 17%); }
.col-toggle input[type="checkbox"] {
  accent-color: hsl(266, 55%, 55%);
  cursor: pointer;
}

/* ── Import row ── */
.import-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
}
.import-input {
  flex: 1;
  padding: 3px 8px;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 13px;
  background: hsl(0, 0%, 11%);
  border: 1px solid hsl(0, 0%, 22%);
  border-radius: 3px;
  color: var(--text);
}
.import-input::placeholder { color: var(--text-muted); }
.import-error {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 12px;
  color: hsl(0, 60%, 60%);
}
</style>
