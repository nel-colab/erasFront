<script setup lang="ts">
import { ref, onMounted  } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../store/login' // <-- the Pinia store I shared

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const tokenvalidate = ref('')
const localError = ref('')

onMounted(async () => {

  // rescatar token del path
  tokenvalidate.value = route.query.token as string

  if (!tokenvalidate.value) {
    localError.value = 'Token not found'
    return
  }

  // llamar al servicio
  const ok = await auth.validateAccount({ tokenvalidate: tokenvalidate.value })

  if (!ok) {
    localError.value = 'Validation failed. Please try again.'
  }
})

</script>

<template>
  <div class="d-flex justify-content-center align-items-center bg-dark text-light" style="margin-top: 15rem;">
    <div class="card shadow-lg p-5 border-3 border-light bg-secondary bg-opacity-25" style="width: 40rem; height: auto;">
      <h1 class="text-center mb-5 fw-bold text-light">Validate Account</h1>

      
        <div class="text-center mb-5">
          <h3>Your account has been validated and you can log in</h3>
        </div>
        <!-- errors -->

        <button type="submit" class="btn btn-primary btn-lg w-100 fw-bold">
           <router-link to="/login" class="btn btn-primary btn-lg w-100 fw-bold"> Sign in </router-link>
        </button>

    </div>
  </div>
</template>

<style scoped>
/* your styles here */
</style>
