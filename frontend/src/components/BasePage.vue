<script setup lang="ts">
defineProps<{
  loading?: boolean
  error?: string | null
}>()
</script>

<template>
  <div v-if="error" class="base-error">
    <span>{{ error }}</span>
  </div>

  <div v-else-if="loading" class="base-skeleton">
    <div class="skeleton sk-title" />
    <div class="skeleton sk-row" v-for="i in 8" :key="i" />
  </div>

  <slot v-else />
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
