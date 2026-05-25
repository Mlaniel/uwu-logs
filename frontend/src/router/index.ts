import { createRouter, createWebHistory } from 'vue-router'
import About from '../views/About.vue'
import Home from '../views/Home.vue'
import Logs from '../views/Logs.vue'
import Report from '../views/Report.vue'
import Player from '../views/Player.vue'
import Timeline from '../views/Timeline.vue'
import Compare from '../views/Compare.vue'
import Rankings from '../views/Rankings.vue'
import Character from '../views/Character.vue'
import Targets from '../views/Targets.vue'
import Consumables from '../views/Consumables.vue'
import Entities from '../views/Entities.vue'
import Auras from '../views/Auras.vue'
import Powers from '../views/Powers.vue'
import NotFound from '../views/NotFound.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/about', component: About },
    { path: '/logs', component: Logs },
    { path: '/reports/:id', component: Report },
    { path: '/reports/:id/player/:name', component: Player },
    { path: '/reports/:id/timeline', component: Timeline },
    { path: '/reports/:id/compare', component: Compare },
    { path: '/reports/:id/targets', component: Targets },
    { path: '/reports/:id/consumables', component: Consumables },
    { path: '/reports/:id/entities', component: Entities },
    { path: '/reports/:id/auras', component: Auras },
    { path: '/reports/:id/powers', component: Powers },
    { path: '/top', component: Rankings },
    { path: '/character', component: Character },
    { path: '/:pathMatch(.*)*', component: NotFound },
  ],
})

export default router
