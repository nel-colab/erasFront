<script setup>
import { useGameStore } from '@/store/game'

const props = defineProps({
  cardSlot: { type: Object, required: true },
})
const emit = defineEmits(['close'])
const game = useGameStore()

function detach(card, attachmentType, toZone) {
  game.moveFromAttachment({
    instanceId:     card.instanceId,
    attachmentOf:   props.cardSlot.instanceId,
    attachmentType,
    toZone,
  })
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="emit('close')">
      <div class="detach-modal">
        <div class="modal-header">
          <span>Separar cartas</span>
          <button class="close-btn" @click="emit('close')">✕</button>
        </div>

        <div class="section">
          <div class="section-title">Recursos ({{ cardSlot.resources?.length || 0 }})</div>
          <div v-if="!cardSlot.resources?.length" class="empty">Sin recursos</div>
          <div v-for="card in (cardSlot.resources || [])" :key="card.instanceId" class="card-row">
            <img v-if="card.imageUrl" :src="card.imageUrl" class="thumb" alt="" />
            <div v-else class="thumb back" />
            <span class="name">{{ card.cardId }}</span>
            <div class="actions">
              <button class="act-btn" @click="detach(card, 'resource', 'hand')">→ Mano</button>
              <button class="act-btn" @click="detach(card, 'resource', 'discardPile')">→ Descarte</button>
              <button class="act-btn" @click="detach(card, 'resource', 'field')">→ Campo</button>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Materiales ({{ cardSlot.materials?.length || 0 }})</div>
          <div v-if="!cardSlot.materials?.length" class="empty">Sin materiales</div>
          <div v-for="card in (cardSlot.materials || [])" :key="card.instanceId" class="card-row">
            <img v-if="card.imageUrl" :src="card.imageUrl" class="thumb" alt="" />
            <div v-else class="thumb back" />
            <span class="name">{{ card.cardId }}</span>
            <div class="actions">
              <button class="act-btn" @click="detach(card, 'material', 'hand')">→ Mano</button>
              <button class="act-btn" @click="detach(card, 'material', 'discardPile')">→ Descarte</button>
              <button class="act-btn" @click="detach(card, 'material', 'field')">→ Campo</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 800;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}
.detach-modal {
  background: #1e293b;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 12px;
  padding: 0;
  width: 420px;
  max-width: 95vw;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 16px 48px rgba(0,0,0,0.8);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  font-size: 0.9rem;
  font-weight: 700;
  color: #e2e8f0;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.close-btn {
  background: none; border: none; color: #94a3b8;
  cursor: pointer; font-size: 1rem; padding: 2px 6px; border-radius: 4px;
}
.close-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }

.section { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.section-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}
.empty { font-size: 0.8rem; color: #475569; font-style: italic; }

.card-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.card-row:last-child { border-bottom: none; }
.thumb {
  width: 32px;
  height: 44px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
}
.back { background: linear-gradient(135deg, #1a237e, #283593); }
.name { font-size: 0.78rem; color: #cbd5e1; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.actions { display: flex; gap: 4px; flex-shrink: 0; }
.act-btn {
  background: rgba(255,255,255,0.06);
  border: none;
  color: #94a3b8;
  font-size: 0.7rem;
  padding: 3px 7px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}
.act-btn:hover { background: rgba(255,255,255,0.14); color: #e2e8f0; }
</style>
