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
</style>
