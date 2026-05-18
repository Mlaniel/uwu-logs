<script setup lang="ts">
import { computed } from 'vue'
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import type { Player } from '../types/api'
import type { PlayerView, SortKey } from '../composables/useFilters'
import { POINTS } from '../constants/bosses'

const props = defineProps<{
  players: Player[]
  view: PlayerView
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
}>()

const emit = defineEmits<{
  sort: [key: SortKey]
  'player-click': [name: string]
}>()

function rankClass(pct: number): string {
  for (const threshold of POINTS) {
    if (pct >= threshold) return `top${threshold}`
  }
  return 'top0'
}

function sortIndicator(key: SortKey): string {
  if (props.sortKey !== key) return ''
  return props.sortDir === 'desc' ? ' ↓' : ' ↑'
}

// CSS class for WoW class color
function classSlug(className: string): string {
  return className.toLowerCase().replace(/\s+/g, '-')
}

const columns = computed(() => {
  if (props.view === 'damage') {
    return [
      { key: 'useful_dmg' as SortKey, label: 'Useful dmg' },
      { key: 'total_dmg' as SortKey, label: 'Total dmg' },
      { key: 'per_second' as SortKey, label: 'DPS' },
    ]
  }
  if (props.view === 'heal') {
    return [
      { key: 'heal' as SortKey, label: 'Heal' },
      { key: 'heal_total' as SortKey, label: 'Total heal' },
      { key: 'per_second' as SortKey, label: 'HPS' },
    ]
  }
  // taken
  return [
    { key: 'per_second' as SortKey, label: 'DTPS' },
  ]
})

function getStatCell(player: Player) {
  if (props.view === 'damage') return player.damage
  if (props.view === 'heal') return player.heal
  return player.taken
}
</script>

<template>
  <div class="player-table">
    <!-- Column headers -->
    <div class="table-header">
      <div class="col-spec" />
      <div class="col-name" @click="emit('sort', 'name')">
        Name{{ sortIndicator('name') }}
      </div>
      <div
        v-for="col in columns"
        :key="col.key"
        class="col-num"
        @click="emit('sort', col.key)"
      >
        {{ col.label }}{{ sortIndicator(col.key) }}
      </div>
    </div>

    <!-- Virtualized rows — do NOT add v-memo here (RecycleScroller incompatible) -->
    <RecycleScroller
      class="scroller"
      :items="players"
      :item-size="36"
      key-field="name"
    >
      <template #default="{ item: player }">
        <div
          class="player-row"
          :class="{ healer: player.useful === null && view === 'damage' }"
          @click="emit('player-click', player.name)"
        >
          <div class="col-spec">
            <img
              :src="`/static/icons/${player.spec_icon}.jpg`"
              :alt="player.spec_name"
              width="20"
              height="20"
            />
          </div>

          <div class="col-name" :class="classSlug(player.class_name)">
            {{ player.name }}
          </div>

          <!-- Damage view -->
          <template v-if="view === 'damage'">
            <div class="col-num" :class="rankClass(getStatCell(player).percent)">
              {{ player.useful ? player.useful.percent + '%' : '—' }}
            </div>
            <div class="col-num number">
              {{ player.useful?.value || '—' }}
            </div>
            <div class="col-num number">
              {{ player.damage.value }}
            </div>
          </template>

          <!-- Heal view -->
          <template v-else-if="view === 'heal'">
            <div class="col-num" :class="rankClass(player.heal.percent)">
              {{ player.heal.percent }}%
            </div>
            <div class="col-num number">{{ player.heal.value }}</div>
            <div class="col-num number">{{ player.heal_total.value }}</div>
          </template>

          <!-- Taken view -->
          <template v-else>
            <div class="col-num number">{{ player.taken.value }}</div>
          </template>
        </div>
      </template>
    </RecycleScroller>
  </div>
</template>

<style scoped>
.player-table {
  display: flex;
  flex-direction: column;
}

.table-header,
.player-row {
  display: flex;
  align-items: center;
  height: 36px;
  border-bottom: 1px solid var(--table-border);
  gap: 0;
}

.table-header {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  cursor: pointer;
  user-select: none;
}

.table-header > div:hover { color: var(--text); }

.player-row {
  cursor: pointer;
}

.player-row:hover {
  background: var(--hover-row);
}

.player-row.healer {
  opacity: var(--healer-row-opacity);
}

.col-spec {
  width: 28px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.col-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  padding: 0 8px;
}

.col-num {
  width: 90px;
  flex-shrink: 0;
  text-align: right;
  padding: 0 8px;
  font-family: 'Barlow Condensed', sans-serif;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
}

.scroller {
  height: calc(100vh - 320px);
  min-height: 200px;
}
</style>
