<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../store/login'

const route = useRoute()
const auth  = useAuthStore()

type Status = 'loading' | 'success' | 'error'
const status = ref<Status>('loading')

onMounted(async () => {
  const token = route.query.token as string
  if (!token) { status.value = 'error'; return }
  const ok = await auth.validateAccount({ tokenvalidate: token })
  status.value = ok ? 'success' : 'error'
})
</script>

<template>
  <div class="vp-page">
    <div class="auth-card vp-card">

      <div class="vp-brand">
        <span class="vp-brand-title">ERAS</span>
        <span class="vp-brand-sub">Trading Card Game</span>
      </div>

      <hr class="t-hr" />

      <!-- Loading -->
      <div v-if="status === 'loading'" class="vp-body">
        <div class="vp-spinner"></div>
        <p class="vp-hint">Verifying your account…</p>
      </div>

      <!-- Success -->
      <div v-else-if="status === 'success'" class="vp-body">
        <div class="vp-icon vp-icon--success">
          <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="26" cy="26" r="25" stroke="currentColor" stroke-width="2"/>
            <path d="M14 26.5l8.5 8.5 15-16" stroke="currentColor" stroke-width="2.5"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h2 class="vp-title">Cuenta verificada!</h2>
        <p class="vp-desc">Tu correo ha sido confirmado. Ya puedes ingresar al sitio y disfrutar de sus funcionalidades.</p>
        <router-link to="/login" class="btn-primary-t vp-btn">Iniciar sesión</router-link>
      </div>

      <!-- Error -->
      <div v-else class="vp-body">
        <div class="vp-icon vp-icon--error">
          <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="26" cy="26" r="25" stroke="currentColor" stroke-width="2"/>
            <path d="M18 18l16 16M34 18L18 34" stroke="currentColor" stroke-width="2.5"
                  stroke-linecap="round"/>
          </svg>
        </div>
        <h2 class="vp-title">Verificación fallida</h2>
        <p class="vp-desc">El link de verificación es inválido o ha expirado.</p>
        <router-link to="/register" class="btn-primary-t vp-btn">Volver al registro</router-link>
      </div>

    </div>
  </div>
</template>

<style scoped>
.vp-page {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: var(--page-bg);
  z-index: 1;
}

.vp-card {
  text-align: center;
  max-width: 420px;
  width: 100%;
}

.vp-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  margin-bottom: 0.5rem;
}
.vp-brand-title {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: #c9a84c;
  font-family: 'Georgia', serif;
}
.vp-brand-sub {
  font-size: 0.6rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.vp-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0 0.25rem;
}

.vp-spinner {
  width: 52px;
  height: 52px;
  border: 3px solid var(--input-border);
  border-top-color: #c9a84c;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.vp-hint {
  color: var(--text-muted);
  font-size: 0.85rem;
  margin: 0;
}

.vp-icon { width: 60px; height: 60px; }
.vp-icon--success { color: var(--success-color); }
.vp-icon--error   { color: var(--error-color); }
.vp-icon svg { width: 100%; height: 100%; }

.vp-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
.vp-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.55;
}

.vp-btn {
  display: inline-block;
  width: auto;
  padding: 0.65rem 2rem;
  margin-top: 0.25rem;
  text-decoration: none;
  border-radius: 6px;
  font-size: 0.9rem;
}
</style>
