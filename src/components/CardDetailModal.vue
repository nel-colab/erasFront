<script setup>
/**
 * CardDetailModal – shared read-only card detail panel.
 *
 * Props
 *   card          – merged drive+meta card object
 *   prevDisabled  – disables the ← nav button
 *   nextDisabled  – disables the → nav button
 *
 * Emits:  close | prev | next
 *
 * Slots
 *   header-extra  – rendered after the card name (e.g. edit-name button)
 *   edition-nav   – replaces the edition badge row (e.g. edition variant arrows)
 *   actions       – rendered below the meta grid (e.g. edit / delete buttons)
 */
import { computed } from 'vue'
import { useCardsStore } from '@/store/cards'

const props = defineProps({
  card:         { type: Object,  required: true },
  prevDisabled: { type: Boolean, default: true  },
  nextDisabled: { type: Boolean, default: true  },
})

const emit = defineEmits(['close', 'prev', 'next'])

const cardsStore = useCardsStore()
const refData    = computed(() => cardsStore.refData || {})

// ── Constants ────────────────────────────────────────────────────────────
const CARD_TYPE_ES = { creature: 'Criatura', utility: 'Utilidad', structure: 'Estructura' }
const SS_KIND_ES   = { materialization: 'Materialización', promotion: 'Ascenso', ritual: 'Ritual', evolution: 'Evolución' }
const COLOR_NAMES  = { B: 'Azúl', G: 'Verde', P: 'Violeta', R: 'Rojo', W: 'Blanco' }

const colorLabel = c => ({ B: 'Blue', G: 'Green', P: 'Purple', R: 'Red', W: 'White' }[c] ?? c)
const subLabel   = s => (s === null || s === '') ? 'MAIN' : `SUB${s}`
const mapColors  = colors => (colors ?? []).map(c => COLOR_NAMES[c] ?? c)

// ── Image URL ─────────────────────────────────────────────────────────────
const cardImageUrl = card => {
  if (!card?.image_url) return null
  const ts = card.time_stamp ? new Date(card.time_stamp).getTime() : Date.now()
  return `${card.image_url}?v=${ts}`
}

// ── Effect rendering ──────────────────────────────────────────────────────
const escapeHtml = s => s
  ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  : ''

const getKwDescription = kwKey => {
  const ref = refData.value.keywordEffects?.[kwKey]
  return ref?.displayText || null
}

const resolveTokensHtml = (text, collectedKws) => {
  if (!text) return ''
  return escapeHtml(text).replace(
    /\[\[([^\]:]+)(?::([^\]]*))?\]\]/g,
    (_, kw, val) => {
      const rendered = val ? kw.replace(/\{[^}]+\}/, val) : kw
      collectedKws.push({ kw, val: val || null, rendered })
      return `<span class="cdm-kw-inline">${escapeHtml(rendered)}</span>`
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
          blockHtml += ` <span class="cdm-kw-desc">(${escapeHtml(rendered)}: ${escapeHtml(descResolved)})</span>`
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
  let html = `<span class="cdm-kw-name">${escapeHtml(rendered)}</span>`
  if (desc) {
    const descResolved = ke.number != null ? desc.replace(/\{[^}]+\}/g, ke.number) : desc
    html += ` <span class="cdm-kw-desc">(${escapeHtml(descResolved)})</span>`
  }
  return html
}
</script>

<template>
  <Teleport to="body">
    <div class="cdm-overlay" @click.self="emit('close')">
      <!-- Prev / Next nav -->
      <button class="cdm-nav cdm-nav--prev" :disabled="prevDisabled" @click="emit('prev')">
        <i class="bi bi-chevron-left"></i>
      </button>

      <div class="cdm-box">
        <!-- Header -->
        <div class="cdm-name-row">
          <slot name="header-extra">
            <h2 class="cdm-card-name">{{ card.name }}</h2>
          </slot>
        </div>
        <button class="cdm-close" @click="emit('close')">✕</button>

        <div class="cdm-layout">
          <!-- Left: info -->
          <div class="cdm-info">
            <!-- Edition badges row — replaceable via slot -->
            <div class="cdm-top-row">
              <slot name="edition-nav">
                <div class="cdm-badges">
                  <span class="cdm-badge cdm-badge--edition">{{ card.edition }}</span>
                  <span v-if="card.sub_edition" class="cdm-badge cdm-badge--sub">{{ subLabel(card.sub_edition) }}</span>
                  <span class="cdm-badge cdm-badge--num">#{{ card.number }}</span>
                  <span class="cdm-badge cdm-badge--color" :class="'cdm-badge--color-' + (card.color_identity || '').toLowerCase()">
                    {{ colorLabel(card.color_identity) }}
                  </span>
                </div>
              </slot>
            </div>

            <!-- No metadata -->
            <div v-if="!card.meta" class="cdm-no-meta">
              Carta sin metadatos aún.
              <slot name="create-meta" />
            </div>

            <!-- Meta grid -->
            <template v-if="card.meta">
              <div class="cdm-meta-grid">
                <div class="cdm-meta-row" v-if="card.meta.cardType"><span class="cdm-meta-k">Tipo de carta</span><span class="cdm-meta-v">{{ CARD_TYPE_ES[card.meta.cardType] ?? card.meta.cardType }}</span></div>
                <div class="cdm-meta-row" v-if="card.meta.cost != null"><span class="cdm-meta-k">Coste</span><span class="cdm-meta-v">{{ card.meta.cost }}</span></div>
                <div class="cdm-meta-row" v-if="card.meta.strength != null"><span class="cdm-meta-k">Fuerza</span><span class="cdm-meta-v">{{ card.meta.strength }}</span></div>
                <div class="cdm-meta-row" v-if="card.meta.level != null"><span class="cdm-meta-k">Nivel</span><span class="cdm-meta-v">{{ card.meta.level }}</span></div>
                <div class="cdm-meta-row" v-if="card.meta.starter"><span class="cdm-meta-k">Iniciador</span><span class="cdm-meta-v">Sí</span></div>
                <div class="cdm-meta-row" v-if="card.meta.cardClasses?.length"><span class="cdm-meta-k">Clases</span><span class="cdm-meta-v">{{ card.meta.cardClasses.join(', ') }}</span></div>
                <div class="cdm-meta-row" v-if="card.meta.regulation"><span class="cdm-meta-k">Regulación</span><span class="cdm-meta-v">{{ card.meta.regulation }}</span></div>
                <div class="cdm-meta-row" v-if="card.meta.specialCost != null"><span class="cdm-meta-k">Coste Especial</span><span class="cdm-meta-v">{{ card.meta.specialCost }}</span></div>
                <div class="cdm-meta-row" v-if="card.meta.specialSummonKind"><span class="cdm-meta-k">Inv. Especial</span><span class="cdm-meta-v">{{ SS_KIND_ES[card.meta.specialSummonKind] ?? card.meta.specialSummonKind }}</span></div>
                <div class="cdm-meta-row" v-if="card.meta.rarity"><span class="cdm-meta-k">Rareza</span><span class="cdm-meta-v">{{ card.meta.rarity }}</span></div>
                <div class="cdm-meta-row" v-if="card.meta.colors?.length"><span class="cdm-meta-k">Colores</span><span class="cdm-meta-v">{{ mapColors(card.meta.colors).join(', ') }}</span></div>
                <div class="cdm-meta-row cdm-meta-row--full" v-if="card.meta.requirement"><span class="cdm-meta-k">Requerimiento</span><span class="cdm-meta-v">{{ card.meta.requirement }}</span></div>
              </div>

              <!-- Effects -->
              <div v-if="card.meta.effects?.length || card.meta.keywordEffects?.length" class="cdm-effects">
                <div class="cdm-effects-label">Efectos</div>
                <div v-for="(ef, i) in card.meta.effects" :key="i" class="cdm-effect-pill">
                  <span v-html="renderEffectHtml(ef)"></span>
                  <span v-if="ef.tags?.length" class="cdm-effect-tags">{{ ef.tags.join(', ') }}</span>
                </div>
                <div v-for="(ke, i) in card.meta.keywordEffects" :key="'kw'+i" class="cdm-effect-pill cdm-kw-pill">
                  <span v-html="renderCardKwEffect(ke)"></span>
                </div>
              </div>

              <!-- Inherited effects -->
              <div v-if="card.meta.inheritEffects?.length || card.meta.inheritKeywordEffects?.length" class="cdm-effects">
                <div class="cdm-effects-label">Efectos heredados</div>
                <div v-for="(ef, i) in card.meta.inheritEffects" :key="i" class="cdm-effect-pill">
                  <span v-html="renderEffectHtml(ef)"></span>
                </div>
                <div v-for="(ke, i) in card.meta.inheritKeywordEffects" :key="'ikw'+i" class="cdm-effect-pill cdm-kw-pill">
                  <span v-html="renderCardKwEffect(ke)"></span>
                </div>
              </div>
            </template>

            <!-- Action slot (edit / delete buttons) -->
            <div v-if="$slots.actions" class="cdm-actions">
              <slot name="actions" />
            </div>
          </div>

          <!-- Right: image -->
          <div class="cdm-img-col">
            <div class="cdm-img-frame">
              <img
                v-if="cardImageUrl(card)"
                :key="card.id"
                :src="cardImageUrl(card)"
                :alt="card.name"
                class="cdm-img"
              />
            </div>
          </div>
        </div>
      </div>

      <button class="cdm-nav cdm-nav--next" :disabled="nextDisabled" @click="emit('next')">
        <i class="bi bi-chevron-right"></i>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── Overlay ─────────────────────────────────────────────────────────────── */
.cdm-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.65);
  display: flex; align-items: center; justify-content: center;
  z-index: 2000; padding: 1rem;
  overflow: hidden;
}

/* ── Nav buttons ─────────────────────────────────────────────────────────── */
.cdm-nav {
  position: fixed; top: 50%; transform: translateY(-50%);
  z-index: 2100; background: rgba(0,0,0,0.5); border: none;
  color: #fff; font-size: 1.4rem;
  width: 2.75rem; height: 2.75rem; border-radius: 50%;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.cdm-nav:hover:not(:disabled) { background: rgba(0,0,0,0.8); }
.cdm-nav:disabled             { opacity: 0.2; cursor: default; }
.cdm-nav--prev { left: 0.75rem; }
.cdm-nav--next { right: 0.75rem; }

/* ── Box ─────────────────────────────────────────────────────────────────── */
.cdm-box {
  background: var(--card-bg); border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow); border-radius: 12px;
  width: 100%; max-width: 1440px;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  padding: 1.5rem; position: relative;
}
.cdm-box::-webkit-scrollbar       { width: 6px; }
.cdm-box::-webkit-scrollbar-track { background: var(--card-bg); border-radius: 0 12px 12px 0; }
.cdm-box::-webkit-scrollbar-thumb { background: var(--card-border); border-radius: 3px; }

/* ── Close ───────────────────────────────────────────────────────────────── */
.cdm-close {
  position: absolute; top: 0.75rem; right: 0.75rem;
  background: none; border: none; color: var(--text-secondary);
  font-size: 1.2rem; cursor: pointer; line-height: 1;
}
.cdm-close:hover { color: var(--text-primary); }

/* ── Header ──────────────────────────────────────────────────────────────── */
.cdm-name-row {
  display: flex; align-items: center; gap: 0.5rem;
  margin-bottom: 0.5rem; padding-right: 2rem;
}
.cdm-card-name {
  margin: 0; font-size: 1.5rem; font-weight: 700;
  color: var(--text-primary); line-height: 1.2;
}

/* ── Layout ──────────────────────────────────────────────────────────────── */
.cdm-layout  { display: flex; gap: 2rem; align-items: flex-start; }
.cdm-info    { flex: 1; min-width: 0; }
.cdm-top-row { margin-bottom: 0.75rem; }
.cdm-img-col { flex-shrink: 0; width: 35%; position: sticky; top: 0; align-self: flex-start; }
.cdm-img-frame { width: 100%; aspect-ratio: 63/88; overflow: hidden; border-radius: 8px; background: var(--input-bg); }
.cdm-img     { width: 100%; height: 100%; object-fit: cover; display: block; }

/* ── Badges ──────────────────────────────────────────────────────────────── */
.cdm-badges  { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.cdm-badge   { font-size: 0.7rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 6px; letter-spacing: 0.04em; }
.cdm-badge--edition { background: #2a2a2a; color: var(--text-muted); }
.cdm-badge--num     { background: #2a2a2a; color: var(--text-muted); border: 1px solid var(--card-border); }
.cdm-badge--sub     { background: #2a2a2a; color: var(--text-muted); border: 1px solid var(--card-border); }
.cdm-badge--color   { background: #2a2a2a; color: var(--text-muted); border: 1px solid var(--card-border); }
.cdm-badge--color-b { background: #3b82f6; color: #fff; border: none; }
.cdm-badge--color-g { background: #22c55e; color: #fff; border: none; }
.cdm-badge--color-p { background: #a855f7; color: #fff; border: none; }
.cdm-badge--color-r { background: #ef4444; color: #fff; border: none; }
.cdm-badge--color-w { background: #ffffff; color: #1a1a1a; border: 1px solid #ccc; }

/* ── No meta ─────────────────────────────────────────────────────────────── */
.cdm-no-meta { padding: 0.75rem 0; color: var(--text-muted); font-style: italic; display: flex; align-items: center; gap: 0.75rem; }

/* ── Meta grid ───────────────────────────────────────────────────────────── */
.cdm-meta-grid    { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 0.75rem; }
.cdm-meta-row     { background: var(--input-bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 0.45rem 0.65rem; display: flex; flex-direction: column; gap: 0.1rem; }
.cdm-meta-row--full { grid-column: 1 / -1; }
.cdm-meta-k       { color: var(--text-muted); font-weight: 600; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.07em; }
.cdm-meta-v       { color: var(--text-primary); font-size: 1rem; font-weight: 700; }

/* ── Effects ─────────────────────────────────────────────────────────────── */
.cdm-effects       { margin-bottom: 0.75rem; background: var(--input-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 0.75rem 0.9rem; }
.cdm-effects-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); font-weight: 700; margin-bottom: 0.5rem; }
.cdm-effect-pill   { font-size: 0.75rem; color: var(--text-primary); line-height: 1.45; margin-bottom: 0.25rem; }
.cdm-kw-pill       { color: #7c8ce8; font-weight: 600; }
.cdm-kw-name       { font-weight: 700; }
.cdm-kw-desc       { opacity: 0.75; }

/* ── Actions slot ────────────────────────────────────────────────────────── */
.cdm-actions { margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap; }

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 700px) {
  .cdm-layout  { flex-direction: column; }
  .cdm-img-col { width: 100%; max-width: 200px; }
}
</style>
