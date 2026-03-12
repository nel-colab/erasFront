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
    errorMsg.value = 'Las contraseñas no coinciden'
    return
  }

  const ok = await auth.updateProfile({
    username: username.value,
    email: email.value,
    oldPassword: oldPassword.value || undefined,
    newPassword: newPassword.value || undefined,
  })

  if (ok) {
    successMsg.value = 'Perfil actualizado correctamente'
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } else {
    errorMsg.value = auth.error || 'Error al actualizar'
  }
}
</script>

<template>
  <div class="profile-page">

    <!-- Page header -->
    <div class="profile-header">
      <div class="profile-avatar">{{ username.charAt(0).toUpperCase() || '?' }}</div>
      <div class="profile-header-info">
        <h1 class="profile-name">{{ username }}</h1>
        <p class="profile-email-label">{{ email }}</p>
      </div>
    </div>

    <p v-if="successMsg" class="profile-success">{{ successMsg }}</p>
    <p v-if="errorMsg" class="profile-error">{{ errorMsg }}</p>

    <form @submit.prevent="save" class="profile-grid">

      <!-- Account info -->
      <section class="profile-section">
        <h2 class="section-title">Información de cuenta</h2>

        <div class="form-group-t">
          <label class="form-label-t">Nombre de usuario</label>
          <input v-model="username" type="text" class="form-control-t" />
        </div>

        <div class="form-group-t">
          <label class="form-label-t">Correo electrónico</label>
          <input v-model="email" type="email" class="form-control-t" />
        </div>
      </section>

      <!-- Password -->
      <section class="profile-section">
        <h2 class="section-title">Cambiar contraseña <span class="section-title--muted">(opcional)</span></h2>

        <div class="form-group-t">
          <label class="form-label-t">Contraseña actual</label>
          <input v-model="oldPassword" type="password" class="form-control-t"
            placeholder="Requerida para cambiar contraseña" />
        </div>

        <div class="form-group-t">
          <label class="form-label-t">Nueva contraseña</label>
          <input v-model="newPassword" type="password" class="form-control-t" />
        </div>

        <div class="form-group-t">
          <label class="form-label-t">Confirmar nueva contraseña</label>
          <input v-model="confirmPassword" type="password" class="form-control-t" />
        </div>
      </section>

      <!-- Save button full width -->
      <div class="profile-actions">
        <button type="submit" class="btn-filled profile-save-btn" :disabled="auth.loading">
          {{ auth.loading ? 'Guardando…' : 'Guardar cambios' }}
        </button>
      </div>

    </form>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem 1.5rem;
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.profile-header {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--hr-color);
}

.profile-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #3f51b5;
  color: #fff;
  font-size: 2rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  letter-spacing: 0;
}

.profile-name {
  font-size: 1.6rem;
  font-weight: 800;
  margin: 0;
  color: var(--text-primary);
  line-height: 1.2;
}

.profile-email-label {
  margin: 0.2rem 0 0;
  font-size: 0.9rem;
  color: var(--text-muted);
}

/* ── Messages ────────────────────────────────────────────────────────────── */
.profile-success {
  background: rgba(39,174,96,0.1);
  border: 1px solid rgba(39,174,96,0.35);
  border-left: 4px solid var(--success-color);
  border-radius: 8px;
  color: var(--success-color);
  padding: 0.65rem 1rem;
  font-size: 0.9rem;
  margin-bottom: 1.25rem;
}

.profile-error {
  background: rgba(192,57,43,0.1);
  border: 1px solid rgba(192,57,43,0.35);
  border-left: 4px solid var(--error-color);
  border-radius: 8px;
  color: var(--error-color);
  padding: 0.65rem 1rem;
  font-size: 0.9rem;
  margin-bottom: 1.25rem;
}

/* ── Two-column grid ─────────────────────────────────────────────────────── */
.profile-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  align-items: start;
}

.profile-section {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: var(--card-shadow);
}

.section-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 1.25rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--hr-color);
}

.section-title--muted {
  font-size: 0.82rem;
  font-weight: 400;
  color: var(--text-muted);
}

/* ── Save button ─────────────────────────────────────────────────────────── */
.profile-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
}

.profile-save-btn {
  padding: 0.6rem 2.5rem;
  font-size: 0.95rem;
}

@media (max-width: 680px) {
  .profile-grid { grid-template-columns: 1fr; }
  .profile-actions { justify-content: stretch; }
  .profile-save-btn { width: 100%; text-align: center; }
}
</style>
