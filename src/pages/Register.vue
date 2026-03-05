<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/login'
import Swal from 'sweetalert2'

const router = useRouter()
const auth = useAuthStore()

// Form fields
const email = ref('')
const username = ref('')
const password = ref('')
const confirmPassword = ref('')

// UI state
const error = ref('')
const loading = ref(false)

/** Register handler */
const register = async () => {
  error.value = ''

  // Simple validation
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
     const ok = await auth.register({email: email.value, username: username.value, password: password.value})
      
  if (ok) {
      Swal.fire("Tu cuenta ha sido creada. Ahora puedes iniciar sesión.").then(() => {
        router.push('/login')
      });
  }
  } catch (err) {
    error.value = err.message || 'Could not register. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="d-flex justify-content-center align-items-center bg-dark text-light" style="margin-top: 2rem;">
    <div
      class="card shadow-lg p-5 border-3 border-light bg-secondary bg-opacity-25"
      style="width: 40rem; height: auto;"
    >
      <h1 class="text-center mb-5 fw-bold text-light">Register</h1>

      <!-- Email -->
      <div class="mb-4">
        <label for="email" class="form-label fs-5 fw-semibold text-light">Email</label>
        <input
          v-model="email"
          type="email"
          id="email"
          class="form-control form-control-lg bg-dark text-light border-light"
          placeholder="Enter your email"
        />
      </div>

      <!-- Username -->
      <div class="mb-4">
        <label for="username" class="form-label fs-5 fw-semibold text-light">Username</label>
        <input
          v-model="username"
          type="text"
          id="username"
          class="form-control form-control-lg bg-dark text-light border-light"
          placeholder="Enter a username"
        />
      </div>

      <!-- Password -->
      <div class="mb-4">
        <label for="password" class="form-label fs-5 fw-semibold text-light">Password</label>
        <input
          v-model="password"
          type="password"
          id="password"
          class="form-control form-control-lg bg-dark text-light border-light"
          placeholder="Enter your password"
        />
      </div>

      <!-- Confirm password -->
      <div class="mb-4">
        <label for="confirmPassword" class="form-label fs-5 fw-semibold text-light">Confirm Password</label>
        <input
          v-model="confirmPassword"
          type="password"
          id="confirmPassword"
          class="form-control form-control-lg bg-dark text-light border-light"
          placeholder="Confirm your password"
        />
      </div>

      <p v-if="error" class="text-danger small mb-3">{{ error }}</p>

      <button
        @click="register"
        type="button"
        class="btn btn-primary btn-lg w-100 fw-bold"
        :disabled="loading"
      >
        <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
        {{ loading ? 'Registering...' : 'Register' }}
      </button>

      <p class="text-center mt-4 mb-0 fs-6">
        <router-link to="/login" class="text-decoration-none text-info">
          Already have an account? <span class="fw-semibold">Login</span>
        </router-link>
      </p>
    </div>
  </div>
</template>

<style scoped>
/* optional small tweaks */
.spinner-border {
  vertical-align: middle;
}
</style>
