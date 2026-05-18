<template>
  <div class="not-found">
    <h1>404</h1>
    <p>This page doesn't exist.</p>
    <RouterLink to="/">Back to home</RouterLink>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4rem;
  gap: 1rem;
  color: var(--text);
}
h1 { font-size: 4rem; color: var(--primary); }
</style>
