<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../store/login' // <-- the Pinia store I shared

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const localError = ref('')


/** Submit handler */
const login = async () => {
  localError.value = ''

  if (!username.value || !password.value) {
    localError.value = 'Please fill in both fields.'
    return
  }

  // Calls POST /login/auth/login under the hood (via the store’s axios)
  const ok = await auth.login({ username: username.value, password: password.value })

  if (ok) {
    // Respect ?redirect=/some/path if present, else go to /
    const redirect = (route.query.redirect as string) || '/'
    router.replace(redirect)
  }
}

const goToRegister = () => router.push('/register')
</script>

<template>
  <div class="d-flex justify-content-center align-items-center bg-dark text-light" style="margin-top: 15rem;">
    <div class="card shadow-lg p-5 border-3 border-light bg-secondary bg-opacity-25" style="width: 40rem; height: auto;">
      <h1 class="text-center mb-5 fw-bold text-light">Login</h1>

      <form @submit.prevent="login" novalidate>
        <div class="mb-4">
          <label for="username" class="form-label fs-5 fw-semibold text-light">Username</label>
          <input
            v-model.trim="username"
            type="username"
            id="username"
            class="form-control form-control-lg bg-dark text-light border-light"
            placeholder="Enter your username"
            autocomplete="username"
            required
          />
        </div>

        <div class="mb-3">
          <label for="password" class="form-label fs-5 fw-semibold text-light">Password</label>
          <input
            v-model="password"
            type="password"
            id="password"
            class="form-control form-control-lg bg-dark text-light border-light"
            placeholder="Enter your password"
            autocomplete="current-password"
            required
          />
        </div>

        <!-- errors -->

        <button type="submit" class="btn btn-primary btn-lg w-100 fw-bold">
          <span role="status" aria-hidden="true">INGRESAR</span>
        </button>
      </form>

      <p class="text-center mt-4 mb-0 fs-6">
        <a href="#" @click.prevent="goToRegister" class="text-decoration-none text-info">
          Don't have an account? <span class="fw-semibold">Register</span>
        </a>
      </p>
    </div>
  </div>
</template>

<style scoped>
/* your styles here */
</style>
