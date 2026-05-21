<script setup lang="ts">
import type { SpellRow } from '../types/api'

defineProps<{
  spells: SpellRow[]
}>()
</script>

<template>
  <div class="spell-table-wrap">
    <div class="spell-thead">
      <div class="col-icon" />
      <div class="col-name">Spell</div>
      <div class="col-casts">Casts</div>
      <div class="col-pct">%</div>
      <div class="col-amount">Amount</div>
      <div class="col-bar" />
    </div>

    <div
      v-for="item in spells"
      :key="item.spell_id"
      class="spell-row"
    >
      <div class="col-icon">
        <img
          v-if="item.icon"
          :src="`/static/icons/${item.icon}.jpg`"
          :alt="item.name"
          class="spell-icon"
        />
      </div>
      <div class="col-name" :style="{ color: item.color || undefined }">
        {{ item.name }}
      </div>
      <div class="col-casts number">{{ item.casts }}</div>
      <div class="col-pct number">{{ item.percent }}%</div>
      <div class="col-amount number">{{ item.actual }}</div>
      <div class="col-bar">
        <div
          class="bar-fill"
          :style="{ width: item.percent + '%' }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.spell-table-wrap {
  display: flex;
  flex-direction: column;
}

.spell-thead,
.spell-row {
  display: grid;
  grid-template-columns: 28px 1fr 60px 48px 100px 120px;
  align-items: center;
  height: 36px;
  padding: 0 4px;
  gap: 4px;
}

.spell-thead {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  border-bottom: 1px solid var(--table-border);
}

.spell-row {
  border-bottom: 1px solid var(--table-border);
  font-size: 0.8125rem;
}

.spell-row:hover {
  background: var(--hover-row);
}

.spell-icon {
  width: 24px;
  height: 24px;
  display: block;
}

.col-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.number {
  font-family: 'Barlow Condensed', sans-serif;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.col-bar {
  position: relative;
  height: 6px;
  background: var(--table-border);
}

.bar-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--primary-dim);
  min-width: 0;
  max-width: 100%;
}
</style>
