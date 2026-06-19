<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/store/game'

const game = useGameStore()
const containerRef = ref(null)
const isDragging   = ref(false)
const dragValue    = ref(null)

// Display: indices 0-20 → values [10,9,8,...,1,0,1,...,8,9,10]
const LABELS = [10,9,8,7,6,5,4,3,2,1,0,1,2,3,4,5,6,7,8,9,10]

const serverValue  = computed(() => game.gameState?.sharedCounter ?? 0)
const displayValue = computed(() => dragValue.value ?? serverValue.value)

// Second player sees the bar mirrored: their left is their positive direction
const effectiveValue = computed(() => game.isFirstPlayer ? displayValue.value : -displayValue.value)
const activeIndex    = computed(() => effectiveValue.value + 10)   // 0..20
const markerPct      = computed(() => (activeIndex.value / 20) * 100 + '%')

function clickNumber(idx) {
  const val = game.isFirstPlayer ? idx - 10 : 10 - idx
  game.setCounter(val)
}

function onMarkerMousedown(e) {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = true
}

function onMousemove(e) {
  if (!isDragging.value || !containerRef.value) return
  const rect  = containerRef.value.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const rawIdx = Math.round(ratio * 20)
  dragValue.value = game.isFirstPlayer ? rawIdx - 10 : 10 - rawIdx
}

function onMouseup() {
  if (isDragging.value && dragValue.value !== null) {
    game.setCounter(dragValue.value)
    dragValue.value = null
  }
  isDragging.value = false
}

onMounted(() => {
  document.addEventListener('mousemove', onMousemove)
  document.addEventListener('mouseup',  onMouseup)
})
onUnmounted(() => {
  document.removeEventListener('mousemove', onMousemove)
  document.removeEventListener('mouseup',  onMouseup)
})
</script>

<template>
  <div class="sc-wrap" ref="containerRef">
    <!-- Track numbers -->
    <div class="sc-numbers">
      <span
        v-for="(lbl, i) in LABELS"
        :key="i"
        class="sc-num"
        :class="{
          active: i === activeIndex,
          zero:   lbl === 0,
          side:   lbl !== 0,
        }"
        @click="clickNumber(i)"
      >{{ lbl }}</span>
    </div>

    <!-- Marker line + dot -->
    <div class="sc-rail">
      <div class="sc-bar-left"  :style="{ width: markerPct }" />
      <div class="sc-bar-right" :style="{ width: `calc(100% - ${markerPct})` }" />
      <div
        class="sc-marker"
        :style="{ left: markerPct }"
        @mousedown="onMarkerMousedown"
        title="Arrastra el marcador"
      />
    </div>
  </div>
</template>

<style scoped>
.sc-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 0 0.5rem;
  user-select: none;
  min-width: 0;
}

.sc-numbers {
  display: grid;
  grid-template-columns: repeat(21, 1fr);
  width: 100%;
}

.sc-num {
  text-align: center;
  font-size: 0.62rem;
  font-weight: 500;
  color: rgba(255,255,255,0.3);
  cursor: pointer;
  line-height: 1.4;
  transition: color 0.1s;
  border-radius: 3px;
}
.sc-num:hover { color: rgba(255,255,255,0.8); }
.sc-num.zero  { color: rgba(255,255,255,0.55); font-weight: 700; }
.sc-num.active {
  color: #a5b4fc;
  font-weight: 800;
  background: rgba(99,102,241,0.15);
  border-radius: 3px;
}

.sc-rail {
  position: relative;
  height: 8px;
  display: flex;
  align-items: center;
}
.sc-bar-left {
  height: 2px;
  background: rgba(165,180,252,0.5);
  border-radius: 2px 0 0 2px;
  flex-shrink: 0;
}
.sc-bar-right {
  height: 2px;
  background: rgba(255,255,255,0.12);
  border-radius: 0 2px 2px 0;
  flex-shrink: 0;
}
.sc-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  background: #a5b4fc;
  border: 2px solid #6366f1;
  border-radius: 50%;
  cursor: grab;
  z-index: 2;
  transition: background 0.1s, transform 0.1s;
  box-shadow: 0 0 6px rgba(99,102,241,0.6);
}
.sc-marker:hover {
  background: #c7d2fe;
  transform: translate(-50%, -50%) scale(1.25);
}
</style>
