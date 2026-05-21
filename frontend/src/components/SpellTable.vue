<script setup lang="ts">
import { computed } from 'vue'
import type { SpellRow } from '../types/api'

const props = defineProps<{
  spells: SpellRow[]
}>()

// Extended mode when rows carry hit-level detail (Player page).
const extended = computed(() => props.spells.some(r => r.hit_total !== undefined))
</script>

<template>
  <div class="spell-table-wrap">

    <!-- Extended header (Player detail) -->
    <div v-if="extended" class="spell-thead spell-thead--ext">
      <div class="col-icon" />
      <div class="col-name">Spell</div>
      <div class="col-num">Casts</div>
      <div class="col-num">Hits</div>
      <div class="col-num">Crits</div>
      <div class="col-num">Crit%</div>
      <div class="col-num">Avg Hit</div>
      <div class="col-num">Avg Crit</div>
      <div class="col-num">Misses</div>
      <div class="col-amount">Amount</div>
      <div class="col-bar" />
    </div>

    <!-- Basic header (Compare) -->
    <div v-else class="spell-thead">
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
      :class="extended ? 'spell-row--ext' : ''"
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
        <a
          v-if="item.spell_id && !item.spell_id.includes('--')"
          :href="`https://www.wowhead.com/wotlk/spell=${item.spell_id}`"
          target="_blank"
          rel="noreferrer"
          class="spell-link"
          :style="{ color: item.color || undefined }"
        >{{ item.name }}</a>
        <span v-else>{{ item.name }}</span>
      </div>

      <!-- Extended columns -->
      <template v-if="extended">
        <div class="col-num number">{{ item.casts }}</div>
        <div class="col-num number">{{ item.hit_total }}</div>
        <div class="col-num number">{{ item.crits }}</div>
        <div class="col-num number crit-pct">{{ item.crit_pct }}</div>
        <div class="col-num number">{{ item.avg_hit }}</div>
        <div class="col-num number crit-val">{{ item.avg_crit }}</div>
        <div class="col-num number miss">{{ item.misses }}</div>
        <div class="col-amount number">{{ item.actual }}</div>
      </template>

      <!-- Basic columns -->
      <template v-else>
        <div class="col-casts number">{{ item.casts }}</div>
        <div class="col-pct number">{{ item.percent }}%</div>
        <div class="col-amount number">{{ item.actual }}</div>
      </template>

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

/* ── Basic layout (Compare) ── */
.spell-thead,
.spell-row {
  display: grid;
  grid-template-columns: 32px 1fr 72px 58px 120px 120px;
  align-items: center;
  height: 40px;
  padding: 0 6px;
  gap: 6px;
}

/* ── Extended layout (Player detail) ── */
.spell-thead--ext,
.spell-row--ext {
  grid-template-columns: 32px 1fr repeat(7, 76px) 120px 100px;
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
  width: 30px;
  height: 30px;
  display: block;
}

.col-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spell-link {
  text-decoration: none;
}
.spell-link:hover {
  text-decoration: underline;
}

.number {
  font-family: 'Barlow Condensed', sans-serif;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.col-num { text-align: right; }

.crit-pct  { color: #ffd700; }
.crit-val  { color: #ffd700; }
.miss      { color: var(--text-muted); }

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
