<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../store/login'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const localError = ref('')

auth.error = null

const login = async () => {
  localError.value = ''

  if (!username.value || !password.value) {
    localError.value = 'Please fill in both fields.'
    return
  }

  const ok = await auth.login({ username: username.value, password: password.value })

  if (ok) {
    const redirect = route.query.redirect || '/'
    router.replace(redirect)
  } else {
    localError.value = 'Credenciales inválidas.'
  }
}

const goToRegister = () => router.push('/register')
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1>Login</h1>

      <p v-if="localError || auth.error" class="auth-error">{{ localError || auth.error }}</p>

      <form @submit.prevent="login" novalidate>
        <div class="form-group-t">
          <label for="username" class="form-label-t">Username</label>
          <input
            v-model.trim="username"
            type="text"
            id="username"
            class="form-control-t"
            placeholder="Enter your username"
            autocomplete="username"
          />
        </div>

        <div class="form-group-t">
          <label for="password" class="form-label-t">Password</label>
          <input
            v-model="password"
            type="password"
            id="password"
            class="form-control-t"
            placeholder="Enter your password"
            autocomplete="current-password"
          />
        </div>

        <button type="submit" class="btn-primary-t" :disabled="auth.loading">
          {{ auth.loading ? 'Logging in...' : 'Log in' }}
        </button>
      </form>

      <p class="auth-footer">
        Don't have an account?
        <a href="#" @click.prevent="goToRegister">Register</a>
      </p>
    </div>
  </div>
</template>
