<script setup>
import { onMounted } from 'vue'
import Navbar from './components/Navbar.vue'
import { useThemeStore } from './store/theme'

const theme = useThemeStore()
onMounted(() => theme.init())
</script>

<template>
  <nav>
    <Navbar />
  </nav>

  <main class="container-fluid mt-5 pt-4">
    <div style="max-width:1800px;margin:auto;">
      <div class="col">
        <router-view />
      </div>
    </div>
  </main>
</template>
