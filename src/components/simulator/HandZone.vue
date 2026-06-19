<script setup>
import { ref, computed } from 'vue'
import CardToken from './CardToken.vue'
import { useGameStore } from '@/store/game'

const props = defineProps({
  slots:      { type: Array,   default: () => [] },
  isOpponent: { type: Boolean, default: false },
})

const game    = useGameStore()
const hovered = ref(false)

const zoneClass = computed(() => ({
  opponent: props.isOpponent,
  'drop-active': hovered.value && !props.isOpponent,
}))

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
  if (fromZone === 'hand') return
  game.moveCard(instanceId, fromZone, 'hand')
}
</script>

<template>
  <div
    class="hand-zone"
    :class="zoneClass"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="hand-label">{{ isOpponent ? 'MANO' : 'TU MANO' }}</div>
    <div class="hand-scroll">
      <div class="hand-cards">
        <CardToken
          v-for="s in slots"
          :key="s.instanceId"
          :cardSlot="s"
          zone="hand"
          :isOpponent="isOpponent"
        />
        <div v-if="slots.length === 0" class="hand-empty">
          {{ isOpponent ? `${slots.length} cartas` : 'Sin cartas en mano' }}
        </div>
      </div>
    </div>
    <div v-if="isOpponent" class="hand-count">{{ slots.length }} cartas</div>
  </div>
</template>

<style scoped>
.hand-zone.drop-active { background: rgba(99,102,241,0.1); outline: 1.5px dashed rgba(99,102,241,0.5); }
.hand-zone {
  height: 130px;
  background: rgba(12,12,16,0.7);
  border-top: 1px solid rgba(255,255,255,0.07);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.75rem;
  flex-shrink: 0;
}
.hand-zone.opponent {
  border-top: none;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  height: 100px;
}

.hand-label {
  font-size: 0.45rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.3);
  text-transform: uppercase;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
}

/* Scroll container — centers inner when few cards, scrolls when many */
.hand-scroll {
  flex: 1;
  overflow-x: auto;
  display: flex;
  align-items: center;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.2) transparent;
}
.hand-scroll::-webkit-scrollbar { height: 4px; }
.hand-scroll::-webkit-scrollbar-track { background: transparent; }
.hand-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }

/* Inner row — margin: auto centers when content fits, becomes 0 on overflow */
.hand-cards {
  display: flex;
  gap: 0.3rem;
  align-items: center;
  padding: 0.25rem 0;
  margin: 0 auto;
}

.hand-empty {
  font-size: 0.7rem;
  color: rgba(255,255,255,0.2);
}
.hand-count {
  font-size: 0.65rem;
  color: rgba(255,255,255,0.4);
  flex-shrink: 0;
}
</style>
