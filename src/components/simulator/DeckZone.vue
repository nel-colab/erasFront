<script setup>
import { ref } from 'vue'
import DeckPeekModal from './DeckPeekModal.vue'
import { useGameStore } from '@/store/game'

const props = defineProps({
  count:      { type: Number,  default: 0  },
  deck:       { type: Array,   default: () => [] },
  isOpponent: { type: Boolean, default: false },
})

const game         = useGameStore()
const hovering     = ref(false)
const peekN        = ref(5)
const peekBottomN  = ref(5)
const showPeek     = ref(false)
const showPeekBot  = ref(false)
const deckRef      = ref(null)
const ctrlPos      = ref({ top: 0, right: 0 })
const deckDropOver = ref(false)

let hideTimer = null
function onEnter() {
  clearTimeout(hideTimer)
  if (!hovering.value && deckRef.value) {
    const rect = deckRef.value.getBoundingClientRect()
    ctrlPos.value = {
      top:   rect.top,
      right: window.innerWidth - rect.left + 6,
    }
  }
  hovering.value = true
}
function onLeave() {
  hideTimer = setTimeout(() => { hovering.value = false }, 200)
}

let clickTimer = null
function onDeckClick() {
  if (props.isOpponent || props.count === 0) return
  if (clickTimer) {
    clearTimeout(clickTimer)
    clickTimer = null
    game.drawCard()
    return
  }
  clickTimer = setTimeout(() => { clickTimer = null }, 250)
}

function sendTopToLife() {
  if (props.count === 0 || props.isOpponent) return
  game.moveCard(props.deck[0].instanceId, 'deck', 'lifeStack', undefined, undefined, 'top', null, true)
}

function openPeek() {
  const n = Math.max(1, Math.min(peekN.value || 1, props.count))
  peekN.value    = n
  showPeek.value = true
}

function openPeekBottom() {
  const n = Math.max(1, Math.min(peekBottomN.value || 1, props.count))
  peekBottomN.value = n
  showPeekBot.value = true
}

function confirmShuffle() {
  if (!window.confirm('¿Barajar el mazo?')) return
  game.shuffleDeck()
}

function confirmIncludeDiscard() {
  if (!window.confirm('¿Enviar el descarte al fondo del mazo (orden aleatorio)?')) return
  game.deckIncludeDiscard()
}

function confirmIncludeTribute() {
  if (!window.confirm('¿Enviar los tributos al fondo del mazo (orden aleatorio)?')) return
  game.deckIncludeTribute()
}

function onDeckDragOver(e) {
  if (props.isOpponent) return
  e.preventDefault()
  deckDropOver.value = true
}
function onDeckDragLeave() { deckDropOver.value = false }
function onDeckDrop(e) {
  if (props.isOpponent) return
  deckDropOver.value = false
  e.preventDefault()
  const raw = e.dataTransfer.getData('text/plain')
  if (!raw) return
  const { instanceId, fromZone } = JSON.parse(raw)
  game.moveCard(instanceId, fromZone, 'deck', undefined, undefined, 'top')
}
</script>

<template>
  <div
    ref="deckRef"
    class="deck-zone"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    <!-- Card stack with count overlaid -->
    <div
      class="deck-stack"
      :class="{ clickable: !isOpponent && count > 0, 'drop-active': deckDropOver }"
      :title="isOpponent
        ? `Mazo del oponente (${count})`
        : `Tu mazo (${count}) — doble clic robar · arrastra carta → tope`"
      @click="onDeckClick"
      @dragover="onDeckDragOver"
      @dragleave="onDeckDragLeave"
      @drop="onDeckDrop"
    >
      <div v-if="count > 0">
        <div class="card-back layer3" />
        <div class="card-back layer2" />
        <div class="card-back layer1" />
      </div>
      <div v-else class="deck-empty-shell">
        <div class="deck-empty-icon">∅</div>
      </div>
      <div class="deck-count-badge">{{ count }}</div>
    </div>

    <div class="deck-label">MAZO</div>

    <!-- Controls panel teleported to body so no overflow clip -->
    <Teleport to="body">
      <Transition name="deck-ctrl">
        <div
          v-if="hovering && !isOpponent"
          class="deck-controls"
          :style="{ top: ctrlPos.top + 'px', right: ctrlPos.right + 'px' }"
          @mouseenter="onEnter"
          @mouseleave="onLeave"
          @click.stop
        >
          <div class="peek-row">
            <input
              v-model.number="peekN"
              type="number"
              min="1"
              :max="count || 1"
              class="peek-input"
              @keydown.enter="openPeek"
            />
            <button class="dc-btn primary" :disabled="count === 0" @click="openPeek">↑ Ver</button>
          </div>
          <div class="peek-row">
            <input
              v-model.number="peekBottomN"
              type="number"
              min="1"
              :max="count || 1"
              class="peek-input"
              @keydown.enter="openPeekBottom"
            />
            <button class="dc-btn primary" :disabled="count === 0" @click="openPeekBottom">↓ Ver</button>
          </div>
          <button class="dc-btn" :disabled="count === 0" @click="confirmShuffle">Barajar</button>
          <button class="dc-btn" :disabled="count === 0" @click="sendTopToLife">Top → Vida</button>
          <button class="dc-btn" @click="confirmIncludeDiscard">+ Descarte</button>
          <button class="dc-btn" @click="confirmIncludeTribute">+ Tributos</button>
        </div>
      </Transition>
    </Teleport>

    <DeckPeekModal
      :visible="showPeek"
      :deck="deck"
      :n="peekN"
      @close="showPeek = false"
    />
    <DeckPeekModal
      :visible="showPeekBot"
      :deck="deck"
      :n="peekBottomN"
      :fromBottom="true"
      @close="showPeekBot = false"
    />
  </div>
</template>

<style scoped>
.deck-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.3rem;
  position: relative;
}

.deck-stack {
  position: relative;
  width: 68px;
  height: 95px;
  cursor: pointer;
}
.deck-stack.clickable:hover .card-back { border-color: rgba(255,255,255,0.55); }
.deck-stack.drop-active .card-back {
  border-color: rgba(99,102,241,0.8);
  box-shadow: 0 0 12px rgba(99,102,241,0.4);
}

.card-back {
  position: absolute;
  width: 64px;
  height: 90px;
  border-radius: 5px;
  border: 1px solid rgba(255,255,255,0.2);
  background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #1a237e 100%);
  transition: border-color 0.15s;
}
.layer1 { top: 0;   left: 2px; z-index: 3; }
.layer2 { top: 2px; left: 1px; z-index: 2; opacity: 0.7; }
.layer3 { top: 4px; left: 0;   z-index: 1; opacity: 0.4; }

.deck-empty-shell {
  position: absolute;
  inset: 0;
  border: 1px dashed rgba(255,255,255,0.12);
  border-radius: 5px;
}
.deck-empty-icon {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.2rem; color: rgba(255,255,255,0.15);
}

/* Count badge on top of card */
.deck-count-badge {
  position: absolute;
  bottom: 6px;
  right: 4px;
  z-index: 10;
  font-size: 0.8rem;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0,0,0,0.9);
  background: rgba(0,0,0,0.55);
  border-radius: 8px;
  padding: 0.05rem 0.3rem;
  line-height: 1.4;
}

.deck-label {
  font-size: 0.46rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.35);
  text-transform: uppercase;
}

/* Controls panel — teleported, fixed position */
:global(.deck-controls) {
  position: fixed;
  z-index: 500;
  background: #1e2333;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 130px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.7);
}
:global(.peek-row) { display: flex; gap: 0.3rem; }
:global(.peek-input) {
  width: 48px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 0.72rem;
  padding: 0.2rem 0.35rem;
  text-align: center;
}
:global(.peek-input:focus) { outline: none; border-color: rgba(99,102,241,0.6); }
:global(.dc-btn) {
  flex: 1;
  font-size: 0.65rem;
  padding: 0.25rem 0.4rem;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 5px;
  color: rgba(255,255,255,0.75);
  cursor: pointer;
  transition: background 0.1s;
  white-space: nowrap;
}
:global(.dc-btn:hover:not(:disabled)) { background: rgba(255,255,255,0.18); color: #fff; }
:global(.dc-btn:disabled) { opacity: 0.35; cursor: default; }
:global(.dc-btn.primary) {
  background: rgba(99,102,241,0.25);
  border-color: rgba(99,102,241,0.5);
  color: #a5b4fc;
}
:global(.dc-btn.primary:hover:not(:disabled)) { background: rgba(99,102,241,0.45); color: #fff; }

.deck-ctrl-enter-active, .deck-ctrl-leave-active { transition: opacity 0.12s, transform 0.12s; }
.deck-ctrl-enter-from, .deck-ctrl-leave-to { opacity: 0; transform: translateX(4px); }
</style>
