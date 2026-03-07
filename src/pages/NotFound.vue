<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="not-found">
    <h1 class="not-found__code">404</h1>
    <p class="not-found__message">Page not found</p>
    <p class="not-found__sub">The page you're looking for doesn't exist.</p>
    <button class="not-found__btn" @click="router.push('/home')">Go Home</button>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  text-align: center;
  gap: 1rem;
}

.not-found__code {
  font-size: 8rem;
  font-weight: bold;
  margin: 0;
  line-height: 1;
  opacity: 0.15;
}

.not-found__message {
  font-size: 2rem;
  font-weight: 600;
  margin: 0;
}

.not-found__sub {
  opacity: 0.6;
  margin: 0;
}

.not-found__btn {
  margin-top: 1rem;
  padding: 0.6rem 1.8rem;
  font-size: 1rem;
  cursor: pointer;
  border: 2px solid currentColor;
  background: transparent;
  border-radius: 4px;
  transition: background 0.2s, color 0.2s;
}

.not-found__btn:hover {
  background: currentColor;
  color: #fff;
}
</style>
