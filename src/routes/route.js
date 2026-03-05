// src/routes/route.js
import { createRouter, createWebHistory } from 'vue-router'

import Home from '../pages/Home.vue'
import Login from '../pages/Login.vue'
import Register from '../pages/Register.vue'

const routes = [
  { path: '/home', component: Home, alias: ['/', '/Home'], meta: { public: true } },
  { path: '/login', component: Login, alias: ['/Login'], meta: { public: true } },
  { path: '/register', component: Register, alias: ['/Register'], meta: { public: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

export default router
