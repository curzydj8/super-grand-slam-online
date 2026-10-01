import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from './stores/user'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/lobby' },
    { path: '/login', component: () => import('./pages/Login.vue') },
    { path: '/lobby', component: () => import('./pages/Lobby.vue'), meta: { auth: true } },
    { path: '/game/:roomId', component: () => import('./pages/Game.vue'), meta: { auth: true } },
    { path: '/rank', component: () => import('./pages/Rank.vue'), meta: { auth: true } },
  ],
})

router.beforeEach((to) => {
  const user = useUserStore()
  if (to.meta.auth && !user.token) return '/login'
})

export default router
