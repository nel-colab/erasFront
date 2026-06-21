<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/store/login'
import { useDecksStore } from '@/store/decks'
import { useGameStore } from '@/store/game'
import axios from 'axios'

const router     = useRouter()
const route      = useRoute()
const auth       = useAuthStore()
const decksStore = useDecksStore()
const game       = useGameStore()

if (!auth.isAuthenticated) router.replace('/login')

const roomId          = ref(route.params.roomId || null)
const selectedDeck    = ref(null)
const loading         = ref(false)
const joining         = ref(false)
const error           = ref(null)
const copied          = ref(false)
const isReconnecting  = ref(false)
const roomStatus      = ref(null)
const checkingRoom    = ref(false)

const allDecks = computed(() => {
  const mine = decksStore.myDecks
  const pub  = decksStore.publicDecks
  const ids  = new Set(mine.map(d => d.id))
  return [...mine, ...pub.filter(d => !ids.has(d.id))]
})

const statusLabel = computed(() => {
  const map = { WAITING: 'Esperando oponente', IN_PROGRESS: 'En curso', SELECTING_STARTER: 'Seleccionando starter', MULLIGAN: 'Mulligan', POST_GAME: 'Post partida', FINISHED: 'Finalizada' }
  return map[roomStatus.value] ?? roomStatus.value ?? ''
})

onMounted(async () => {
  await Promise.all([
    decksStore.loadPublic(),
    decksStore.loadMine(auth.userId),
  ])

  if (roomId.value) {
    checkingRoom.value = true
    try {
      const { data } = await axios.get(`/api/simulator/rooms/${roomId.value}`)
      roomStatus.value = data.status
      if ((data.playerIds ?? []).includes(auth.userId)) {
        isReconnecting.value = true
      }
    } catch {
      // Room not found or error — treat as fresh join
    } finally {
      checkingRoom.value = false
    }
  }
})

async function createRoom() {
  if (!selectedDeck.value) { error.value = 'Selecciona un mazo primero'; return }
  loading.value = true
  error.value   = null
  try {
    const { data } = await axios.post('/api/simulator/rooms')
    roomId.value = data.roomId
    router.replace(`/simulator/${data.roomId}`)
  } catch (e) {
    error.value = e?.response?.data?.error || 'Error al crear la sala'
  } finally {
    loading.value = false
  }
}

function waitConnected(maxMs = 5000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + maxMs
    const iv = setInterval(() => {
      if (game.connected) { clearInterval(iv); resolve() }
      else if (Date.now() > deadline) { clearInterval(iv); reject(new Error('timeout')) }
    }, 100)
  })
}

async function enterGame() {
  if (!selectedDeck.value) { error.value = 'Selecciona un mazo primero'; return }
  if (!roomId.value)        { error.value = 'No hay sala seleccionada'; return }
  joining.value = true
  error.value   = null
  try {
    game.connect(roomId.value)
    await waitConnected()
    game.joinRoom(selectedDeck.value, auth.username)
    router.push(`/simulator/${roomId.value}/board`)
  } catch (e) {
    error.value = 'No se pudo conectar al servidor'
    game.disconnect()
  } finally {
    joining.value = false
  }
}

async function reconnectGame() {
  joining.value = true
  error.value   = null
  try {
    game.connect(roomId.value)
    await waitConnected()
    game.joinRoom(null, auth.username)
    router.push(`/simulator/${roomId.value}/board`)
  } catch (e) {
    error.value = 'No se pudo conectar al servidor'
    game.disconnect()
  } finally {
    joining.value = false
  }
}

const roomLink = computed(() =>
  roomId.value ? `${window.location.origin}/simulator/${roomId.value}` : ''
)

function copyLink() {
  navigator.clipboard.writeText(roomLink.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<template>
  <div class="sim-lobby">
    <h2 class="sim-title">Simulador</h2>

    <!-- Reconnect panel — shown when user is already in the room -->
    <div v-if="isReconnecting" class="sim-card reconnect-card">
      <div class="reconnect-icon"><i class="bi bi-arrow-repeat" /></div>
      <h3 class="section-title" style="margin:0">Ya estás en esta sala</h3>
      <p class="sim-hint" style="margin:0">
        Estado: <strong>{{ statusLabel }}</strong> · Tu mazo y estado de juego se conservan.
      </p>
      <button
        class="btn-filled"
        :disabled="joining"
        @click="reconnectGame"
      >
        {{ joining ? 'Conectando...' : 'Volver a la partida' }}
      </button>
      <div class="reconnect-sep">o entra con un mazo nuevo (solo si la partida aún no empezó)</div>
    </div>

    <!-- Deck selection — always visible, but entering with deck only makes sense for new joins or WAITING rooms -->
    <div class="sim-card">
      <h3 class="section-title">Elige tu mazo</h3>
      <div v-if="allDecks.length === 0" class="sim-empty">No hay mazos disponibles.</div>
      <div class="deck-grid">
        <button
          v-for="deck in allDecks"
          :key="deck.id"
          class="deck-opt"
          :class="{ selected: selectedDeck === deck.id }"
          @click="selectedDeck = deck.id"
        >
          <img v-if="deck.deckImage" :src="deck.deckImage" class="deck-thumb" alt="" />
          <div v-else class="deck-thumb deck-thumb-empty">?</div>
          <span class="deck-name">{{ deck.deckName }}</span>
        </button>
      </div>
    </div>

    <div v-if="error" class="sim-error">{{ error }}</div>

    <!-- No room yet -->
    <div v-if="!roomId" class="sim-actions">
      <button class="btn-filled" :disabled="loading || !selectedDeck" @click="createRoom">
        {{ loading ? 'Creando...' : 'Crear sala' }}
      </button>
    </div>

    <!-- Room ready — enter with selected deck -->
    <div v-else class="sim-card">
      <h3 class="section-title">Sala <code class="room-code">{{ roomId }}</code></h3>
      <p class="sim-hint">Comparte este enlace con tu oponente y luego entra al juego:</p>
      <div class="room-link-row">
        <input class="room-link-input" readonly :value="roomLink" />
        <button class="btn-ghost btn-sm" @click="copyLink">
          {{ copied ? 'Copiado' : 'Copiar' }}
        </button>
      </div>
      <button
        class="btn-filled"
        style="margin-top:1rem"
        :disabled="joining || !selectedDeck"
        @click="enterGame"
      >
        {{ joining ? 'Conectando...' : (isReconnecting ? 'Entrar con nuevo mazo' : 'Entrar al juego') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.sim-lobby {
  padding: 5.5rem 1.5rem 4rem;
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.sim-title { font-size: 1.6rem; font-weight: 700; color: var(--text-primary); margin: 0; }
.sim-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 1.4rem 1.6rem;
}
.section-title { font-size: 0.9rem; font-weight: 700; color: var(--text-primary); margin: 0 0 1rem; }
.sim-empty { color: var(--text-muted); font-size: 0.8rem; }
.sim-error { color: var(--error-color); font-size: 0.8rem; }
.sim-hint  { font-size: 0.8rem; color: var(--text-secondary); margin: 0 0 0.6rem; }
.sim-actions { display: flex; gap: 0.75rem; }

/* Reconnect card */
.reconnect-card {
  border-color: rgba(99,102,241,0.4);
  background: rgba(99,102,241,0.06);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}
.reconnect-icon {
  font-size: 1.6rem;
  color: #a5b4fc;
}
.reconnect-sep {
  font-size: 0.72rem;
  color: var(--text-muted);
  padding-top: 0.25rem;
  border-top: 1px solid var(--card-border);
  width: 100%;
}

.deck-grid { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.deck-opt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  background: var(--input-bg);
  border: 2px solid var(--card-border);
  border-radius: 8px;
  padding: 0.6rem;
  cursor: pointer;
  transition: border-color 0.15s;
  width: 90px;
}
.deck-opt.selected { border-color: #3f51b5; }
.deck-opt:hover:not(.selected) { border-color: var(--input-focus); }
.deck-thumb {
  width: 60px; height: 80px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--card-border);
  display: block;
}
.deck-thumb-empty {
  width: 60px; height: 80px;
  display: flex; align-items: center; justify-content: center;
  background: var(--card-bg);
  color: var(--text-muted);
  font-size: 1.2rem;
  border-radius: 4px;
  border: 1px solid var(--card-border);
}
.deck-name {
  font-size: 0.62rem;
  color: var(--text-primary);
  text-align: center;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-code {
  background: var(--input-bg);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #3f51b5;
}
.room-link-row { display: flex; gap: 0.5rem; align-items: center; }
.room-link-input {
  flex: 1;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 6px;
  color: var(--text-primary);
  padding: 0.35rem 0.6rem;
  font-size: 0.76rem;
  outline: none;
}
</style>
