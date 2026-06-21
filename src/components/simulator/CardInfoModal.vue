<script setup>
import { computed, ref } from 'vue'
import { useGameStore } from '@/store/game'

const props = defineProps({
  cardSlot:       { type: Object, required: true },
  targetPlayerId: { type: String, default: null },
})
const emit = defineEmits(['close'])
const game = useGameStore()

function swap(card, attachmentType) {
  game.swapWithMain({
    instanceId:     card.instanceId,
    attachmentType,
    parentId:       props.cardSlot.instanceId,
    targetPlayerId: props.targetPlayerId,
  })
  emit('close')
}

const CARD_H = 392
const PEEK_H = 30

const materialsCount = computed(() => props.cardSlot.materials?.length ?? 0)

const stackHeight = computed(() =>
  CARD_H + (props.cardSlot.resources?.length ?? 0) * PEEK_H + 'px'
)

// ── Hover preview ─────────────────────────────────────────────────────────────
const hoveredCard = ref(null)
const previewPos  = ref({ left: 0, top: 0 })

function onAttachHover(card, e) { hoveredCard.value = card; updatePreviewPos(e) }
function onAttachMove(card, e)  { if (hoveredCard.value?.instanceId === card.instanceId) updatePreviewPos(e) }
function updatePreviewPos(e) {
  const W = 280, H = 392
  let left = e.clientX + 18
  let top  = e.clientY - H / 2
  if (left + W > window.innerWidth - 8)  left = e.clientX - W - 18
  if (top < 8)                           top  = 8
  if (top + H > window.innerHeight - 8)  top  = window.innerHeight - H - 8
  previewPos.value = { left, top }
}
function onAttachLeave() { hoveredCard.value = null }

// ── Detach ────────────────────────────────────────────────────────────────────
function detach(card, attachmentType, toZone, faceDown = false, position = 'bottom') {
  game.moveFromAttachment({
    instanceId:     card.instanceId,
    attachmentOf:   props.cardSlot.instanceId,
    attachmentType,
    toZone,
    faceDown,
    position,
    targetPlayerId: props.targetPlayerId,
  })
}

// ── Drag-to-reorder within attachment lists ───────────────────────────────────
const resDragIdx  = ref(null)
const resOverIdx  = ref(null)
const matDragIdx  = ref(null)
const matOverIdx  = ref(null)

function onListDragStart(list, idx) { if (list === 'res') { resDragIdx.value = idx } else { matDragIdx.value = idx } }
function onListDragEnter(list, idx) { if (list === 'res') { resOverIdx.value = idx } else { matOverIdx.value = idx } }
function onListDragEnd(list)        { if (list === 'res') { resDragIdx.value = null; resOverIdx.value = null } else { matDragIdx.value = null; matOverIdx.value = null } }

function onListDrop(list, idx, e) {
  e.preventDefault(); e.stopPropagation()
  const dragIdx = list === 'res' ? resDragIdx.value : matDragIdx.value
  if (dragIdx === null || dragIdx === idx) { onListDragEnd(list); return }
  const items = [...(list === 'res' ? (props.cardSlot.resources || []) : (props.cardSlot.materials || []))]
  const [moved] = items.splice(dragIdx, 1)
  items.splice(idx, 0, moved)
  game.reorderAttachment({
    parentId:       props.cardSlot.instanceId,
    attachmentType: list === 'res' ? 'resource' : 'material',
    instanceIds:    items.map(c => c.instanceId),
    targetPlayerId: props.targetPlayerId,
  })
  onListDragEnd(list)
}

function reclassify(card, fromType) {
  game.reclassifyAttachment({
    instanceId:     card.instanceId,
    fromType,
    parentId:       props.cardSlot.instanceId,
    targetPlayerId: props.targetPlayerId,
  })
}

function cardLabel(slot) { return slot.cardName || slot.cardId }
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="emit('close')">
      <div class="card-info-modal">
        <button class="close-btn" @click="emit('close')">✕</button>

        <!-- Left: card image with resources peeking BELOW -->
        <div class="card-visual">
          <div class="resource-stack" :style="{ height: stackHeight }">
            <div class="main-card-wrap">
              <img v-if="cardSlot.imageUrl" :src="cardSlot.imageUrl" class="main-img" alt="" />
              <div v-else class="main-back" />
              <div v-if="materialsCount > 0" class="mat-badge">{{ materialsCount }}</div>
            </div>
            <div
              v-for="res in (cardSlot.resources || [])"
              :key="res.instanceId"
              class="resource-peek"
            >
              <img v-if="res.imageUrl" :src="res.imageUrl" class="res-peek-img" alt="" />
              <div v-else class="res-peek-back" />
            </div>
          </div>
        </div>

        <!-- Right: lists with detach + swap + reorder -->
        <div class="info-panel">

          <!-- Recursos -->
          <div class="info-section">
            <div class="section-title">Recursos ({{ cardSlot.resources?.length || 0 }})</div>
            <div v-if="!cardSlot.resources?.length" class="empty-label">Sin recursos</div>
            <div
              v-for="(res, i) in (cardSlot.resources || [])"
              :key="res.instanceId"
              class="attach-row"
              :class="{
                'row-dragging':   resDragIdx === i,
                'row-drop-over':  resOverIdx === i && resDragIdx !== null && resDragIdx !== i,
              }"
              draggable="true"
              @dragstart="onListDragStart('res', i)"
              @dragenter.prevent="onListDragEnter('res', i)"
              @dragover.prevent
              @drop="onListDrop('res', i, $event)"
              @dragend="onListDragEnd('res')"
            >
              <span class="row-handle">⠿</span>
              <img
                v-if="res.imageUrl"
                :src="res.imageUrl"
                class="attach-thumb"
                alt=""
                @mouseenter="(e) => onAttachHover(res, e)"
                @mousemove="(e) => onAttachMove(res, e)"
                @mouseleave="onAttachLeave"
              />
              <div v-else class="attach-thumb attach-back" />
              <div class="attach-info">
                <div class="attach-name-row">
                  <span class="attach-name">{{ cardLabel(res) }}</span>
                  <button class="swap-btn" title="Intercambiar con carta principal" @click="swap(res, 'resource')">⇅</button>
                </div>
                <div class="attach-btns">
                  <button class="ab" @click="detach(res, 'resource', 'tributeZone')">Tributos</button>
                  <button class="ab danger" @click="detach(res, 'resource', 'discardPile')">Descarte</button>
                  <button class="ab" @click="detach(res, 'resource', 'hand')">Mano</button>
                  <button class="ab reclassify-btn" @click="reclassify(res, 'resource')">→ Mat</button>
                  <button class="ab" @click="detach(res, 'resource', 'lifeStack', false, 'bottom')">Fondo vida ↑</button>
                  <button class="ab" @click="detach(res, 'resource', 'lifeStack', false, 'top')">Tope vida ↑</button>
                  <button class="ab" @click="detach(res, 'resource', 'lifeStack', true, 'bottom')">Fondo vida ↓</button>
                  <button class="ab" @click="detach(res, 'resource', 'lifeStack', true, 'top')">Tope vida ↓</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Materiales -->
          <div class="info-section">
            <div class="section-title">Materiales ({{ cardSlot.materials?.length || 0 }})</div>
            <div v-if="!cardSlot.materials?.length" class="empty-label">Sin materiales</div>
            <div
              v-for="(mat, i) in (cardSlot.materials || [])"
              :key="mat.instanceId"
              class="attach-row"
              :class="{
                'row-dragging':   matDragIdx === i,
                'row-drop-over':  matOverIdx === i && matDragIdx !== null && matDragIdx !== i,
              }"
              draggable="true"
              @dragstart="onListDragStart('mat', i)"
              @dragenter.prevent="onListDragEnter('mat', i)"
              @dragover.prevent
              @drop="onListDrop('mat', i, $event)"
              @dragend="onListDragEnd('mat')"
            >
              <span class="row-handle">⠿</span>
              <img
                v-if="mat.imageUrl"
                :src="mat.imageUrl"
                class="attach-thumb"
                alt=""
                @mouseenter="(e) => onAttachHover(mat, e)"
                @mousemove="(e) => onAttachMove(mat, e)"
                @mouseleave="onAttachLeave"
              />
              <div v-else class="attach-thumb attach-back" />
              <div class="attach-info">
                <div class="attach-name-row">
                  <span class="attach-name">{{ cardLabel(mat) }}</span>
                  <button class="swap-btn" title="Intercambiar con carta principal" @click="swap(mat, 'material')">⇅</button>
                </div>
                <div class="attach-btns">
                  <button class="ab" @click="detach(mat, 'material', 'tributeZone')">Tributos</button>
                  <button class="ab danger" @click="detach(mat, 'material', 'discardPile')">Descarte</button>
                  <button class="ab" @click="detach(mat, 'material', 'hand')">Mano</button>
                  <button class="ab reclassify-btn" @click="reclassify(mat, 'material')">→ Rec</button>
                  <button class="ab" @click="detach(mat, 'material', 'lifeStack', false, 'bottom')">Fondo vida ↑</button>
                  <button class="ab" @click="detach(mat, 'material', 'lifeStack', false, 'top')">Tope vida ↑</button>
                  <button class="ab" @click="detach(mat, 'material', 'lifeStack', true, 'bottom')">Fondo vida ↓</button>
                  <button class="ab" @click="detach(mat, 'material', 'lifeStack', true, 'top')">Tope vida ↓</button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- Hover preview for attachment cards -->
    <div
      v-if="hoveredCard && hoveredCard.imageUrl"
      class="attach-hover-preview"
      :style="{ top: previewPos.top + 'px', left: previewPos.left + 'px' }"
    >
      <img :src="hoveredCard.imageUrl" class="attach-hover-img" alt="" />
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 800;
  background: rgba(0,0,0,0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.card-info-modal {
  background: #1e293b;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  gap: 24px;
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 16px 48px rgba(0,0,0,0.85);
}

.close-btn {
  position: absolute;
  top: 10px; right: 12px;
  background: none; border: none;
  color: #94a3b8; font-size: 1.1rem;
  cursor: pointer; padding: 4px 8px; border-radius: 4px; z-index: 1;
}
.close-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }

.card-visual { flex-shrink: 0; width: 280px; }

.resource-stack {
  display: flex;
  flex-direction: column;
  width: 280px;
}

.main-card-wrap {
  width: 280px;
  height: 392px;
  flex-shrink: 0;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.2);
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
}
.main-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.main-back { width: 100%; height: 100%; background: linear-gradient(135deg, #1a237e, #283593); }

.mat-badge {
  position: absolute;
  bottom: 8px; right: 8px;
  width: 28px; height: 28px;
  border-radius: 50%;
  background: #111; border: 2px solid #fff;
  color: #fff; font-size: 0.8rem; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  z-index: 2;
}

.resource-peek {
  width: 280px;
  height: 84px;
  overflow: hidden;
  flex-shrink: 0;
  border-left: 1px solid rgba(255,255,255,0.08);
  border-right: 1px solid rgba(255,255,255,0.08);
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.res-peek-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: bottom;
  display: block;
}
.res-peek-back { width: 100%; height: 100%; background: linear-gradient(135deg, #1a237e, #283593); }

.info-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 4px;
  padding-right: 28px;
}

.info-section { display: flex; flex-direction: column; gap: 6px; }

.section-title {
  font-size: 0.72rem; font-weight: 700;
  color: #64748b; text-transform: uppercase; letter-spacing: 0.06em;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  padding-bottom: 5px;
}
.empty-label { font-size: 0.8rem; color: #475569; font-style: italic; }

/* Attachment rows */
.attach-row {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 6px 4px;
  border-radius: 6px;
  border: 1px solid transparent;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: background 0.1s, border-color 0.1s;
  cursor: grab;
  user-select: none;
}
.attach-row:last-child { border-bottom: none; }
.attach-row:hover { background: rgba(255,255,255,0.04); }
.attach-row.row-dragging  { opacity: 0.35; border-color: rgba(255,255,255,0.2); }
.attach-row.row-drop-over { border-color: rgba(99,102,241,0.7); background: rgba(99,102,241,0.1); }

.row-handle {
  font-size: 0.9rem; color: rgba(255,255,255,0.2);
  letter-spacing: -2px; cursor: grab; flex-shrink: 0;
  margin-top: 28px;
}

/* Bigger thumbnails */
.attach-thumb {
  width: 64px; height: 90px;
  object-fit: cover;
  border-radius: 4px; flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.1);
}
.attach-back { background: linear-gradient(135deg, #1a237e, #283593); }

.attach-info {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 6px;
}

.attach-name-row {
  display: flex; align-items: center; gap: 6px; min-width: 0;
}
.attach-name {
  font-size: 0.8rem; color: #cbd5e1; font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  flex: 1;
}
.swap-btn {
  background: rgba(99,102,241,0.15);
  border: 1px solid rgba(99,102,241,0.35);
  color: #a5b4fc; font-size: 1rem; font-weight: 700;
  width: 26px; height: 26px; border-radius: 4px;
  cursor: pointer; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.12s, border-color 0.12s;
  padding: 0;
}
.swap-btn:hover { background: rgba(99,102,241,0.3); border-color: rgba(99,102,241,0.6); }

.attach-btns { display: flex; flex-wrap: wrap; gap: 4px; }
.ab {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  color: #94a3b8; font-size: 0.68rem;
  padding: 3px 8px; border-radius: 4px;
  cursor: pointer; white-space: nowrap;
  transition: background 0.12s, color 0.12s;
}
.ab:hover { background: rgba(255,255,255,0.16); color: #e2e8f0; }
.ab.danger { color: #f87171; border-color: rgba(239,68,68,0.2); }
.ab.danger:hover { background: rgba(239,68,68,0.14); }
.ab.reclassify-btn { color: #34d399; border-color: rgba(52,211,153,0.25); }
.ab.reclassify-btn:hover { background: rgba(52,211,153,0.12); }

:global(.attach-hover-preview) {
  position: fixed;
  z-index: 1200;
  width: 280px;
  height: 392px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 12px 36px rgba(0,0,0,0.8);
  border: 1px solid rgba(255,255,255,0.2);
  pointer-events: none;
}
:global(.attach-hover-img) {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
</style>
