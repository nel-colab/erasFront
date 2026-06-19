<script setup>
import { ref, computed } from 'vue'
import { useGameStore } from '@/store/game'
import { persistedDetachDest } from '@/composables/detachState'

const props = defineProps({
  cardSlot:       { type: Object, required: true },
  groupType:      { type: String, required: true }, // 'materials' | 'resources'
  targetPlayerId: { type: String, default: null },
})
const emit = defineEmits(['close'])
const game = useGameStore()

const group = computed(() =>
  props.groupType === 'materials'
    ? (props.cardSlot.materials || [])
    : (props.cardSlot.resources || [])
)

const attachmentType = computed(() =>
  props.groupType === 'materials' ? 'material' : 'resource'
)

const groupLabel = computed(() =>
  props.groupType === 'materials' ? 'Materiales' : 'Recursos'
)

// No cards selected by default — user picks
const selectedIds = ref(new Set())

function toggle(id) {
  const s = new Set(selectedIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedIds.value = s
}

const isSelected    = (id) => selectedIds.value.has(id)
const selectedCount = computed(() => selectedIds.value.size)
const allSelected   = computed(() => selectedIds.value.size === group.value.length && group.value.length > 0)

function toggleAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(group.value.map(c => c.instanceId))
  }
}

// Destinations — grouped for ordered display
const ZONE_DESTS = [
  { key: 'tributeZone', label: 'Tributos',  toZone: 'tributeZone', faceDown: false, position: 'bottom' },
  { key: 'discardPile', label: 'Descarte',  toZone: 'discardPile', faceDown: false, position: 'bottom', danger: true },
  { key: 'hand',        label: 'Mano',      toZone: 'hand',        faceDown: false, position: 'bottom' },
  { key: 'deckBottom',  label: 'Fondo mazo',toZone: 'deck',        faceDown: true,  position: 'bottom' },
]
const LIFE_DESTS = [
  { key: 'lifeBotUp',   label: 'Fondo ↑',  toZone: 'lifeStack', faceDown: false, position: 'bottom' },
  { key: 'lifeTopUp',   label: 'Tope ↑',   toZone: 'lifeStack', faceDown: false, position: 'top'    },
  { key: 'lifeBotDown', label: 'Fondo ↓',  toZone: 'lifeStack', faceDown: true,  position: 'bottom' },
  { key: 'lifeTopDown', label: 'Tope ↓',   toZone: 'lifeStack', faceDown: true,  position: 'top'    },
]
const ALL_DESTS = [...ZONE_DESTS, ...LIFE_DESTS]

const selectedDest = persistedDetachDest

function send() {
  const dest  = ALL_DESTS.find(d => d.key === selectedDest.value)
  if (!dest) return
  group.value.filter(c => selectedIds.value.has(c.instanceId)).forEach(card => {
    game.moveFromAttachment({
      instanceId:     card.instanceId,
      attachmentOf:   props.cardSlot.instanceId,
      attachmentType: attachmentType.value,
      toZone:         dest.toZone,
      faceDown:       dest.faceDown,
      position:       dest.position,
      targetPlayerId: props.targetPlayerId,
    })
  })
  emit('close')
}

function cardLabel(slot) { return slot.cardName || slot.cardId }
</script>

<template>
  <Teleport to="body">
    <div class="dg-backdrop" @click.self="emit('close')">
      <div class="dg-modal">

        <div class="dg-header">
          <span>Separar {{ groupLabel }}</span>
          <button class="close-btn" @click="emit('close')">✕</button>
        </div>

        <!-- Card grid (mulligan-style) -->
        <div class="card-grid-area">
          <div v-if="group.length === 0" class="empty">Sin cartas en este grupo</div>
          <button
            v-for="card in group"
            :key="card.instanceId"
            class="card-pick"
            :class="{ selected: isSelected(card.instanceId) }"
            @click="toggle(card.instanceId)"
            :title="cardLabel(card)"
          >
            <img v-if="card.imageUrl" :src="card.imageUrl" class="pick-img" alt="" />
            <div v-else class="pick-back" />
            <div v-if="isSelected(card.instanceId)" class="pick-badge">✓</div>
          </button>
        </div>

        <div class="selection-hint">
          {{ selectedCount > 0
            ? `${selectedCount} carta${selectedCount > 1 ? 's' : ''} seleccionada${selectedCount > 1 ? 's' : ''}`
            : 'Ninguna seleccionada — haz clic para elegir' }}
        </div>

        <!-- Destination: zone row -->
        <div class="dest-section">
          <div class="dest-group-label">Destino</div>
          <div class="dest-row">
            <button
              v-for="d in ZONE_DESTS"
              :key="d.key"
              class="dest-btn"
              :class="{ active: selectedDest === d.key, danger: d.danger }"
              @click="selectedDest = d.key"
            >{{ d.label }}</button>
          </div>

          <div class="dest-group-label vida-label">Vida</div>
          <div class="dest-life-grid">
            <button
              v-for="d in LIFE_DESTS"
              :key="d.key"
              class="dest-btn"
              :class="{ active: selectedDest === d.key }"
              @click="selectedDest = d.key"
            >{{ d.label }}</button>
          </div>
        </div>

        <!-- Footer -->
        <div class="dg-footer">
          <button class="tog-btn" @click="toggleAll">
            {{ allSelected ? 'Ninguna' : 'Todas' }}
          </button>
          <button class="send-btn" :disabled="selectedCount === 0" @click="send">
            Enviar{{ selectedCount > 0 ? ` (${selectedCount})` : '' }}
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dg-backdrop {
  position: fixed; inset: 0; z-index: 810;
  background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
}

.dg-modal {
  background: #1a2033;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 14px;
  width: min(520px, 95vw);
  max-height: 88vh;
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.85);
}

.dg-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px;
  font-size: 0.92rem; font-weight: 700; color: #e2e8f0;
  border-bottom: 1px solid rgba(255,255,255,0.09);
  flex-shrink: 0;
}
.close-btn {
  background: none; border: none; color: #64748b;
  cursor: pointer; font-size: 1rem; padding: 2px 6px; border-radius: 4px;
}
.close-btn:hover { color: #fff; background: rgba(255,255,255,0.08); }

/* Card grid */
.card-grid-area {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 18px 18px 0;
  justify-content: center;
  overflow-y: auto;
  max-height: 260px;
  flex-shrink: 0;
}

.empty {
  font-size: 0.82rem; color: #475569; font-style: italic;
  padding: 16px 0; width: 100%; text-align: center;
}

.card-pick {
  position: relative;
  background: none;
  border: 2px solid rgba(255,255,255,0.12);
  border-radius: 7px;
  padding: 0;
  cursor: pointer;
  transition: border-color 0.14s, transform 0.14s;
  overflow: hidden;
  flex-shrink: 0;
}
.card-pick:hover {
  border-color: rgba(165,180,252,0.5);
  transform: translateY(-3px);
}
.card-pick.selected {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99,102,241,0.35);
}

.pick-img {
  display: block;
  width: 80px;
  height: 112px;
  object-fit: cover;
}
.pick-back {
  width: 80px; height: 112px;
  background: linear-gradient(135deg, #1a237e, #283593);
}
.pick-badge {
  position: absolute;
  inset: 0;
  background: rgba(99,102,241,0.3);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.4rem; color: #fff; font-weight: 900;
}

.selection-hint {
  font-size: 0.72rem;
  color: rgba(255,255,255,0.3);
  text-align: center;
  padding: 8px 18px 0;
  flex-shrink: 0;
}

/* Destination section */
.dest-section {
  padding: 12px 18px 8px;
  border-top: 1px solid rgba(255,255,255,0.07);
  margin-top: 12px;
  flex-shrink: 0;
}

.dest-group-label {
  font-size: 0.62rem; font-weight: 700; color: #475569;
  text-transform: uppercase; letter-spacing: 0.08em;
  margin-bottom: 6px;
}
.vida-label { margin-top: 10px; }

.dest-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
}

.dest-life-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
}

.dest-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.09);
  color: #94a3b8; font-size: 0.72rem; font-weight: 500;
  padding: 6px 4px; border-radius: 6px;
  cursor: pointer; white-space: nowrap; text-align: center;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.dest-btn:hover { background: rgba(255,255,255,0.11); color: #e2e8f0; }
.dest-btn.active {
  background: rgba(99,102,241,0.18);
  border-color: rgba(99,102,241,0.5);
  color: #a5b4fc; font-weight: 700;
}
.dest-btn.danger { color: #f87171; border-color: rgba(239,68,68,0.15); }
.dest-btn.danger:hover { background: rgba(239,68,68,0.12); }
.dest-btn.active.danger { background: rgba(239,68,68,0.18); border-color: rgba(239,68,68,0.5); }

/* Footer */
.dg-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 18px 14px;
  flex-shrink: 0;
}
.tog-btn {
  background: none; border: 1px solid rgba(255,255,255,0.12);
  color: #94a3b8; font-size: 0.78rem;
  padding: 6px 14px; border-radius: 7px; cursor: pointer;
  transition: background 0.1s;
}
.tog-btn:hover { background: rgba(255,255,255,0.07); }

.send-btn {
  background: #6366f1; border: none;
  color: #fff; font-size: 0.84rem; font-weight: 700;
  padding: 7px 20px; border-radius: 7px; cursor: pointer;
  transition: background 0.12s;
}
.send-btn:hover:not(:disabled) { background: #4f46e5; }
.send-btn:disabled { background: rgba(99,102,241,0.25); color: rgba(255,255,255,0.3); cursor: not-allowed; }
</style>
