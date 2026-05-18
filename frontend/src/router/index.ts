import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Report from '../views/Report.vue'
import NotFound from '../views/NotFound.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/reports/:id', component: Report },
    { path: '/:pathMatch(.*)*', component: NotFound },
  ],
})

export default router
