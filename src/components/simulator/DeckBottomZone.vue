<script setup>
import { ref } from 'vue'
import { useGameStore } from '@/store/game'

const props = defineProps({
  isOpponent: { type: Boolean, default: false },
})

const game    = useGameStore()
const hovered = ref(false)

let lastConfirmTime = 0

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

  const now = Date.now()
  const needsConfirm = (now - lastConfirmTime) > 5000
  if (needsConfirm) {
    const ok = window.confirm('¿Enviar esta carta al fondo del mazo?')
    if (!ok) return
  }
  lastConfirmTime = now  // reset on every successful drop — keeps window open while dropping rapidly

  game.moveCard(instanceId, fromZone, 'deck', undefined, undefined, 'bottom')
}
</script>

<template>
  <div
    v-if="!isOpponent"
    class="deck-bottom-zone"
    :class="{ 'drop-active': hovered }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
    title="Arrastra aquí para enviar al fondo del mazo"
  >
    <span class="dbz-label">↓ FONDO</span>
  </div>
  <div v-else class="deck-bottom-zone empty" />
</template>

<style scoped>
.deck-bottom-zone {
  height: 110px;
  min-height: 110px;
  border: 1.5px dashed rgba(255,255,255,0.1);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, background 0.15s;
}
.deck-bottom-zone.empty {
  border-color: transparent;
}
.deck-bottom-zone.drop-active {
  border-color: rgba(99,102,241,0.7);
  background: rgba(99,102,241,0.1);
}
.dbz-label {
  font-size: 0.45rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase;
  user-select: none;
}
.deck-bottom-zone.drop-active .dbz-label {
  color: rgba(165,180,252,0.8);
}
</style>
