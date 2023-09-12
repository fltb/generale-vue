import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/GamesView.vue')
    },
    {
      path: '/games',
      name: 'game',
      component: () => import('../views/GamesView.vue')
    },
    {
      path: '/rooms',
      name: 'Rooms',
      component: () => import('../views/RoomsView.vue')
    },
    {
      path: '/maps',
      name: 'Maps',
      component: () => import('../views/MapsView.vue')
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('../views/SettingsView.vue')
    },
    {
      path: '/map/:mapID',
      name: 'Map',
      props: true,
      component: () => import('../views/SingleMapView.vue')
    },
    {
      path: '/game/:gameID',
      name: 'Game',
      props: true,
      component: () => import('../views/SingleGameView.vue')
    },
  ]
})

export default router
