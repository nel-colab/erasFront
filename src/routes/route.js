// src/routes/route.js
import { createRouter, createWebHistory } from 'vue-router'

import Home from '../pages/Home.vue'
import Login from '../pages/Login.vue'
import Register from '../pages/Register.vue'
import Validate from '../pages/validate.vue'
import Profile from '../pages/Profile.vue'
import UpdatesManager from '../pages/UpdatesManager.vue'
import Editions from '../pages/Editions.vue'
import Cards from '../pages/Cards.vue'
import CardRefManager from '../pages/CardRefManager.vue'
import DeckBuilder from '../pages/DeckBuilder.vue'
import MyDecks from '../pages/MyDecks.vue'
import NotFound from '../pages/NotFound.vue'

const routes = [
  { path: '/home', component: Home, alias: ['/', '/Home'], meta: { public: true } },
  { path: '/login', component: Login, alias: ['/Login'], meta: { public: true } },
  { path: '/register', component: Register, alias: ['/Register'], meta: { public: true } },
  { path: '/validate', component: Validate, alias: ['/Validate'], meta: { public: true } },
  { path: '/profile', component: Profile },
  { path: '/updates-manager', component: UpdatesManager },
  { path: '/editions', component: Editions, alias: ['/Editions'], meta: { public: true } },
  { path: '/cards', component: Cards, alias: ['/Cards'], meta: { public: true } },
  { path: '/card-ref', component: CardRefManager },
  { path: '/deck-builder', component: DeckBuilder, alias: ['/DeckBuilder'], meta: { public: true } },
  { path: '/my-decks', component: MyDecks },
  { path: '/:pathMatch(.*)*', component: NotFound, meta: { public: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

export default router
