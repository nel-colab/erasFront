<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router'
import { useGameStore } from '@/store/game'
import { useAuthStore } from '@/store/login'
import PlayerHalf         from '@/components/simulator/PlayerHalf.vue'
import SharedCounter      from '@/components/simulator/SharedCounter.vue'
import StarterSelectModal from '@/components/simulator/StarterSelectModal.vue'
import MulliganModal      from '@/components/simulator/MulliganModal.vue'
import TargetingOverlay   from '@/components/simulator/TargetingOverlay.vue'
import DecklistModal      from '@/components/simulator/DecklistModal.vue'

const router = useRouter()
const route  = useRoute()
const game   = useGameStore()
const auth   = useAuthStore()

const roomId     = route.params.roomId
const optsOpen        = ref(false)
const showEndModal    = ref(false)
const startGameOpen   = ref(false)
const showDecklist    = ref(false)

const isLoading          = computed(() => game.connected && !game.myState)
const isWaiting          = computed(() => game.roomStatus === 'WAITING')
const isSelectingStarter = computed(() => game.roomStatus === 'SELECTING_STARTER')
const isMulligan         = computed(() => game.roomStatus === 'MULLIGAN')
const isPostGame         = computed(() => game.roomStatus === 'POST_GAME')
const isFinished         = computed(() => game.roomStatus === 'FINISHED')
const isInProgress       = computed(() => game.roomStatus === 'IN_PROGRESS')

// When change-deck resolves: backend sets WAITING, navigate back to lobby
let prevStatus = null
watch(() => game.roomStatus, (newStatus) => {
  if (prevStatus === 'POST_GAME' && newStatus === 'WAITING') {
    router.replace(`/simulator/${roomId}`)
  }
  prevStatus = newStatus
})

// Post-game state
const surrendererId = ref(null)
watch(() => game.gameState?.event, (ev) => {
  if (ev === 'SURRENDER') surrendererId.value = game.gameState?.actorId ?? null
})

const iSurrendered = computed(() => surrendererId.value === auth.userId)

// What option did the surrenderer pick (if any)
const surrendererChoice = computed(() => {
  if (!surrendererId.value) return null
  return game.postGameChoices[surrendererId.value] ?? null
})

// Which options are available to ME as opponent
const myPostGameOptions = computed(() => {
  if (iSurrendered.value) return ['new_game', 'change_deck', 'exit']
  const sc = surrendererChoice.value
  if (sc === 'exit') return ['exit']
  if (sc === 'change_deck') return ['change_deck', 'exit']
  return ['new_game', 'change_deck', 'exit']
})

const myChoice = computed(() => game.postGameChoices[auth.userId] ?? null)

const myState       = computed(() => game.myState)
const opponentState = computed(() => game.opponentState)


onMounted(() => {
  if (!game.roomId || !game.connected) {
    router.replace(`/simulator/${roomId}`)
  }
})

onBeforeRouteLeave((_to, _from, next) => {
  if (game.roomStatus === 'IN_PROGRESS') {
    const ok = confirm('¿Salir de la partida?')
    if (ok) { game.disconnect(); next() }
    else next(false)
  } else {
    game.disconnect()
    next()
  }
})

const roomLink = computed(() => `${window.location.origin}/simulator/${roomId}`)
function copyLink() { navigator.clipboard.writeText(roomLink.value) }

// ── Opciones ──────────────────────────────────────────────────────────────────
function toggleOpts() { optsOpen.value = !optsOpen.value }

function onVerMazo() { optsOpen.value = false; showDecklist.value = true }

function onSalir() {
  optsOpen.value = false
  const ok = game.roomStatus === 'IN_PROGRESS'
    ? confirm('¿Salir de la partida? El juego continuará sin ti.')
    : true
  if (ok) { game.disconnect(); router.replace('/home') }
}

function onIniciarPartida() {
  optsOpen.value = false
  startGameOpen.value = true
}

function pickFirstPlayer(id) {
  startGameOpen.value = false
  game.startGame(id)
}

function onRendirse() {
  optsOpen.value = false
  const ok = confirm('¿Rendirse?')
  if (!ok) return
  game.surrender()
}

function onPostGameChoice(choice) {
  game.postGameChoice(choice)
}

function goHome() {
  game.disconnect()
  router.replace('/home')
}

function goNewGame() {
  game.disconnect()
  router.replace('/simulator')
}
</script>

<template>
  <div class="board-root" @click="optsOpen = false">

    <!-- Non-blocking waiting banner — only while opponent hasn't joined yet -->
    <div v-if="game.roomStatus === 'WAITING' && !opponentState" class="waiting-banner">
      <div class="waiting-spinner-sm" />
      <span class="waiting-text">Esperando oponente</span>
      <input class="waiting-link-input" readonly :value="roomLink" />
      <button class="btn-copy" @click.stop="copyLink" title="Copiar enlace">Copiar</button>
    </div>

    <!-- Start game picker (host only) -->
    <Teleport to="body">
      <div v-if="startGameOpen" class="end-overlay" @click.self="startGameOpen = false">
        <div class="end-box">
          <h3 class="end-title">¿Quién empieza?</h3>
          <div class="end-btns" style="flex-direction:column;gap:0.5rem">
            <button class="end-btn primary" @click="pickFirstPlayer(myState?.userId)">
              {{ myState?.username ?? 'Yo' }} (Yo)
            </button>
            <button class="end-btn" @click="pickFirstPlayer('random')">
              <i class="bi bi-shuffle" /> Aleatorio
            </button>
            <button class="end-btn" @click="pickFirstPlayer(opponentState?.userId)">
              {{ opponentState?.username ?? 'Oponente' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Post-game overlay -->
    <Teleport to="body">
      <div v-if="isPostGame || isFinished" class="end-overlay">
        <div class="end-box">
          <h3 class="end-title">
            {{ iSurrendered ? 'Te rendiste' : 'El oponente se rindió' }}
          </h3>

          <div v-if="!myChoice" class="end-btns" style="flex-direction:column;gap:0.5rem">
            <button
              v-if="myPostGameOptions.includes('new_game')"
              class="end-btn primary"
              @click="onPostGameChoice('new_game')"
            >
              <i class="bi bi-arrow-repeat" /> Nueva partida (mismo mazo)
            </button>
            <button
              v-if="myPostGameOptions.includes('change_deck')"
              class="end-btn"
              @click="onPostGameChoice('change_deck')"
            >
              <i class="bi bi-collection" /> Cambiar mazo
            </button>
            <button
              v-if="myPostGameOptions.includes('exit')"
              class="end-btn danger"
              @click="onPostGameChoice('exit')"
            >
              <i class="bi bi-box-arrow-left" /> Salir
            </button>
          </div>

          <div v-else class="end-btns" style="flex-direction:column">
            <p class="end-sub">Esperando al oponente...</p>
            <div class="pg-spinner" />
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Loading overlay — waiting for JOIN_ROOM acknowledgment -->
    <div v-if="isLoading" class="joining-overlay">
      <div class="joining-spinner" />
      <span class="joining-text">Cargando partida...</span>
    </div>

    <!-- Error banner -->
    <div v-if="game.error" class="error-banner">{{ game.error }}</div>

    <!-- Deck warning banner (auto-dismisses after 10s) -->
    <Transition name="warn-slide">
      <div v-if="game.deckWarning" class="deck-warn-banner">
        <i class="bi bi-exclamation-triangle-fill" />
        {{ game.deckWarning }}
        <button class="warn-dismiss" @click="game.deckWarning = null">✕</button>
      </div>
    </Transition>

    <!-- Targeting SVG overlay -->
    <TargetingOverlay />

    <!-- Decklist modal -->
    <DecklistModal v-if="showDecklist" @close="showDecklist = false" />

    <!-- Card reveal popup (both players see this for 3s) -->
    <div v-if="game.revealedCards.length" class="reveal-container">
      <TransitionGroup name="reveal-pop" tag="div" class="reveal-inner">
        <div v-for="card in game.revealedCards" :key="card.id" class="reveal-popup">
          <div class="reveal-label">Carta añadida</div>
          <img :src="card.imageUrl" class="reveal-img" alt="" />
          <div v-if="card.name" class="reveal-name">{{ card.name }}</div>
        </div>
      </TransitionGroup>
    </div>

    <!-- Starter selection overlay -->
    <StarterSelectModal v-if="isSelectingStarter" />

    <!-- Mulligan overlay -->
    <MulliganModal v-if="isMulligan" />

    <!-- Opponent half -->
    <PlayerHalf
      v-if="opponentState"
      :state="opponentState"
      :isOpponent="true"
    />
    <div v-else class="half-placeholder opponent-placeholder">
      <span>Oponente aún no conectado</span>
    </div>

    <!-- Controls bar: turn info + counter + opciones -->
    <div class="controls-bar">
      <div class="ctrl-left">
        <span
          class="turn-badge"
          :class="{
            mine: game.isMyTurn,
            opp:  !game.isMyTurn && game.gameState?.status === 'IN_PROGRESS',
          }"
        >
          {{ game.isMyTurn ? 'Tu turno' : (game.gameState?.status === 'IN_PROGRESS' ? 'Turno Oponente' : '—') }}
        </span>
        <button
          v-if="game.currentPhase === 'MAIN'"
          class="ctrl-btn phase-btn"
          :disabled="!game.isMyTurn"
          @click.stop="game.enterEndPhase()"
          title="Entrar en fase final"
        >
          <i class="bi bi-hourglass-split" /> Fase Final
        </button>
        <button
          v-else
          class="ctrl-btn pass-btn"
          :disabled="!game.isMyTurn"
          @click.stop="game.endTurn()"
          title="Terminar turno"
        >
          <i class="bi bi-arrow-right-circle" /> Terminar Turno
        </button>
      </div>

      <SharedCounter />

      <div class="ctrl-right" @click.stop>
        <button class="ctrl-btn opts-btn" @click="toggleOpts">
          <i class="bi bi-gear" /> Opciones
        </button>
        <div v-if="optsOpen" class="opts-dropdown">
          <button
            class="opts-item"
            :disabled="!isWaiting || !game.isHost || !opponentState"
            @click="onIniciarPartida"
          >
            <i class="bi bi-play-circle" /> Iniciar partida
          </button>
          <div class="opts-sep" />
          <button class="opts-item" @click="onVerMazo">
            <i class="bi bi-card-list" /> Ver mazo
          </button>
          <div class="opts-sep" />
          <button class="opts-item" @click="onSalir">
            <i class="bi bi-box-arrow-left" /> Salir al inicio
          </button>
          <div class="opts-sep" />
          <button
            class="opts-item danger"
            :disabled="!isInProgress"
            @click="onRendirse"
          >
            <i class="bi bi-flag" /> Rendirse
          </button>
        </div>
      </div>
    </div>

    <!-- Player half -->
    <PlayerHalf
      v-if="myState"
      :state="myState"
      :isOpponent="false"
    />
    <div v-else class="half-placeholder player-placeholder">
      <span>Conectando...</span>
    </div>

  </div>
</template>

<style scoped>
.board-root {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #141418;
  z-index: 200;
  overflow: hidden;
}

/* ── Halves ─────────────────────────────────── */
.half-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255,255,255,0.2);
  font-size: 0.8rem;
}

/* ── Controls bar ─────────────────────────── */
.controls-bar {
  height: 48px;
  flex-shrink: 0;
  background: #0c0c0f;
  border-top: 1px solid rgba(255,255,255,0.06);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
  gap: 0.4rem;
}

.ctrl-left,
.ctrl-right {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex: 0 0 236px;
}

.ctrl-right { position: relative; justify-content: flex-end; }

.turn-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.18rem 0.5rem;
  border-radius: 10px;
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.45);
  white-space: nowrap;
}
.turn-badge.mine {
  background: rgba(76,175,80,0.22);
  color: #81c784;
}
.turn-badge.opp {
  background: rgba(239,68,68,0.2);
  color: #f87171;
}

.ctrl-btn {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 5px;
  color: rgba(255,255,255,0.7);
  font-size: 0.68rem;
  padding: 0.22rem 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.2rem;
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
}
.ctrl-btn:hover:not(:disabled) { background: rgba(255,255,255,0.14); color: #fff; }
.ctrl-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.phase-btn { border-color: rgba(251,191,36,0.3); }
.phase-btn:hover:not(:disabled) { background: rgba(251,191,36,0.15); color: #fbbf24; }
.pass-btn { border-color: rgba(76,175,80,0.3); }
.pass-btn:hover:not(:disabled) { background: rgba(76,175,80,0.15); color: #81c784; }

/* ── Opciones dropdown ─────────────────────── */
.opts-btn { border-color: rgba(165,180,252,0.3); }
.opts-btn:hover { background: rgba(99,102,241,0.15); color: #a5b4fc; }

.opts-dropdown {
  position: absolute;
  bottom: calc(100% + 6px);
  right: 0;
  background: #1e2333;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 8px;
  padding: 0.3rem 0;
  min-width: 180px;
  box-shadow: 0 -6px 20px rgba(0,0,0,0.7);
  z-index: 600;
}
.opts-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  color: rgba(255,255,255,0.8);
  font-size: 0.78rem;
  padding: 0.45rem 1rem;
  cursor: pointer;
  transition: background 0.1s;
}
.opts-item:hover { background: rgba(255,255,255,0.08); }
.opts-item.danger { color: #ef9a9a; }
.opts-item.danger:hover:not(:disabled) { background: rgba(239,154,154,0.1); }
.opts-item:disabled { opacity: 0.35; cursor: default; }
.opts-sep { height: 1px; background: rgba(255,255,255,0.08); margin: 0.2rem 0; }

.end-btn.danger {
  background: rgba(239,68,68,0.2);
  border-color: rgba(239,68,68,0.4);
  color: #fca5a5;
}
.end-btn.danger:hover { background: rgba(239,68,68,0.35); color: #fff; }

.pg-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255,255,255,0.15);
  border-top-color: #81c784;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0.5rem auto;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Waiting banner ───────────────────────── */
.waiting-banner {
  flex-shrink: 0;
  height: 36px;
  background: rgba(0,0,0,0.4);
  border-bottom: 1px solid rgba(255,193,7,0.35);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.75rem;
  z-index: 10;
}
.waiting-spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.15);
  border-top-color: #81c784;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
.waiting-text {
  font-size: 0.7rem;
  color: rgba(255,193,7,0.9);
  font-weight: 600;
  flex-shrink: 0;
}
.waiting-link-input {
  flex: 1;
  max-width: 280px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 5px;
  color: rgba(255,255,255,0.7);
  padding: 0.15rem 0.4rem;
  font-size: 0.65rem;
  outline: none;
}
.btn-copy {
  font-size: 0.65rem;
  padding: 0.18rem 0.55rem;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 5px;
  color: rgba(255,255,255,0.75);
  cursor: pointer;
  flex-shrink: 0;
}
.btn-copy:hover { background: rgba(255,255,255,0.15); color: #fff; }

/* ── End overlay ──────────────────────────── */
.end-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.75);
  z-index: 400;
  display: flex;
  align-items: center;
  justify-content: center;
}
.end-box {
  background: #1a2033;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 14px;
  padding: 2rem 2.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  min-width: 300px;
}
.end-title {
  color: #e0e0e0;
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0;
}
.end-sub {
  color: rgba(255,255,255,0.45);
  font-size: 0.82rem;
  margin: 0;
}
.end-btns {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
.end-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 1.2rem;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.75);
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.end-btn:hover { background: rgba(255,255,255,0.14); color: #fff; }
.end-btn.primary {
  background: rgba(99,102,241,0.3);
  border-color: rgba(99,102,241,0.6);
  color: #a5b4fc;
}
.end-btn.primary:hover { background: rgba(99,102,241,0.5); color: #fff; }

/* ── Card reveal popup ────────────────────── */
.reveal-container {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2000;
  pointer-events: none;
}
.reveal-inner {
  display: flex;
  flex-direction: row;
  gap: 1rem;
  align-items: flex-start;
}
.reveal-popup {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}
.reveal-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.6);
  background: rgba(0,0,0,0.7);
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
}
.reveal-img {
  width: 160px;
  height: 224px;
  object-fit: cover;
  border-radius: 8px;
  border: 2px solid rgba(255,255,255,0.3);
  box-shadow: 0 8px 40px rgba(0,0,0,0.9);
}
.reveal-name {
  font-size: 0.7rem;
  font-weight: 700;
  color: #e0e0e0;
  background: rgba(0,0,0,0.7);
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
  max-width: 160px;
  text-align: center;
}
.reveal-pop-enter-active { transition: opacity 0.25s, transform 0.25s; }
.reveal-pop-leave-active { transition: opacity 0.4s, transform 0.4s; }
.reveal-pop-enter-from  { opacity: 0; transform: scale(0.8); }
.reveal-pop-leave-to    { opacity: 0; transform: scale(1.05); }

/* ── Joining overlay ──────────────────────── */
.joining-overlay {
  position: fixed;
  inset: 0;
  z-index: 500;
  background: rgba(0,0,0,0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}
.joining-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255,255,255,0.12);
  border-top-color: #81c784;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.joining-text {
  font-size: 0.85rem;
  color: rgba(255,255,255,0.6);
  font-weight: 600;
}

/* ── Error banner ─────────────────────────── */
.error-banner {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(239,154,154,0.9);
  color: #b71c1c;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.35rem 1rem;
  border-radius: 0 0 8px 8px;
  z-index: 400;
}

/* ── Deck warning banner ──────────────────── */
.deck-warn-banner {
  position: absolute;
  top: 36px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(234,179,8,0.92);
  color: #1a1200;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.3rem 2.2rem 0.3rem 0.75rem;
  border-radius: 0 0 8px 8px;
  z-index: 400;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
  box-shadow: 0 2px 12px rgba(0,0,0,0.4);
}
.warn-dismiss {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: rgba(0,0,0,0.5);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
}
.warn-dismiss:hover { color: #000; }

.warn-slide-enter-active { transition: opacity 0.2s, transform 0.2s; }
.warn-slide-leave-active { transition: opacity 0.3s, transform 0.3s; }
.warn-slide-enter-from  { opacity: 0; transform: translateX(-50%) translateY(-8px); }
.warn-slide-leave-to    { opacity: 0; transform: translateX(-50%) translateY(-8px); }
</style>
