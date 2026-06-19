<script setup>
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/store/game'
import { targetingSource } from '@/composables/targetingState'

const game = useGameStore()

// Live cursor line while in targeting mode (source → cursor)
const cursorPos = ref({ x: 0, y: 0 })
function onMouseMove(e) {
  cursorPos.value = { x: e.clientX, y: e.clientY }
}
onMounted(()  => window.addEventListener('mousemove', onMouseMove))
onUnmounted(() => window.removeEventListener('mousemove', onMouseMove))

// Source card center while in targeting mode
const sourcePos = ref(null)

watch(targetingSource, (id) => {
  if (!id) { sourcePos.value = null; return }
  nextTick(() => {
    const el = document.querySelector(`[data-instance-id="${id}"]`)
    if (!el) return
    const r = el.getBoundingClientRect()
    sourcePos.value = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
})

// Completed target line (source → target, shown for 3s)
const targetLine = ref(null)   // { x1, y1, x2, y2 } | null

watch(() => [game.targetingSourceId, game.targetedInstanceId], ([srcId, tgtId]) => {
  if (!srcId || !tgtId) { targetLine.value = null; return }
  nextTick(() => {
    const srcEl  = document.querySelector(`[data-instance-id="${srcId}"]`)
    let tgtEl
    if (tgtId.startsWith('zone:')) {
      tgtEl = document.querySelector(`[data-zone-id="${tgtId}"]`)
    } else {
      tgtEl = document.querySelector(`[data-instance-id="${tgtId}"]`)
    }
    if (!srcEl || !tgtEl) return
    const s = srcEl.getBoundingClientRect()
    const t = tgtEl.getBoundingClientRect()
    targetLine.value = {
      x1: s.left + s.width  / 2,
      y1: s.top  + s.height / 2,
      x2: t.left + t.width  / 2,
      y2: t.top  + t.height / 2,
    }
  })
}, { deep: true })

const showLiveLine = computed(() =>
  targetingSource.value !== null && sourcePos.value !== null
)
const showTargetLine = computed(() => targetLine.value !== null)

// Arrow marker id
const markerId = 'targeting-arrow'
</script>

<template>
  <Teleport to="body">
    <svg
      v-if="showLiveLine || showTargetLine"
      class="targeting-svg"
    >
      <defs>
        <marker
          :id="markerId"
          markerWidth="8" markerHeight="8"
          refX="6" refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="#ef4444" />
        </marker>
      </defs>

      <!-- Live line: source → cursor -->
      <line
        v-if="showLiveLine"
        :x1="sourcePos.x"
        :y1="sourcePos.y"
        :x2="cursorPos.x"
        :y2="cursorPos.y"
        class="target-live-line"
        :marker-end="`url(#${markerId})`"
      />

      <!-- Completed line: source → target (3s) -->
      <line
        v-if="showTargetLine"
        :x1="targetLine.x1"
        :y1="targetLine.y1"
        :x2="targetLine.x2"
        :y2="targetLine.y2"
        class="target-done-line"
        :marker-end="`url(#${markerId})`"
      />
    </svg>

  </Teleport>
</template>

<style scoped>
:global(.targeting-svg) {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 4000;
  overflow: visible;
}

:global(.target-live-line) {
  stroke: #ef4444;
  stroke-width: 2.5;
  stroke-dasharray: 8 5;
  opacity: 0.75;
  animation: dash-flow 0.5s linear infinite;
}

:global(.target-done-line) {
  stroke: #ef4444;
  stroke-width: 3;
  stroke-dasharray: none;
  opacity: 0.9;
  filter: drop-shadow(0 0 6px rgba(239,68,68,0.8));
  animation: line-fade 3s forwards;
}

@keyframes dash-flow {
  to { stroke-dashoffset: -13; }
}
@keyframes line-fade {
  0%   { opacity: 0.9; }
  70%  { opacity: 0.9; }
  100% { opacity: 0; }
}
</style>
