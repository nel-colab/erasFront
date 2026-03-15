<script setup>
import { ref, onMounted } from 'vue'
import Navbar from './components/Navbar.vue'
import { useThemeStore } from './store/theme'

const showWelcomeModal = ref(false)

const theme = useThemeStore()

const version = "v1.2.3"

onMounted(() => {
  theme.init()

  if (!localStorage.getItem("welcomeModalSeen")) {
    showWelcomeModal.value = true
  }
})

const closeWelcomeModal = () => {
  localStorage.setItem("welcomeModalSeen", "true")
  showWelcomeModal.value = false
}
</script>

<template>
  <nav>
    <Navbar />
  </nav>

  <main class="container-fluid mt-5 pt-4">
    <div style="max-width:1800px;margin:auto;">
      <div class="col">
        <router-view />
      </div>
    </div>
  </main>

<!-- Welcome Modal -->
<div
  v-if="showWelcomeModal"
  class="modal-overlay"
  @click="closeWelcomeModal"
>
  <div class="modal-box" @click.stop>

    <h2>Disclaimer</h2>

    <p>
      None of the card images on this site belong to us; they all come from different
      websites and belong to their respective owners. We do not claim ownership; we
      simply want to create a fun collectible card game with beautiful illustrations.
      If you are an artist and would like us to remove your work, please contact us
      and we will do so as soon as possible. If you are interested in collaborating
      with us, you can also contact us: click the WhatsApp icon in the upper right
      corner to join our WhatsApp group.
    </p>

    <button class="btn-filled" @click="closeWelcomeModal">
      Enter Site
    </button>

  </div>
</div>

<div class="version-tag">
  {{ version }}
</div>
</template>

<style>
.modal-overlay{
  position: fixed;
  inset: 0;

  background: rgba(0,0,0,0.6);

  display: flex;
  align-items: center;
  justify-content: center;

  z-index: 9999;
}

.modal-box{
  background: var(--card-bg, #1e1e1e);
  border: 1px solid var(--card-border, #333);
  border-radius: 10px;

  padding: 2rem;
  width: 520px;
  max-width: 90%;

  color: var(--text-primary, white);

  box-shadow: 0 10px 40px rgba(0,0,0,0.6);
}

.version-tag{
  position: fixed;

  bottom: 10px;
  right: 14px;

  font-size: 0.7rem;
  font-weight: 600;

  color: var(--text-muted);
  background: rgba(0,0,0,0.4);

  padding: 3px 8px;
  border-radius: 6px;

  backdrop-filter: blur(4px);

  z-index: 9999;
  pointer-events: none;
}
</style>