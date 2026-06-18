<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  decks:      { type: Array,  default: () => [] },
  placeholder:{ type: String, default: '— Sin mazo —' },
})

const emit = defineEmits(['update:modelValue'])

const open        = ref(false)
const search      = ref('')
const containerRef = ref(null)

const selectedDeck = computed(() => props.decks.find(d => d.id === props.modelValue) || null)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.decks
  return props.decks.filter(d => (d.deckName || '').toLowerCase().includes(q))
})

const toggle = () => {
  open.value = !open.value
  if (open.value) search.value = ''
}

const select = id => {
  emit('update:modelValue', id)
  open.value  = false
  search.value = ''
}

const clear = e => {
  e.stopPropagation()
  emit('update:modelValue', '')
}

const onOutside = e => {
  if (!containerRef.value?.contains(e.target)) open.value = false
}

onMounted(()  => document.addEventListener('mousedown', onOutside))
onUnmounted(() => document.removeEventListener('mousedown', onOutside))
</script>

<template>
  <div class="dp-wrap" ref="containerRef">

    <!-- Trigger -->
    <button type="button" class="dp-trigger" @click="toggle" :class="{ open }">
      <template v-if="selectedDeck">
        <img
          v-if="selectedDeck.deckImage"
          :src="selectedDeck.deckImage"
          class="dp-thumb"
          draggable="false"
          alt=""
        />
        <div v-else class="dp-thumb dp-thumb-empty">?</div>
        <span class="dp-selected-name">{{ selectedDeck.deckName }}</span>
        <button type="button" class="dp-clear" @click="clear" title="Quitar">×</button>
      </template>
      <template v-else>
        <span class="dp-placeholder">{{ placeholder }}</span>
      </template>
      <i class="bi bi-chevron-down dp-chevron" :class="{ rotated: open }"></i>
    </button>

    <!-- Dropdown -->
    <div v-if="open" class="dp-dropdown">
      <div class="dp-search-wrap">
        <i class="bi bi-search dp-search-icon"></i>
        <input
          v-model="search"
          type="text"
          class="dp-search"
          placeholder="Buscar mazo…"
          autofocus
          @keydown.escape="open = false"
        />
      </div>

      <div class="dp-list">
        <button
          type="button"
          class="dp-option dp-none-opt"
          @click="select('')"
          :class="{ active: !modelValue }"
        >
          <span>— Sin mazo —</span>
        </button>

        <div v-if="filtered.length === 0" class="dp-empty">Sin resultados</div>

        <button
          v-for="deck in filtered"
          :key="deck.id"
          type="button"
          class="dp-option"
          :class="{ active: modelValue === deck.id }"
          @click="select(deck.id)"
        >
          <img
            v-if="deck.deckImage"
            :src="deck.deckImage"
            class="dp-opt-img"
            draggable="false"
            alt=""
          />
          <div v-else class="dp-opt-img dp-opt-img-empty">?</div>
          <span class="dp-opt-name">{{ deck.deckName }}</span>
          <i v-if="modelValue === deck.id" class="bi bi-check2 dp-check"></i>
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.dp-wrap {
  position: relative;
  width: 100%;
}

/* ── Trigger ───────────────────────────────────────────────────── */
.dp-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--card-bg);
  border: 1px solid var(--input-border);
  border-radius: 6px;
  color: var(--text-primary);
  padding: 0.3rem 0.5rem;
  font-size: 0.76rem;
  cursor: pointer;
  text-align: left;
  min-height: 38px;
  transition: border-color 0.12s;
  box-sizing: border-box;
}

.dp-trigger:hover,
.dp-trigger.open { border-color: var(--input-focus); }

.dp-thumb {
  width: 28px;
  height: 38px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
  border: 1px solid var(--card-border);
}

.dp-thumb-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--input-bg);
  color: var(--text-muted);
  font-size: 0.85rem;
}

.dp-selected-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dp-placeholder {
  flex: 1;
  color: var(--text-muted);
}

.dp-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.1rem;
  flex-shrink: 0;
}
.dp-clear:hover { color: var(--error-color); }

.dp-chevron {
  font-size: 0.65rem;
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform 0.15s;
}
.dp-chevron.rotated { transform: rotate(180deg); }

/* ── Dropdown ──────────────────────────────────────────────────── */
.dp-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 500;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.2);
  display: flex;
  flex-direction: column;
  max-height: 280px;
  overflow: hidden;
}

.dp-search-wrap {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--card-border);
  flex-shrink: 0;
}

.dp-search-icon { font-size: 0.7rem; color: var(--text-muted); }

.dp-search {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 0.76rem;
}

.dp-list {
  overflow-y: auto;
  flex: 1;
}

.dp-empty {
  padding: 1rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.72rem;
}

/* ── Option ────────────────────────────────────────────────────── */
.dp-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.35rem 0.6rem;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--text-primary);
  transition: background-color 0.1s;
}

.dp-option:hover   { background-color: var(--input-bg); }
.dp-option.active  { background-color: rgba(63, 81, 181, 0.08); }

.dp-none-opt {
  font-size: 0.72rem;
  color: var(--text-muted);
  border-bottom: 1px solid var(--card-border);
  padding: 0.4rem 0.6rem;
}

.dp-opt-img {
  width: 32px;
  height: 44px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
  border: 1px solid var(--card-border);
}

.dp-opt-img-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--input-bg);
  color: var(--text-muted);
  font-size: 0.8rem;
}

.dp-opt-name {
  flex: 1;
  font-size: 0.74rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dp-check {
  font-size: 0.75rem;
  color: #3f51b5;
  flex-shrink: 0;
}
</style>
