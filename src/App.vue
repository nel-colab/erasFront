<script setup>
import Navbar from './components/Navbar.vue'
</script>

<template>
  <nav>
    <Navbar />
  </nav>

  <!-- Contenedor principal con margen superior para evitar que el navbar lo tape -->
  <main class="container mt-5 pt-4">
    <div class="row">
      <div class="col">
        <router-view />
      </div>
    </div>
  </main>
</template>

<style scoped>
header {
  line-height: 1.5;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
