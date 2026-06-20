<script setup>
import { ref, computed } from 'vue'
import { useGameStore } from '@/store/game'

const props = defineProps({
  summonedSlot: { type: Object, required: true },
  summonerSlot: { type: Object, required: true },
  fromZone:     { type: String, required: true },
})
const emit = defineEmits(['close'])
const game = useGameStore()

const showAttachChoice = ref(false)
const pendingAction    = ref(null)

function hasSummonedAttachments() {
  return (props.summonedSlot.materials?.length || 0) + (props.summonedSlot.resources?.length || 0) > 0
}

// Map specialSummonKind (DB value) to action key + display label
const SUMMON_MAP = {
  'materialization':  { key: 'materialization', label: 'Materialización' },
  'evolution':        { key: 'evolution',        label: 'Evolución'       },
  'ritual':           { key: 'ritual',           label: 'Ritual'          },
  'promotion':          { key: 'promotion',          label: 'Ascenso'         },
}

const validSummon = computed(() => {
  const kind = props.summonedSlot.specialSummonKind
  if (!kind) return null
  return SUMMON_MAP[kind.toLowerCase().trim()] ?? null
})

function doSpecialSummon() {
  if (!validSummon.value) return
  game.specialSummon({
    summonedId: props.summonedSlot.instanceId,
    fromZone:   props.fromZone,
    summonerId: props.summonerSlot.instanceId,
    summonType: validSummon.value.key,
  })
  emit('close')
}

function tryAddMaterial() {
  if (props.fromZone === 'field' && hasSummonedAttachments()) {
    pendingAction.value = 'material'
    showAttachChoice.value = true
  } else {
    game.addMaterial({
      instanceId:       props.summonedSlot.instanceId,
      fromZone:         props.fromZone,
      targetInstanceId: props.summonerSlot.instanceId,
    })
    emit('close')
  }
}

function tryAddResource() {
  game.addResource({
    instanceId:       props.summonedSlot.instanceId,
    fromZone:         props.fromZone,
    targetInstanceId: props.summonerSlot.instanceId,
  })
  emit('close')
}

function confirmAttachChoice(choice) {
  if (pendingAction.value === 'material') {
    game.addMaterial({
      instanceId:       props.summonedSlot.instanceId,
      fromZone:         props.fromZone,
      targetInstanceId: props.summonerSlot.instanceId,
      attachmentChoice: choice,
    })
  }
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="emit('close')">

      <!-- Attachment sub-choice -->
      <div v-if="showAttachChoice" class="interact-modal">
        <div class="modal-header">
          <span>¿Qué hacer con los anexos de la carta?</span>
          <button class="close-btn" @click="emit('close')">✕</button>
        </div>
        <div class="option-list">
          <button class="opt-btn" @click="confirmAttachChoice('resources_only')">
            Solo recursos → campo / descartar materiales
          </button>
          <button class="opt-btn" @click="confirmAttachChoice('materials_only')">
            Solo materiales → campo / descartar recursos
          </button>
          <button class="opt-btn" @click="confirmAttachChoice('all')">
            Transferir todo
          </button>
          <button class="opt-btn danger" @click="confirmAttachChoice('discard_all')">
            Descartar todo
          </button>
        </div>
      </div>

      <!-- Main interaction menu -->
      <div v-else class="interact-modal">
        <div class="modal-header">
          <span>Interacción de criaturas</span>
          <button class="close-btn" @click="emit('close')">✕</button>
        </div>

        <div class="cards-preview">
          <div class="card-preview-item">
            <img
              v-if="summonedSlot.imageUrl"
              :src="summonedSlot.imageUrl"
              class="preview-img"
              alt=""
            />
            <div v-else class="preview-back" />
            <span class="preview-label">entrante</span>
          </div>
          <div class="arrow">→</div>
          <div class="card-preview-item">
            <img
              v-if="summonerSlot.imageUrl"
              :src="summonerSlot.imageUrl"
              class="preview-img"
              alt=""
            />
            <div v-else class="preview-back" />
            <span class="preview-label">en campo</span>
          </div>
        </div>

        <!-- Special summon — only if card has a specialSummonKind -->
        <template v-if="validSummon">
          <div class="section-title">Invocación especial</div>
          <div class="option-list">
            <button class="opt-btn" @click="doSpecialSummon">
              <span class="opt-title">{{ validSummon.label }}</span>
            </button>
          </div>
        </template>

        <div class="section-title" :style="validSummon ? 'margin-top:12px' : ''">Anexar</div>
        <div class="option-list">
          <button class="opt-btn" @click="tryAddMaterial">
            <span class="opt-title">Agregar como material</span>
          </button>
          <button class="opt-btn" @click="tryAddResource">
            <span class="opt-title">Agregar como recurso</span>
          </button>
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
.interact-modal {
  background: #1e293b;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 12px;
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

.cards-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.card-preview-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.preview-img {
  width: 80px;
  height: 112px;
  object-fit: cover;
  border-radius: 5px;
  border: 1px solid rgba(255,255,255,0.2);
}
.preview-back {
  width: 80px;
  height: 112px;
  border-radius: 5px;
  background: linear-gradient(135deg, #1a237e, #283593);
  border: 1px solid rgba(255,255,255,0.2);
}
.preview-label { font-size: 0.72rem; color: #64748b; }
.arrow { font-size: 1.4rem; color: #475569; }

.section-title {
  font-size: 0.72rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 10px 16px 4px;
}
.option-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 12px 12px;
}
.opt-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  color: #e2e8f0;
  padding: 10px 14px;
  border-radius: 7px;
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: background 0.15s;
}
.opt-btn:hover { background: rgba(255,255,255,0.12); }
.opt-btn.danger { color: #f87171; border-color: rgba(239,68,68,0.2); }
.opt-btn.danger:hover { background: rgba(239,68,68,0.12); }
.opt-title { font-size: 0.85rem; font-weight: 600; }
</style>
