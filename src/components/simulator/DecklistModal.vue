<script setup>
import { computed, ref } from 'vue'
import { useGameStore } from '@/store/game'

const emit = defineEmits(['close'])
const game = useGameStore()

const refreshingIds = ref(new Set())
const hoveredCard   = ref(null)
const previewPos    = ref({ top: 0, left: 0 })

const allCards     = computed(() => game.originalDeck)
const deck         = computed(() => allCards.value.filter(s => s.imageUrl))
const missingCount = computed(() => allCards.value.filter(s => !s.imageUrl).length)

function refreshMeta(cardId) {
  if (!cardId || refreshingIds.value.has(cardId)) return
  refreshingIds.value = new Set([...refreshingIds.value, cardId])
  game.refreshCardMetadata(cardId)
  setTimeout(() => {
    const next = new Set(refreshingIds.value)
    next.delete(cardId)
    refreshingIds.value = next
  }, 2000)
}

const PREVIEW_W = 240
const PREVIEW_H = 336

function onCardEnter(slot, e) {
  if (!slot.imageUrl) return
  hoveredCard.value = slot
  updatePos(e)
}
function onCardMove(slot, e) {
  if (hoveredCard.value?.instanceId === slot.instanceId) updatePos(e)
}
function onCardLeave() { hoveredCard.value = null }

function updatePos(e) {
  let left = e.clientX + 16
  let top  = e.clientY - PREVIEW_H / 2
  if (left + PREVIEW_W > window.innerWidth - 8)  left = e.clientX - PREVIEW_W - 16
  if (top < 8)                                    top  = 8
  if (top + PREVIEW_H > window.innerHeight - 8)  top  = window.innerHeight - PREVIEW_H - 8
  previewPos.value = { top, left }
}
</script>

<template>
  <Teleport to="body">
    <div class="dl-backdrop" @click.self="emit('close')">
      <div class="dl-modal">
        <div class="dl-header">
          <span class="dl-title">
            Lista de mazo — {{ deck.length }} cartas
            <span v-if="missingCount > 0" class="dl-missing-badge">{{ missingCount }} sin imagen</span>
          </span>
          <button class="dl-close" @click="emit('close')">✕</button>
        </div>

        <div v-if="deck.length === 0" class="dl-empty">Mazo vacío</div>

        <div class="dl-grid">
          <div
            v-for="(slot, i) in deck"
            :key="slot.instanceId"
            class="dl-card"
            @mouseenter="onCardEnter(slot, $event)"
            @mousemove="onCardMove(slot, $event)"
            @mouseleave="onCardLeave"
          >
            <div class="dl-card-inner" :class="{ 'no-meta': !slot.cardType }">
              <img v-if="slot.imageUrl" :src="slot.imageUrl" class="dl-img" alt="" draggable="false" />
              <div v-else class="dl-img dl-back" />
              <span class="dl-num">{{ i + 1 }}</span>
              <span v-if="!slot.cardType" class="dl-warn-badge" title="Sin metadatos">!</span>
              <button
                class="dl-refresh"
                :class="{ spinning: refreshingIds.has(slot.cardId) }"
                :disabled="!slot.cardId || refreshingIds.has(slot.cardId)"
                title="Actualizar metadatos"
                @click.stop="refreshMeta(slot.cardId)"
              >
                <i class="bi bi-arrow-clockwise" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Hover preview -->
    <div
      v-if="hoveredCard && hoveredCard.imageUrl"
      class="dl-hover-preview"
      :style="{ top: previewPos.top + 'px', left: previewPos.left + 'px' }"
    >
      <img :src="hoveredCard.imageUrl" class="dl-hover-img" alt="" draggable="false" />
    </div>
  </Teleport>
</template>

<style scoped>
.dl-backdrop {
  position: fixed;
  inset: 0;
  z-index: 800;
  background: rgba(0,0,0,0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.dl-modal {
  background: #1e293b;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 12px;
  width: min(700px, 96vw);
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(0,0,0,0.85);
  overflow: hidden;
}

.dl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  flex-shrink: 0;
}
.dl-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: #e2e8f0;
}
.dl-missing-badge {
  margin-left: 8px;
  font-size: 0.68rem;
  font-weight: 700;
  background: rgba(234,179,8,0.2);
  color: #fbbf24;
  border: 1px solid rgba(234,179,8,0.35);
  border-radius: 10px;
  padding: 1px 8px;
  vertical-align: middle;
}

.dl-close {
  background: none;
  border: none;
  color: #64748b;
  font-size: 1rem;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}
.dl-close:hover { background: rgba(255,255,255,0.08); color: #fff; }

.dl-empty {
  padding: 32px;
  text-align: center;
  color: #475569;
  font-size: 0.82rem;
  font-style: italic;
}

.dl-grid {
  overflow-y: auto;
  flex: 1;
  padding: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
  gap: 8px;
  align-content: start;
}

/* Padding-top trick ensures correct aspect ratio without overlap */
.dl-card {
  position: relative;
  padding-top: 140%;
}

.dl-card-inner {
  position: absolute;
  inset: 0;
  border-radius: 5px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.1);
}
.dl-card:hover .dl-refresh { opacity: 1; }

.dl-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.dl-back {
  background: linear-gradient(135deg, #1a237e, #283593);
}

.dl-card-inner.no-meta {
  border-color: rgba(234,179,8,0.6);
  box-shadow: 0 0 0 1px rgba(234,179,8,0.4) inset;
}

.dl-warn-badge {
  position: absolute;
  top: 3px;
  right: 4px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(234,179,8,0.9);
  color: #1a1200;
  font-size: 0.6rem;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 3;
}

.dl-num {
  position: absolute;
  top: 3px;
  left: 4px;
  font-size: 0.58rem;
  font-weight: 800;
  color: #fff;
  background: rgba(0,0,0,0.65);
  padding: 1px 4px;
  border-radius: 3px;
  line-height: 1.4;
  pointer-events: none;
  z-index: 2;
}

.dl-refresh {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: rgba(0,0,0,0.72);
  border: 1px solid rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.75);
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.12s;
  padding: 0;
  z-index: 2;
}
.dl-refresh:hover:not(:disabled) { background: rgba(99,102,241,0.7); color: #fff; border-color: rgba(99,102,241,0.8); }
.dl-refresh:disabled { opacity: 0.3 !important; cursor: default; }
.dl-refresh.spinning { opacity: 1 !important; }
.dl-refresh.spinning i { animation: spin 0.7s linear infinite; display: inline-block; }

@keyframes spin { to { transform: rotate(360deg); } }

/* Hover preview */
:global(.dl-hover-preview) {
  position: fixed;
  z-index: 1500;
  width: 240px;
  height: 336px;
  border-radius: 7px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0,0,0,0.85);
  border: 1px solid rgba(255,255,255,0.2);
  pointer-events: none;
}
:global(.dl-hover-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
