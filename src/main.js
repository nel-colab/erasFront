import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

import 'sweetalert2/dist/sweetalert2.min.css'

import router from './routes/route'

import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'


const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router) 
app.mount('#app')
