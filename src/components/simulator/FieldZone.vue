<script setup>
import { ref, computed } from 'vue'
import CardToken from './CardToken.vue'
import CreatureInteractionModal from './CreatureInteractionModal.vue'
import { useGameStore } from '@/store/game'
import { draggingCard } from '@/composables/dragState'
import { targetingSource } from '@/composables/targetingState'
import { effectSummonPending } from '@/composables/effectSummonState'

const props = defineProps({
  slots:      { type: Array,   default: () => [] },
  isOpponent: { type: Boolean, default: false },
})

const game      = useGameStore()
const hovered   = ref(false)
const zoneClass = computed(() => ({
  'drop-active': hovered.value,
  opponent: props.isOpponent,
}))

// creature-on-creature interaction
const interactionSummoned = ref(null)
const interactionSummoner = ref(null)
const interactionFromZone = ref(null)
const willInteract        = ref(null) // field slot that would be targeted during drag

const PROXIMITY = 7 // % threshold

function findNearbyCreature(x, y, excludeId) {
  return props.slots.find(s =>
    s.instanceId !== excludeId &&
    s.cardType === 'creature' &&
    Math.abs((s.x ?? 50) - x) < PROXIMITY &&
    Math.abs((s.y ?? 50) - y) < PROXIMITY
  ) ?? null
}

function onDragOver(e) {
  e.preventDefault()
  if (props.isOpponent) {
    if (draggingCard.value) {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width)  * 100
      const y = 100 - ((e.clientY - rect.top) / rect.height) * 100
      willInteract.value = findNearbyCreature(x, y, null)
    }
    return
  }
  hovered.value = true
  if (draggingCard.value) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width)  * 100
    const y = ((e.clientY - rect.top)  / rect.height) * 100
    willInteract.value = findNearbyCreature(x, y, draggingCard.value.instanceId)
  }
}

function onDragLeave() {
  hovered.value = false
  willInteract.value = null
}

function onDrop(e) {
  hovered.value = false
  e.preventDefault()
  const raw = e.dataTransfer.getData('text/plain')
  if (!raw) { willInteract.value = null; return }
  const { instanceId, fromZone } = JSON.parse(raw)
  const rect = e.currentTarget.getBoundingClientRect()
  const x    = ((e.clientX - rect.left) / rect.width)  * 100
  const y    = ((e.clientY - rect.top)  / rect.height) * 100

  if (props.isOpponent) {
    const mirroredY = 100 - y
    const nearby = findNearbyCreature(x, mirroredY, null)
    willInteract.value = null
    if (nearby) {
      targetingSource.value = instanceId
      game.targetCard(nearby.instanceId)
    }
    return
  }

  willInteract.value = null
  const nearby = findNearbyCreature(x, y, instanceId)
  if (nearby) {
    const fieldSlot  = props.slots.find(s => s.instanceId === instanceId)
    const zoneSlots  = game.myState?.[fromZone] ?? []
    const zoneSlot   = zoneSlots.find(s => s.instanceId === instanceId)
    const draggedSlot = fieldSlot ?? zoneSlot ?? { instanceId, imageUrl: null, cardType: 'creature', materials: [], resources: [] }
    interactionSummoned.value = draggedSlot
    interactionSummoner.value = nearby
    interactionFromZone.value = fromZone
    return
  }

  const zoneSlots  = game.myState?.[fromZone] ?? []
  const droppedCard = zoneSlots.find(c => c.instanceId === instanceId)
  const isCreatureSummon = game.roomStatus === 'IN_PROGRESS'
    && fromZone !== 'field'
    && droppedCard?.cardType === 'creature'

  game.moveCard(instanceId, fromZone, 'field', x, y)

  if (isCreatureSummon) effectSummonPending.value = true
}
</script>

<template>
  <div
    class="field-zone"
    :class="zoneClass"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <span class="field-section top-label">{{ isOpponent ? 'RETAGUARDIA' : 'VANGUARDIA' }}</span>
    <div class="field-divider-line" />
    <span class="field-section bottom-label">{{ isOpponent ? 'VANGUARDIA' : 'RETAGUARDIA' }}</span>

    <div v-if="slots.length === 0" class="field-hint">
      {{ isOpponent ? 'Campo del oponente' : 'Arrastra cartas aquí' }}
    </div>
    <div
      v-for="s in slots"
      :key="s.instanceId"
      class="field-card-wrapper"
      :style="{
        left:   (s.x ?? 50) + '%',
        top:    (isOpponent ? (100 - (s.y ?? 50)) : (s.y ?? 50)) + '%',
        zIndex: draggingCard?.instanceId === s.instanceId ? 100 : 1,
      }"
    >
      <CardToken :cardSlot="s" zone="field" :isOpponent="isOpponent" />
    </div>

    <!-- Interaction hint during drag -->
    <Transition name="hint-fade">
      <div v-if="willInteract && !isOpponent" class="interact-hint">
        Suelta para interactuar con {{ willInteract.cardName || 'la criatura' }}
      </div>
    </Transition>
  </div>

  <CreatureInteractionModal
    v-if="interactionSummoned && interactionSummoner"
    :summonedSlot="interactionSummoned"
    :summonerSlot="interactionSummoner"
    :fromZone="interactionFromZone"
    @close="interactionSummoned = null; interactionSummoner = null"
  />
</template>

<style scoped>
.field-zone {
  flex: 1;
  position: relative;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 6px;
  background: rgba(22, 22, 30, 0.65);
  min-height: 0;
  overflow: hidden;
  transition: background 0.15s, border-color 0.15s;
}
.field-zone.drop-active {
  background: rgba(42, 42, 62, 0.7);
  border-color: rgba(165,180,252,0.25);
}

.field-section {
  position: absolute;
  right: 6px;
  font-size: 0.38rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.08);
  text-transform: uppercase;
  pointer-events: none;
  user-select: none;
}
.top-label    { top: 4px; }
.bottom-label { bottom: 4px; }

.field-divider-line {
  position: absolute;
  left: 0; right: 0; top: 50%;
  height: 1px;
  background: rgba(255,255,255,0.04);
  pointer-events: none;
}

.field-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  color: rgba(255,255,255,0.12);
  pointer-events: none;
  user-select: none;
}

.field-card-wrapper {
  position: absolute;
  transform: translate(-50%, -50%);
}

/* Interaction hint */
.interact-hint {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(250, 204, 21, 0.92);
  color: #1a1a00;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 5px 14px;
  border-radius: 20px;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 2px 12px rgba(0,0,0,0.4);
  z-index: 50;
}

.hint-fade-enter-active,
.hint-fade-leave-active { transition: opacity 0.15s, transform 0.15s; }
.hint-fade-enter-from,
.hint-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(6px); }
</style>
