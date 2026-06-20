<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import CardToken from './CardToken.vue'
import ZoneModal from './ZoneModal.vue'
import { useGameStore } from '@/store/game'
import { targetingSource } from '@/composables/targetingState'

const props = defineProps({
  slots:      { type: Array,   default: () => [] },
  isOpponent: { type: Boolean, default: false },
})

const game         = useGameStore()
const ctxMenu      = ref({ visible: false, x: 0, y: 0 })
const showModal    = ref(false)
const dropHalf     = ref(null)
const hovering     = ref(false)
const lifeStackRef = ref(null)
const lifeCardsRef = ref(null)
const containerH   = ref(240)
const panelPos     = ref({ top: 0, left: 0 })

let hideTimer = null

// ── Dynamic card overlap ─────────────────────────────────────────────────────
const CARD_LAYOUT_H = 78  // small CardToken height in layout (pre-rotation)

const cardMarginTop = computed(() => {
  const n = props.slots.length
  if (n <= 1) return 0
  const avail = containerH.value - CARD_LAYOUT_H
  const step  = Math.max(6, avail / (n - 1))
  return Math.round(step - CARD_LAYOUT_H)  // negative
})

// ── ResizeObserver for container height ──────────────────────────────────────
let ro = null

// ── Drag FROM life stack ─────────────────────────────────────────────────────
function onDragStart(e) {
  if (props.slots.length === 0 || props.isOpponent) { e.preventDefault(); return }
  const rect      = e.currentTarget.getBoundingClientRect()
  const isTopHalf = (e.clientY - rect.top) < rect.height / 2
  const card      = isTopHalf ? props.slots[0] : props.slots[props.slots.length - 1]
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', JSON.stringify({
    instanceId: card.instanceId,
    fromZone:   'lifeStack',
  }))
  const ghost = document.createElement('div')
  Object.assign(ghost.style, {
    position: 'absolute', top: '-200px',
    width: '52px', height: '74px',
    borderRadius: '5px', overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.3)',
    pointerEvents: 'none',
  })
  if (!card.faceDown && card.imageUrl) {
    const img = document.createElement('img')
    img.src = card.imageUrl
    Object.assign(img.style, { width: '100%', height: '100%', objectFit: 'cover' })
    ghost.appendChild(img)
  } else {
    ghost.style.background = 'linear-gradient(135deg,#1a237e,#283593)'
  }
  document.body.appendChild(ghost)
  e.dataTransfer.setDragImage(ghost, 26, 37)
  setTimeout(() => ghost.remove(), 0)
}

// ── Drop target ───────────────────────────────────────────────────────────────
function getDropHalf(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  return (e.clientY - rect.top) < rect.height / 2 ? 'top' : 'bottom'
}
function onDragOver(e) {
  e.preventDefault()
  if (!props.isOpponent) {
    dropHalf.value = getDropHalf(e)
  }
}
function onDragLeave() { dropHalf.value = null }
function onDrop(e) {
  e.preventDefault()
  if (props.isOpponent) {
    const raw = e.dataTransfer.getData('text/plain')
    if (!raw) return
    const { instanceId } = JSON.parse(raw)
    targetingSource.value = instanceId
    game.targetCard(zoneTargetId.value)
    return
  }
  const half = getDropHalf(e)
  dropHalf.value = null
  const raw = e.dataTransfer.getData('text/plain')
  if (!raw) return
  const { instanceId, fromZone } = JSON.parse(raw)
  game.moveCard(instanceId, fromZone, 'lifeStack', undefined, undefined, half)
}

function onLifeClick() {
  if (targetingSource.value !== null) {
    game.targetCard(zoneTargetId.value)
  }
}

// ── Hover ─────────────────────────────────────────────────────────────────────
function onMouseEnter() {
  clearTimeout(hideTimer)
  if (!props.isOpponent) {
    if (!hovering.value && lifeStackRef.value) {
      const rect = lifeStackRef.value.getBoundingClientRect()
      panelPos.value = { top: rect.top, left: rect.right + 6 }
    }
    hovering.value = true
  }
}
function onMouseLeave() {
  hideTimer = setTimeout(() => { hovering.value = false }, 200)
}

// ── Context menu ─────────────────────────────────────────────────────────────
function onContextMenu(e) {
  if (props.isOpponent) return
  e.preventDefault()
  ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY }
}
function closeCtx() { ctxMenu.value.visible = false }
function onDocClick() { if (ctxMenu.value.visible) closeCtx() }

onMounted(() => {
  document.addEventListener('click', onDocClick)
  if (lifeCardsRef.value) {
    ro = new ResizeObserver(([entry]) => {
      containerH.value = entry.contentRect.height
    })
    ro.observe(lifeCardsRef.value)
  }
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  ro?.disconnect()
})

const zoneTargetId = computed(() =>
  `zone:${props.isOpponent ? 'opp' : 'own'}:lifeStack`
)
const isZoneTargeted = computed(() => game.targetedInstanceId === zoneTargetId.value)

// ── Actions ──────────────────────────────────────────────────────────────────
function viewStack()   { closeCtx(); hovering.value = false; showModal.value = true }
function heal()        { closeCtx(); game.lifeHeal() }
function shuffleLife() { closeCtx(); hovering.value = false; game.lifeShuffle() }
function allDown()     { closeCtx(); hovering.value = false; game.lifeAllDown() }
function allUp()       { closeCtx(); hovering.value = false; game.lifeAllUp() }
function restart()     { game.lifeRestart() }
</script>

<template>
  <div
    ref="lifeStackRef"
    class="life-stack"
    :class="{ targeted: isZoneTargeted }"
    :data-zone-id="zoneTargetId"
    :title="isOpponent ? 'Vida del oponente' : 'Tu vida — arrastra top/bottom · hover para opciones'"
    :draggable="!isOpponent && slots.length > 0"
    @click="onLifeClick"
    @dragstart="onDragStart"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
    @contextmenu="onContextMenu"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <div class="life-label">VIDA</div>

    <div ref="lifeCardsRef" class="life-cards">
      <div
        v-for="(s, i) in slots"
        :key="s.instanceId"
        class="life-card-outer"
        :style="{ marginTop: i === 0 ? '0' : cardMarginTop + 'px', zIndex: slots.length - i }"
      >
        <div class="life-card-rotate">
          <CardToken
            :cardSlot="s"
            zone="lifeStack"
            :isOpponent="isOpponent"
            :small="true"
          />
        </div>
      </div>

      <div v-if="slots.length === 0 && !isOpponent" class="life-empty-wrap">
        <div class="life-empty">Sin vida</div>
        <button class="restart-btn" @click.stop="restart">+6 del mazo</button>
      </div>
      <div v-if="slots.length === 0 && isOpponent" class="life-empty">—</div>
    </div>

    <!-- Drop overlay -->
    <div v-if="dropHalf !== null && !isOpponent" class="drop-overlay">
      <div class="drop-half drop-top" :class="{ active: dropHalf === 'top' }">
        <span class="drop-label">↑ Tope</span>
      </div>
      <div class="drop-half drop-bottom" :class="{ active: dropHalf === 'bottom' }">
        <span class="drop-label">↓ Fondo</span>
      </div>
    </div>

    <div class="life-count">{{ slots.length }}</div>

    <!-- Hover action panel — teleported so it's never clipped -->
    <Teleport to="body">
      <Transition name="life-panel">
        <div
          v-if="hovering && !isOpponent"
          class="life-panel-controls"
          :style="{ top: panelPos.top + 'px', left: panelPos.left + 'px' }"
          @mouseenter="onMouseEnter"
          @mouseleave="onMouseLeave"
          @click.stop
        >
          <button class="lp-btn" @click="viewStack">
            <i class="bi bi-list-ul" /> Lista
          </button>
          <button class="lp-btn" @click="allDown">
            <i class="bi bi-eye-slash" /> Ocultar
          </button>
          <button class="lp-btn" @click="allUp">
            <i class="bi bi-eye" /> Revelar
          </button>
          <button class="lp-btn" @click="shuffleLife">
            <i class="bi bi-shuffle" /> Barajar
          </button>
        </div>
      </Transition>
    </Teleport>

    <!-- Context menu -->
    <Teleport to="body">
      <div
        v-if="ctxMenu.visible"
        class="ctx-menu"
        :style="{ top: ctxMenu.y + 'px', left: ctxMenu.x + 'px' }"
        @click.stop
      >
        <button class="ctx-item" @click="viewStack">Ver la pila</button>
        <button class="ctx-item" @click="heal">Curar (top del mazo)</button>
        <button class="ctx-item" @click="shuffleLife">Barajar la pila</button>
        <div class="ctx-sep" />
        <button class="ctx-item" @click="allDown">Poner todo boca abajo</button>
        <button class="ctx-item" @click="allUp">Poner todo boca arriba</button>
      </div>
    </Teleport>

    <ZoneModal
      :visible="showModal"
      title="Pila de vida"
      :cards="slots"
      zone="lifeStack"
      :readOnly="true"
      @close="showModal = false"
    />
  </div>
</template>

<style scoped>
.life-stack {
  width: 108px;
  flex: 1;
  min-height: 0;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.4rem 0.2rem;
  gap: 0.25rem;
  border: 1.5px dashed rgba(255,255,255,0.1);
  border-radius: 6px;
  position: relative;
  cursor: grab;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.life-stack.targeted {
  border-color: #ef4444;
  box-shadow: 0 0 0 2px #ef4444, 0 0 14px 3px rgba(239,68,68,0.55);
  animation: life-target-pulse 0.5s ease-in-out infinite alternate;
}
@keyframes life-target-pulse {
  from { box-shadow: 0 0 0 2px #ef4444, 0 0 8px 2px rgba(239,68,68,0.4); }
  to   { box-shadow: 0 0 0 2px #ef4444, 0 0 20px 5px rgba(239,68,68,0.75); }
}

.life-label {
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.4);
  text-transform: uppercase;
  position: relative;
  z-index: 2;
  flex-shrink: 0;
}

.life-cards {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  overflow: visible;
  width: 100%;
  position: relative;
  z-index: 2;
}

.life-card-outer {
  position: relative;
  flex-shrink: 0;
}
.life-card-rotate {
  transform: rotate(90deg);
}

.drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  border-radius: 5px;
  overflow: hidden;
  pointer-events: none;
}
.drop-half {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(99,102,241,0.15);
  border: 1.5px solid rgba(99,102,241,0.25);
  transition: background 0.1s;
}
.drop-half.active {
  background: rgba(99,102,241,0.45);
  border-color: rgba(99,102,241,0.9);
}
.drop-top    { border-bottom: 1px solid rgba(255,255,255,0.25); border-radius: 5px 5px 0 0; }
.drop-bottom { border-top: none; border-radius: 0 0 5px 5px; }
.drop-label {
  font-size: 0.5rem;
  font-weight: 700;
  color: rgba(255,255,255,0.8);
  letter-spacing: 0.05em;
  pointer-events: none;
}

/* Teleported life panel — global */
:global(.life-panel-controls) {
  position: fixed;
  z-index: 500;
  background: #1e2333;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 120px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.7);
}
:global(.lp-btn) {
  font-size: 0.65rem;
  padding: 0.28rem 0.5rem;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 5px;
  color: rgba(255,255,255,0.8);
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  transition: background 0.1s;
}
:global(.lp-btn:hover) { background: rgba(255,255,255,0.18); color: #fff; }

:global(.life-panel-enter-active), :global(.life-panel-leave-active) { transition: opacity 0.12s, transform 0.12s; }
:global(.life-panel-enter-from), :global(.life-panel-leave-to) { opacity: 0; transform: translateX(-4px); }

.life-empty-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  margin-top: 4px;
  z-index: 2;
  position: relative;
}
.life-empty { font-size: 0.55rem; color: rgba(255,255,255,0.25); }
.restart-btn {
  font-size: 0.5rem;
  padding: 0.2rem 0.35rem;
  background: rgba(76,175,80,0.2);
  border: 1px solid rgba(76,175,80,0.5);
  border-radius: 4px;
  color: #a5d6a7;
  cursor: pointer;
  white-space: nowrap;
  line-height: 1.2;
  text-align: center;
}
.restart-btn:hover { background: rgba(76,175,80,0.35); }

.life-count {
  font-size: 0.7rem;
  font-weight: 700;
  color: rgba(255,255,255,0.7);
  background: rgba(0,0,0,0.3);
  border-radius: 10px;
  padding: 0.1rem 0.35rem;
  min-width: 20px;
  text-align: center;
  position: relative;
  z-index: 2;
  flex-shrink: 0;
}

:global(.ctx-menu) {
  position: fixed;
  z-index: 2000;
  background: #1e2333;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 7px;
  padding: 0.3rem 0;
  min-width: 190px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.6);
}
:global(.ctx-item) {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  color: rgba(255,255,255,0.85);
  font-size: 0.78rem;
  padding: 0.45rem 1rem;
  cursor: pointer;
  transition: background 0.1s;
}
:global(.ctx-item:hover) { background: rgba(255,255,255,0.1); }
:global(.ctx-sep) {
  height: 1px;
  background: rgba(255,255,255,0.08);
  margin: 0.2rem 0;
}
</style>
