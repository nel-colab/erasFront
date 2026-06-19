<script setup>
import { ref, watch, computed } from 'vue'
import { useGameStore } from '@/store/game'

const props = defineProps({
  visible:        { type: Boolean, default: false },
  title:          { type: String,  default: 'Zona' },
  cards:          { type: Array,   default: () => [] },
  zone:           { type: String,  default: '' },
  readOnly:       { type: Boolean, default: false },
  isOpponent:     { type: Boolean, default: false },
  targetPlayerId: { type: String,  default: null },
})
const emit = defineEmits(['close'])

const game        = useGameStore()
const localCards  = ref([])
const dragIndex   = ref(null)
const overIndex   = ref(null)
const draggingOut = ref(false)   // true while dragging a card OUT to a board zone

watch(
  () => [props.visible, props.cards],
  () => {
    if (props.visible && dragIndex.value === null) {
      localCards.value = props.cards.map(c => ({ ...c }))
    }
  },
  { immediate: true, deep: true },
)

// ── Internal drag-to-reorder (via ⠿ handle → row) ───────────────────────────
function onDragStart(i, e) {
  if (props.readOnly) { e.preventDefault(); return }
  dragIndex.value = i
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('application/zone-modal-dnd', String(i))
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
  // Only handle internal drops (mime type check)
  if (!e.dataTransfer.types.includes('application/zone-modal-dnd')) return
  e.preventDefault()
  e.stopPropagation()
  const from = dragIndex.value
  dragIndex.value = null
  overIndex.value = null
  if (from === null || from === i) return

  const items   = [...localCards.value]
  const [moved] = items.splice(from, 1)
  items.splice(i, 0, moved)
  localCards.value = items

  if (!props.readOnly) {
    game.zoneReorder(props.zone, items.map(c => c.instanceId))
  }
}

function onDragEnd() {
  dragIndex.value = null
  overIndex.value = null
}

// ── External drag: drag card thumbnail OUT to a board zone ───────────────────
function onThumbDragStart(card, e) {
  e.stopPropagation()            // prevent row's internal DnD from firing
  draggingOut.value = true
  e.dataTransfer.effectAllowed = 'move'
  // Use the standard zone DnD format so board drop handlers accept it
  e.dataTransfer.setData('text/plain', JSON.stringify({
    instanceId: card.instanceId,
    fromZone:   props.zone,
  }))
  // Build drag ghost
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

function onThumbDragEnd() {
  draggingOut.value = false
}

// ── Move via button ──────────────────────────────────────────────────────────
function moveTo(card, toZone) {
  game.moveCard(card.instanceId, props.zone, toZone, undefined, undefined, undefined, props.targetPlayerId)
  localCards.value = localCards.value.filter(c => c.instanceId !== card.instanceId)
}

const ALL_ZONES = [
  { key: 'hand',        label: 'Mano'    },
  { key: 'field',       label: 'Campo'   },
  { key: 'tributeZone', label: 'Tributo' },
  { key: 'discardPile', label: 'Descarte'},
  { key: 'lifeStack',   label: 'Vida'    },
  { key: 'deck',        label: 'Mazo ↑'  },
]

const ZONES = computed(() =>
  props.isOpponent ? ALL_ZONES.filter(z => z.key === 'field') : ALL_ZONES
)
</script>

<template>
  <Teleport to="body">
    <!--
      When draggingOut, the overlay loses pointer-events so drag events
      pass through to the board zones behind the modal.
    -->
    <div
      v-if="visible"
      class="zm-overlay"
      :class="{ 'no-ptr': draggingOut }"
      @mousedown.self="$emit('close')"
    >
      <div class="zm-box" :class="{ 'no-ptr': draggingOut }">
        <div class="zm-header">
          <span class="zm-title">
            {{ title }} <span class="zm-count">({{ localCards.length }})</span>
          </span>
          <button class="zm-close" @click="$emit('close')">✕</button>
        </div>

        <div class="zm-list">
          <div
            v-for="(card, i) in localCards"
            :key="card.instanceId"
            class="zm-row"
            :class="{
              dragging:    dragIndex === i,
              'drop-over': overIndex === i && dragIndex !== null && dragIndex !== i,
            }"
            :draggable="!readOnly"
            @dragstart="onDragStart(i, $event)"
            @dragenter="onDragEnter(i, $event)"
            @dragover="onDragOver(i, $event)"
            @drop="onDrop(i, $event)"
            @dragend="onDragEnd"
          >
            <!-- Drag-to-board handle (thumbnail) -->
            <div
              class="zm-thumb"
              draggable="true"
              title="Arrastra al tablero"
              @dragstart="onThumbDragStart(card, $event)"
              @dragend="onThumbDragEnd"
            >
              <img v-if="!card.faceDown && card.imageUrl" :src="card.imageUrl" class="zm-img" />
              <div v-else class="zm-back" />
              <div class="zm-drag-hint-img">↗</div>
            </div>

            <div class="zm-meta">
              <span class="zm-pos">#{{ i + 1 }}</span>
              <span class="zm-status">{{ card.faceDown ? '↓ Oculta' : '↑ Revelada' }}</span>
            </div>

            <span v-if="!readOnly" class="zm-handle">⠿</span>

            <div v-if="!readOnly" class="zm-actions">
              <button
                v-for="z in ZONES"
                :key="z.key"
                class="zm-btn"
                :disabled="z.key === zone"
                @click="moveTo(card, z.key)"
              >{{ z.label }}</button>
            </div>
          </div>

          <div v-if="localCards.length === 0" class="zm-empty">Sin cartas</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.zm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
/* During external drag: pass events through to board */
.zm-overlay.no-ptr { pointer-events: none; }
.zm-box.no-ptr     { pointer-events: none; }

.zm-box {
  background: #1a1f2e;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  width: min(560px, 95vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.zm-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.zm-title { font-size: 0.9rem; font-weight: 700; color: #e0e0e0; }
.zm-count { color: rgba(255,255,255,0.4); font-weight: 400; }
.zm-close {
  background: none; border: none; color: rgba(255,255,255,0.5);
  font-size: 1rem; cursor: pointer; padding: 0.2rem 0.4rem; border-radius: 4px;
}
.zm-close:hover { color: #fff; background: rgba(255,255,255,0.1); }

.zm-list {
  overflow-y: auto; flex: 1; padding: 0.5rem;
  display: flex; flex-direction: column; gap: 0.35rem;
  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.2) transparent;
}

.zm-row {
  display: flex; align-items: center; gap: 0.5rem;
  background: rgba(255,255,255,0.04);
  border-radius: 6px; padding: 0.25rem 0.5rem;
  border: 1px solid transparent;
  transition: background 0.1s, border-color 0.1s;
  user-select: none;
}
.zm-row:hover { background: rgba(255,255,255,0.07); }
.zm-row.dragging  { opacity: 0.35; border-color: rgba(255,255,255,0.2); }
.zm-row.drop-over { border-color: rgba(99,102,241,0.7); background: rgba(99,102,241,0.12); }

/* Thumbnail — also acts as drag handle for external drag */
.zm-thumb {
  flex-shrink: 0;
  width: 36px; height: 50px;
  border-radius: 3px; overflow: hidden;
  cursor: grab;
  position: relative;
}
.zm-img  { width: 100%; height: 100%; object-fit: cover; display: block; }
.zm-back {
  width: 100%; height: 100%;
  background: linear-gradient(135deg,#1a237e,#283593);
  border: 1px solid rgba(255,255,255,0.2); border-radius: 3px;
}
/* Arrow hint shown on thumbnail hover */
.zm-drag-hint-img {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; color: rgba(255,255,255,0.9);
  background: rgba(0,0,0,0.55);
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
}
.zm-thumb:hover .zm-drag-hint-img { opacity: 1; }

.zm-meta {
  flex-shrink: 0; display: flex; flex-direction: column; gap: 2px; min-width: 54px;
}
.zm-pos    { font-size: 0.55rem; color: rgba(255,255,255,0.3); }
.zm-status { font-size: 0.6rem;  color: rgba(255,255,255,0.5); }

.zm-handle {
  font-size: 0.85rem; color: rgba(255,255,255,0.2);
  letter-spacing: -2px; cursor: grab; flex-shrink: 0;
}

.zm-actions { display: flex; flex-wrap: wrap; gap: 0.2rem; margin-left: auto; }
.zm-btn {
  font-size: 0.55rem; padding: 0.15rem 0.35rem;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 4px; color: rgba(255,255,255,0.7);
  cursor: pointer; transition: background 0.1s; white-space: nowrap;
}
.zm-btn:hover:not(:disabled) { background: rgba(255,255,255,0.18); color: #fff; }
.zm-btn:disabled { opacity: 0.3; cursor: default; }

.zm-empty { text-align: center; padding: 2rem; color: rgba(255,255,255,0.2); font-size: 0.8rem; }
</style>
