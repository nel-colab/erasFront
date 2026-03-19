<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useCardsStore }    from '@/store/cards'
import { useAuthStore }     from '@/store/login'

const route      = useRoute()
const router     = useRouter()
const cardsStore = useCardsStore()
const auth       = useAuthStore()

// ── Constants ─────────────────────────────────────────────────────────────
const CARD_TYPE_ES = { creature: 'Criatura', utility: 'Utilidad', structure: 'Estructura' }
const SS_KIND_ES   = { materialization: 'Materialización', promotion: 'Ascenso', ritual: 'Ritual', evolution: 'Evolución' }
const COLOR_NAMES  = { B: 'Azúl', G: 'Verde', P: 'Violeta', R: 'Rojo', W: 'Blanco' }
const colorLabel   = c => ({ B: 'Blue', G: 'Green', P: 'Purple', R: 'Red', W: 'White' }[c] ?? c)
const subLabel     = s => (s === null || s === '') ? 'MAIN' : `SUB${s}`
const mapColors    = colors => (colors ?? []).map(c => COLOR_NAMES[c] ?? c)

// ── State ─────────────────────────────────────────────────────────────────
const loading    = ref(true)
const deckData   = ref(null)
const deckEntries = ref([])

// ── Cards data ─────────────────────────────────────────────────────────────
function buildCardKey(edition, number, sub, color) {
  return `${edition}|${number}|${sub ?? ''}|${color ?? ''}`
}

const metaMap = computed(() => {
  const m = new Map()
  cardsStore.metaCards.forEach(c => {
    if (c.edition && c.cardNumber != null)
      m.set(buildCardKey(c.edition, c.cardNumber, c.subEdition, c.colorIdentity), c)
  })
  return m
})

const allMerged = computed(() =>
  cardsStore.driveCards.map(dc => ({
    ...dc,
    meta: metaMap.value.get(buildCardKey(dc.edition, dc.number, dc.sub_edition, dc.color_identity)) ?? null,
  }))
)

const cardImageUrl = card => {
  if (!card?.image_url) return null
  const ts = card.time_stamp ? new Date(card.time_stamp).getTime() : Date.now()
  return `${card.image_url}?v=${ts}`
}

// ── Resolve deck into entries ──────────────────────────────────────────────
function resolveDeck(data) {
  deckData.value = data
  const countMap = {}
  ;(data.cards ?? []).forEach(cId => { countMap[cId] = (countMap[cId] ?? 0) + 1 })
  const entries = []
  for (const [cId, count] of Object.entries(countMap)) {
    const card = allMerged.value.find(c => c.id === cId)
    if (card) entries.push({ card, count })
  }
  deckEntries.value = entries
}

// ── Detail modal ──────────────────────────────────────────────────────────
const detailCard  = ref(null)
const showDetail  = ref(false)
const detailIndex = computed(() => deckEntries.value.findIndex(e => e.card.id === detailCard.value?.id))

function openDetail(card) {
  detailCard.value = card
  showDetail.value = true
  document.body.style.overflow = 'hidden'
}
function closeDetail() {
  showDetail.value = false
  detailCard.value = null
  document.body.style.overflow = ''
}
function prevCard() {
  const i = detailIndex.value
  if (i > 0) detailCard.value = deckEntries.value[i - 1].card
}
function nextCard() {
  const i = detailIndex.value
  if (i < deckEntries.value.length - 1) detailCard.value = deckEntries.value[i + 1].card
}

// ── Effect rendering ──────────────────────────────────────────────────────
const refData = computed(() => cardsStore.refData || {})

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

// ── Permissions ──────────────────────────────────────────────────────────
const canEdit = computed(() =>
  deckData.value && (
    auth.userId === deckData.value.userId ||
    auth.can('manage_decks')
  )
)
const canCopy = computed(() => !!auth.userId)

function goEdit()    { router.push(`/deck-builder?id=${route.params.id}`) }
function goCopy()    { router.push(`/deck-builder?id=${route.params.id}&copy=true`) }
function goBack()    { router.back() }

// ── Load ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const [deckRes] = await Promise.all([
      axios.get(`/api/drive/decklists/${route.params.id}`),
      cardsStore.load(),
      cardsStore.loadRef(),
    ])
    resolveDeck(deckRes.data)
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="dv-page">

    <!-- Header -->
    <div class="dv-header">
      <button class="btn-ghost dv-back-btn" @click="goBack">
        <i class="bi bi-arrow-left"></i> Volver
      </button>
      <div class="dv-title-block">
        <h1 class="dv-title">{{ deckData?.deckName ?? '…' }}</h1>
        <span v-if="deckData?.username" class="dv-owner">por {{ deckData.username }}</span>
      </div>
      <div class="dv-header-actions">
        <button v-if="canEdit" class="btn-ghost" @click="goEdit">
          <i class="bi bi-pencil"></i> Editar
        </button>
        <button v-if="canCopy" class="btn-filled" @click="goCopy">
          <i class="bi bi-files"></i> Crear copia
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="dv-loading">Cargando…</div>

    <!-- Empty -->
    <div v-else-if="deckEntries.length === 0" class="dv-empty">
      <i class="bi bi-collection"></i>
      <p>Este mazo no tiene cartas.</p>
    </div>

    <!-- Card grid -->
    <div v-else class="dv-grid">
      <div
        v-for="entry in deckEntries"
        :key="entry.card.id"
        class="dv-card"
        @click="openDetail(entry.card)"
      >
        <img
          v-if="cardImageUrl(entry.card)"
          :src="cardImageUrl(entry.card)"
          :alt="entry.card.name"
          class="dv-card-img"
        />
        <div v-else class="dv-card-placeholder">
          <i class="bi bi-image"></i>
          <span>{{ entry.card.name }}</span>
        </div>
        <span v-if="entry.count > 1" class="dv-card-count">×{{ entry.count }}</span>
      </div>
    </div>

    <!-- Detail modal -->
    <Teleport to="body">
      <div v-if="showDetail" class="modal-overlay" @click.self="closeDetail">
        <button class="modal-nav modal-nav--prev" @click="prevCard" :disabled="detailIndex <= 0">
          <i class="bi bi-chevron-left"></i>
        </button>
        <div class="modal-box">
          <div class="modal-name-row">
            <h1 class="modal-card-name">{{ detailCard.name }}</h1>
          </div>
          <button class="modal-close" @click="closeDetail">✕</button>
          <div class="form-with-preview">
            <div class="form-main">
              <div class="modal-info-col">
                <div class="modal-top-row">
                  <div class="modal-badges">
                    <span class="badge-edition">{{ detailCard.edition }}</span>
                    <span v-if="detailCard.sub_edition" class="badge-sub">{{ subLabel(detailCard.sub_edition) }}</span>
                    <span class="badge-num">#{{ detailCard.number }}</span>
                    <span class="badge-color" :class="'badge-color--' + (detailCard.color_identity || '').toLowerCase()">{{ colorLabel(detailCard.color_identity) }}</span>
                  </div>
                </div>

                <div v-if="!detailCard.meta" class="no-meta-notice">
                  Carta sin metadatos aun.
                </div>

                <template v-if="detailCard.meta">
                  <div class="meta-grid-badges">
                    <div class="meta-row" v-if="detailCard.meta.cardType"><span class="meta-k">Tipo de carta</span><span class="meta-v">{{ CARD_TYPE_ES[detailCard.meta.cardType] ?? detailCard.meta.cardType }}</span></div>
                    <div class="meta-row" v-if="detailCard.meta.cost != null"><span class="meta-k">Coste</span><span class="meta-v">{{ detailCard.meta.cost }}</span></div>
                    <div class="meta-row" v-if="detailCard.meta.strength != null"><span class="meta-k">Fuerza</span><span class="meta-v">{{ detailCard.meta.strength }}</span></div>
                    <div class="meta-row" v-if="detailCard.meta.level != null"><span class="meta-k">Nivel</span><span class="meta-v">{{ detailCard.meta.level }}</span></div>
                    <div class="meta-row" v-if="detailCard.meta.starter"><span class="meta-k">Iniciador</span><span class="meta-v">Sí</span></div>
                    <div class="meta-row" v-if="detailCard.meta.cardClasses?.length"><span class="meta-k">Clases</span><span class="meta-v">{{ detailCard.meta.cardClasses.join(', ') }}</span></div>
                    <div class="meta-row" v-if="detailCard.meta.regulation"><span class="meta-k">Regulación</span><span class="meta-v">{{ detailCard.meta.regulation }}</span></div>
                    <div class="meta-row" v-if="detailCard.meta.specialCost != null"><span class="meta-k">Coste Especial</span><span class="meta-v">{{ detailCard.meta.specialCost }}</span></div>
                    <div class="meta-row" v-if="detailCard.meta.specialSummonKind"><span class="meta-k">Invocación Especial</span><span class="meta-v">{{ SS_KIND_ES[detailCard.meta.specialSummonKind] ?? detailCard.meta.specialSummonKind }}</span></div>
                    <div class="meta-row" v-if="detailCard.meta.rarity"><span class="meta-k">Rareza</span><span class="meta-v">{{ detailCard.meta.rarity }}</span></div>
                    <div class="meta-row" v-if="detailCard.meta.colors?.length"><span class="meta-k">Colores</span><span class="meta-v">{{ mapColors(detailCard.meta.colors).join(', ') }}</span></div>
                    <div class="meta-row meta-row--full" v-if="detailCard.meta.requirement"><span class="meta-k">Requerimiento</span><span class="meta-v">{{ detailCard.meta.requirement }}</span></div>
                  </div>

                  <div v-if="detailCard.meta.effects?.length || detailCard.meta.keywordEffects?.length" class="effects-section">
                    <div class="effects-label">Efectos</div>
                    <div v-for="(ef, i) in detailCard.meta.effects" :key="i" class="effect-pill">
                      <span v-html="renderEffectHtml(ef)"></span>
                      <span v-if="ef.tags?.length" class="effect-tags">{{ ef.tags.join(', ') }}</span>
                    </div>
                    <div v-for="(ke, i) in detailCard.meta.keywordEffects" :key="'kw'+i" class="effect-pill kw-pill">
                      <span v-html="renderCardKwEffect(ke)"></span>
                    </div>
                  </div>

                  <div v-if="detailCard.meta.inheritEffects?.length || detailCard.meta.inheritKeywordEffects?.length" class="effects-section">
                    <div class="effects-label">Efectos heredados</div>
                    <div v-for="(ef, i) in detailCard.meta.inheritEffects" :key="i" class="effect-pill">
                      <span v-html="renderEffectHtml(ef)"></span>
                    </div>
                    <div v-for="(ke, i) in detailCard.meta.inheritKeywordEffects" :key="'ikw'+i" class="effect-pill kw-pill">
                      <span v-html="renderCardKwEffect(ke)"></span>
                    </div>
                  </div>
                </template>
              </div>
            </div>

            <div class="modal-img-col">
              <div class="modal-frame">
                <img
                  :key="detailCard.id"
                  :src="cardImageUrl(detailCard)"
                  :alt="detailCard.name"
                  class="modal-img"
                />
              </div>
            </div>
          </div>
        </div>
        <button class="modal-nav modal-nav--next" @click="nextCard" :disabled="detailIndex >= deckEntries.length - 1">
          <i class="bi bi-chevron-right"></i>
        </button>
      </div>
    </Teleport>

  </div>
</template>

<style scoped>
/* ── Page ────────────────────────────────────────────────────────────────── */
.dv-page { max-width: 1400px; margin: 0 auto; padding: 1.5rem 1rem; }

/* ── Header ──────────────────────────────────────────────────────────────── */
.dv-header         { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.dv-back-btn       { flex-shrink: 0; }
.dv-title-block    { flex: 1; min-width: 0; }
.dv-title          { font-size: 1.4rem; font-weight: 700; color: var(--text-primary); margin: 0; }
.dv-owner          { font-size: 0.85rem; color: var(--text-secondary); }
.dv-header-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }

/* ── States ──────────────────────────────────────────────────────────────── */
.dv-loading, .dv-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; padding: 4rem; color: var(--text-muted); font-size: 1rem; }
.dv-empty i { font-size: 2.5rem; }

/* ── Card grid ───────────────────────────────────────────────────────────── */
.dv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.75rem; }
.dv-card { position: relative; border-radius: 8px; overflow: hidden; cursor: pointer; background: var(--card-bg); border: 1px solid var(--card-border); transition: transform 0.15s, box-shadow 0.15s; aspect-ratio: 63/88; }
.dv-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
.dv-card-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.dv-card-placeholder { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.4rem; color: var(--text-muted); font-size: 0.75rem; text-align: center; padding: 0.5rem; }
.dv-card-placeholder i { font-size: 1.5rem; }
.dv-card-count { position: absolute; bottom: 0.3rem; right: 0.4rem; background: rgba(0,0,0,0.75); color: #fff; font-size: 0.75rem; font-weight: 700; padding: 0.1rem 0.35rem; border-radius: 4px; }

/* ── Modal overlay ───────────────────────────────────────────────────────── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: flex-start; justify-content: center; z-index: 2000; padding: 4.5rem 1rem 1rem; overflow-y: auto; }
.modal-nav { position: fixed; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.55); border: none; color: #fff; font-size: 1.4rem; width: 2.5rem; height: 2.5rem; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 2100; transition: background 0.15s; }
.modal-nav:hover:not(:disabled) { background: rgba(0,0,0,0.75); }
.modal-nav:disabled { opacity: 0.2; cursor: default; }
.modal-nav--prev { left: 0.75rem; }
.modal-nav--next { right: 0.75rem; }
.modal-box { background: var(--card-bg); border: 1px solid var(--card-border); box-shadow: var(--card-shadow); border-radius: 12px; width: 100%; max-width: 1440px; max-height: 90vh; overflow-y: auto; padding: 1.5rem; position: relative; flex-shrink: 0; margin-bottom: 1rem; }
.modal-close { position: absolute; top: 0.75rem; right: 0.75rem; background: none; border: none; color: var(--text-secondary); font-size: 1.2rem; cursor: pointer; line-height: 1; }
.modal-close:hover { color: var(--text-primary); }
.modal-name-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; padding-right: 2rem; }
.modal-card-name { color: var(--text-primary); margin: 0; font-size: 1.5rem; }

/* ── Modal layout ────────────────────────────────────────────────────────── */
.form-with-preview { display: flex; gap: 2rem; align-items: flex-start; }
.form-main         { flex: 1; min-width: 0; }
.modal-info-col    { flex: 1; min-width: 0; }
.modal-top-row     { margin-bottom: 0.75rem; }
.modal-img-col     { flex-shrink: 0; width: 35%; position: sticky; top: 0; align-self: flex-start; }
.modal-frame       { width: 100%; aspect-ratio: 63/88; overflow: hidden; border-radius: 8px; background: var(--input-bg); }
.modal-img         { width: 100%; height: 100%; object-fit: cover; display: block; }

/* ── Badges ──────────────────────────────────────────────────────────────── */
.modal-badges { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.badge-edition, .badge-color, .badge-sub, .badge-num { font-size: 0.7rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 20px; letter-spacing: 0.04em; }
.badge-edition { background: #2a2a2a; color: var(--text-muted); }
.badge-num     { background: #2a2a2a; color: var(--text-muted); border: 1px solid var(--card-border); }
.badge-sub     { background: #2a2a2a; color: var(--text-muted); border: 1px solid var(--card-border); }
.badge-color   { background: #2a2a2a; color: var(--text-muted); border: 1px solid var(--card-border); }
.badge-color--b { background: #3b82f6; color: #fff; border: none; }
.badge-color--g { background: #22c55e; color: #fff; border: none; }
.badge-color--p { background: #a855f7; color: #fff; border: none; }
.badge-color--r { background: #ef4444; color: #fff; border: none; }
.badge-color--w { background: #ffffff; color: #1a1a1a; border: 1px solid #ccc; }

/* ── Meta grid ───────────────────────────────────────────────────────────── */
.no-meta-notice     { padding: 1rem; color: var(--text-muted); font-style: italic; }
.meta-grid-badges   { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 0.75rem; }
.meta-row           { background: var(--input-bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 0.45rem 0.65rem; display: flex; flex-direction: column; gap: 0.1rem; }
.meta-row--full     { grid-column: 1 / -1; }
.meta-k             { color: var(--text-muted); font-weight: 600; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.07em; }
.meta-v             { color: var(--text-primary); font-size: 1rem; font-weight: 700; }

/* ── Effects ─────────────────────────────────────────────────────────────── */
.effects-section  { margin-bottom: 0.75rem; background: var(--input-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 0.75rem 0.9rem; }
.effects-label    { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); font-weight: 700; margin-bottom: 0.5rem; }
.effect-pill      { font-size: 0.75rem; color: var(--text-primary); line-height: 1.45; margin-bottom: 0.25rem; }
.kw-pill          { color: #7c8ce8; font-weight: 600; }

/* ── Scrollbar ───────────────────────────────────────────────────────────── */
.modal-box::-webkit-scrollbar       { width: 6px; }
.modal-box::-webkit-scrollbar-track { background: var(--card-bg); border-radius: 0 12px 12px 0; }
.modal-box::-webkit-scrollbar-thumb { background: var(--card-border); border-radius: 3px; }

@media (max-width: 700px) {
  .form-with-preview { flex-direction: column; }
  .modal-img-col { width: 100%; max-width: 200px; }
  .dv-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
}
</style>
