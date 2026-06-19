<script setup>
import { computed } from 'vue'
import { useGameStore } from '@/store/game'
import { useAuthStore } from '@/store/login'

const game = useGameStore()
const auth = useAuthStore()

const myDeck = computed(() => game.myState?.deck ?? [])
const alreadySelected = computed(() => {
  const state = game.gameState
  if (!state?.players) return false
  // If my card is no longer in deck and IS on field, I've selected
  return game.myState?.field?.length > 0
})

function select(card) {
  if (alreadySelected.value) return
  game.selectStarter(card.instanceId)
}
</script>

<template>
  <div class="ss-overlay">
    <div class="ss-box">
      <h2 class="ss-title">Selecciona tu Starter</h2>
      <p class="ss-sub">
        {{ alreadySelected
          ? 'Esperando al oponente...'
          : 'Elige una carta de tu mazo para empezar en el campo.' }}
      </p>

      <div v-if="!alreadySelected" class="ss-grid">
        <button
          v-for="card in myDeck"
          :key="card.instanceId"
          class="ss-card"
          @click="select(card)"
        >
          <img
            v-if="card.imageUrl"
            :src="card.imageUrl"
            class="ss-card-img"
            alt=""
          />
          <div v-else class="ss-card-back" />
        </button>
      </div>

      <div v-else class="ss-waiting">
        <div class="ss-spinner" />
        <span>Oponente seleccionando...</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ss-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.88);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.ss-box {
  background: #1a2033;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 14px;
  padding: 1.8rem 2rem;
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.ss-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #e0e0e0;
  margin: 0;
  text-align: center;
}
.ss-sub {
  font-size: 0.8rem;
  color: rgba(255,255,255,0.45);
  margin: 0;
  text-align: center;
}
.ss-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  overflow-y: auto;
  max-height: 65vh;
  padding: 0.25rem;
}
.ss-card {
  background: none;
  border: 2px solid rgba(255,255,255,0.12);
  border-radius: 7px;
  padding: 0;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;
  overflow: hidden;
  flex-shrink: 0;
}
.ss-card:hover {
  border-color: #fbbf24;
  transform: translateY(-4px);
}
.ss-card-img {
  display: block;
  width: 80px;
  height: 112px;
  object-fit: cover;
}
.ss-card-back {
  width: 80px;
  height: 112px;
  background: linear-gradient(135deg,#1a237e,#283593);
}
.ss-waiting {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
  color: rgba(255,255,255,0.5);
  font-size: 0.85rem;
}
.ss-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255,255,255,0.15);
  border-top-color: #81c784;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
