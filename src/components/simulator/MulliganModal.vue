<script setup>
import { ref, computed } from 'vue'
import { useGameStore } from '@/store/game'

const game = useGameStore()

const top5 = computed(() => (game.myState?.deck ?? []).slice(0, 5))
const selected = ref(new Set())  // instanceIds to send to bottom
const confirmed = ref(false)

function toggle(instanceId) {
  if (confirmed.value) return
  const s = new Set(selected.value)
  if (s.has(instanceId)) s.delete(instanceId)
  else s.add(instanceId)
  selected.value = s
}

function confirm() {
  confirmed.value = true
  game.confirmMulligan([...selected.value])
}
</script>

<template>
  <div class="mul-overlay">
    <div class="mul-box">
      <h2 class="mul-title">Mulligán</h2>
      <p class="mul-sub">
        {{ confirmed
          ? 'Esperando al oponente...'
          : 'Selecciona las cartas a enviar al fondo del mazo. El resto quedará en tu mano.' }}
      </p>

      <div v-if="!confirmed" class="mul-cards">
        <button
          v-for="card in top5"
          :key="card.instanceId"
          class="mul-card"
          :class="{ selected: selected.has(card.instanceId) }"
          @click="toggle(card.instanceId)"
        >
          <img
            v-if="card.imageUrl"
            :src="card.imageUrl"
            class="mul-card-img"
            alt=""
          />
          <div v-else class="mul-card-back" />
          <div v-if="selected.has(card.instanceId)" class="mul-bottom-badge">↓ Fondo</div>
        </button>
      </div>

      <div v-if="!confirmed" class="mul-footer">
        <span class="mul-hint">
          {{ selected.size > 0 ? `${selected.size} carta(s) al fondo` : 'Ninguna al fondo (guarda todas)' }}
        </span>
        <button class="mul-confirm-btn" @click="confirm">Confirmar</button>
      </div>

      <div v-else class="mul-waiting">
        <div class="mul-spinner" />
        <span>Oponente en mulligán...</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mul-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.88);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.mul-box {
  background: #1a2033;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 14px;
  padding: 1.8rem 2rem;
  max-width: 680px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  align-items: center;
}
.mul-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #e0e0e0;
  margin: 0;
}
.mul-sub {
  font-size: 0.8rem;
  color: rgba(255,255,255,0.45);
  margin: 0;
  text-align: center;
}
.mul-cards {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}
.mul-card {
  position: relative;
  background: none;
  border: 2px solid rgba(255,255,255,0.15);
  border-radius: 7px;
  padding: 0;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s, opacity 0.15s;
  overflow: hidden;
}
.mul-card:hover { border-color: rgba(251,191,36,0.5); transform: translateY(-4px); }
.mul-card.selected {
  border-color: #ef4444;
  opacity: 0.75;
}
.mul-card-img {
  display: block;
  width: 88px;
  height: 123px;
  object-fit: cover;
}
.mul-card-back {
  width: 88px;
  height: 123px;
  background: linear-gradient(135deg,#1a237e,#283593);
}
.mul-bottom-badge {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(239,68,68,0.85);
  color: #fff;
  font-size: 0.6rem;
  font-weight: 700;
  text-align: center;
  padding: 0.15rem;
}
.mul-footer {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  justify-content: center;
}
.mul-hint {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.4);
}
.mul-confirm-btn {
  padding: 0.5rem 1.4rem;
  background: rgba(76,175,80,0.25);
  border: 1px solid rgba(76,175,80,0.5);
  border-radius: 8px;
  color: #a5d6a7;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.mul-confirm-btn:hover { background: rgba(76,175,80,0.4); color: #fff; }
.mul-waiting {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem;
  color: rgba(255,255,255,0.5);
  font-size: 0.85rem;
}
.mul-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255,255,255,0.15);
  border-top-color: #81c784;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
