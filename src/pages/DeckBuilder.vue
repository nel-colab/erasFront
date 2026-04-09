<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'
import { useAuthStore }    from '@/store/login'
import { useCardsStore }   from '@/store/cards'
import { useEditionsStore } from '@/store/editions'
import { useDecksStore }   from '@/store/decks'
import ProxyPrintModal    from '@/components/ProxyPrintModal.vue'

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
const COLOR_FIXED_ORDER  = ['B', 'G', 'P', 'R', 'W']
const RARITY_FIXED_ORDER = ['C', 'UC', 'R', 'SR', 'SEC']

// ── Card data (from store) ─────────────────────────────────────────────────
const loadingCards = ref(false)

const editions = computed(() => editionsStore.sorted)
const refData  = computed(() => cardsStore.refData ?? { classes: [], keywordEffects: {} })

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
// empty fColors = all colors active
const fColors         = ref([])
const fColorMatchMode = ref('any')
const fType           = ref('')
const fEdition        = ref('')
const fClases         = ref([])
const fRarity         = ref([])
const fCostMin        = ref(0); const fCostMax        = ref(999)
const fLevelMin       = ref(0); const fLevelMax       = ref(999)
const fStrengthMin    = ref(0); const fStrengthMax    = ref(999)
const fSpecialCostMin = ref(0); const fSpecialCostMax = ref(999)
const fSpecialSummon  = ref('')
const fStarter        = ref(false)

const colorLabel = c => ({ B: 'Blue', G: 'Green', P: 'Purple', R: 'Red', W: 'White' }[c] ?? c)
const typeLabel  = t => ({ creature: 'Criatura', structure: 'Estructura', utility: 'Utilidad' }[t] ?? t)
const ssLabel    = s => ({ evolution: 'Evolución', materialization: 'Materialización', promotion: 'Ascenso', ritual: 'Ritual' }[s] ?? s)

// ── Centralized filter logic ───────────────────────────────────────────────
// skip: Set of dimension names to exclude (for computing per-dimension options)
const filterCards = (cards, skip = new Set()) => {
  const q       = searchQuery.value.toLowerCase().trim()
  const allClrs  = fColors.value.length === 0
  const costFull = fCostMin.value === 0 && fCostMax.value >= maxCost.value
  const lvlFull  = fLevelMin.value === 0 && fLevelMax.value >= maxLevel.value
  const strFull  = fStrengthMin.value === 0 && fStrengthMax.value >= maxStrength.value
  const scFull   = fSpecialCostMin.value === 0 && fSpecialCostMax.value >= maxSpecialCost.value
  return cards
    .filter(c => skip.has('query') || !q || (c.name ?? '').toLowerCase().includes(q) || (c.edition ?? '').toLowerCase().includes(q))
    .filter(c => {
      if (skip.has('type')) return true
      const t = quickType.value || fType.value
      return !t || c.meta?.cardType?.toLowerCase() === t.toLowerCase()
    })
    .filter(c => {
      if (skip.has('color') || allClrs) return true
      const cols = [...new Set([c.color_identity, ...(c.meta?.colors ?? [])].filter(Boolean))]
      if (!cols.length) return true
      return cols.some(col => fColors.value.includes(col))
    })
    .filter(c => skip.has('classes') || !fClases.value.length || c.meta?.cardClasses?.some(cl => fClases.value.includes(cl)))
    .filter(c => { if (skip.has('cost') || costFull) return true; const v = c.meta?.cost; return v == null || (v >= fCostMin.value && v <= fCostMax.value) })
    .filter(c => { if (skip.has('level') || lvlFull) return true; const v = c.meta?.level; return v == null || (v >= fLevelMin.value && v <= fLevelMax.value) })
    .filter(c => { if (skip.has('strength') || strFull) return true; const v = c.meta?.strength; return v == null || (v >= fStrengthMin.value && v <= fStrengthMax.value) })
    .filter(c => { if (skip.has('specialCost') || scFull) return true; const v = c.meta?.specialCost; return v != null && v >= fSpecialCostMin.value && v <= fSpecialCostMax.value })
    .filter(c => skip.has('specialSummon') || !fSpecialSummon.value || c.meta?.specialSummonKind === fSpecialSummon.value)
    .filter(c => skip.has('rarity') || !fRarity.value.length || fRarity.value.includes(c.meta?.rarity))
    .filter(c => skip.has('starter') || !fStarter.value || c.meta?.starter === true)
    .filter(c => {
      if (skip.has('edition') || !fEdition.value) return true
      const [edBase, edSub] = fEdition.value.includes('.') ? fEdition.value.split('.') : [fEdition.value, null]
      if (c.edition !== edBase) return false
      const cardSub = c.sub_edition ?? ''
      return edSub !== null ? cardSub === edSub : cardSub === ''
    })
}

const searchResults = computed(() => filterCards(allMerged.value))

// ── Static filter options (derived from full dataset, not filtered subset) ─
const availableColorIdentities = computed(() => {
  const s = new Set(allMerged.value.map(c => c.color_identity).filter(Boolean))
  return COLOR_FIXED_ORDER.filter(c => s.has(c))
})
const availableRarities = computed(() => {
  const s = new Set(cardsStore.metaCards.map(c => c.rarity).filter(Boolean))
  return RARITY_FIXED_ORDER.filter(r => s.has(r))
})
const availableTypes = computed(() => {
  const s = new Set(cardsStore.metaCards.map(c => c.cardType).filter(Boolean))
  return [...s].sort()
})
const classes = computed(() => {
  const s = new Set(cardsStore.metaCards.flatMap(c => c.cardClasses ?? []))
  return [...s].sort()
})
const availableSpecialSummons = computed(() => {
  const s = new Set(cardsStore.metaCards.map(c => c.specialSummonKind).filter(Boolean))
  return [...s].sort()
})
const maxCost = computed(() =>
  cardsStore.metaCards.reduce((m, c) => c.cost != null ? Math.max(m, c.cost) : m, 0)
)
const maxLevel = computed(() =>
  cardsStore.metaCards.reduce((m, c) => c.level != null ? Math.max(m, c.level) : m, 0)
)
const maxStrength = computed(() =>
  cardsStore.metaCards.reduce((m, c) => c.strength != null ? Math.max(m, c.strength) : m, 0)
)
const maxSpecialCost = computed(() =>
  cardsStore.metaCards.reduce((m, c) => c.specialCost != null ? Math.max(m, c.specialCost) : m, 0)
)

const advFiltersActive = computed(() =>
  fColors.value.length > 0 || fType.value || fEdition.value ||
  fClases.value.length || fRarity.value.length || fStarter.value || fSpecialSummon.value ||
  fCostMin.value > 0 || fCostMax.value < maxCost.value ||
  fLevelMin.value > 0 || fLevelMax.value < maxLevel.value ||
  fStrengthMin.value > 0 || fStrengthMax.value < maxStrength.value ||
  (maxSpecialCost.value > 0 && (fSpecialCostMin.value > 0 || fSpecialCostMax.value < maxSpecialCost.value))
)

const resetAdvFilters = () => {
  fColors.value = []; fColorMatchMode.value = 'any'
  fType.value = ''; fEdition.value = ''; fClases.value = []; fRarity.value = []
  fCostMin.value = 0; fCostMax.value = 999
  fLevelMin.value = 0; fLevelMax.value = 999
  fStrengthMin.value = 0; fStrengthMax.value = 999
  fSpecialCostMin.value = 0; fSpecialCostMax.value = 999
  fSpecialSummon.value = ''; fStarter.value = false
}

const anyFilterActive = computed(() => !!(searchQuery.value || quickType.value || advFiltersActive.value))
const clearAllFilters = () => { searchQuery.value = ''; quickType.value = ''; resetAdvFilters() }

// Sync slider maxes to data range on initial load
watch(maxCost,        val => { if (val > 0 && fCostMax.value        >= 999) fCostMax.value        = val }, { immediate: true })
watch(maxLevel,       val => { if (val > 0 && fLevelMax.value       >= 999) fLevelMax.value       = val }, { immediate: true })
watch(maxStrength,    val => { if (val > 0 && fStrengthMax.value    >= 999) fStrengthMax.value    = val }, { immediate: true })
watch(maxSpecialCost, val => { if (val > 0 && fSpecialCostMax.value >= 999) fSpecialCostMax.value = val }, { immediate: true })

// ── Collapse reprints ─────────────────────────────────────────────────────
const collapseByName     = ref(true)
const editionReleaseMap  = computed(() => editionsStore.releaseMap)

const collapsedResults = computed(() => {
  if (!collapseByName.value) return searchResults.value
  const newest = new Map()
  searchResults.value.forEach(card => {
    const name = (card.name || '').toLowerCase()
    if (!name) return
    const existing = newest.get(name)
    if (!existing) {
      newest.set(name, card)
    } else {
      const fullEd = card.sub_edition     ? `${card.edition}.${card.sub_edition}`         : card.edition
      const fullEx = existing.sub_edition ? `${existing.edition}.${existing.sub_edition}`  : existing.edition
      const edDate = editionReleaseMap.value.get(fullEd) || ''
      const exDate = editionReleaseMap.value.get(fullEx) || ''
      if (edDate > exDate) newest.set(name, card)
    }
  })
  const winnerIds = new Set([...newest.values()].map(c => c.id))
  return searchResults.value.filter(c => {
    const name = (c.name || '').toLowerCase()
    if (!name) return true
    return winnerIds.has(c.id)
  })
})

const visibleCards = computed(() => collapsedResults.value.slice(0, renderCount.value))

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

// Count all copies of a card name across every version in the deck
const deckNameCountMap = computed(() => {
  const m = {}
  deckEntries.value.forEach(e => {
    const name = (e.card.name || '').toLowerCase()
    if (name) m[name] = (m[name] ?? 0) + e.count
  })
  return m
})
const countNameInDeck = name => deckNameCountMap.value[(name || '').toLowerCase()] ?? 0

const MAX_COPIES = 4
const MAX_CARDS = 100

const addToDeck = card => {
  if (totalCards.value >= MAX_CARDS) return
  if (countNameInDeck(card.name) >= MAX_COPIES) return   // cross-version limit
  const existing = deckEntries.value.find(e => e.card.id === card.id)
  if (existing) {
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

const TYPE_ORDER = { creature: 0, structure: 1, utility: 2 }
const sortEntries = entries =>
  [...entries].sort((a, b) => {
    const ta = TYPE_ORDER[a.card.meta?.cardType] ?? 99
    const tb = TYPE_ORDER[b.card.meta?.cardType] ?? 99
    if (ta !== tb) return ta - tb
    const la = a.card.meta?.level ?? 0
    const lb = b.card.meta?.level ?? 0
    if (la !== lb) return la - lb
    return (a.card.number ?? 0) - (b.card.number ?? 0)
  })

const deckGrouped = computed(() => {
  const TYPE_LABEL_ORDER = ['creature', 'structure', 'utility']
  const g = {}
  deckEntries.value.forEach(e => {
    const type = e.card.meta?.cardType ?? 'sin tipo'
    if (!g[type]) g[type] = []
    g[type].push(e)
  })
  // Sort entries within each group by level then cardNumber
  Object.keys(g).forEach(t => {
    g[t].sort((a, b) => {
      const la = a.card.meta?.level ?? 0
      const lb = b.card.meta?.level ?? 0
      if (la !== lb) return la - lb
      return (a.card.number ?? 0) - (b.card.number ?? 0)
    })
  })
  // Return groups in creature → structure → utility order
  const ordered = {}
  ;[...TYPE_LABEL_ORDER, ...Object.keys(g).filter(t => !TYPE_LABEL_ORDER.includes(t))].forEach(t => {
    if (g[t]) ordered[t] = g[t]
  })
  return ordered
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

// ── Import deck from .txt ──────────────────────────────────────────────────
const importError   = ref('')
const importWarnings = ref([])

const importDeck = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.txt'
  input.onchange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    parseImport(text, file.name.replace(/\.txt$/, ''))
  }
  input.click()
}

const parseImport = (text, fallbackName) => {
  importError.value = ''
  importWarnings.value = []

  // Parse header for deck name
  const nameMatch = text.match(/^Mazo:\s*(.+)/m)
  if (nameMatch) deckName.value = nameMatch[1].trim()
  else if (fallbackName) deckName.value = fallbackName

  // Parse card lines: "  Nx Name (EDITION #NUMBER)"
  // edition may contain dots e.g. E1.1
  const cardLineRe = /^\s+(\d+)x\s+(.+?)\s+\(([^)]+)\s+#(\d+)\)\s*$/
  const newEntries = []
  const warnings   = []

  for (const line of text.split('\n')) {
    const m = line.match(cardLineRe)
    if (!m) continue
    const [, countStr, name, edition, numberStr] = m
    const count  = parseInt(countStr)
    const number = parseInt(numberStr)

    // Try to match against loaded drive cards (by name + edition + number)
    const dotIdx  = edition.indexOf('.')
    const edBase  = dotIdx >= 0 ? edition.substring(0, dotIdx) : edition
    const edSub   = dotIdx >= 0 ? edition.substring(dotIdx + 1) : null

    const found = allMerged.value.find(dc => {
      if ((dc.name || '').toLowerCase() !== name.toLowerCase()) return false
      if (dc.edition !== edBase) return false
      if (dc.number !== number) return false
      if (edSub !== null) return (dc.sub_edition ?? '') === edSub
      return (dc.sub_edition ?? '') === ''
    })

    if (!found) {
      warnings.push(`No encontrada: ${count}x ${name} (${edition} #${number})`)
      continue
    }

    // Find existing entry or create new
    const existing = newEntries.find(e => e.card.id === found.id)
    if (existing) existing.count += count
    else newEntries.push({ card: found, count: Math.min(count, MAX_COPIES) })
  }

  if (newEntries.length === 0 && warnings.length > 0) {
    importError.value = 'No se encontraron cartas. ¿Es el archivo correcto?'
    return
  }

  deckEntries.value = newEntries
  dirty.value = true
  importWarnings.value = warnings
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
  deckEntries.value  = entries
  savedState.value   = JSON.parse(JSON.stringify(entries))
  // deckImage is now stored as a URL directly
  deckImage.value    = data.deckImage || (entries[0]?.card ? cardImageUrl(entries[0].card) : null)
  privateDeck.value  = data.privateDeck ?? false

  if (copy === 'true') {
    deckId.value    = null
    deckName.value += ' (copia)'
    dirty.value     = true
  } else {
    deckId.value = data.id
    dirty.value  = false
  }
}

// ── Infinite scroll ───────────────────────────────────────────────────────────
const loadMoreRef = ref(null)
const observer    = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) renderCount.value += LOAD_MORE
})

onUnmounted(() => observer.disconnect())

onMounted(async () => {
  loadingCards.value = true

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

  if (loadMoreRef.value) observer.observe(loadMoreRef.value)
})

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

// ── Deck metrics ──────────────────────────────────────────────────────────
const metricFilterType  = ref(null)
const metricFilterColor = ref(null)

const toggleMetricType  = t => { metricFilterType.value  = metricFilterType.value  === t ? null : t }
const toggleMetricColor = c => { metricFilterColor.value = metricFilterColor.value === c ? null : c }

const deckMetrics = computed(() => {
  const types    = {}
  const colors       = {}
  const costs        = {}
  const levels       = {}
  const rarities     = {}
  const specialCosts = {}

  for (const { card, count } of deckEntries.value) {
    const type   = card.meta?.cardType
    const color  = card.color_identity
    const cost   = card.meta?.cost
    const level  = card.meta?.level   // only count if explicitly set (no ?? 0)
    const rarity = card.meta?.rarity

    // Type and color always show full deck totals (they are the filter selectors)
    if (type)  types[type]   = (types[type]   ?? 0) + count
    if (color) colors[color] = (colors[color] ?? 0) + count

    // Other plots react to selected type/color filter
    const passType  = !metricFilterType.value  || type  === metricFilterType.value
    const passColor = !metricFilterColor.value || color === metricFilterColor.value
    if (!passType || !passColor) continue

    const specialCost = card.meta?.specialCost
    if (cost        != null) costs[cost]              = (costs[cost]              ?? 0) + count
    if (level       != null) levels[level]            = (levels[level]            ?? 0) + count
    if (rarity)              rarities[rarity]         = (rarities[rarity]         ?? 0) + count
    if (specialCost != null) specialCosts[specialCost] = (specialCosts[specialCost] ?? 0) + count
  }

  const costKeys    = Object.keys(costs).map(Number)
  const levelKeys   = Object.keys(levels).map(Number).sort((a, b) => a - b)
  const scKeys      = Object.keys(specialCosts).map(Number)

  const maxCostKey     = costKeys.length ? Math.max(...costKeys) : 0
  const maxScKey       = scKeys.length   ? Math.max(...scKeys)   : 0
  const maxCostCount   = Math.max(0, ...Object.values(costs))
  const maxLevelCount  = Math.max(0, ...Object.values(levels))
  const maxRarityCount = Math.max(0, ...Object.values(rarities))
  const maxScCount     = Math.max(0, ...Object.values(specialCosts))

  return { types, colors, costs, levels, rarities, specialCosts, levelKeys, maxCostKey, maxScKey, maxCostCount, maxLevelCount, maxRarityCount, maxScCount }
})

// ── Tools dropdown ─────────────────────────────────────────────────────────
const showToolsMenu = ref(false)
const showDeckMetrics = ref(true)

// ── Proxy print ────────────────────────────────────────────────────────────
const proxyModal = ref(null)

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
            <span class="db-badge db-badge--ed">{{ selectedCard.sub_edition ? `${selectedCard.edition}.${selectedCard.sub_edition}` : selectedCard.edition }}</span>
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
          <button class="db-copy-btn db-copy-btn--add" @click="addToDeck(selectedCard)" :disabled="countNameInDeck(selectedCard.name) >= MAX_COPIES || totalCards >= MAX_CARDS">
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
          <div class="db-tools-wrap">
            <button class="btn-ghost" @click="showToolsMenu = !showToolsMenu">
              <i class="bi bi-tools"></i> Herramientas
            </button>
            <div v-if="showToolsMenu" class="db-tools-menu">
              <button class="db-tools-item" :disabled="deckEntries.length === 0" @click="proxyModal.open(); showToolsMenu = false">
                <i class="bi bi-printer"></i> Imprimir proxies
              </button>
              <button class="db-tools-item" :disabled="deckEntries.length === 0" @click="shareDeck(); showToolsMenu = false">
                <i class="bi bi-download"></i> Exportar lista
              </button>
              <button class="db-tools-item" @click="importDeck(); showToolsMenu = false">
                <i class="bi bi-upload"></i> Importar lista
              </button>
            </div>
            <div v-if="showToolsMenu" class="db-tools-backdrop" @click="showToolsMenu = false"></div>
          </div>
        </div>
      </div>

      <div class="db-deck-count">{{ totalCards }}</div>

      <!-- Import feedback -->
      <div v-if="importError" class="db-import-error">{{ importError }}</div>
      <div v-if="importWarnings.length" class="db-import-warnings">
        <div class="db-import-warnings-title">
          {{ importWarnings.length }} carta{{ importWarnings.length !== 1 ? 's' : '' }} no encontrada{{ importWarnings.length !== 1 ? 's' : '' }}:
        </div>
        <div v-for="w in importWarnings" :key="w" class="db-import-warning-line">{{ w }}</div>
      </div>

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

      <!-- ── Deck metrics ──────────────────────────────────────────────────── -->
      <div v-if="deckEntries.length > 0" class="db-metrics">

        <!-- Header with toggle -->
        <div class="dm-header">
          <span class="dm-header-title">Métricas</span>
          <span v-if="metricFilterType || metricFilterColor" class="dm-filter-hint">
            {{ [metricFilterType && typeLabel(metricFilterType), metricFilterColor && colorLabel(metricFilterColor)].filter(Boolean).join(' · ') }}
            <button class="dm-clear-filter" @click="metricFilterType = null; metricFilterColor = null">✕</button>
          </span>
          <button class="dm-toggle-btn" @click="showDeckMetrics = !showDeckMetrics">
            <i :class="showDeckMetrics ? 'bi bi-chevron-down' : 'bi bi-chevron-up'"></i>
          </button>
        </div>

        <template v-if="showDeckMetrics">
          <!-- Selectors row: Type + Color (clickable, filter other plots) -->
          <div class="dm-selectors">

            <!-- Types -->
            <div class="dm-section">
              <div class="dm-title">Tipo <span class="dm-click-hint">clic para filtrar</span></div>
              <div class="dm-hbars">
                <template v-for="t in ['creature','structure','utility']" :key="t">
                  <template v-if="deckMetrics.types[t]">
                    <div class="dm-hbar-label" :class="{ 'dm-sel-active': metricFilterType === t, 'dm-sel-dim': metricFilterType && metricFilterType !== t }"
                      @click="toggleMetricType(t)" style="cursor:pointer">{{ typeLabel(t) }}</div>
                    <div class="dm-hbar-track dm-hbar-track--click" :class="{ 'dm-sel-dim': metricFilterType && metricFilterType !== t }"
                      @click="toggleMetricType(t)">
                      <div class="dm-hbar-fill" :class="['dm-type-' + t, { 'dm-sel-active-bar': metricFilterType === t }]"
                        :style="{ width: (deckMetrics.types[t] / totalCards * 100) + '%' }"></div>
                    </div>
                    <div class="dm-hbar-val" :class="{ 'dm-sel-dim': metricFilterType && metricFilterType !== t }">{{ deckMetrics.types[t] }}</div>
                  </template>
                </template>
              </div>
            </div>

            <!-- Colors -->
            <div class="dm-section">
              <div class="dm-title">Color <span class="dm-click-hint">clic para filtrar</span></div>
              <div class="dm-hbars">
                <template v-for="c in ['B','G','P','R','W']" :key="c">
                  <template v-if="deckMetrics.colors[c]">
                    <div class="dm-hbar-label" :class="{ 'dm-sel-active': metricFilterColor === c, 'dm-sel-dim': metricFilterColor && metricFilterColor !== c }"
                      @click="toggleMetricColor(c)" style="cursor:pointer">{{ colorLabel(c) }}</div>
                    <div class="dm-hbar-track dm-hbar-track--click" :class="{ 'dm-sel-dim': metricFilterColor && metricFilterColor !== c }"
                      @click="toggleMetricColor(c)">
                      <div class="dm-hbar-fill" :class="['dm-color-' + c.toLowerCase(), { 'dm-sel-active-bar': metricFilterColor === c }]"
                        :style="{ width: (deckMetrics.colors[c] / totalCards * 100) + '%' }"></div>
                    </div>
                    <div class="dm-hbar-val" :class="{ 'dm-sel-dim': metricFilterColor && metricFilterColor !== c }">{{ deckMetrics.colors[c] }}</div>
                  </template>
                </template>
              </div>
            </div>

          </div>

          <!-- 2×2 bar plots (react to type/color filter) -->
          <div class="dm-plots dm-plots--2x2">

            <!-- Cost -->
            <div class="dm-plot">
              <div class="dm-plot-title">Coste</div>
              <div class="dm-vbars">
                <div v-for="i in (deckMetrics.maxCostKey + 1)" :key="i - 1" class="dm-vbar-col">
                  <div class="dm-vbar-count">{{ deckMetrics.costs[i - 1] || '' }}</div>
                  <div class="dm-vbar-track">
                    <div class="dm-vbar-fill" :style="{ height: deckMetrics.costs[i - 1] ? (deckMetrics.costs[i - 1] / deckMetrics.maxCostCount * 100) + '%' : '0%' }"></div>
                  </div>
                  <div class="dm-vbar-axis"><span class="dm-axis-tick"></span><span class="dm-axis-val">{{ i - 1 }}</span></div>
                </div>
              </div>
            </div>

            <!-- Level -->
            <div class="dm-plot">
              <div class="dm-plot-title">Nivel</div>
              <div class="dm-vbars">
                <div v-for="lvl in deckMetrics.levelKeys" :key="lvl" class="dm-vbar-col">
                  <div class="dm-vbar-count">{{ deckMetrics.levels[lvl] || '' }}</div>
                  <div class="dm-vbar-track">
                    <div class="dm-vbar-fill" :style="{ height: deckMetrics.levels[lvl] ? (deckMetrics.levels[lvl] / deckMetrics.maxLevelCount * 100) + '%' : '0%' }"></div>
                  </div>
                  <div class="dm-vbar-axis"><span class="dm-axis-tick"></span><span class="dm-axis-val">{{ lvl }}</span></div>
                </div>
              </div>
            </div>

            <!-- Rarity -->
            <div class="dm-plot">
              <div class="dm-plot-title">Rareza</div>
              <div class="dm-vbars">
                <div v-for="r in ['C','UC','R','SR','SEC']" :key="r" class="dm-vbar-col">
                  <div class="dm-vbar-count">{{ deckMetrics.rarities[r] || '' }}</div>
                  <div class="dm-vbar-track">
                    <div class="dm-vbar-fill" :class="'dm-rarity-' + r"
                      :style="{ height: deckMetrics.rarities[r] ? (deckMetrics.rarities[r] / deckMetrics.maxRarityCount * 100) + '%' : '0%' }"></div>
                  </div>
                  <div class="dm-vbar-axis"><span class="dm-axis-tick"></span><span class="dm-axis-val">{{ r }}</span></div>
                </div>
              </div>
            </div>

            <!-- Special Cost -->
            <div v-if="deckMetrics.maxScCount > 0" class="dm-plot">
              <div class="dm-plot-title">Coste especial</div>
              <div class="dm-vbars">
                <div v-for="i in (deckMetrics.maxScKey + 1)" :key="i - 1" class="dm-vbar-col">
                  <div class="dm-vbar-count">{{ deckMetrics.specialCosts[i - 1] || '' }}</div>
                  <div class="dm-vbar-track">
                    <div class="dm-vbar-fill"
                      :style="{ height: deckMetrics.specialCosts[i - 1] ? (deckMetrics.specialCosts[i - 1] / deckMetrics.maxScCount * 100) + '%' : '0%' }"></div>
                  </div>
                  <div class="dm-vbar-axis"><span class="dm-axis-tick"></span><span class="dm-axis-val">{{ i - 1 }}</span></div>
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

        <!-- Quick type chips + collapse toggle -->
        <div v-if="showQuickFilters" class="db-quick-chips">
          <button v-for="t in availableTypes" :key="t" class="chip"
            :class="{ active: quickType === t }"
            @click="quickType = quickType === t ? '' : t">{{ typeLabel(t) }}</button>
          <button class="chip" :class="{ active: !collapseByName }"
            @click="collapseByName = !collapseByName">
            {{ collapseByName ? 'Prints antiguos' : 'Solo prints recientes' }}
          </button>
        </div>

        <div class="db-results-row">
          <div class="db-results-count">{{ collapsedResults.length }} carta{{ collapsedResults.length !== 1 ? 's' : '' }}</div>
          <button v-if="anyFilterActive" class="db-clear-btn" @click="clearAllFilters">
            <i class="bi bi-x-circle"></i> Limpiar filtros
          </button>
        </div>
      </div>

      <div v-if="loadingCards" class="db-loading">Cargando…</div>
      <div v-else class="db-search-scroll">
        <div class="db-search-grid">
          <div v-for="card in visibleCards" :key="card.id"
            class="db-search-card"
            :class="{ 'db-search-card--selected': selectedCard?.id === card.id, 'db-search-card--maxed': countNameInDeck(card.name) >= MAX_COPIES || totalCards >= MAX_CARDS }"
            draggable="true"
            @dragstart="onSearchDragStart(card, $event)"
            @click="selectCard(card)"
            @contextmenu.prevent="addToDeck(card)">
            <img :src="cardImageUrl(card)" :alt="card.name" class="db-search-img" />
            <span v-if="countNameInDeck(card.name) > 0" class="db-count-badge" :class="{ 'db-count-badge--max': countNameInDeck(card.name) >= MAX_COPIES || totalCards >= MAX_CARDS }">{{ countNameInDeck(card.name) }}</span>
            <button class="db-search-add" @click.stop="addToDeck(card)" :disabled="countNameInDeck(card.name) >= MAX_COPIES || totalCards >= MAX_CARDS" title="Añadir">+</button>
          </div>
          <div ref="loadMoreRef" class="db-load-trigger"></div>
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
              <button v-for="c in availableColorIdentities" :key="c"
                class="chip chip--color"
                :class="['color-' + c.toLowerCase(), { active: fColors.length === 0 || fColors.includes(c) }]"
                @click="() => {
                  if (fColors.length === 0) { fColors = [c] }
                  else if (fColors.includes(c)) { const next = fColors.filter(x => x !== c); fColors = next }
                  else { const next = [...fColors, c]; fColors = next.length >= availableColorIdentities.length ? [] : next }
                }">
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
              <option v-for="t in availableTypes" :key="t" :value="t">{{ typeLabel(t) }}</option>
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
          <div v-if="maxCost > 0" class="filter-group">
            <label class="filter-label">Coste<span class="filter-range-val" v-if="fCostMin > 0 || fCostMax < maxCost"> ({{ fCostMin }}–{{ fCostMax }})</span></label>
            <div class="dual-range" :style="{ '--pct-min': (fCostMin / maxCost * 100) + '%', '--pct-max': (Math.min(fCostMax, maxCost) / maxCost * 100) + '%' }">
              <div class="dual-range-track"></div>
              <input type="range" min="0" :max="maxCost" step="1" v-model.number="fCostMin" @input="fCostMax = fCostMin > fCostMax ? fCostMin : fCostMax" />
              <input type="range" min="0" :max="maxCost" step="1" v-model.number="fCostMax" @input="fCostMin = fCostMax < fCostMin ? fCostMax : fCostMin" />
            </div>
          </div>

          <!-- Level -->
          <div v-if="maxLevel > 0" class="filter-group">
            <label class="filter-label">Nivel<span class="filter-range-val" v-if="fLevelMin > 0 || fLevelMax < maxLevel"> ({{ fLevelMin }}–{{ fLevelMax }})</span></label>
            <div class="dual-range" :style="{ '--pct-min': (fLevelMin / maxLevel * 100) + '%', '--pct-max': (Math.min(fLevelMax, maxLevel) / maxLevel * 100) + '%' }">
              <div class="dual-range-track"></div>
              <input type="range" min="0" :max="maxLevel" step="1" v-model.number="fLevelMin" @input="fLevelMax = fLevelMin > fLevelMax ? fLevelMin : fLevelMax" />
              <input type="range" min="0" :max="maxLevel" step="1" v-model.number="fLevelMax" @input="fLevelMin = fLevelMax < fLevelMin ? fLevelMax : fLevelMin" />
            </div>
          </div>

          <!-- Strength -->
          <div v-if="maxStrength > 0" class="filter-group">
            <label class="filter-label">Fuerza<span class="filter-range-val" v-if="fStrengthMin > 0 || fStrengthMax < maxStrength"> ({{ fStrengthMin }}–{{ fStrengthMax }})</span></label>
            <div class="dual-range" :style="{ '--pct-min': (fStrengthMin / maxStrength * 100) + '%', '--pct-max': (Math.min(fStrengthMax, maxStrength) / maxStrength * 100) + '%' }">
              <div class="dual-range-track"></div>
              <input type="range" min="0" :max="maxStrength" step="1" v-model.number="fStrengthMin" @input="fStrengthMax = fStrengthMin > fStrengthMax ? fStrengthMin : fStrengthMax" />
              <input type="range" min="0" :max="maxStrength" step="1" v-model.number="fStrengthMax" @input="fStrengthMin = fStrengthMax < fStrengthMin ? fStrengthMax : fStrengthMin" />
            </div>
          </div>

          <!-- Special cost -->
          <div v-if="maxSpecialCost > 0" class="filter-group">
            <label class="filter-label">Coste Especial<span class="filter-range-val" v-if="fSpecialCostMin > 0 || fSpecialCostMax < maxSpecialCost"> ({{ fSpecialCostMin }}–{{ fSpecialCostMax }})</span></label>
            <div class="dual-range" :style="{ '--pct-min': (fSpecialCostMin / maxSpecialCost * 100) + '%', '--pct-max': (Math.min(fSpecialCostMax, maxSpecialCost) / maxSpecialCost * 100) + '%' }">
              <div class="dual-range-track"></div>
              <input type="range" min="0" :max="maxSpecialCost" step="1" v-model.number="fSpecialCostMin" @input="fSpecialCostMax = fSpecialCostMin > fSpecialCostMax ? fSpecialCostMin : fSpecialCostMax" />
              <input type="range" min="0" :max="maxSpecialCost" step="1" v-model.number="fSpecialCostMax" @input="fSpecialCostMin = fSpecialCostMax < fSpecialCostMin ? fSpecialCostMax : fSpecialCostMin" />
            </div>
          </div>

          <!-- Special summon -->
          <div v-if="availableSpecialSummons.length" class="filter-group">
            <label class="filter-label">Inv. Especial</label>
            <select v-model="fSpecialSummon" class="filter-select">
              <option value="">Todos</option>
              <option v-for="ss in availableSpecialSummons" :key="ss" :value="ss">{{ ssLabel(ss) }}</option>
            </select>
          </div>

          <!-- Rarity -->
          <div class="filter-group">
            <label class="filter-label">Rareza</label>
            <div class="filter-chips">
              <button v-for="r in availableRarities" :key="r" class="chip"
                :class="{ active: fRarity.includes(r) }"
                @click="fRarity = fRarity.includes(r) ? fRarity.filter(x => x !== r) : [...fRarity, r]">
                {{ r }}
              </button>
            </div>
          </div>

          <!-- Reprints -->
          <div class="filter-group filter-group--row">
            <input type="checkbox" :checked="!collapseByName" @change="collapseByName = !$event.target.checked" class="filter-check" id="db-reprints" />
            <label class="filter-label" for="db-reprints">Mostrar reprints</label>
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

  <ProxyPrintModal ref="proxyModal" :deck-entries="deckEntries" :deck-name="deckName" />
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

.db-import-error { font-size: 0.8rem; color: var(--error-color); padding: 0.4rem 0.5rem; background: rgba(220,53,69,0.1); border-radius: 6px; margin-bottom: 0.4rem; }
.db-import-warnings { font-size: 0.75rem; color: #f59e0b; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); border-radius: 6px; padding: 0.4rem 0.5rem; margin-bottom: 0.4rem; display: flex; flex-direction: column; gap: 0.15rem; }
.db-import-warnings-title { font-weight: 700; margin-bottom: 0.1rem; }
.db-import-warning-line { opacity: 0.85; }

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
.db-results-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.db-results-count { font-size: 0.68rem; color: var(--text-muted); }
.db-clear-btn { font-size: 0.68rem; background: none; border: none; color: #f87171; cursor: pointer; display: flex; align-items: center; gap: 0.25rem; padding: 0; }
.db-clear-btn:hover { color: #ef4444; }

.db-loading { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.85rem; }

.db-search-scroll { flex: 1; overflow-y: auto; padding: 0.5rem; }

.db-search-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 0.4rem;
}
.db-load-trigger { height: 1px; }

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

/* ── Tools dropdown ──────────────────────────────────────────────────────── */
.db-tools-wrap    { position: relative; }
.db-tools-backdrop{ position: fixed; inset: 0; z-index: 99; }
.db-tools-menu    { position: absolute; top: calc(100% + 4px); right: 0; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 8px; box-shadow: var(--card-shadow); min-width: 180px; z-index: 100; padding: 0.25rem; }
.db-tools-item    { display: flex; align-items: center; gap: 0.5rem; width: 100%; background: none; border: none; color: var(--text-primary); font-size: 0.85rem; padding: 0.45rem 0.65rem; border-radius: 6px; cursor: pointer; white-space: nowrap; }
.db-tools-item:hover:not(:disabled) { background: var(--card-border); }
.db-tools-item:disabled { opacity: 0.4; cursor: default; }

/* ── Deck metrics ────────────────────────────────────────────────────────── */
.db-metrics {
  flex-shrink: 0;
  border-top: 1px solid var(--card-border);
  padding: 0.5rem 0.6rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--card-bg);
}

/* Header */
.dm-header { display: flex; align-items: center; gap: 0.5rem; }
.dm-header-title { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); flex: 1; }
.dm-filter-hint { font-size: 0.62rem; color: #818cf8; display: flex; align-items: center; gap: 0.3rem; }
.dm-clear-filter { background: none; border: none; color: #818cf8; cursor: pointer; font-size: 0.7rem; padding: 0; line-height: 1; }
.dm-toggle-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0.1rem 0.3rem; font-size: 0.75rem; }
.dm-toggle-btn:hover { color: var(--text-primary); }

/* Selectors (type + color) */
.dm-selectors { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 0.75rem; }
.dm-section { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
.dm-title { font-size: 0.6rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
.dm-click-hint { font-size: 0.55rem; font-weight: 400; text-transform: none; letter-spacing: 0; opacity: 0.6; }

/* Horizontal bars */
.dm-hbars { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.12rem 0.35rem; }
.dm-hbar-label { font-size: 0.62rem; color: var(--text-muted); white-space: nowrap; transition: opacity 0.2s; }
.dm-hbar-track { height: 7px; background: var(--card-border); border-radius: 4px; overflow: hidden; transition: opacity 0.2s; }
.dm-hbar-track--click { cursor: pointer; }
.dm-hbar-track--click:hover { filter: brightness(1.15); }
.dm-hbar-fill  { height: 100%; border-radius: 4px; transition: width 0.3s, opacity 0.2s; }
.dm-hbar-val   { font-size: 0.62rem; color: var(--text-muted); text-align: right; transition: opacity 0.2s; }

/* Filter selection states */
.dm-sel-dim { opacity: 0.3; }
.dm-sel-active { color: var(--text-primary) !important; font-weight: 600; opacity: 1 !important; }
.dm-sel-active-bar { filter: brightness(1.2); box-shadow: 0 0 0 1px rgba(255,255,255,0.3); }

/* Type / color fills */
.dm-type-creature  { background: #60a5fa; }
.dm-type-structure { background: #f59e0b; }
.dm-type-utility   { background: #34d399; }
.dm-color-b { background: #60a5fa; }
.dm-color-g { background: #34d399; }
.dm-color-p { background: #a78bfa; }
.dm-color-r { background: #f87171; }
.dm-color-w { background: #d1d5db; }

/* 2×2 plot grid */
.dm-plots { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 0.75rem; }
.dm-plots--2x2 { grid-template-columns: 1fr 1fr; }
.dm-plot { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
.dm-plot-title { font-size: 0.6rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }

/* Vertical bars */
.dm-vbars { display: flex; align-items: flex-end; gap: 2px; height: 55px; }
.dm-vbar-col { display: flex; flex-direction: column; align-items: center; flex: 1; min-width: 0; height: 100%; }
.dm-vbar-count { font-size: 0.5rem; color: var(--text-primary); font-weight: 600; line-height: 1; min-height: 0.65rem; }
.dm-vbar-track { flex: 1; width: 100%; display: flex; align-items: flex-end; }
.dm-vbar-fill  { width: 100%; background: #818cf8; border-radius: 2px 2px 0 0; transition: height 0.3s; }

/* X-axis: tick line + label clearly separated from bar */
.dm-vbar-axis { display: flex; flex-direction: column; align-items: center; width: 100%; }
.dm-axis-tick { display: block; width: 100%; height: 1px; background: var(--card-border); margin-bottom: 2px; }
.dm-axis-val  { font-size: 0.5rem; color: var(--text-muted); line-height: 1; }

/* Rarity colors */
.dm-rarity-C   { background: #9ca3af; }
.dm-rarity-UC  { background: #34d399; }
.dm-rarity-R   { background: #60a5fa; }
.dm-rarity-SR  { background: #f59e0b; }
.dm-rarity-SEC { background: #f472b6; }
</style>
