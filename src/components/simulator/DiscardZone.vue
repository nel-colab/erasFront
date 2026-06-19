<script setup>
import { ref, computed } from 'vue'
import CardToken from './CardToken.vue'
import ZoneModal from './ZoneModal.vue'
import { useGameStore } from '@/store/game'
import { targetingSource } from '@/composables/targetingState'

const props = defineProps({
  slots:          { type: Array,   default: () => [] },
  isOpponent:     { type: Boolean, default: false },
  targetPlayerId: { type: String,  default: null },
})

const game      = useGameStore()
const hovered   = ref(false)
const showModal = ref(false)

const topCard  = computed(() =>
  props.slots.length > 0 ? props.slots[props.slots.length - 1] : null
)
const zoneClass = computed(() => ({
  'drop-active': hovered.value,
  opponent: props.isOpponent,
  'has-cards': props.slots.length > 0,
  targeted: game.targetedInstanceId === zoneTargetId.value,
}))

const zoneTargetId = computed(() =>
  `zone:${props.isOpponent ? 'opp' : 'own'}:discardPile`
)

function onDragOver(e) {
  if (props.isOpponent) return
  e.preventDefault()
  hovered.value = true
}
function onDragLeave() { hovered.value = false }
function onDrop(e) {
  if (props.isOpponent) return
  hovered.value = false
  e.preventDefault()
  const raw = e.dataTransfer.getData('text/plain')
  if (!raw) return
  const { instanceId, fromZone } = JSON.parse(raw)
  game.moveCard(instanceId, fromZone, 'discardPile')
}

function onClick() {
  if (targetingSource.value !== null) {
    game.targetCard(zoneTargetId.value)
    return
  }
  if (props.slots.length > 0) showModal.value = true
}
</script>

<template>
  <div
    class="discard-zone"
    :class="zoneClass"
    :data-zone-id="zoneTargetId"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
    @click="onClick"
  >
    <div class="zone-label">DESCARTE</div>
    <CardToken
      v-if="topCard"
      :cardSlot="topCard"
      zone="discardPile"
      :isOpponent="isOpponent"
      :small="true"
    />
    <div v-else class="zone-empty"><i class="bi bi-trash3"></i></div>
    <div v-if="slots.length > 0" class="discard-count">{{ slots.length }}</div>
  </div>

  <ZoneModal
    :visible="showModal"
    title="Descarte"
    :cards="slots"
    zone="discardPile"
    :readOnly="false"
    :isOpponent="isOpponent"
    :targetPlayerId="targetPlayerId"
    @close="showModal = false"
  />
</template>

<style scoped>
.discard-zone.has-cards { cursor: pointer; }
.discard-zone.has-cards:hover { border-color: rgba(239,154,154,0.5); }
.discard-zone {
  height: 110px;
  min-height: 110px;
  border: 1.5px dashed rgba(255,255,255,0.2);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.3rem;
  gap: 0.2rem;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  position: relative;
}
.discard-zone.drop-active {
  border-color: #ef9a9a;
  background: rgba(239,154,154,0.08);
}
.discard-zone.targeted {
  border-color: #ef4444;
  box-shadow: 0 0 0 2px #ef4444, 0 0 14px 3px rgba(239,68,68,0.55);
  animation: zone-pulse 0.5s ease-in-out infinite alternate;
}
@keyframes zone-pulse {
  from { box-shadow: 0 0 0 2px #ef4444, 0 0 8px 2px rgba(239,68,68,0.4); }
  to   { box-shadow: 0 0 0 2px #ef4444, 0 0 20px 5px rgba(239,68,68,0.75); }
}
.zone-label {
  font-size: 0.45rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.4);
  text-transform: uppercase;
}
.zone-empty {
  color: rgba(255,255,255,0.15);
  font-size: 1rem;
  padding: 0.5rem;
}
.discard-count {
  font-size: 0.6rem;
  font-weight: 700;
  color: rgba(255,255,255,0.5);
  background: rgba(0,0,0,0.3);
  border-radius: 8px;
  padding: 0.05rem 0.3rem;
}
</style>
