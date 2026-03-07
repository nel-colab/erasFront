import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

import 'sweetalert2/dist/sweetalert2.min.css'

import router from './routes/route'

import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './assets/main.css'

// Apply saved theme before mount to prevent flash
const savedTheme = localStorage.getItem('theme') || 'light'
document.documentElement.setAttribute('data-theme', savedTheme)

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')
