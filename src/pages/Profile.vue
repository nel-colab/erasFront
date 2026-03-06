<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../store/login'

const auth = useAuthStore()

const username = ref('')
const email = ref('')
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const successMsg = ref('')
const errorMsg = ref('')

onMounted(async () => {
  await auth.fetchProfile()
  username.value = auth.user?.username || ''
  email.value = auth.user?.email || ''
})

const save = async () => {
  errorMsg.value = ''
  successMsg.value = ''

  if (newPassword.value && newPassword.value !== confirmPassword.value) {
    errorMsg.value = 'Passwords do not match'
    return
  }

  const ok = await auth.updateProfile({
    username: username.value,
    email: email.value,
    oldPassword: oldPassword.value || undefined,
    newPassword: newPassword.value || undefined,
  })

  if (ok) {
    successMsg.value = 'Profile updated successfully'
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } else {
    errorMsg.value = auth.error || 'Update failed'
  }
}
</script>

<template>
  <div class="row justify-content-center mt-4">
    <div class="col-md-6">
      <div class="card bg-secondary bg-opacity-25 border-light shadow-lg p-4">
        <h2 class="text-light fw-bold mb-4">Profile</h2>

        <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>
        <div v-if="errorMsg" class="alert alert-danger">{{ errorMsg }}</div>

        <form @submit.prevent="save">
          <div class="mb-3">
            <label class="form-label text-light fw-semibold">Username</label>
            <input
              v-model="username"
              type="text"
              class="form-control bg-dark text-light border-light"
            />
          </div>

          <div class="mb-3">
            <label class="form-label text-light fw-semibold">Email</label>
            <input
              v-model="email"
              type="email"
              class="form-control bg-dark text-light border-light"
            />
          </div>

          <hr class="border-light my-4">
          <h5 class="text-light mb-3">
            Change Password
            <small class="text-muted fs-6 fw-normal ms-2">(optional)</small>
          </h5>

          <div class="mb-3">
            <label class="form-label text-light fw-semibold">Current Password</label>
            <input
              v-model="oldPassword"
              type="password"
              class="form-control bg-dark text-light border-light"
              placeholder="Required to change password"
            />
          </div>

          <div class="mb-3">
            <label class="form-label text-light fw-semibold">New Password</label>
            <input
              v-model="newPassword"
              type="password"
              class="form-control bg-dark text-light border-light"
            />
          </div>

          <div class="mb-4">
            <label class="form-label text-light fw-semibold">Confirm New Password</label>
            <input
              v-model="confirmPassword"
              type="password"
              class="form-control bg-dark text-light border-light"
            />
          </div>

          <button
            type="submit"
            class="btn btn-primary w-100 fw-bold btn-lg"
            :disabled="auth.loading"
          >
            {{ auth.loading ? 'Saving...' : 'Save Changes' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
