<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/login'
import Swal from 'sweetalert2'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)

auth.error = null

const register = async () => {
  error.value = ''

  if (!email.value || !username.value || !password.value || !confirmPassword.value) {
    error.value = 'Please fill in all fields.'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }

  try {
    loading.value = true
    const ok = await auth.register({ email: email.value, username: username.value, password: password.value })

    if (ok) {
      Swal.fire('Your account has been created. You can now log in.').then(() => {
        router.push('/login')
      })
    } else {
      error.value = auth.error || 'Registration failed.'
    }
  } catch (err) {
    error.value = err.message || 'Could not register. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1>Register</h1>

      <p v-if="error" class="auth-error">{{ error }}</p>

      <div class="form-group-t">
        <label for="email" class="form-label-t">Email</label>
        <input
          v-model="email"
          type="email"
          id="email"
          class="form-control-t"
          placeholder="Enter your email"
        />
      </div>

      <div class="form-group-t">
        <label for="username" class="form-label-t">Username</label>
        <input
          v-model="username"
          type="text"
          id="username"
          class="form-control-t"
          placeholder="Enter a username"
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
        />
      </div>

      <div class="form-group-t">
        <label for="confirmPassword" class="form-label-t">Confirm Password</label>
        <input
          v-model="confirmPassword"
          type="password"
          id="confirmPassword"
          class="form-control-t"
          placeholder="Confirm your password"
        />
      </div>

      <button @click="register" type="button" class="btn-primary-t" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
        {{ loading ? 'Registering...' : 'Register' }}
      </button>

      <p class="auth-footer">
        Already have an account?
        <router-link to="/login">Log in</router-link>
      </p>
    </div>
  </div>
</template>
