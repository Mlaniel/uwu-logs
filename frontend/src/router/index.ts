import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Report from '../views/Report.vue'
import Player from '../views/Player.vue'
import Deaths from '../views/Deaths.vue'
import Compare from '../views/Compare.vue'
import NotFound from '../views/NotFound.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/reports/:id', component: Report },
    { path: '/reports/:id/player/:name', component: Player },
    { path: '/reports/:id/deaths', component: Deaths },
    { path: '/reports/:id/compare', component: Compare },
    { path: '/:pathMatch(.*)*', component: NotFound },
  ],
})

export default router
