<script setup>
import { computed, ref, onUnmounted } from 'vue'
import { useGameStore } from '@/store/game'
import { draggingCard } from '@/composables/dragState'
import { targetingSource } from '@/composables/targetingState'
import CardInfoModal from './CardInfoModal.vue'
import DetachGroupModal from './DetachGroupModal.vue'

const props = defineProps({
  cardSlot:   { type: Object,  required: true },
  zone:       { type: String,  required: true },
  isOpponent: { type: Boolean, default: false },
  small:      { type: Boolean, default: false },
})

const game = useGameStore()

const hidden = computed(() =>
  props.cardSlot.faceDown || (props.isOpponent && props.zone === 'hand')
)
const tapped = computed(() => !!props.cardSlot.tapped)

const displayStrength = computed(() => {
  if (props.cardSlot.strength == null) return null
  return props.cardSlot.strength + (props.cardSlot.strengthModifier || 0)
})
const strengthMod    = computed(() => props.cardSlot.strengthModifier || 0)
const materialsCount = computed(() => props.cardSlot.materials?.length ?? 0)
const resourcesCount = computed(() => props.cardSlot.resources?.length ?? 0)

const targetPlayerId  = computed(() =>
  props.isOpponent ? (game.opponentState?.userId ?? null) : null
)
const isTargeted = computed(() =>
  game.targetedInstanceId === props.cardSlot.instanceId
)
const isTargetingMode = computed(() => targetingSource.value !== null)

// ── Hover preview (fixed top-right corner) ─────────────────────────────────────
const showPreview = ref(false)
let hoverTimer    = null

function onMouseEnter() {
  if (hidden.value) return
  hoverTimer = setTimeout(() => { showPreview.value = true }, 600)
}
function onMouseLeave() {
  clearTimeout(hoverTimer)
  showPreview.value = false
}

// ── Context menu (right-click — all zones, own + opponent) ─────────────────────
const showMenu        = ref(false)
const menuPos         = ref({ top: 0, left: 0 })
const showInfo        = ref(false)
const showDetachModal = ref(false)
const detachGroupType = ref('materials')
const tokenRef        = ref(null)

function onContextMenu(e) {
  e.preventDefault()
  e.stopPropagation()
  clearTimeout(tapTimer); tapTimer = null
  const el = tokenRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  let left = rect.right + 6
  let top  = rect.top
  if (left + 180 > window.innerWidth - 8)  left = rect.left - 186
  if (top + 260 > window.innerHeight - 8)  top  = window.innerHeight - 268
  menuPos.value = { top, left }
  showMenu.value = true
}

function closeMenu() { showMenu.value = false }

function menuReduceStrength()   { game.modifyStrength(props.cardSlot.instanceId, -1, targetPlayerId.value) }
function menuIncreaseStrength() { game.modifyStrength(props.cardSlot.instanceId,  1, targetPlayerId.value) }
function menuViewInfo()         { showInfo.value = true; closeMenu() }
function openDetach(type)       { detachGroupType.value = type; showDetachModal.value = true; closeMenu() }
function menuHacerObjetivo()    { targetingSource.value = props.cardSlot.instanceId; closeMenu() }

// ── Tap / flip / view ─────────────────────────────────────────────────────────
let tapTimer = null

function onClick() {
  if (isTargetingMode.value) {
    game.targetCard(props.cardSlot.instanceId)  // game.js clears targetingSource
    return
  }
  if (props.zone !== 'field') return
  if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; return }
  tapTimer = setTimeout(() => {
    tapTimer = null
    game.tapCard(props.cardSlot.instanceId, props.zone, targetPlayerId.value)
  }, 250)
}

function onDblClick() {
  if (tapTimer) { clearTimeout(tapTimer); tapTimer = null }
  if (props.zone === 'field') {
    showInfo.value = true
  } else if (!props.isOpponent) {
    game.flipCard(props.cardSlot.instanceId, props.zone)
  }
}

// ── Drag (own cards only) ─────────────────────────────────────────────────────
function onDragStart(e) {
  if (props.isOpponent) { e.preventDefault(); return }
  draggingCard.value = { instanceId: props.cardSlot.instanceId, fromZone: props.zone }
  e.dataTransfer.setData('text/plain', JSON.stringify({
    instanceId: props.cardSlot.instanceId,
    fromZone:   props.zone,
  }))
  e.dataTransfer.effectAllowed = 'move'
}

function onDragEnd() {
  draggingCard.value = null
}

onUnmounted(() => {
  clearTimeout(hoverTimer)
  clearTimeout(tapTimer)
})
</script>

<template>
  <div
    ref="tokenRef"
    class="card-token"
    :data-instance-id="cardSlot.instanceId"
    :class="{
      small,
      hidden,
      draggable: !isOpponent,
      tapped,
      targeted:     isTargeted,
      'can-target': isTargetingMode,
    }"
    :draggable="!isOpponent"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @click="onClick"
    @dblclick="onDblClick"
    @contextmenu.prevent="onContextMenu"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <img
      v-if="!hidden && cardSlot.imageUrl"
      :src="cardSlot.imageUrl"
      class="card-img"
      draggable="false"
      alt=""
    />
    <div v-else class="card-back">
      <div class="card-back-inner" />
    </div>

    <!-- Strength badge (orange pill, top-right) -->
    <div
      v-if="zone === 'field' && !hidden && cardSlot.cardType === 'creature' && displayStrength != null"
      class="strength-badge"
    >
      <span v-if="strengthMod > 0" class="mod-arrow up">▲</span>
      <span v-if="strengthMod < 0" class="mod-arrow down">▼</span>
      <span class="str-num" :class="{ pos: strengthMod > 0, neg: strengthMod < 0 }">{{ displayStrength }}</span>
    </div>

    <!-- Materials badge (black) -->
    <div v-if="zone === 'field' && !hidden && materialsCount > 0" class="stack-badge mat">
      {{ materialsCount }}
    </div>

    <!-- Resources badge (green) -->
    <div v-if="zone === 'field' && !hidden && resourcesCount > 0" class="stack-badge res">
      {{ resourcesCount }}
    </div>
  </div>

  <!-- Card context menu (right-click — all zones, own + opponent) -->
  <Teleport to="body">
    <div
      v-if="showMenu"
      class="field-card-menu"
      :style="{ top: menuPos.top + 'px', left: menuPos.left + 'px' }"
      @click.stop
    >
      <button class="fcm-btn" @click="menuViewInfo">Ver</button>
      <template v-if="zone === 'field'">
        <button class="fcm-btn" @click="menuReduceStrength">Reducir fuerza</button>
        <button class="fcm-btn" @click="menuIncreaseStrength">Incrementar fuerza</button>
        <button class="fcm-btn target-btn" @click="menuHacerObjetivo">Hacer objetivo</button>
        <template v-if="materialsCount > 0 || resourcesCount > 0">
          <div class="fcm-divider" />
          <button v-if="materialsCount > 0" class="fcm-btn" @click="openDetach('materials')">Separar materiales</button>
          <button v-if="resourcesCount > 0" class="fcm-btn" @click="openDetach('resources')">Separar recursos</button>
        </template>
      </template>
      <button class="fcm-close" @click="closeMenu">✕ Cerrar</button>
    </div>
    <div v-if="showMenu" class="fcm-backdrop" @click="closeMenu" />
  </Teleport>

  <!-- Hover preview — always top-right corner -->
  <Teleport to="body">
    <div v-if="showPreview && !hidden && cardSlot.imageUrl" class="card-hover-preview">
      <img :src="cardSlot.imageUrl" class="card-preview-img" alt="" />
    </div>
  </Teleport>

  <!-- Card info modal -->
  <CardInfoModal
    v-if="showInfo"
    :cardSlot="cardSlot"
    :targetPlayerId="targetPlayerId"
    @close="showInfo = false"
  />

  <!-- Detach group modal -->
  <DetachGroupModal
    v-if="showDetachModal"
    :cardSlot="cardSlot"
    :groupType="detachGroupType"
    :targetPlayerId="targetPlayerId"
    @close="showDetachModal = false"
  />
</template>

<style scoped>
.card-token {
  width: 82px;
  height: 115px;
  border-radius: 6px;
  overflow: visible;
  flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.15);
  box-shadow: 0 2px 6px rgba(0,0,0,0.5);
  cursor: default;
  user-select: none;
  transition: transform 0.15s, box-shadow 0.1s, border-color 0.1s;
  position: relative;
}
.card-token.small { width: 56px; height: 78px; border-radius: 4px; }

.card-img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 6px; }
.card-token.small .card-img { border-radius: 4px; }

/* Targeted — red pulsing highlight broadcast to opponent */
.card-token.targeted {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px #ef4444, 0 0 16px 4px rgba(239,68,68,0.6);
  animation: target-pulse 0.5s ease-in-out infinite alternate;
}
@keyframes target-pulse {
  from { box-shadow: 0 0 0 3px #ef4444, 0 0 10px 2px rgba(239,68,68,0.5); }
  to   { box-shadow: 0 0 0 3px #ef4444, 0 0 22px 6px rgba(239,68,68,0.8); }
}

/* Targeting mode — show crosshair cursor on all cards */
.card-token.can-target { cursor: crosshair !important; }

/* Strength badge */
.strength-badge {
  position: absolute;
  top: -6px; right: -6px;
  min-width: 22px; height: 22px;
  padding: 0 4px;
  border-radius: 11px;
  background: #f97316;
  border: 2px solid #fff;
  font-size: 0.7rem; font-weight: 800;
  display: flex; align-items: center; justify-content: center; gap: 2px;
  z-index: 10; pointer-events: none;
  box-shadow: 0 2px 6px rgba(0,0,0,0.6);
  line-height: 1;
}
.mod-arrow { font-size: 0.55rem; line-height: 1; }
.mod-arrow.up   { color: #bbf7d0; }
.mod-arrow.down { color: #fecaca; }
.str-num { color: #fff; }
.str-num.pos { color: #bbf7d0; }
.str-num.neg { color: #fecaca; }

/* Stack badges (materials black, resources green) */
.stack-badge {
  position: absolute;
  right: -6px;
  width: 22px; height: 22px;
  border-radius: 50%;
  border: 2px solid #fff;
  color: #fff;
  font-size: 0.7rem; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  z-index: 10; pointer-events: none;
  box-shadow: 0 2px 6px rgba(0,0,0,0.6);
  line-height: 1;
}
.stack-badge.mat { top: 20px; background: #111; }
.stack-badge.res { top: 44px; background: #16a34a; }

.card-token.draggable { cursor: grab; }
.card-token.draggable:hover { transform: translateY(-4px); box-shadow: 0 6px 16px rgba(0,0,0,0.6); }
.card-token.draggable:active { cursor: grabbing; }
.card-token.tapped { transform: rotate(90deg); }
.card-token.tapped.draggable:hover { transform: rotate(90deg) translateY(-4px); }

.card-back {
  width: 100%; height: 100%;
  background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #1a237e 100%);
  display: flex; align-items: center; justify-content: center;
  border-radius: 6px; overflow: hidden;
}
.card-token.small .card-back { border-radius: 4px; }
.card-back-inner {
  width: 80%; height: 85%;
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 4px;
  background: repeating-linear-gradient(
    45deg, transparent, transparent 4px,
    rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px
  );
}

/* Context menu */
:global(.field-card-menu) {
  position: fixed; z-index: 600;
  background: #1e293b;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px; padding: 6px;
  display: flex; flex-direction: column; gap: 4px;
  min-width: 170px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.7);
}
:global(.fcm-btn) {
  background: rgba(255,255,255,0.06); border: none;
  color: #e2e8f0; padding: 7px 12px; border-radius: 5px;
  cursor: pointer; font-size: 0.82rem; text-align: left;
  transition: background 0.15s;
}
:global(.fcm-btn:hover) { background: rgba(255,255,255,0.15); }
:global(.fcm-btn.target-btn) { color: #fbbf24; }
:global(.fcm-btn.target-btn:hover) { background: rgba(251,191,36,0.15); }
:global(.fcm-divider) {
  height: 1px; background: rgba(255,255,255,0.08); margin: 2px 0;
}
:global(.fcm-close) {
  background: rgba(239,68,68,0.12); border: none; color: #f87171;
  padding: 7px 12px; border-radius: 5px; cursor: pointer;
  font-size: 0.82rem; text-align: left; margin-top: 2px;
  transition: background 0.15s;
}
:global(.fcm-close:hover) { background: rgba(239,68,68,0.25); }
:global(.fcm-backdrop) { position: fixed; inset: 0; z-index: 599; }

/* Hover preview — always top-right, above opponent zones */
:global(.card-hover-preview) {
  position: fixed;
  top: 8px; right: 16px;
  z-index: 3000;
  width: 320px; height: 440px;
  border-radius: 8px; overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.8);
  border: 1px solid rgba(255,255,255,0.2);
  pointer-events: none;
}
:global(.card-preview-img) {
  width: 100%; height: 100%;
  object-fit: cover; display: block;
}
</style>
