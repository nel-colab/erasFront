<script setup>
import { ref, watch, computed } from 'vue'
import { useCardsStore } from '@/store/cards'
import { useAuthStore  } from '@/store/login'

const props = defineProps({
  card:             { type: Object,  required: true  },
  prevDisabled:     { type: Boolean, default: true   },
  nextDisabled:     { type: Boolean, default: true   },
  sameNameCards:    { type: Array,   default: () => [] },
  editionVariantIdx:{ type: Number,  default: 0      },
  deletingCard:     { type: Boolean, default: false  },
})

const emit = defineEmits([
  'close', 'prev', 'next',
  'prev-edition', 'next-edition',
  'save-name',
  'open-create', 'open-edit',
  'delete-meta', 'delete-image', 'delete-both',
])

const auth       = useAuthStore()
const cardsStore = useCardsStore()
const refData    = computed(() => cardsStore.refData || {})

// ── Inline name editing ───────────────────────────────────────────────────
const editingName      = ref(false)
const editingNameValue = ref('')

watch(() => props.card, () => { editingName.value = false })

function startEditName(e) {
  e.stopPropagation()
  editingNameValue.value = props.card.name
  editingName.value = true
}
function commitName() {
  emit('save-name', editingNameValue.value)
  editingName.value = false
}
function cancelName() {
  editingName.value = false
}

// ── Constants ─────────────────────────────────────────────────────────────
const CARD_TYPE_ES = { creature: 'Criatura', utility: 'Utilidad', structure: 'Estructura' }
const SS_KIND_ES   = { materialization: 'Materialización', promotion: 'Ascenso', ritual: 'Ritual', evolution: 'Evolución' }
const COLOR_NAMES  = { B: 'Azúl', G: 'Verde', P: 'Violeta', R: 'Rojo', W: 'Blanco' }

const colorLabel = c => ({ B: 'Blue', G: 'Green', P: 'Purple', R: 'Red', W: 'White' }[c] ?? c)
const subLabel   = s => (s === null || s === '') ? 'MAIN' : `SUB${s}`
const mapColors  = colors => (colors ?? []).map(c => COLOR_NAMES[c] ?? c)

const cardImageUrl = card => {
  if (!card?.image_url) return null
  const ts = card.time_stamp ? new Date(card.time_stamp).getTime() : Date.now()
  return `${card.image_url}?v=${ts}`
}

// ── Effect rendering (identical to Cards.vue) ─────────────────────────────
const escapeHtml = s => s
  ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  : ''

const getKwDescription = kwKey => {
  const r = refData.value.keywordEffects?.[kwKey]
  return r?.displayText || null
}

const resolveTokensHtml = (text, collectedKws) => {
  if (!text) return ''
  return escapeHtml(text).replace(
    /\[\[([^\]:]+)(?::([^\]]*))?\]\]/g,
    (_, kw, val) => {
      const rendered = val ? kw.replace(/\{[^}]+\}/, val) : kw
      collectedKws.push({ kw, val: val || null, rendered })
      return `<span class="kw-inline">${escapeHtml(rendered)}</span>`
    }
  )
}

const renderEffectHtml = ef => {
  const parts = []
  if (ef.instance) parts.push(escapeHtml(`<${ef.instance}>`))
  if (ef.ussageLimit === 'once per turn') parts.push('[una vez por turno]')
  else if (ef.ussageLimit === 'once per turn between copies') parts.push('[una vez por turno] entre copias,')
  else if (ef.ussageLimit === 'ultimate effect') parts.push('[efecto definitivo]')
  ;(ef.effectBlocks ?? []).forEach(b => {
    const blockKws = []
    let s = ''
    if (b.activationCondition) s += resolveTokensHtml(b.activationCondition, blockKws) + ': '
    if (b.cost)                s += resolveTokensHtml(b.cost, blockKws) + '; '
    if (b.resolution)          s += resolveTokensHtml(b.resolution, blockKws)
    if (s.trim()) {
      let blockHtml = s.trim()
      blockKws.forEach(({ kw, val, rendered }) => {
        const desc = getKwDescription(kw)
        if (desc) {
          const descResolved = val ? desc.replace(/\{[^}]+\}/, val) : desc
          blockHtml += ` <span class="kw-desc">(${escapeHtml(rendered)}: ${escapeHtml(descResolved)})</span>`
        }
      })
      parts.push(blockHtml)
    }
  })
  return parts.join(' ') || 'efecto vacío'
}

const renderCardKwEffect = ke => {
  if (!ke?.keyword) return ''
  const rendered = ke.number != null ? ke.keyword.replace(/\{[^}]+\}/, ke.number) : ke.keyword
  const desc = getKwDescription(ke.keyword)
  let html = `<span class="kw-name">${escapeHtml(rendered)}</span>`
  if (desc) {
    const descResolved = ke.number != null ? desc.replace(/\{[^}]+\}/g, ke.number) : desc
    html += ` <span class="kw-desc">(${escapeHtml(descResolved)})</span>`
  }
  return html
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('close')">
      <button class="modal-nav modal-nav--prev" @click="emit('prev')" :disabled="prevDisabled">
        <i class="bi bi-chevron-left"></i>
      </button>

      <div class="modal-box">
        <div class="modal-name-row">
          <input
            v-if="editingName"
            class="modal-name-input"
            v-model="editingNameValue"
            @blur="commitName"
            @keyup.enter="$event.target.blur()"
            @keyup.escape="cancelName"
          />
          <template v-else>
            <h1 class="modal-card-name">{{ card.name }}</h1>
            <button v-if="auth.can('manage_cards')" class="btn-modal-edit-name" @click="startEditName($event)" title="Edit name">
              <i class="bi bi-pencil"></i>
            </button>
          </template>
        </div>

        <button class="modal-close" @click="emit('close')">✕</button>

        <div class="form-with-preview">
          <div class="form-main">
            <div class="modal-info-col">
              <div class="modal-top-row">
                <div class="modal-edition-nav">
                  <button
                    v-if="sameNameCards.length > 1"
                    class="edition-nav-btn"
                    :disabled="editionVariantIdx <= 0"
                    @click="emit('prev-edition')"
                    title="Edición anterior"
                  ><i class="bi bi-chevron-left"></i></button>

                  <div class="modal-badges">
                    <span class="badge-edition">{{ card.edition }}</span>
                    <span v-if="card.sub_edition" class="badge-sub">{{ subLabel(card.sub_edition) }}</span>
                    <span class="badge-num">#{{ card.number }}</span>
                    <span class="badge-color" :class="'badge-color--' + (card.color_identity || '').toLowerCase()">
                      {{ colorLabel(card.color_identity) }}
                    </span>
                  </div>

                  <button
                    v-if="sameNameCards.length > 1"
                    class="edition-nav-btn"
                    :disabled="editionVariantIdx >= sameNameCards.length - 1"
                    @click="emit('next-edition')"
                    title="Siguiente edición"
                  ><i class="bi bi-chevron-right"></i></button>
                </div>
              </div>

              <div v-if="!card.meta" class="no-meta-notice">
                Carta sin metadatos aun.
                <button v-if="auth.can('manage_cards')" class="btn-filled btn-sm" @click="emit('open-create')">Crear</button>
              </div>

              <template v-if="card.meta">
                <div class="meta-grid-badges">
                  <div class="meta-row" v-if="card.meta.cardType"><span class="meta-k">Tipo de carta</span><span class="meta-v">{{ CARD_TYPE_ES[card.meta.cardType] ?? card.meta.cardType }}</span></div>
                  <div class="meta-row" v-if="card.meta.cost != null"><span class="meta-k">Coste</span><span class="meta-v">{{ card.meta.cost }}</span></div>
                  <div class="meta-row" v-if="card.meta.strength != null"><span class="meta-k">Fuerza</span><span class="meta-v">{{ card.meta.strength }}</span></div>
                  <div class="meta-row" v-if="card.meta.level != null"><span class="meta-k">Nivel</span><span class="meta-v">{{ card.meta.level }}</span></div>
                  <div class="meta-row" v-if="card.meta.starter == true"><span class="meta-k">Iniciador</span><span class="meta-v">Si</span></div>
                  <div class="meta-row" v-if="card.meta.cardClasses?.length"><span class="meta-k">Clases</span><span class="meta-v">{{ card.meta.cardClasses.join(', ') }}</span></div>
                  <div class="meta-row" v-if="card.meta.regulation"><span class="meta-k">Regulación</span><span class="meta-v">{{ card.meta.regulation }}</span></div>
                  <div class="meta-row" v-if="card.meta.specialCost != null"><span class="meta-k">Coste Especial</span><span class="meta-v">{{ card.meta.specialCost }}</span></div>
                  <div class="meta-row" v-if="card.meta.specialSummonKind"><span class="meta-k">Método de Invocación Especial</span><span class="meta-v">{{ SS_KIND_ES[card.meta.specialSummonKind] ?? card.meta.specialSummonKind }}</span></div>
                  <div class="meta-row" v-if="card.meta.rarity"><span class="meta-k">Rareza</span><span class="meta-v">{{ card.meta.rarity }}</span></div>
                  <div class="meta-row" v-if="card.meta.colors?.length"><span class="meta-k">Colores</span><span class="meta-v">{{ mapColors(card.meta.colors).join(', ') }}</span></div>
                  <div class="meta-row meta-row--full" v-if="card.meta.requirement"><span class="meta-k">Requerimiento</span><span class="meta-v">{{ card.meta.requirement }}</span></div>
                </div>

                <div v-if="card.meta.effects?.length || card.meta.keywordEffects?.length" class="effects-section">
                  <div class="effects-label">Efectos</div>
                  <div v-for="(ef, i) in card.meta.effects" :key="i" class="effect-pill">
                    <span v-html="renderEffectHtml(ef)"></span>
                    <span v-if="ef.tags?.length" class="effect-tags">{{ ef.tags.join(', ') }}</span>
                  </div>
                  <div v-for="(ke, i) in card.meta.keywordEffects" :key="'kw'+i" class="effect-pill kw-pill">
                    <span v-html="renderCardKwEffect(ke)"></span>
                  </div>
                </div>

                <div v-if="card.meta.inheritEffects?.length || card.meta.inheritKeywordEffects?.length" class="effects-section">
                  <div class="effects-label">Efectos heredados</div>
                  <div v-for="(ef, i) in card.meta.inheritEffects" :key="i" class="effect-pill">
                    <span v-html="renderEffectHtml(ef)"></span>
                    <span v-if="ef.tags?.length" class="effect-tags">{{ ef.tags.join(', ') }}</span>
                  </div>
                  <div v-for="(ke, i) in card.meta.inheritKeywordEffects" :key="'ikw'+i" class="effect-pill kw-pill">
                    <span v-html="renderCardKwEffect(ke)"></span>
                  </div>
                </div>
              </template>

              <div class="modal-actions" v-if="auth.can('manage_cards')">
                <button v-if="card.meta" class="btn-filled btn-sm" @click="emit('open-edit')">Editar</button>
                <button v-if="card.meta" class="btn-ghost btn-sm btn-danger" :disabled="deletingCard" @click="emit('delete-meta')">Eliminar metadatos</button>
                <button class="btn-ghost btn-sm btn-danger" :disabled="deletingCard" @click="emit('delete-image')">Eliminar imagen</button>
                <button class="btn-ghost btn-sm btn-danger" :disabled="deletingCard" @click="emit('delete-both')">Eliminar todo</button>
              </div>
            </div>
          </div>

          <div class="modal-img-col">
            <div class="modal-frame">
              <img :key="card.id + card.time_stamp"
                   :src="cardImageUrl(card)"
                   :alt="card.name"
                   class="modal-img" />
            </div>
          </div>
        </div>
      </div>

      <button class="modal-nav modal-nav--next" @click="emit('next')" :disabled="nextDisabled">
        <i class="bi bi-chevron-right"></i>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 4.5rem 1rem 1rem; overflow: hidden;
}
.modal-nav {
  position: fixed; top: 50%; transform: translateY(-50%);
  z-index: 1001; background: rgba(0,0,0,0.45); border: none;
  color: #fff; font-size: 2rem; width: 3rem; height: 3rem;
  border-radius: 50%; cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  transition: background 0.15s, opacity 0.15s;
}
.modal-nav:hover:not(:disabled) { background: rgba(0,0,0,0.75); }
.modal-nav:disabled { opacity: 0.2; cursor: default; }
.modal-nav--prev { left: 0.75rem; }
.modal-nav--next { right: 0.75rem; }

.modal-box {
  background: var(--card-bg); border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow); border-radius: 12px;
  width: 100%; max-width: 1440px; max-height: calc(100vh - 6rem);
  overflow-y: auto; padding: 1.5rem; position: relative;
  transition: background-color 0.2s ease;
}
.modal-box::-webkit-scrollbar       { width: 6px; }
.modal-box::-webkit-scrollbar-track { background: var(--card-bg); border-radius: 0 12px 12px 0; }
.modal-box::-webkit-scrollbar-thumb { background: var(--card-border); border-radius: 3px; }
.modal-box::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

.modal-close {
  position: absolute; top: 0.75rem; right: 0.75rem;
  background: none; border: none; color: var(--text-secondary);
  font-size: 1.2rem; cursor: pointer; line-height: 1;
}
.modal-close:hover { color: var(--text-primary); }

.modal-name-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; }
.modal-card-name { color: var(--text-primary); margin: 0; font-size: 1.5rem; font-weight: 700; line-height: 1.2; }
.btn-modal-edit-name { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 1rem; padding: 0; line-height: 1; }
.btn-modal-edit-name:hover { color: var(--text-primary); }
.modal-name-input { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); background: var(--input-bg); border: 1px solid #3f51b5; border-radius: 6px; padding: 0 0.4rem; outline: none; width: min(100%, 60%); }

.form-with-preview { display: flex; gap: 1.5rem; align-items: flex-start; }
.form-main { flex: 1; min-width: 0; }
.modal-info-col { flex: 1; min-width: 0; }
.modal-top-row { margin-bottom: 0.75rem; }
.modal-img-col { flex-shrink: 0; width: 35%; position: sticky; top: 0; align-self: flex-start; }
.modal-frame { width: 100%; aspect-ratio: 63 / 88; overflow: hidden; border-radius: 8px; background: var(--input-bg); }
.modal-img { width: 100%; height: 100%; object-fit: cover; display: block; }

.modal-edition-nav { display: flex; align-items: center; gap: 0.4rem; }
.edition-nav-btn { display: flex; align-items: center; justify-content: center; background: none; border: 1px solid var(--card-border); border-radius: 4px; padding: 0.2rem 0.45rem; cursor: pointer; color: var(--text-muted); font-size: 0.85rem; line-height: 1; flex-shrink: 0; }
.edition-nav-btn:hover:not(:disabled) { color: var(--text-primary); border-color: var(--text-muted); }
.edition-nav-btn:disabled { opacity: 0.25; cursor: default; }

.modal-badges { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.badge-edition, .badge-color, .badge-sub, .badge-num { font-size: 1rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
.badge-edition { background: #2a2a2a; color: var(--text-muted); }
.badge-color   { background: #2a2a2a; color: var(--text-muted); border: 1px solid var(--card-border); }
.badge-color--b { background: #3b82f6; color: #fff; border: none; }
.badge-color--g { background: #22c55e; color: #fff; border: none; }
.badge-color--p { background: #a855f7; color: #fff; border: none; }
.badge-color--r { background: #ef4444; color: #fff; border: none; }
.badge-color--w { background: #ffffff; color: #1a1a1a; border: 1px solid #ccc; }
.badge-sub     { background: #2a2a2a; color: var(--text-muted); border: 1px solid var(--card-border); }
.badge-num     { background: #2a2a2a; color: var(--text-muted); border: 1px solid var(--card-border); }

.no-meta-notice { color: var(--error-color); font-size: 0.85rem; background: rgba(244,67,54,0.08); border: 1px solid rgba(244,67,54,0.25); border-radius: 6px; padding: 0.6rem 0.8rem; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.75rem; }
.meta-grid-badges { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 0.75rem; }
.meta-row         { background: var(--input-bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 0.45rem 0.65rem; display: flex; flex-direction: column; gap: 0.1rem; }
.meta-row--full   { grid-column: 1 / -1; }
.meta-k { color: var(--text-muted); font-weight: 600; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.07em; }
.meta-v { color: var(--text-primary); font-size: 1rem; font-weight: 700; }

.effects-section  { margin-bottom: 0.75rem; background: var(--input-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 0.75rem 0.9rem; }
.effects-label    { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); font-weight: 700; margin-bottom: 0.5rem; }
.effect-pill      { font-size: 0.75rem; color: var(--text-primary); line-height: 1.45; margin-bottom: 0.25rem; }
.kw-pill          { color: #7c8ce8; font-weight: 600; }
.effect-tags      { font-size: 0.72rem; color: var(--text-muted); margin-left: 0.4rem; }
.modal-actions    { margin-top: 1rem; display: flex; gap: 0.5rem; }

.btn-sm { padding: 0.3rem 0.85rem !important; font-size: 0.82rem !important; }

@media (max-width: 700px) {
  .form-with-preview { flex-direction: column; }
  .modal-img-col { width: 100%; max-width: 200px; }
}
</style>
