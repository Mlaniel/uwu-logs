<script setup lang="ts">
</script>

<template>
  <nav class="site-nav">
    <router-link to="/" class="nav-logo">UwU LOGS</router-link>
    <div class="nav-links">
      <router-link to="/" class="nav-item">My Logs</router-link>
      <router-link to="/logs" class="nav-item">Raid Logs</router-link>
      <router-link to="/top" class="nav-item">Rankings</router-link>
      <router-link to="/character" class="nav-item">Characters</router-link>
    </div>
  </nav>
  <RouterView />
</template>

<style scoped>
.site-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  height: var(--nav-height);
  background: var(--surface);
  border-bottom: 1px solid hsl(271, 20%, 12%);
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 1rem;
}

.nav-logo {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 1rem;
  letter-spacing: 0.08em;
  color: var(--primary-bright);
  text-decoration: none;
  margin-right: 2rem;
  flex-shrink: 0;
}

.nav-logo:hover {
  color: #fff;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 0;
  height: 100%;
}

.nav-item {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 0.8125rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-decoration: none;
  padding: 0 14px;
  height: 100%;
  display: flex;
  align-items: center;
  border-bottom: 2px solid transparent;
}

.nav-item:hover,
.nav-item.router-link-active {
  color: var(--text);
  border-bottom-color: var(--primary);
}
</style>
