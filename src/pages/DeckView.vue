<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useCardsStore } from '@/store/cards'
import { useAuthStore }  from '@/store/login'
import CardDetailModal   from '@/components/CardDetailModal.vue'

const route      = useRoute()
const router     = useRouter()
const cardsStore = useCardsStore()
const auth       = useAuthStore()

// ── State ─────────────────────────────────────────────────────────────────
const loading     = ref(true)
const deckData    = ref(null)
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

// ── Resolve deck into entries ─────────────────────────────────────────────
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

// ── Permissions ───────────────────────────────────────────────────────────
const canEdit = computed(() => deckData.value && auth.userId === deckData.value.userId)
const canCopy = computed(() => !!auth.userId)

function goEdit() { router.push(`/deck-builder?id=${route.params.id}`) }
function goCopy() { router.push(`/deck-builder?id=${route.params.id}&copy=true`) }
function goBack() { router.back() }

// ── Proxy print ────────────────────────────────────────────────────────────
const showProxyModal  = ref(false)
const proxyPaperSize  = ref('letter')
const proxyOrient     = ref('portrait')
const proxyGenerating = ref(false)
const proxyBrightness = ref(20)
const proxyContrast   = ref(20)

const PAPER_SIZES = [
  { value: 'letter', label: 'Carta (8.5 × 11 in)',   w: 8.5,   h: 11    },
  { value: 'a4',     label: 'A4 (210 × 297 mm)',      w: 8.27,  h: 11.69 },
  { value: 'legal',  label: 'Legal (8.5 × 14 in)',    w: 8.5,   h: 14    },
  { value: 'a3',     label: 'A3 (297 × 420 mm)',      w: 11.69, h: 16.54 },
]
const CARD_W = 2.5
const CARD_H = 3.5
const MARGIN = 0.5

const proxyCardCount = computed(() =>
  deckEntries.value.reduce((s, e) => s + e.count, 0)
)
const proxyCardsPerPage = computed(() => {
  const paper = PAPER_SIZES.find(p => p.value === proxyPaperSize.value)
  const landscape = proxyOrient.value === 'landscape'
  const pw = landscape ? paper.h : paper.w
  const ph = landscape ? paper.w : paper.h
  return Math.floor((pw - MARGIN * 2) / CARD_W) * Math.floor((ph - MARGIN * 2) / CARD_H)
})

async function printProxies() {
  const cardIds = deckEntries.value.flatMap(e => Array(e.count).fill(e.card.id))
  proxyGenerating.value = true
  try {
    const response = await axios.post('/api/drive/proxy-print', {
      cardIds,
      paperSize:   proxyPaperSize.value,
      orientation: proxyOrient.value,
      brightness:  proxyBrightness.value,
      contrast:    proxyContrast.value,
    }, { responseType: 'blob' })

    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
    const a   = document.createElement('a')
    a.href     = url
    a.download = `proxies-${deckData.value?.deckName || 'mazo'}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('Error generating PDF', e)
  } finally {
    proxyGenerating.value = false
  }
}

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
        <button class="btn-ghost" @click="showProxyModal = true" :disabled="deckEntries.length === 0">
          <i class="bi bi-printer"></i> Proxies
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

    <!-- Detail modal via shared component -->
    <CardDetailModal
      v-if="showDetail"
      :card="detailCard"
      :prev-disabled="detailIndex <= 0"
      :next-disabled="detailIndex >= deckEntries.length - 1"
      @close="closeDetail"
      @prev="prevCard"
      @next="nextCard"
    />

    <!-- Proxy print modal -->
    <Teleport to="body">
      <div v-if="showProxyModal" class="proxy-overlay" @click.self="showProxyModal = false">
        <div class="proxy-modal">
          <button class="proxy-close" @click="showProxyModal = false">✕</button>
          <h2 class="proxy-title"><i class="bi bi-printer"></i> Imprimir proxies</h2>
          <p class="proxy-info">Cartas a <strong>2.5 × 3.5 in</strong> &mdash; <strong>{{ proxyCardCount }}</strong> carta{{ proxyCardCount !== 1 ? 's' : '' }}, <strong>{{ proxyCardsPerPage }}</strong> por hoja.</p>

          <label class="proxy-label">Orientación</label>
          <div class="proxy-orient-row">
            <label class="proxy-size-opt" :class="{ active: proxyOrient === 'portrait' }">
              <input type="radio" value="portrait" v-model="proxyOrient" hidden />
              <i class="bi bi-file-earmark"></i> Vertical
            </label>
            <label class="proxy-size-opt" :class="{ active: proxyOrient === 'landscape' }">
              <input type="radio" value="landscape" v-model="proxyOrient" hidden />
              <i class="bi bi-file-earmark-text"></i> Horizontal
            </label>
          </div>

          <label class="proxy-label">Tamaño de papel</label>
          <div class="proxy-sizes">
            <label v-for="p in PAPER_SIZES" :key="p.value" class="proxy-size-opt" :class="{ active: proxyPaperSize === p.value }">
              <input type="radio" :value="p.value" v-model="proxyPaperSize" hidden />
              <i class="bi bi-file-earmark"></i>
              {{ p.label }}
            </label>
          </div>

          <label class="proxy-label">Ajustes de imagen</label>
          <div class="proxy-adjust-row">
            <span class="proxy-adjust-lbl">Brillo</span>
            <input type="range" v-model.number="proxyBrightness" min="-100" max="100" step="5" class="proxy-slider" />
            <span class="proxy-adjust-val">{{ proxyBrightness > 0 ? '+' : '' }}{{ proxyBrightness }}</span>
          </div>
          <div class="proxy-adjust-row">
            <span class="proxy-adjust-lbl">Contraste</span>
            <input type="range" v-model.number="proxyContrast" min="-100" max="100" step="5" class="proxy-slider" />
            <span class="proxy-adjust-val">{{ proxyContrast > 0 ? '+' : '' }}{{ proxyContrast }}</span>
          </div>

          <p class="proxy-warn"><i class="bi bi-exclamation-triangle"></i> Las cartas sin imagen asignada aparecerán en blanco con su nombre.</p>
          <button class="btn-filled proxy-print-btn" :disabled="proxyCardCount === 0 || proxyGenerating" @click="printProxies">
            <span v-if="proxyGenerating"><i class="bi bi-hourglass-split"></i> Generando PDF…</span>
            <span v-else><i class="bi bi-file-earmark-pdf-fill"></i> Descargar PDF</span>
          </button>
        </div>
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

@media (max-width: 700px) {
  .dv-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
}

/* ── Proxy print modal ───────────────────────────────────────────────────── */
.proxy-overlay  { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 3000; padding: 1rem; }
.proxy-modal    { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; box-shadow: var(--card-shadow); width: 100%; max-width: 480px; padding: 1.75rem; position: relative; }
.proxy-close    { position: absolute; top: 0.75rem; right: 0.75rem; background: none; border: none; color: var(--text-secondary); font-size: 1.1rem; cursor: pointer; line-height: 1; }
.proxy-close:hover { color: var(--text-primary); }
.proxy-title    { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.6rem; display: flex; align-items: center; gap: 0.5rem; }
.proxy-info     { font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 1.25rem; }
.proxy-label    { display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
.proxy-orient-row { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.proxy-orient-row .proxy-size-opt { flex: 1; justify-content: center; }
.proxy-sizes    { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1.5rem; }
.proxy-size-opt { display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 0.75rem; border-radius: 6px; border: 1px solid var(--input-border); cursor: pointer; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); background: transparent; transition: background-color 0.15s, color 0.15s, border-color 0.15s; user-select: none; }
.proxy-size-opt.active { background: var(--btn-bg); color: var(--btn-text); border-color: var(--btn-bg); }
.proxy-size-opt:hover:not(.active) { background: var(--input-bg); color: var(--text-primary); }
.proxy-adjust-row { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem; }
.proxy-adjust-lbl { font-size: 0.82rem; color: var(--text-secondary); width: 5rem; flex-shrink: 0; }
.proxy-slider { flex: 1; accent-color: var(--btn-bg); cursor: pointer; }
.proxy-adjust-val { font-size: 0.82rem; color: var(--text-primary); font-weight: 600; width: 2.5rem; text-align: right; flex-shrink: 0; }
.proxy-warn     { font-size: 0.78rem; color: var(--text-secondary); background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 6px; padding: 0.5rem 0.65rem; margin-top: 0.5rem; margin-bottom: 0.9rem; line-height: 1.4; }
.proxy-warn i   { color: #f59e0b; margin-right: 0.3rem; }
.proxy-print-btn { width: 100%; justify-content: center; gap: 0.5rem; padding: 0.5rem 1rem; font-size: 0.9rem; }
</style>
