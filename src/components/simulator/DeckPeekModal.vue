<script setup>
import { ref, watch } from 'vue'
import { useGameStore } from '@/store/game'

const props = defineProps({
  visible:    { type: Boolean, default: false },
  deck:       { type: Array,   default: () => [] },
  n:          { type: Number,  default: 5 },
  fromBottom: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const game       = useGameStore()
const localCards = ref([])
const dragIndex  = ref(null)
const overIndex  = ref(null)

// Only snapshot the deck when the modal opens (not on every deck change)
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      const slice = props.fromBottom
        ? props.deck.slice(-props.n)
        : props.deck.slice(0, props.n)
      localCards.value = slice.map(c => ({ ...c, faceDown: false }))
    }
  },
  { immediate: true },
)

// ── Drag-to-reorder ──────────────────────────────────────────────────────────
function onDragStart(i, e) {
  dragIndex.value = i
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('application/deck-peek-dnd', String(i))
  e.stopPropagation()
}

function onDragEnter(i, e) {
  if (dragIndex.value === null) return
  e.preventDefault()
  overIndex.value = i
}

function onDragOver(i, e) {
  if (dragIndex.value === null) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}

function onDrop(i, e) {
  e.preventDefault()
  e.stopPropagation()
  const from = dragIndex.value
  dragIndex.value = null
  overIndex.value = null
  if (from === null || from === i) return

  const items = [...localCards.value]
  const [moved] = items.splice(from, 1)
  items.splice(i, 0, moved)
  localCards.value = items
}

function onDragEnd() {
  dragIndex.value = null
  overIndex.value = null
}

// ── External drag: drag thumbnail to board zone (closes modal immediately) ────
function onThumbDragStart(card, e) {
  e.stopPropagation()
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', JSON.stringify({
    instanceId: card.instanceId,
    fromZone:   'deck',
  }))
  const ghost = document.createElement('div')
  Object.assign(ghost.style, {
    position: 'absolute', top: '-200px',
    width: '52px', height: '74px',
    borderRadius: '5px', overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.3)',
    pointerEvents: 'none',
  })
  if (card.imageUrl) {
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
  // Close modal so board zones receive drag events without pointer-events hacks
  setTimeout(() => emit('close'), 0)
}

// ── Move individual card out of deck ─────────────────────────────────────────
function moveTo(card, toZone) {
  game.moveCard(card.instanceId, 'deck', toZone)
  localCards.value = localCards.value.filter(c => c.instanceId !== card.instanceId)
}

// ── Return top-N cards to deck ───────────────────────────────────────────────
function returnCards(position, shuffle) {
  game.deckReorderTop(localCards.value.map(c => c.instanceId), position, shuffle)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="dp-overlay"
      @mousedown.self="$emit('close')"
    >
      <div class="dp-box">
        <div class="dp-header">
          <span class="dp-title">
            {{ fromBottom ? 'Fondo' : 'Top' }} {{ n }} del mazo
            <span class="dp-count">({{ localCards.length }} cartas)</span>
          </span>
          <button class="dp-close" @click="$emit('close')">✕</button>
        </div>

        <div class="dp-list">
          <div
            v-for="(card, i) in localCards"
            :key="card.instanceId"
            class="dp-row"
            :class="{
              dragging:    dragIndex === i,
              'drop-over': overIndex === i && dragIndex !== null && dragIndex !== i,
            }"
            draggable="true"
            @dragstart="onDragStart(i, $event)"
            @dragenter="onDragEnter(i, $event)"
            @dragover="onDragOver(i, $event)"
            @drop="onDrop(i, $event)"
            @dragend="onDragEnd"
          >
            <span class="dp-handle">⠿</span>
            <span class="dp-index">{{ i + 1 }}</span>
            <div
              class="dp-thumb"
              draggable="true"
              title="Arrastra al tablero"
              @dragstart="onThumbDragStart(card, $event)"
              @dragend="onThumbDragEnd"
            >
              <img v-if="!card.faceDown && card.imageUrl" :src="card.imageUrl" class="dp-img" />
              <div v-else class="dp-back" />
              <div class="dp-drag-hint">↗</div>
            </div>
            <div class="dp-actions">
              <button class="dp-btn" @click="moveTo(card, 'hand')">Mano</button>
              <button class="dp-btn" @click="moveTo(card, 'field')">Campo</button>
              <button class="dp-btn" @click="moveTo(card, 'tributeZone')">Tributo</button>
              <button class="dp-btn" @click="moveTo(card, 'discardPile')">Descarte</button>
              <button class="dp-btn" @click="moveTo(card, 'lifeStack')">Vida</button>
            </div>
          </div>

          <div v-if="localCards.length === 0" class="dp-empty">Sin cartas</div>
        </div>

        <div class="dp-footer">
          <span class="dp-footer-label">Devolver:</span>
          <div class="dp-ret-grid">
            <button class="dp-ret-btn" @click="returnCards('top', false)">↑ Tope (orden actual)</button>
            <button class="dp-ret-btn" @click="returnCards('bottom', false)">↓ Fondo (orden actual)</button>
            <button class="dp-ret-btn" @click="returnCards('top', true)">↑ Tope (aleatorio)</button>
            <button class="dp-ret-btn" @click="returnCards('bottom', true)">↓ Fondo (aleatorio)</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dp-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.65);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.dp-box {
  background: #1a1f2e;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  width: min(520px, 95vw);
  max-height: 82vh;
  display: flex; flex-direction: column; overflow: hidden;
}
.dp-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.dp-title  { font-size: 0.9rem; font-weight: 700; color: #e0e0e0; }
.dp-count  { color: rgba(255,255,255,0.4); font-weight: 400; }
.dp-close {
  background: none; border: none; color: rgba(255,255,255,0.5);
  font-size: 1rem; cursor: pointer; padding: 0.2rem 0.4rem; border-radius: 4px;
}
.dp-close:hover { color: #fff; background: rgba(255,255,255,0.1); }

.dp-list {
  overflow-y: auto; flex: 1; padding: 0.5rem;
  display: flex; flex-direction: column; gap: 0.35rem;
  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.2) transparent;
}

.dp-row {
  display: flex; align-items: center; gap: 0.5rem;
  background: rgba(255,255,255,0.04);
  border-radius: 6px; padding: 0.3rem 0.5rem;
  border: 1px solid transparent;
  cursor: grab; user-select: none;
  transition: background 0.1s, border-color 0.1s;
}
.dp-row:hover { background: rgba(255,255,255,0.07); }
.dp-row.dragging { opacity: 0.35; border-color: rgba(255,255,255,0.2); }
.dp-row.drop-over {
  border-color: rgba(99,102,241,0.7);
  background: rgba(99,102,241,0.12);
}

.dp-handle {
  font-size: 0.85rem; color: rgba(255,255,255,0.2);
  letter-spacing: -2px; flex-shrink: 0; cursor: grab;
}
.dp-index {
  font-size: 0.65rem; color: rgba(255,255,255,0.3);
  min-width: 16px; text-align: right; flex-shrink: 0;
}
.dp-thumb {
  flex-shrink: 0; width: 34px; height: 48px;
  border-radius: 3px; overflow: hidden;
  cursor: grab; position: relative;
}
.dp-img  { width: 100%; height: 100%; object-fit: cover; display: block; }
.dp-back {
  width: 100%; height: 100%;
  background: linear-gradient(135deg,#1a237e,#283593);
  border: 1px solid rgba(255,255,255,0.2);
}
.dp-drag-hint {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; color: rgba(255,255,255,0.9);
  background: rgba(0,0,0,0.55);
  border-radius: 3px; opacity: 0;
  transition: opacity 0.15s; pointer-events: none;
}
.dp-thumb:hover .dp-drag-hint { opacity: 1; }

.dp-actions { display: flex; flex-wrap: wrap; gap: 0.2rem; margin-left: auto; }
.dp-btn {
  font-size: 0.55rem; padding: 0.15rem 0.35rem;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 4px; color: rgba(255,255,255,0.7);
  cursor: pointer; transition: background 0.1s; white-space: nowrap;
}
.dp-btn:hover { background: rgba(255,255,255,0.18); color: #fff; }

.dp-empty { text-align: center; padding: 2rem; color: rgba(255,255,255,0.2); font-size: 0.8rem; }

.dp-footer {
  display: flex; align-items: flex-start; gap: 0.5rem;
  padding: 0.55rem 1rem;
  border-top: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0; background: rgba(0,0,0,0.2);
}
.dp-footer-label {
  font-size: 0.65rem; color: rgba(255,255,255,0.4);
  padding-top: 0.3rem; flex-shrink: 0;
}
.dp-ret-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.3rem;
  flex: 1;
}
.dp-ret-btn {
  font-size: 0.62rem; padding: 0.25rem 0.5rem;
  background: rgba(99,102,241,0.25);
  border: 1px solid rgba(99,102,241,0.5);
  border-radius: 5px; color: #a5b4fc;
  cursor: pointer; transition: background 0.1s; white-space: nowrap; text-align: center;
}
.dp-ret-btn:hover { background: rgba(99,102,241,0.45); color: #fff; }
</style>
