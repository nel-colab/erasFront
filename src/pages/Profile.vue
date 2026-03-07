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
  <div class="auth-page">
    <div class="auth-card" style="max-width: 520px;">
      <h2>Profile</h2>

      <p v-if="successMsg" class="auth-success">{{ successMsg }}</p>
      <p v-if="errorMsg" class="auth-error">{{ errorMsg }}</p>

      <form @submit.prevent="save">
        <div class="form-group-t">
          <label class="form-label-t">Username</label>
          <input v-model="username" type="text" class="form-control-t" />
        </div>

        <div class="form-group-t">
          <label class="form-label-t">Email</label>
          <input v-model="email" type="email" class="form-control-t" />
        </div>

        <hr class="t-hr">

        <p style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 1rem;">
          Change Password
          <span style="font-weight: 400; color: var(--text-muted);">(optional)</span>
        </p>

        <div class="form-group-t">
          <label class="form-label-t">Current Password</label>
          <input
            v-model="oldPassword"
            type="password"
            class="form-control-t"
            placeholder="Required to change password"
          />
        </div>

        <div class="form-group-t">
          <label class="form-label-t">New Password</label>
          <input v-model="newPassword" type="password" class="form-control-t" />
        </div>

        <div class="form-group-t">
          <label class="form-label-t">Confirm New Password</label>
          <input v-model="confirmPassword" type="password" class="form-control-t" />
        </div>

        <button type="submit" class="btn-primary-t" :disabled="auth.loading">
          {{ auth.loading ? 'Saving...' : 'Save Changes' }}
        </button>
      </form>
    </div>
  </div>
</template>
