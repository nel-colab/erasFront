<script setup>
import { ref, watch } from 'vue'
import { useGameStore } from '@/store/game'

const props = defineProps({
  isOpponent:    { type: Boolean, default: false },
  resourceCount: { type: Number,  default: 0 },
})

const game  = useGameStore()
const count = ref(0)

watch(() => props.resourceCount, (val) => { count.value = val })

function increment() {
  const next = Math.min(5, count.value + 1)
  count.value = next
  game.setMarker(next)
}
function decrement() {
  const next = Math.max(0, count.value - 1)
  count.value = next
  game.setMarker(next)
}

function isPipFilled(i) {
  const n = props.isOpponent ? props.resourceCount : count.value
  return props.isOpponent ? i > (5 - n) : i <= n
}
</script>

<template>
  <div class="rc-wrap">
    <div class="rc-row">
      <button
        v-if="!isOpponent"
        class="rc-btn rc-minus"
        :disabled="count === 0"
        @click.stop="decrement"
      >−</button>

      <div class="rc-pips">
        <span
          v-for="i in 5"
          :key="i"
          class="rc-pip"
          :class="{ filled: isPipFilled(i) }"
        />
      </div>

      <button
        v-if="!isOpponent"
        class="rc-btn rc-plus"
        :disabled="count === 5"
        @click.stop="increment"
      >+</button>
    </div>
    <span class="rc-value">{{ isOpponent ? props.resourceCount : count }}</span>
  </div>
</template>

<style scoped>
.rc-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.25rem 0.15rem;
  border: 1px dashed rgba(255,255,255,0.1);
  border-radius: 5px;
  width: 100%;
}
.rc-row {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  justify-content: center;
}
.rc-pips {
  display: flex;
  gap: 3px;
  flex: 1;
  justify-content: center;
}
.rc-pip {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.15);
  transition: background 0.15s, border-color 0.15s;
  flex-shrink: 0;
}
.rc-pip.filled {
  background: #fbbf24;
  border-color: #d97706;
  box-shadow: 0 0 4px rgba(251,191,36,0.5);
}
.rc-btn {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.18);
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.8);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.1s, color 0.1s;
  padding: 0;
}
.rc-btn:hover:not(:disabled) { background: rgba(255,255,255,0.18); color: #fff; }
.rc-btn:disabled { opacity: 0.25; cursor: default; }
.rc-plus { border-color: rgba(251,191,36,0.35); }
.rc-plus:hover:not(:disabled) { background: rgba(251,191,36,0.2); color: #fbbf24; }
.rc-value {
  font-size: 0.58rem;
  font-weight: 700;
  color: rgba(255,255,255,0.5);
  line-height: 1;
}
</style>
