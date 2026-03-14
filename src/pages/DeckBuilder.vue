<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'
import { useAuthStore }    from '@/store/login'
import { useCardsStore }   from '@/store/cards'
import { useEditionsStore } from '@/store/editions'
import { useDecksStore }   from '@/store/decks'

const auth           = useAuthStore()
const cardsStore     = useCardsStore()
const editionsStore  = useEditionsStore()
const decksStore     = useDecksStore()
const canManageDecks = computed(() => auth.can('manage_decks'))
const route          = useRoute()


// ── Lazy render for search results ───────────────────────────────────────
const renderCount = ref(60)
const LOAD_MORE   = 40


// ── Constants ─────────────────────────────────────────────────────────────
const COLOR_IDENTITIES = ['B', 'G', 'P', 'R', 'W']
const CARD_TYPES       = ['creature', 'utility', 'structure']
const COST_MAX         = 8
const LEVEL_MAX        = 12
const SPECIAL_COST_MAX = 5
const RARITIES         = ['C', 'UC', 'R', 'SR', 'SEC']

// ── Card data (from store) ─────────────────────────────────────────────────
const loadingCards = ref(false)

const editions = computed(() => editionsStore.sorted)
const refData  = computed(() => cardsStore.refData ?? { classes: [], keywordEffects: {} })

const metaMap = computed(() => {
  const m = new Map()
  cardsStore.metaCards.forEach(c => {
    if (c.edition && c.cardNumber != null) m.set(c.edition + '|' + c.cardNumber, c)
  })
  return m
})

const allMerged = computed(() =>
  cardsStore.driveCards.map(dc => ({
    ...dc,
    meta: metaMap.value.get(dc.edition + '|' + dc.number) ?? null,
  }))
)

// ── Versioned image URL ────────────────────────────────────────────────────
const cardImageUrl = card => {
  if (!card?.image_url) return null
  const ts = card.time_stamp ? new Date(card.time_stamp).getTime() : Date.now()
  return `${card.image_url}?v=${ts}`
}

// ── Search / filter state ──────────────────────────────────────────────────
const searchQuery      = ref('')
const showQuickFilters = ref(false)
const showAdvModal     = ref(false)   // advanced filters as modal
const quickType        = ref('')

// Advanced filters
const fColors         = ref([...COLOR_IDENTITIES])
const fColorMatchMode = ref('any')
const fType           = ref('')
const fEdition        = ref('')
const fClases         = ref([])
const fRarity         = ref([])
const fCostMin        = ref(0); const fCostMax        = ref(COST_MAX)
const fLevelMin       = ref(0); const fLevelMax       = ref(LEVEL_MAX)
const fSpecialCostMin = ref(0); const fSpecialCostMax = ref(SPECIAL_COST_MAX)
const fSpecialSummon  = ref('')
const fStarter        = ref(false)

const classes                 = computed(() => (refData.value.classes ?? []).slice().sort())
const availableTypes          = computed(() => [...new Set(metaCards.value.map(c => c.cardType).filter(Boolean))].sort())
const availableSpecialSummons = computed(() => [...new Set(metaCards.value.map(c => c.specialSummonKind).filter(Boolean))].sort())
const colorLabel = c => ({ B: 'Blue', G: 'Green', P: 'Purple', R: 'Red', W: 'White' }[c] ?? c)

const advFiltersActive = computed(() =>
  fColors.value.length < COLOR_IDENTITIES.length || fType.value || fEdition.value ||
  fClases.value.length || fRarity.value.length || fStarter.value || fSpecialSummon.value ||
  fCostMin.value > 0 || fCostMax.value < COST_MAX ||
  fLevelMin.value > 0 || fLevelMax.value < LEVEL_MAX ||
  fSpecialCostMin.value > 0 || fSpecialCostMax.value < SPECIAL_COST_MAX
)

const resetAdvFilters = () => {
  fColors.value = [...COLOR_IDENTITIES]; fColorMatchMode.value = 'any'
  fType.value = ''; fEdition.value = ''; fClases.value = []; fRarity.value = []
  fCostMin.value = 0; fCostMax.value = COST_MAX
  fLevelMin.value = 0; fLevelMax.value = LEVEL_MAX
  fSpecialCostMin.value = 0; fSpecialCostMax.value = SPECIAL_COST_MAX
  fSpecialSummon.value = ''; fStarter.value = false
}

const searchResults = computed(() => {
  const q         = searchQuery.value.toLowerCase().trim()
  const allColors = fColors.value.length === COLOR_IDENTITIES.length
  const costFull  = fCostMin.value === 0 && fCostMax.value === COST_MAX
  const lvlFull   = fLevelMin.value === 0 && fLevelMax.value === LEVEL_MAX
  const scFull    = fSpecialCostMin.value === 0 && fSpecialCostMax.value === SPECIAL_COST_MAX

  return allMerged.value
    .filter(c => !q || (c.name ?? '').toLowerCase().includes(q) || (c.edition ?? '').toLowerCase().includes(q))
    .filter(c => {
      const t = quickType.value || fType.value
      return !t || c.meta?.cardType?.toLowerCase() === t.toLowerCase()
    })
    .filter(c => {
      if (allColors) return true
      const cols = [...new Set([c.color_identity, ...(c.meta?.colors ?? [])].filter(Boolean))]
      if (!cols.length) return true
      return cols.some(col => fColors.value.includes(col))
    })
    .filter(c => !fClases.value.length || c.meta?.cardClasses?.some(cl => fClases.value.includes(cl)))
    .filter(c => { if (costFull) return true; const v = c.meta?.cost; return v == null || (v >= fCostMin.value && v <= fCostMax.value) })
    .filter(c => { if (lvlFull) return true; const v = c.meta?.level; return v == null || (v >= fLevelMin.value && v <= fLevelMax.value) })
    .filter(c => { if (scFull) return true; const v = c.meta?.specialCost; return v != null && v >= fSpecialCostMin.value && v <= fSpecialCostMax.value })
    .filter(c => !fSpecialSummon.value || c.meta?.specialSummonKind === fSpecialSummon.value)
    .filter(c => !fRarity.value.length || fRarity.value.includes(c.meta?.rarity))
    .filter(c => !fStarter.value || c.meta?.starter === true)
    .filter(c => !fEdition.value || c.edition === fEdition.value)
})

const visibleCards = computed(() => {
  return searchResults.value.slice(0, renderCount.value)
})

// ── Selected card ─────────────────────────────────────────────────────────
const selectedCard = ref(null)
const selectCard   = card => { selectedCard.value = card }

// ── Deck state ────────────────────────────────────────────────────────────
const deckId      = ref(null)
const deckName    = ref('Nuevo mazo')
const deckEntries = ref([])
const savedState  = ref(null)
const dirty       = ref(false)
const saving      = ref(false)
const deckImage   = ref(null)
const privateDeck  = ref(false)

const totalCards   = computed(() => deckEntries.value.reduce((s, e) => s + e.count, 0))
const deckCountMap = computed(() => {
  const m = {}
  deckEntries.value.forEach(e => { m[e.card.id] = e.count })
  return m
})
const changeDeckPrivacy = () => {
  privateDeck.value = !privateDeck.value
  dirty.value = true
}

const countInDeck = cardId => deckCountMap.value[cardId] ?? 0

const MAX_COPIES = 4
const MAX_CARDS = 100

const addToDeck = card => {
  const existing = deckEntries.value.find(e => e.card.id === card.id)
  
  if (totalCards.value >= MAX_CARDS) return
  if (existing) {
    if (existing.count >= MAX_COPIES) return
    existing.count++
  } else {
    deckEntries.value.push({ card: { ...card }, count: 1 })
  }
  dirty.value = true
  selectedCard.value = card
  if (!deckImage.value) deckImage.value = cardImageUrl(card)
  
}

const removeFromDeck = cardId => {
  const idx = deckEntries.value.findIndex(e => e.card.id === cardId)
  if (idx === -1) return
  const entry = deckEntries.value[idx]
  if (entry.count > 1) entry.count--
  else deckEntries.value.splice(idx, 1)
  dirty.value = true
  if (deckImage.value === cardImageUrl(entry.card)) deckImage.value = null
}

const makeDeckImage = card => {
  deckImage.value = cardImageUrl(card)
  dirty.value = true
}

const deckGrouped = computed(() => {
  const g = {}
  deckEntries.value.forEach(e => {
    const type = e.card.meta?.cardType ?? 'sin tipo'
    if (!g[type]) g[type] = []
    g[type].push(e)
  })
  return g
})

// ── Drag & drop ───────────────────────────────────────────────────────────
const isDragOver   = ref(false)
const draggingId   = ref(null)

const onSearchDragStart = (card, e) => {
  draggingId.value = card.id
  e.dataTransfer.setData('cardId', card.id)
  e.dataTransfer.effectAllowed = 'copy'
}

const onDropToDeck = e => {
  e.preventDefault()
  isDragOver.value = false
  const cardId = e.dataTransfer.getData('cardId')
  const card   = allMerged.value.find(c => c.id === cardId)
  if (card) addToDeck(card)
  draggingId.value = null
}

// ── Save / Discard / Share ─────────────────────────────────────────────────
const saveDeck = async () => {
  if (!canManageDecks.value) return
  const cards     = deckEntries.value.flatMap(e => Array(e.count).fill(e.card.id))
  
  // deckImage.value is already a URL — send directly, no card ID lookup needed
  const payload   = { deckName: deckName.value, cards, deckImage: deckImage.value, userId: auth.userId, username: auth.username, privateDeck: privateDeck.value }
  saving.value = true
  try {
    if (deckId.value) {
      await axios.put(`/api/drive/decklists/${deckId.value}`, payload)
    } else {
      const { data } = await axios.post('/api/drive/decklists', payload)
      deckId.value = data.id
    }
    savedState.value = JSON.parse(JSON.stringify(deckEntries.value))
    dirty.value = false
    // Invalidate cached deck lists so MyDecks/PublicDecks refresh on next visit
    decksStore.invalidateMine()
    decksStore.invalidatePublic()
  } catch (e) { console.error('Error saving deck', e) }
  finally { saving.value = false }
}

const discardChanges = () => {
  if (!savedState.value) return
  deckEntries.value = JSON.parse(JSON.stringify(savedState.value))
  dirty.value = false
}

const shareDeck = () => {
  const lines = [`Mazo: ${deckName.value}`, `Total: ${totalCards.value} cartas`, '']
  Object.entries(deckGrouped.value).forEach(([type, entries]) => {
    lines.push(type.toUpperCase())
    entries.forEach(e => lines.push(`  ${e.count}x ${e.card.name} (${e.card.edition} #${e.card.number})`))
    lines.push('')
  })
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = deckName.value + '.txt'; a.click()
  URL.revokeObjectURL(url)
}

// ── Effect rendering ───────────────────────────────────────────────────────
const escapeHtml = s => s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''
const getKwDesc  = kwKey => refData.value.keywordEffects?.[kwKey]?.displayText || null

const resolveTokensHtml = (text, cKws) => {
  if (!text) return ''
  return escapeHtml(text).replace(/\[\[([^\]:]+)(?::([^\]]*))?\]\]/g, (_, kw, val) => {
    const rendered = val ? kw.replace(/\{[^}]+\}/, val) : kw
    cKws.push({ kw, val: val || null, rendered })
    return `<span class="kw-inline">${escapeHtml(rendered)}</span>`
  })
}

const renderEffectHtml = ef => {
  const parts = []
  if (ef.instance) parts.push(escapeHtml(`<${ef.instance}>`))
  if (ef.ussageLimit === 'once per turn') parts.push('[once per turn]')
  else if (ef.ussageLimit === 'once per turn between copies') parts.push('[once per turn between copies]')
  else if (ef.ussageLimit === 'ultimate effect') parts.push('[ultimate]')
  ;(ef.effectBlocks ?? []).forEach(b => {
    const bKws = []; let s = ''
    if (b.activationCondition) s += resolveTokensHtml(b.activationCondition, bKws) + ': '
    if (b.cost)                s += resolveTokensHtml(b.cost, bKws) + '; '
    if (b.resolution)          s += resolveTokensHtml(b.resolution, bKws)
    if (s.trim()) {
      let html = s.trim()
      bKws.forEach(({ kw, val, rendered }) => {
        const desc = getKwDesc(kw)
        if (desc) {
          const dr = val ? desc.replace(/\{[^}]+\}/, val) : desc
          html += ` <span class="kw-desc">(${escapeHtml(rendered)}: ${escapeHtml(dr)})</span>`
        }
      })
      parts.push(html)
    }
  })
  return parts.join(' ') || 'efecto vacío'
}

const renderCardKwEffect = ke => {
  if (!ke?.keyword) return ''
  const rendered = ke.number != null ? ke.keyword.replace(/\{[^}]+\}/, ke.number) : ke.keyword
  const desc     = getKwDesc(ke.keyword)
  let html = `<span class="kw-name">${escapeHtml(rendered)}</span>`
  if (desc) {
    const dr = ke.number != null ? desc.replace(/\{[^}]+\}/g, ke.number) : desc
    html += ` <span class="kw-desc">(${escapeHtml(dr)})</span>`
  }
  return html
}

// ── Resolve loaded deck data into local state ─────────────────────────────
const resolveDeck = (data, copy) => {
  deckName.value = data.deckName ?? 'Mazo'
  const countMap = {}
  ;(data.cards ?? []).forEach(cId => { countMap[cId] = (countMap[cId] ?? 0) + 1 })
  const entries = []
  for (const [cId, count] of Object.entries(countMap)) {
    const card = allMerged.value.find(c => c.id === cId)
    if (card) entries.push({ card, count })
  }
  deckEntries.value = entries
  savedState.value  = JSON.parse(JSON.stringify(entries))
  // deckImage is now stored as a URL directly
  deckImage.value   = data.deckImage || (entries[0]?.card ? cardImageUrl(entries[0].card) : null)

  if (copy === 'true') {
    deckId.value    = null
    deckName.value += ' (copia)'
    dirty.value     = true
  } else {
    deckId.value = data.id
    dirty.value  = false
  }
}

onMounted(async () => {
  loadingCards.value = true
  window.addEventListener('scroll', onScroll)

  // Start deck fetch in parallel with card/edition loading
  const deckPromise = route.query.id
    ? axios.get(`/api/drive/decklists/${route.query.id}`).catch(() => null)
    : Promise.resolve(null)

  try {
    await Promise.all([
      cardsStore.load(),
      editionsStore.load(),
      cardsStore.loadRef(),
    ])
  } catch (e) {
    console.error(e)
  } finally {
    loadingCards.value = false
  }

  // Resolve deck entries — cards are guaranteed loaded now
  const deckRes = await deckPromise
  if (deckRes) {
    resolveDeck(deckRes.data, route.query.copy)
  }
})


const onScroll = () => {
  const scrollBottom =
    window.innerHeight + window.scrollY >= document.body.offsetHeight - 400

  if (scrollBottom && renderCount.value < searchResults.value.length) {
    renderCount.value += LOAD_MORE
  }
}

watch(searchResults, () => {
  renderCount.value = 60
})

watch(deckEntries, () => {
  if (!deckEntries.value.some(e => cardImageUrl(e.card) === deckImage.value)) {
    deckImage.value = deckEntries.value[0]?.card
      ? cardImageUrl(deckEntries.value[0].card)
      : null
  }
})

</script>

<template>
  <div class="db-page">

    <!-- ══ LEFT: Card detail ════════════════════════════════════════════════ -->
    <div class="db-left">
      <div v-if="!selectedCard" class="db-empty-panel">
        <i class="bi bi-card-image db-empty-icon"></i>
        <p>Selecciona una carta</p>
      </div>

      <template v-else>
        <div class="db-detail-header">
          <h2 class="db-card-name">{{ selectedCard.name }}</h2>
          <div class="db-detail-badges">
            <span class="db-badge db-badge--ed">{{ selectedCard.edition }}</span>
            <span class="db-badge db-badge--num">#{{ selectedCard.number }}</span>
            <span class="db-badge" :class="'db-badge--' + (selectedCard.color_identity || '').toLowerCase()">
              {{ colorLabel(selectedCard.color_identity) }}
            </span>
          </div>
        </div>

        <!-- Copy manager -->
        <div class="db-copy-manager">
          <button class="db-copy-btn" @click="removeFromDeck(selectedCard.id)"
            :disabled="countInDeck(selectedCard.id) === 0">
            <i class="bi bi-dash"></i>
          </button>
          <div class="db-copy-info">
            <span class="db-copy-num">{{ countInDeck(selectedCard.id) }}</span>
            <span class="db-copy-label">en el mazo</span>
          </div>
          <button class="db-copy-btn db-copy-btn--add" @click="addToDeck(selectedCard)" :disabled="countInDeck(selectedCard.id) >= MAX_COPIES || totalCards >= MAX_CARDS">
            <i class="bi bi-plus"></i>
          </button>
        </div>

        <!-- Image -->
        <div class="db-detail-img-wrap">
          <img :src="cardImageUrl(selectedCard)" :alt="selectedCard.name" class="db-detail-img" />
        </div>

        <!-- Plain meta -->
        <div v-if="selectedCard.meta" class="db-meta-plain">
          <div v-if="selectedCard.meta.cardType" class="db-meta-row">
            <span class="db-meta-k">Tipo</span><span class="db-meta-v">{{ selectedCard.meta.cardType }}</span>
          </div>
          <div v-if="selectedCard.meta.cost != null" class="db-meta-row">
            <span class="db-meta-k">Coste</span><span class="db-meta-v">{{ selectedCard.meta.cost }}</span>
          </div>
          <div v-if="selectedCard.meta.strength != null" class="db-meta-row">
            <span class="db-meta-k">Fuerza</span><span class="db-meta-v">{{ selectedCard.meta.strength }}</span>
          </div>
          <div v-if="selectedCard.meta.level != null" class="db-meta-row">
            <span class="db-meta-k">Nivel</span><span class="db-meta-v">{{ selectedCard.meta.level }}</span>
          </div>
          <div v-if="selectedCard.meta.rarity" class="db-meta-row">
            <span class="db-meta-k">Rareza</span><span class="db-meta-v">{{ selectedCard.meta.rarity }}</span>
          </div>
          <div v-if="selectedCard.meta.specialCost != null" class="db-meta-row">
            <span class="db-meta-k">C. Especial</span><span class="db-meta-v">{{ selectedCard.meta.specialCost }}</span>
          </div>
          <div v-if="selectedCard.meta.starter" class="db-meta-row">
            <span class="db-meta-k">Iniciador</span><span class="db-meta-v">Sí</span>
          </div>
          <div v-if="selectedCard.meta.cardClasses?.length" class="db-meta-row">
            <span class="db-meta-k">Clases</span><span class="db-meta-v">{{ selectedCard.meta.cardClasses.join(', ') }}</span>
          </div>
          <div v-if="selectedCard.meta.specialSummonKind" class="db-meta-row">
            <span class="db-meta-k">Inv. Especial</span><span class="db-meta-v">{{ selectedCard.meta.specialSummonKind }}</span>
          </div>
          <div v-if="selectedCard.meta.requirement" class="db-meta-row db-meta-row--block">
            <span class="db-meta-k">Requerimiento</span><span class="db-meta-v">{{ selectedCard.meta.requirement }}</span>
          </div>

          <template v-if="selectedCard.meta.effects?.length || selectedCard.meta.keywordEffects?.length">
            <div class="db-effects-label">Efectos</div>
            <div v-for="(ef, i) in selectedCard.meta.effects" :key="i" class="db-effect-line">
              <span v-html="renderEffectHtml(ef)"></span>
            </div>
            <div v-for="(ke, i) in selectedCard.meta.keywordEffects" :key="'kw'+i" class="db-effect-line db-effect-kw">
              <span v-html="renderCardKwEffect(ke)"></span>
            </div>
          </template>

          <template v-if="selectedCard.meta.inheritEffects?.length || selectedCard.meta.inheritKeywordEffects?.length">
            <div class="db-effects-label">Efectos heredados</div>
            <div v-for="(ef, i) in selectedCard.meta.inheritEffects" :key="i" class="db-effect-line">
              <span v-html="renderEffectHtml(ef)"></span>
            </div>
            <div v-for="(ke, i) in selectedCard.meta.inheritKeywordEffects" :key="'ikw'+i" class="db-effect-line db-effect-kw">
              <span v-html="renderCardKwEffect(ke)"></span>
            </div>
          </template>
        </div>

        <div v-else class="db-no-meta">Sin metadatos</div>
      </template>
    </div>

    <!-- ══ MIDDLE: Deck editor ═══════════════════════════════════════════════ -->
    <div class="db-mid">
      <!-- Header -->
      <div class="db-mid-header">
        <div class="db-deck-header">
          <input
            class="db-deck-name"
            v-model="deckName"
            placeholder="Nombre del mazo"
            @input="dirty = true"
          />

          <button class="db-private-btn" v-on:click="changeDeckPrivacy">
            <i :class="privateDeck ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
          </button>
        </div>
        <div class="db-mid-actions">
          <div class="db-save-group">
            <button class="btn-filled" @click="saveDeck"
              :disabled="!canManageDecks || saving || !dirty || deckEntries.length === 0"
              :title="!canManageDecks ? 'Necesitas el permiso manage_decks para guardar' : ''">
              {{ saving ? 'Guardando…' : 'Guardar' }}
            </button>
            <button class="db-discard-btn" @click="discardChanges"
              :disabled="!savedState || !dirty" title="Descartar cambios">
              <i class="bi bi-arrow-counterclockwise"></i>
            </button>
          </div>
          <button class="btn-ghost" @click="shareDeck" :disabled="deckEntries.length === 0">
            <i class="bi bi-download"></i> Compartir
          </button>
          <button class="btn-ghost" disabled title="Próximamente">
            <i class="bi bi-tools"></i> Herramientas
          </button>
        </div>
      </div>

      <div class="db-deck-count">{{ totalCards }}</div>

      <!-- Drop zone + grid -->
      <div class="db-deck-scroll"
        @dragover.prevent="isDragOver = true"
        @dragleave="isDragOver = false"
        @drop="onDropToDeck">

        <div v-if="deckEntries.length === 0" class="db-deck-empty"
          :class="{ 'db-deck-empty--dragover': isDragOver }">
          <i class="bi bi-collection db-empty-icon"></i>
          <p>Arrastra cartas aquí o usa el <strong>+</strong></p>
        </div>

        <template v-else>
          <div v-for="(entries, type) in deckGrouped" :key="type" class="db-deck-group">
            <div class="db-group-label">
              {{ type }}
              <span class="db-group-count">{{ entries.reduce((s, e) => s + e.count, 0) }}</span>
            </div>
            <div class="db-deck-grid" :class="{ 'db-deck-grid--dragover': isDragOver }">
              <div v-for="entry in entries" :key="entry.card.id"
                class="db-deck-card"
                :class="{ 'db-deck-card--selected': selectedCard?.id === entry.card.id }"
                draggable="true"
                @dragstart="onSearchDragStart(entry.card, $event)"
                @click="selectCard(entry.card)"
                @contextmenu.prevent="removeFromDeck(entry.card.id)">

                <img :src="cardImageUrl(entry.card)" :alt="entry.card.name" class="db-deck-img" />

                <!-- Deck image button (top-left) -->
                <button
                  class="db-ctrl-btn-deck-image"
                  :class="{ selected: deckImage === cardImageUrl(entry.card) }"
                  :disabled="deckImage === cardImageUrl(entry.card)"
                  @click.stop="makeDeckImage(entry.card)"
                >
                  <i class="bi bi-image"></i>
                </button>

                <div class="db-deck-card-controls" @click.stop>
                  <button class="db-ctrl-btn" @click="removeFromDeck(entry.card.id)">−</button>
                  <span class="db-ctrl-count">{{ entry.count }}</span>
                  <button class="db-ctrl-btn" @click="addToDeck(entry.card)" :disabled="entry.count >= MAX_COPIES || totalCards >= MAX_CARDS">+</button>
                </div>

              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- ══ RIGHT: Search ══════════════════════════════════════════════════════ -->
    <div class="db-right">
      <div class="db-search-header">
        <input class="db-search-input" v-model="searchQuery"
          placeholder="Buscar por nombre o edición…" />

        <div class="db-filter-row">
          <div class="db-filter-toggle-btns">
            <button class="db-filter-toggle" :class="{ active: showQuickFilters }"
              @click="showQuickFilters = !showQuickFilters">
              Filtros comunes
            </button>
            <button class="db-filter-toggle" :class="{ active: showAdvModal || advFiltersActive }"
              @click="showAdvModal = true">
              Filtros avanzados<span v-if="advFiltersActive" class="db-adv-dot"></span>
            </button>
          </div>
        </div>

        <!-- Quick type chips -->
        <div v-if="showQuickFilters" class="db-quick-chips">
          <button v-for="t in CARD_TYPES" :key="t" class="chip"
            :class="{ active: quickType === t }"
            @click="quickType = quickType === t ? '' : t">{{ t }}</button>
        </div>

        <div class="db-results-count">{{ searchResults.length }} carta{{ searchResults.length !== 1 ? 's' : '' }}</div>
      </div>

      <div v-if="loadingCards" class="db-loading">Cargando…</div>
      <div v-else class="db-search-scroll">
        <div class="db-search-grid">
          <div v-for="card in visibleCards" :key="card.id"
            class="db-search-card"
            :class="{ 'db-search-card--selected': selectedCard?.id === card.id, 'db-search-card--maxed': countInDeck(card.id) >= MAX_COPIES || totalCards >= MAX_CARDS }"
            draggable="true"
            @dragstart="onSearchDragStart(card, $event)"
            @click="selectCard(card)"
            @contextmenu.prevent="addToDeck(card)">
            <img :src="cardImageUrl(card)" :alt="card.name" class="db-search-img" />
            <span v-if="countInDeck(card.id) > 0" class="db-count-badge" :class="{ 'db-count-badge--max': countInDeck(card.id) >= MAX_COPIES || totalCards >= MAX_CARDS }">{{ countInDeck(card.id) }}</span>
            <button class="db-search-add" @click.stop="addToDeck(card)" :disabled="countInDeck(card.id) >= MAX_COPIES || totalCards >= MAX_CARDS" title="Añadir">+</button>
          </div>
        </div>
      </div>
    </div>

  </div>

  <!-- ══ Advanced filters modal ══════════════════════════════════════════════ -->
  <Teleport to="body">
    <div v-if="showAdvModal" class="adv-overlay" @click.self="showAdvModal = false">
      <div class="adv-modal">
        <div class="adv-modal-header">
          <span class="adv-modal-title">Filtros avanzados</span>
          <div style="display:flex;gap:0.5rem;align-items:center">
            <button v-if="advFiltersActive" class="adv-reset-btn" @click="resetAdvFilters">Limpiar</button>
            <button class="adv-close-btn" @click="showAdvModal = false">✕</button>
          </div>
        </div>

        <div class="adv-modal-body">
          <!-- Color -->
          <div class="filter-group">
            <label class="filter-label">Color</label>
            <div class="filter-chips filter-chips--colors">
              <button v-for="c in COLOR_IDENTITIES" :key="c"
                class="chip chip--color"
                :class="['color-' + c.toLowerCase(), { active: fColors.includes(c) }]"
                @click="() => { if (fColors.length === COLOR_IDENTITIES.length) { fColors = [c] } else if (fColors.includes(c)) { const next = fColors.filter(x => x !== c); fColors = next.length ? next : [...COLOR_IDENTITIES] } else { fColors = [...fColors, c] } }">
                {{ colorLabel(c) }}
              </button>
            </div>
          </div>

          <!-- Edition -->
          <div class="filter-group">
            <label class="filter-label">Edición</label>
            <select v-model="fEdition" class="filter-select">
              <option value="">Todas</option>
              <option v-for="ed in editions" :key="ed.editionId" :value="ed.editionId">
                {{ ed.editionId }}{{ ed.editionName ? ' — ' + ed.editionName : '' }}
              </option>
            </select>
          </div>

          <!-- Type -->
          <div v-if="availableTypes.length" class="filter-group">
            <label class="filter-label">Tipo</label>
            <select v-model="fType" class="filter-select">
              <option value="">Todos</option>
              <option v-for="t in availableTypes" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>

          <!-- Classes -->
          <div v-if="classes.length" class="filter-group">
            <label class="filter-label">Clases</label>
            <div class="filter-chips">
              <button v-for="cl in classes" :key="cl" class="chip"
                :class="{ active: fClases.includes(cl) }"
                @click="fClases = fClases.includes(cl) ? fClases.filter(x => x !== cl) : [...fClases, cl]">
                {{ cl }}
              </button>
            </div>
          </div>

          <!-- Cost -->
          <div class="filter-group">
            <label class="filter-label">Coste<span class="filter-range-val" v-if="fCostMin > 0 || fCostMax < COST_MAX"> ({{ fCostMin }}–{{ fCostMax }})</span></label>
            <div class="dual-range" :style="{ '--pct-min': (fCostMin / COST_MAX * 100) + '%', '--pct-max': (fCostMax / COST_MAX * 100) + '%' }">
              <div class="dual-range-track"></div>
              <input type="range" min="0" :max="COST_MAX" step="1" v-model.number="fCostMin" @input="fCostMax = fCostMin > fCostMax ? fCostMin : fCostMax" />
              <input type="range" min="0" :max="COST_MAX" step="1" v-model.number="fCostMax" @input="fCostMin = fCostMax < fCostMin ? fCostMax : fCostMin" />
            </div>
          </div>

          <!-- Level -->
          <div class="filter-group">
            <label class="filter-label">Nivel<span class="filter-range-val" v-if="fLevelMin > 0 || fLevelMax < LEVEL_MAX"> ({{ fLevelMin }}–{{ fLevelMax }})</span></label>
            <div class="dual-range" :style="{ '--pct-min': (fLevelMin / LEVEL_MAX * 100) + '%', '--pct-max': (fLevelMax / LEVEL_MAX * 100) + '%' }">
              <div class="dual-range-track"></div>
              <input type="range" min="0" :max="LEVEL_MAX" step="1" v-model.number="fLevelMin" @input="fLevelMax = fLevelMin > fLevelMax ? fLevelMin : fLevelMax" />
              <input type="range" min="0" :max="LEVEL_MAX" step="1" v-model.number="fLevelMax" @input="fLevelMin = fLevelMax < fLevelMin ? fLevelMax : fLevelMin" />
            </div>
          </div>

          <!-- Special summon -->
          <div v-if="availableSpecialSummons.length" class="filter-group">
            <label class="filter-label">Inv. Especial</label>
            <select v-model="fSpecialSummon" class="filter-select">
              <option value="">Todos</option>
              <option v-for="ss in availableSpecialSummons" :key="ss" :value="ss">{{ ss }}</option>
            </select>
          </div>

          <!-- Rarity -->
          <div class="filter-group">
            <label class="filter-label">Rareza</label>
            <div class="filter-chips">
              <button v-for="r in RARITIES" :key="r" class="chip"
                :class="{ active: fRarity.includes(r) }"
                @click="fRarity = fRarity.includes(r) ? fRarity.filter(x => x !== r) : [...fRarity, r]">
                {{ r }}
              </button>
            </div>
          </div>

          <!-- Starter -->
          <div class="filter-group filter-group--row">
            <input type="checkbox" v-model="fStarter" class="filter-check" id="db-starter" />
            <label class="filter-label" for="db-starter">Iniciador</label>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── Page layout ─────────────────────────────────────────────────────────── */
.db-page {
  display: grid;
  grid-template-columns: 340px 1fr 500px;
  gap: 0.75rem;
  height: calc(100vh - 7.5rem);
  overflow: hidden;
}

/* ── Shared panel ────────────────────────────────────────────────────────── */
.db-left, .db-mid, .db-right {
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  overflow: hidden;
  min-height: 0;
}

/* ══ LEFT ═══════════════════════════════════════════════════════════════════ */
.db-left {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  padding: 1rem;
  gap: 0.7rem;
  overflow-y: auto;
}

.db-empty-panel {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: var(--text-muted); text-align: center; gap: 0.5rem;
}
.db-empty-icon { font-size: 2.5rem; }
.db-empty-panel p { font-size: 0.82rem; margin: 0; }

.db-detail-header { display: flex; flex-direction: column; gap: 0.35rem; }
.db-card-name { color: var(--text-primary); margin: 0; font-size: 1.05rem; font-weight: 700; line-height: 1.25; }
.db-detail-badges { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.db-badge {
  font-size: 0.72rem; font-weight: 700; padding: 0.1rem 0.4rem;
  border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em;
  background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--card-border);
}
.db-badge--b { background: #3b82f6; color: #fff; border-color: #3b82f6; }
.db-badge--g { background: #22c55e; color: #fff; border-color: #22c55e; }
.db-badge--p { background: #a855f7; color: #fff; border-color: #a855f7; }
.db-badge--r { background: #ef4444; color: #fff; border-color: #ef4444; }
.db-badge--w { background: #f5f5f5; color: #111; border-color: #ccc; }

/* Copy manager */
.db-copy-manager {
  display: flex; align-items: center;
  background: var(--input-bg); border: 1px solid var(--card-border); border-radius: 10px;
  padding: 0.5rem 0.6rem; gap: 0;
}
.db-copy-btn {
  width: 34px; height: 34px; border-radius: 8px;
  border: 1px solid var(--input-border); background: var(--card-bg);
  color: var(--text-secondary); font-size: 1.1rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, border-color 0.15s;
  flex-shrink: 0;
}
.db-copy-btn:hover:not(:disabled) { background: var(--input-bg); border-color: var(--text-muted); }
.db-copy-btn--add:hover:not(:disabled) { background: #3f51b5; border-color: #3f51b5; color: #fff; }
.db-copy-btn:disabled { opacity: 0.3; cursor: default; }
.db-copy-info {
  flex: 1; text-align: center; display: flex; flex-direction: column; line-height: 1.1;
}
.db-copy-num { font-size: 1.3rem; font-weight: 800; color: var(--text-primary); }
.db-copy-label { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

.db-detail-img-wrap { width: 100%; }
.db-detail-img { width: 100%; border-radius: 6px; display: block; }

/* Plain meta */
.db-meta-plain { display: flex; flex-direction: column; gap: 0.2rem; }
.db-meta-row { display: flex; gap: 0.5rem; align-items: baseline; }
.db-meta-row--block { flex-direction: column; gap: 0.1rem; }
.db-meta-k { font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; min-width: 70px; flex-shrink: 0; }
.db-meta-v { font-size: 0.82rem; color: var(--text-secondary); }
.db-effects-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); font-weight: 700; margin-top: 0.4rem; }
.db-effect-line { font-size: 0.72rem; color: var(--text-secondary); line-height: 1.45; }
.db-effect-kw { color: #7c8ce8; font-weight: 600; }
.db-no-meta { font-size: 0.8rem; color: #f55; background: rgba(244,67,54,0.08); border: 1px solid rgba(244,67,54,0.25); border-radius: 6px; padding: 0.5rem 0.7rem; }

/* ══ MIDDLE ══════════════════════════════════════════════════════════════════ */
.db-mid {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  padding: 0.9rem 0.9rem 0;
  gap: 0.4rem;
}

.db-mid-header { display: flex; flex-direction: column; gap: 0.5rem; flex-shrink: 0; }

.db-deck-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.db-private-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.25);
  background: rgba(0,0,0,0.5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.db-private-btn i {
  font-size: 1.1rem;
}


.db-deck-name {
  background: var(--input-bg); border: 1px solid var(--input-border);
  border-radius: 6px; color: var(--text-primary);
  font-size: 1rem; font-weight: 700; padding: 0.38rem 0.65rem;
  outline: none; width: 100%; box-sizing: border-box; transition: border-color 0.15s;
}
.db-deck-name:focus { border-color: #3f51b5; }

.db-mid-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; }
.db-save-group { display: flex; border-radius: 6px; overflow: hidden; }
.db-save-group .btn-filled { border-radius: 6px 0 0 6px; }
.db-discard-btn {
  background: var(--input-bg); border: 1px solid var(--input-border); border-left: none;
  color: var(--text-secondary); padding: 0 0.6rem; cursor: pointer;
  border-radius: 0 6px 6px 0; font-size: 0.95rem;
  transition: background 0.15s, color 0.15s;
}
.db-discard-btn:hover:not(:disabled) { background: var(--card-border); color: var(--text-primary); }
.db-discard-btn:disabled { opacity: 0.35; cursor: default; }

.db-deck-count { font-size: 0.75rem; color: var(--text-muted); flex-shrink: 0; padding-bottom: 0.2rem; }

.db-deck-scroll { flex: 1; overflow-y: auto; padding-bottom: 0.9rem; }

.db-deck-empty {
  min-height: 200px; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: var(--text-muted); text-align: center; gap: 0.5rem;
  border: 2px dashed var(--card-border); border-radius: 8px; margin: 0.5rem 0;
  transition: border-color 0.15s, background 0.15s;
}
.db-deck-empty--dragover { border-color: #3f51b5; background: rgba(63,81,181,0.06); }
.db-deck-empty p { font-size: 0.83rem; margin: 0; color: var(--text-muted); }

.db-deck-group { margin-bottom: 1rem; }
.db-group-label {
  font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em;
  color: var(--text-muted); font-weight: 700;
  display: flex; align-items: center; gap: 0.5rem;
  border-bottom: 1px solid var(--card-border); padding-bottom: 0.25rem; margin-bottom: 0.5rem;
}
.db-group-count {
  background: var(--input-bg); border: 1px solid var(--card-border);
  border-radius: 10px; font-size: 0.65rem; padding: 0.05rem 0.4rem;
  font-weight: 700; color: var(--text-muted);
}

.db-deck-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 0.4rem;
  transition: outline 0.15s;
}
.db-deck-grid--dragover { outline: 2px dashed #3f51b5; border-radius: 6px; }


.db-deck-card {
  position: relative; cursor: pointer;
  border-radius: 5px; overflow: hidden;
  border: 2px solid transparent; transition: border-color 0.15s;
}
.db-deck-card:hover { border-color: rgba(255,255,255,0.25); }
.db-deck-card--selected { border-color: #3f51b5; }

.db-deck-img { width: 100%; aspect-ratio: 63/88; object-fit: cover; display: block; }

.db-deck-card-controls {
  position: absolute; bottom: 0; left: 0; right: 0;
  display: flex; align-items: center; justify-content: center; gap: 3px;
  padding: 3px 4px 4px;
  background: linear-gradient(transparent, rgba(0,0,0,0.85));
}
.db-ctrl-btn {
  width: 22px; height: 22px; border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.25); background: rgba(0,0,0,0.5);
  color: #fff; font-size: 1rem; line-height: 1; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.12s;
}

.db-ctrl-btn:hover { background: #3f51b5; border-color: #3f51b5; }
.db-ctrl-count { font-size: 0.78rem; color: #fff; font-weight: 700; min-width: 14px; text-align: center; }

.db-ctrl-btn-deck-image {
  position: absolute;
  top: 4px;
  left: 4px;

  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.25);
  background: rgba(0,0,0,0.55);

  color: #fff; /* default icon color */

  display: flex;
  align-items: center;
  justify-content: center;

  cursor: pointer;
  transition: color 0.12s, background 0.12s;
}

.db-ctrl-btn-deck-image.selected {
  color: #ffd54f; /* yellow icon */
}

.db-ctrl-btn-deck-image.selected {
  color: #ffd54f;
  background: rgba(0,0,0,0.75);
}

.db-ctrl-btn-deck-image.selected {
  background: rgba(63,81,181,0.5);
}

.db-ctrl-btn-deck-image:disabled {
  cursor: default;
  opacity: 0.9;
}

/* ══ RIGHT ═══════════════════════════════════════════════════════════════════ */
.db-right {
  background: var(--card-bg); border: 1px solid var(--card-border);
  display: flex; flex-direction: column; overflow: hidden;
}

.db-search-header {
  display: flex; flex-direction: column; gap: 0.45rem;
  padding: 0.85rem 0.75rem 0.5rem; border-bottom: 1px solid var(--card-border); flex-shrink: 0;
}
.db-search-input {
  background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 6px;
  color: var(--text-primary); padding: 0.38rem 0.6rem; font-size: 0.85rem;
  outline: none; width: 100%; box-sizing: border-box;
}
.db-search-input:focus { border-color: #3f51b5; }
.db-search-input::placeholder { color: var(--text-muted); }

.db-filter-row { display: flex; align-items: center; gap: 0.4rem; }
.db-filter-toggle-btns { display: flex; gap: 0.35rem; flex: 1; }
.db-filter-toggle {
  flex: 1; padding: 0.25rem 0.4rem; font-size: 0.72rem; font-weight: 600;
  border-radius: 5px; border: 1px solid var(--input-border); background: transparent;
  color: var(--text-muted); cursor: pointer; position: relative;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.db-filter-toggle:hover { background: var(--input-bg); color: var(--text-primary); }
.db-filter-toggle.active { background: #3f51b5; border-color: #3f51b5; color: #fff; }
.db-adv-dot {
  position: absolute; top: 3px; right: 4px;
  width: 6px; height: 6px; background: #ff9800; border-radius: 50%;
}

.db-quick-chips { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.db-results-count { font-size: 0.68rem; color: var(--text-muted); }

.db-loading { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.85rem; }

.db-search-scroll { flex: 1; overflow-y: auto; padding: 0.5rem; }

.db-search-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 0.4rem;
}

.db-search-card {
  position: relative; cursor: pointer; border-radius: 5px; overflow: hidden;
  border: 2px solid transparent; transition: border-color 0.12s;
}
.db-search-card:hover { border-color: rgba(255,255,255,0.3); }
.db-search-card--selected { border-color: #3f51b5; }
.db-search-card--maxed { opacity: 0.55; cursor: not-allowed; }
.db-count-badge--max { background: #888; }

.db-search-img { width: 100%; aspect-ratio: 63/88; object-fit: cover; display: block; }

.db-count-badge {
  position: absolute; top: 4px; left: 4px;
  background: #3f51b5; color: #fff;
  font-size: 0.65rem; font-weight: 800; min-width: 18px; height: 18px;
  border-radius: 9px; display: flex; align-items: center; justify-content: center;
  padding: 0 3px; pointer-events: none;
}
.db-search-add {
  position: absolute; bottom: 4px; right: 4px;
  width: 22px; height: 22px; border-radius: 5px;
  border: 1px solid rgba(255,255,255,0.3); background: rgba(0,0,0,0.55);
  color: #fff; font-size: 1.1rem; line-height: 1;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.12s;
  opacity: 0; transition: opacity 0.12s;
}
.db-search-card:hover .db-search-add { opacity: 1; }
.db-search-card:hover .db-search-add:hover { background: #3f51b5; }

/* Chips */
.chip {
  padding: 0.2rem 0.55rem; border-radius: 20px; border: 1px solid var(--input-border);
  background: transparent; color: var(--text-secondary); font-size: 0.72rem; font-weight: 600;
  cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.chip:hover { background: var(--input-bg); color: var(--text-primary); }
.chip.active { background: #3f51b5; border-color: #3f51b5; color: #fff; }
.chip--color { flex: 1; text-align: center; font-size: 0.68rem; }
.chip.color-b.active { background: #1565c0; border-color: #1565c0; }
.chip.color-g.active { background: #2e7d32; border-color: #2e7d32; }
.chip.color-r.active { background: #c62828; border-color: #c62828; }
.chip.color-w.active { background: #d8d8d8; border-color: #d8d8d8; color: #111; }

/* ══ Advanced filters modal ══════════════════════════════════════════════════ */
.adv-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.65);
  display: flex; align-items: center; justify-content: center;
  z-index: 2000; padding: 1rem;
  padding-top: 4rem;
}
.adv-modal {
  background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px;
  width: 100%; max-width: 520px; max-height: 85vh;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.4);
}
.adv-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.2rem 0.75rem; border-bottom: 1px solid var(--card-border); flex-shrink: 0;
}
.adv-modal-title { font-size: 0.95rem; font-weight: 700; color: var(--text-primary); }
.adv-close-btn { background: none; border: none; color: var(--text-muted); font-size: 1.1rem; cursor: pointer; }
.adv-close-btn:hover { color: var(--text-primary); }
.adv-reset-btn {
  font-size: 0.75rem; color: #ff9800; background: rgba(255,152,0,0.1);
  border: 1px solid rgba(255,152,0,0.3); border-radius: 5px; padding: 0.2rem 0.6rem; cursor: pointer;
}
.adv-reset-btn:hover { background: rgba(255,152,0,0.2); }

.adv-modal-body {
  flex: 1; overflow-y: auto; padding: 1rem 1.2rem;
  display: flex; flex-direction: column; gap: 0.9rem;
}

/* Filter group styles */
.filter-group { display: flex; flex-direction: column; gap: 0.3rem; }
.filter-group--row { flex-direction: row; align-items: center; gap: 0.5rem; }
.filter-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); font-weight: 600; }
.filter-range-val { color: var(--text-secondary); text-transform: none; letter-spacing: 0; }
.filter-select {
  background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 6px;
  color: var(--text-primary); padding: 0.35rem 0.5rem; font-size: 0.83rem; outline: none; width: 100%;
}
.filter-select:focus { border-color: #3f51b5; }
.filter-select option { background: var(--input-bg); }
.filter-check { width: 14px; height: 14px; cursor: pointer; accent-color: #3f51b5; }
.filter-chips { display: flex; gap: 0.25rem; flex-wrap: wrap; }
.filter-chips--colors { flex-wrap: nowrap; }

/* Dual range */
.dual-range { position: relative; height: 20px; width: 100%; }
.dual-range-track {
  position: absolute; top: 50%; transform: translateY(-50%);
  left: 0; right: 0; height: 4px; border-radius: 2px; pointer-events: none;
  background: linear-gradient(to right, var(--card-border) var(--pct-min), #3f51b5 var(--pct-min), #3f51b5 var(--pct-max), var(--card-border) var(--pct-max));
}
.dual-range input[type="range"] {
  position: absolute; width: 100%; top: 0; left: 0; margin: 0; padding: 0;
  background: transparent; border: none; -webkit-appearance: none; appearance: none;
  pointer-events: none; height: 20px;
}
.dual-range input[type="range"]::-webkit-slider-runnable-track { background: transparent; height: 4px; }
.dual-range input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; pointer-events: all; cursor: pointer;
  height: 14px; width: 14px; background: #ccc; border-radius: 50%; margin-top: -5px;
}
.dual-range input[type="range"]::-moz-range-track { background: transparent; height: 4px; }
.dual-range input[type="range"]::-moz-range-thumb {
  pointer-events: all; cursor: pointer; height: 14px; width: 14px;
  background: #ccc; border-radius: 50%; border: none;
}

/* kw rendering */
:deep(.kw-inline) { color: #7c8ce8; font-weight: 600; }
:deep(.kw-name)   { color: #7c8ce8; font-weight: 700; }
:deep(.kw-desc)   { color: var(--text-muted); font-size: 0.9em; }

/* ── Themed scrollbars ───────────────────────────────────────────────────── */
.db-left::-webkit-scrollbar,
.db-deck-scroll::-webkit-scrollbar,
.db-search-scroll::-webkit-scrollbar,
.adv-modal-body::-webkit-scrollbar {
  width: 6px;
}
.db-left::-webkit-scrollbar-track,
.db-deck-scroll::-webkit-scrollbar-track,
.db-search-scroll::-webkit-scrollbar-track,
.adv-modal-body::-webkit-scrollbar-track {
  background: var(--card-bg);
}
.db-left::-webkit-scrollbar-thumb,
.db-deck-scroll::-webkit-scrollbar-thumb,
.db-search-scroll::-webkit-scrollbar-thumb,
.adv-modal-body::-webkit-scrollbar-thumb {
  background: var(--card-border);
  border-radius: 3px;
}
.db-left::-webkit-scrollbar-thumb:hover,
.db-deck-scroll::-webkit-scrollbar-thumb:hover,
.db-search-scroll::-webkit-scrollbar-thumb:hover,
.adv-modal-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>
