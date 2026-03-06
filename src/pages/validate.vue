<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../store/login' // <-- the Pinia store I shared

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const role = ref('')
const permissions = ref('')
const localError = ref('')


/** Submit handler */
const validate = async () => {
  localError.value = ''

  if (!role.value || !permissions.value) {
    localError.value = 'Please fill in both fields.'
    return
  }

  // Calls POST /login/auth/login under the hood (via the store’s axios)
  const ok = await auth.validateAccount({ role: role.value, permissions: permissions.value })

  if (ok) {
    // Respect ?redirect=/some/path if present, else go to /
    const redirect = (route.query.redirect as string) || '/'
    router.replace(redirect)
  }
}

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
           <router-link to="/login" class="btn btn-primary w-100 fw-bold">Sign up</router-link>
        </button>

    </div>
  </div>
</template>

<style scoped>
/* your styles here */
</style>
