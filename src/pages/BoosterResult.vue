<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCardsStore } from '@/store/cards'
import { useEditionsStore } from '@/store/editions'
import CardDetailModal from '@/components/CardDetailModal.vue'

const route         = useRoute()
const router        = useRouter()
const cardsStore    = useCardsStore()
const editionsStore = useEditionsStore()

const loading = ref(true)

// ── Rarity constants ──────────────────────────────────────────────────────────
const RARITY_ORDER = ['SEC', 'SR', 'R', 'UC', 'C']
const RARITY_LABEL = { C: 'Common', UC: 'Uncommon', R: 'Rare', SR: 'Super Rare', SEC: 'Secret Rare' }
const RARITY_COLOR = { C: '#9ca3af', UC: '#34d399', R: '#60a5fa', SR: '#f59e0b', SEC: '#f472b6' }

// ── Resolve drive card image url ──────────────────────────────────────────────
const cardImageUrl = card => {
  if (!card?.image_url) return null
  const ts = card.time_stamp ? new Date(card.time_stamp).getTime() : Date.now()
  return `${card.image_url}?v=${ts}`
}

// ── Build merged card map ─────────────────────────────────────────────────────
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

// ── Simulation helpers ────────────────────────────────────────────────────────
const getEditionCards = (editionId) => {
  const dotIdx = editionId.indexOf('.')
  const base   = dotIdx >= 0 ? editionId.substring(0, dotIdx) : editionId
  const sub    = dotIdx >= 0 ? editionId.substring(dotIdx + 1) : null
  return cardsStore.metaCards.filter(c => {
    if (c.edition !== base) return false
    return sub !== null ? (c.subEdition ?? '') === sub : (c.subEdition ?? '') === ''
  })
}

const groupByRarity = (cards) => {
  const g = {}
  for (const c of cards) { const r = c.rarity || 'C'; (g[r] ??= []).push(c) }
  return g
}

// With replacement — each slot is an independent pick
const pickRandom = (arr, n) => {
  if (!arr.length || n <= 0) return []
  const result = []
  for (let i = 0; i < n; i++) result.push(arr[Math.floor(Math.random() * arr.length)])
  return result
}

const simulatePack = (packType, rarityGroups) => {
  const picked = []
  for (const r of ['C', 'UC', 'R', 'SR', 'SEC']) {
    const n = packType.cardsPerRarity?.[r] ?? 0
    if (n > 0) picked.push(...pickRandom(rarityGroups[r] || [], n))
  }
  return picked
}

const pickByProb = (options) => {
  const rand = Math.random()
  let cumulative = 0
  for (const opt of options) {
    cumulative += parseFloat(opt.prob) || 0
    if (rand <= cumulative) return parseInt(opt.quantity) || 0
  }
  return parseInt(options[options.length - 1]?.quantity) || 0
}

const simulatePack = (packType, rarityGroups) => {
  const picked = []
  for (const r of ['C', 'UC', 'R', 'SR', 'SEC']) {
    const n = packType.cardsPerRarity?.[r] ?? 0
    if (n > 0) picked.push(...pickRandom(rarityGroups[r] || [], n))
  }
  return picked
}

// ── Result state ──────────────────────────────────────────────────────────────
// entries: [{ driveCard, meta, rarity, count }] sorted by rarity then cardNumber
const resultEntries = ref([])
const editionId     = ref('')
const editionName   = ref('')
const mode          = ref('') // 'pack' | 'box'
const packTypeName  = ref('')
const randomPack    = ref(false)
const totalCards    = ref(0)

const resultsByRarity = computed(() => {
  const grouped = {}
  for (const r of RARITY_ORDER) {
    const cards = resultEntries.value.filter(e => e.rarity === r)
    if (cards.length) grouped[r] = cards
  }
  return grouped
})

// ── Build result entries from meta cards + drive cards ────────────────────────
function buildEntries(metaCardResults) {
  // Count occurrences
  const countMap = new Map()
  for (const mc of metaCardResults) {
    const key = mc.id
    countMap.set(key, (countMap.get(key) ?? 0) + 1)
  }

  const entries = []
  for (const [metaId, count] of countMap) {
    const meta = cardsStore.metaCards.find(c => c.id === metaId)
    if (!meta) continue
    // Find matching drive card
    const driveCard = allMerged.value.find(dc =>
      buildCardKey(dc.edition, dc.number, dc.sub_edition, dc.color_identity) ===
      buildCardKey(meta.edition, meta.cardNumber, meta.subEdition, meta.colorIdentity)
    ) ?? null
    entries.push({ driveCard, meta, rarity: meta.rarity || 'C', count })
  }

  entries.sort((a, b) => {
    const ri = r => RARITY_ORDER.indexOf(r)
    if (ri(a.rarity) !== ri(b.rarity)) return ri(a.rarity) - ri(b.rarity)
    return (a.meta.cardNumber ?? 0) - (b.meta.cardNumber ?? 0)
  })
  return entries
}

// ── Run simulation from query params ─────────────────────────────────────────
async function runSimulation() {
  loading.value = true
  await Promise.all([cardsStore.load(), editionsStore.load()])

  const eId        = route.query.edition    ?? ''
  const modeVal    = route.query.mode       ?? 'pack'
  const ptName     = route.query.packType   ?? ''

  editionId.value   = eId
  mode.value        = modeVal
  packTypeName.value = ptName
  randomPack.value  = route.query.random === '1'

  const edMeta = editionsStore.sorted.find(e => e.editionId === eId)
  editionName.value = edMeta?.editionName ?? eId

  if (!edMeta?.packTypes?.length) { loading.value = false; return }

  const edCards    = getEditionCards(eId)
  const groups     = groupByRarity(edCards)
  let picked       = []

  if (modeVal === 'box') {
    const bc = edMeta.boxConfig ?? {}
    const totalPacks = bc.totalPacks ?? 0
    const entries    = bc.entries ?? []
    let placed = 0

    // 1. FIXED
    for (const entry of entries.filter(e => e.mode === 'FIXED')) {
      const pt = edMeta.packTypes.find(p => p.name === entry.packTypeName)
      if (!pt) continue
      const n = entry.quantity || 0
      for (let i = 0; i < n; i++) picked.push(...simulatePack(pt, groups))
      placed += n
    }

    // 2. PROB — roll each entry's probability distribution
    for (const entry of entries.filter(e => e.mode === 'PROB')) {
      const pt = edMeta.packTypes.find(p => p.name === entry.packTypeName)
      if (!pt || !entry.probOptions?.length) continue
      const n = pickByProb(entry.probOptions)
      for (let i = 0; i < n; i++) picked.push(...simulatePack(pt, groups))
      placed += n
    }

    // 3. FLEX — fill remaining slots
    const flexEntry = entries.find(e => e.mode === 'FLEX')
    if (flexEntry) {
      const pt = edMeta.packTypes.find(p => p.name === flexEntry.packTypeName)
      if (pt) {
        const remaining = Math.max(0, totalPacks - placed)
        for (let i = 0; i < remaining; i++) picked.push(...simulatePack(pt, groups))
      }
    }
  } else {
    const pt = edMeta.packTypes.find(p => p.name === ptName) ?? edMeta.packTypes[0]
    picked = simulatePack(pt, groups)
  }

  totalCards.value   = picked.length
  resultEntries.value = buildEntries(picked)
  loading.value = false
}

// ── Detail modal ──────────────────────────────────────────────────────────────
const detailCard  = ref(null)
const showDetail  = ref(false)
const flatList    = computed(() => resultEntries.value.map(e => e.driveCard).filter(Boolean))
const detailIndex = computed(() => flatList.value.findIndex(c => c?.id === detailCard.value?.id))

function openDetail(entry) {
  if (!entry.driveCard) return
  detailCard.value = entry.driveCard
  showDetail.value = true
  document.body.style.overflow = 'hidden'
}
function closeDetail() {
  showDetail.value = false
  detailCard.value = null
  document.body.style.overflow = ''
}
function prevCard() { if (detailIndex.value > 0) detailCard.value = flatList.value[detailIndex.value - 1] }
function nextCard() { if (detailIndex.value < flatList.value.length - 1) detailCard.value = flatList.value[detailIndex.value + 1] }

onMounted(runSimulation)
</script>

<template>
  <div class="br-page">

    <!-- Header -->
    <div class="br-header">
      <button class="btn-ghost br-back" @click="router.back()">
        <i class="bi bi-arrow-left"></i> Volver
      </button>
      <div class="br-title-block">
        <h1 class="br-title">
          {{ mode === 'box' ? 'Apertura de caja' : randomPack ? 'Sobre aleatorio' : 'Apertura de sobre' }}
        </h1>
        <div class="br-subtitle">
          {{ editionId }}{{ editionName ? ` — ${editionName}` : '' }}
          <span v-if="mode === 'pack' && packTypeName" class="br-packtype">· {{ packTypeName }}</span>
        </div>
      </div>
      <button class="btn-filled br-reroll" @click="runSimulation" :disabled="loading">
        <i class="bi bi-arrow-clockwise"></i> Volver a abrir
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="br-loading">Simulando…</div>

    <!-- Empty -->
    <div v-else-if="resultEntries.length === 0" class="br-empty">
      <i class="bi bi-exclamation-circle"></i>
      <p>No se pudo simular. Verifica que la edición tenga cartas y configuración de sobre.</p>
    </div>

    <!-- Results by rarity -->
    <template v-else>
      <div class="br-summary">
        {{ totalCards }} carta{{ totalCards !== 1 ? 's' : '' }} obtenidas
      </div>

      <div v-for="r in RARITY_ORDER" :key="r">
        <div v-if="resultsByRarity[r]" class="br-rarity-section">

          <div class="br-rarity-header">
            <span class="br-rarity-dot" :style="{ background: RARITY_COLOR[r] }"></span>
            <span class="br-rarity-label" :style="{ color: RARITY_COLOR[r] }">{{ RARITY_LABEL[r] }}</span>
            <span class="br-rarity-count">
              {{ resultsByRarity[r].reduce((s, e) => s + e.count, 0) }} carta{{ resultsByRarity[r].reduce((s, e) => s + e.count, 0) !== 1 ? 's' : '' }}
            </span>
          </div>

          <div class="br-grid">
            <div
              v-for="entry in resultsByRarity[r]"
              :key="entry.meta.id"
              class="br-card"
              :class="{ 'br-card--clickable': !!entry.driveCard }"
              @click="openDetail(entry)"
            >
              <img
                v-if="entry.driveCard && cardImageUrl(entry.driveCard)"
                :src="cardImageUrl(entry.driveCard)"
                :alt="entry.meta.cardName"
                class="br-card-img"
              />
              <div v-else class="br-card-placeholder">
                <i class="bi bi-image"></i>
                <span>{{ entry.meta.cardName }}</span>
              </div>
              <span v-if="entry.count > 1" class="br-card-count">×{{ entry.count }}</span>
              <div class="br-card-rarity-dot" :style="{ background: RARITY_COLOR[r] }"></div>
            </div>
          </div>

        </div>
      </div>
    </template>

    <!-- Detail modal -->
    <CardDetailModal
      v-if="showDetail"
      :card="detailCard"
      :prev-disabled="detailIndex <= 0"
      :next-disabled="detailIndex >= flatList.length - 1"
      @close="closeDetail"
      @prev="prevCard"
      @next="nextCard"
    />

  </div>
</template>

<style scoped>
.br-page { max-width: 1400px; margin: 0 auto; padding: 1.5rem 1rem; }

/* Header */
.br-header {
  display: flex; align-items: center; gap: 1rem;
  margin-bottom: 1.5rem; flex-wrap: wrap;
}
.br-back { flex-shrink: 0; }
.br-title-block { flex: 1; min-width: 0; }
.br-title { font-size: 1.4rem; font-weight: 700; color: var(--text-primary); margin: 0; }
.br-subtitle { font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.15rem; }
.br-packtype { color: var(--text-muted); }
.br-reroll { flex-shrink: 0; }

/* States */
.br-loading, .br-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 0.75rem; padding: 4rem;
  color: var(--text-muted); font-size: 1rem; text-align: center;
}
.br-empty i { font-size: 2.5rem; }

/* Summary */
.br-summary {
  font-size: 0.88rem; color: var(--text-muted); font-weight: 600;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--card-border); padding-bottom: 0.6rem;
}

/* Rarity section */
.br-rarity-section { margin-bottom: 2rem; }
.br-rarity-header {
  display: flex; align-items: center; gap: 0.6rem;
  margin-bottom: 0.75rem;
}
.br-rarity-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.br-rarity-label { font-size: 0.85rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; }
.br-rarity-count { font-size: 0.8rem; color: var(--text-muted); }

/* Card grid — same rhythm as DeckView */
.br-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
}
.br-card {
  position: relative; border-radius: 8px; overflow: hidden;
  background: var(--card-bg); border: 1px solid var(--card-border);
  aspect-ratio: 63/88;
  transition: transform 0.15s, box-shadow 0.15s;
}
.br-card--clickable { cursor: pointer; }
.br-card--clickable:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
.br-card-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.br-card-placeholder {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 0.4rem;
  color: var(--text-muted); font-size: 0.75rem; text-align: center; padding: 0.5rem;
}
.br-card-placeholder i { font-size: 1.5rem; }
.br-card-count {
  position: absolute; bottom: 0.3rem; right: 0.4rem;
  background: rgba(0,0,0,0.75); color: #fff;
  font-size: 0.75rem; font-weight: 700;
  padding: 0.1rem 0.35rem; border-radius: 4px;
}
.br-card-rarity-dot {
  position: absolute; top: 0.35rem; right: 0.35rem;
  width: 8px; height: 8px; border-radius: 50%;
  box-shadow: 0 0 4px rgba(0,0,0,0.5);
}

@media (max-width: 700px) {
  .br-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
}
</style>
