<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/store/login'

import { useCardsStore }    from '@/store/cards'
import { useEditionsStore } from '@/store/editions'

const cardsStore    = useCardsStore()
const editionsStore = useEditionsStore()

const driveCards = computed(() => cardsStore.driveCards)
const metaCards  = computed(() => cardsStore.metaCards)
const refData    = computed(() => cardsStore.refData || {})


const auth = useAuthStore()

const sidebarOpen = ref(true)

// ── Constants (hardcoded by game rules) ───────────────────────────────────────
const CARD_TYPES   = ['creature', 'utility', 'structure']
const CARD_TYPE_ES = { creature: 'Criatura', utility: 'Utilitaria', structure: 'Estructura' }
const COLOR_IDENTITIES = ['B', 'G', 'P', 'R', 'W']
const SS_KINDS     = ['materialization', 'promotion', 'ritual', 'evolution']
const SS_KIND_ES   = { materialization: 'Materialización', promotion: 'Ascenso', ritual: 'Ritual', evolution: 'Evolución' }
const USAGE_LIMITS = ['once per turn', 'once per turn between copies', 'ultimate effect']
const USAGE_LIMIT_ES = { 'once per turn': 'una vez por turno', 'once per turn between copies': 'una vez por turno entre copias', 'ultimate effect': 'efecto definitivo' }
const RARITIES = ['C', 'UC', 'R', 'SR', 'SEC']
const COST_MAX          = 8
const LEVEL_MAX         = 12
const STRENGTH_MAX      = 15
const SPECIAL_COST_MAX  = 5

// ── Ref data (classes, instances, kinds, tags) ────────────────────────────────


const addTag = async (tag) => {
  try {
    await axios.post('/api/cards/ref/tags', { value: tag })
    if (cardsStore.refData && !cardsStore.refData.tags.includes(tag)) {
      cardsStore.refData.tags.push(tag)
    }
  } catch {}
}

// ── Editions list (from store) ────────────────────────────────────────────────
const editions = computed(() => editionsStore.sorted)

// ── Drive cards (images db) ───────────────────────────────────────────────────
const loadingDrive = ref(false)


// ── Metadata cards (cards collection) ────────────────────────────────────────
const loadingMeta = ref(false)

// ── Filters ───────────────────────────────────────────────────────────────────
const fEdition        = ref('')
const fColors         = ref([...COLOR_IDENTITIES])  // included colors; all = no filter
const fColorMatchMode = ref('any')                  // 'any' = colorIdentity OR colors list; 'identity' = colorIdentity only
const fSubEdition     = ref(null)   // null = all, '' = MAIN, '1'/'2'/… = SUBn
const fName           = ref('')
const fType           = ref('')
const fStarter        = ref(false)
const showWithoutMeta = ref(true)
const cardSize        = ref(200) // px, for responsive grid
const fCostMin        = ref(0)
const fCostMax        = ref(COST_MAX)
const fLevelMin       = ref(0)
const fLevelMax       = ref(LEVEL_MAX)
const fStrengthMin    = ref(0)
const fStrengthMax    = ref(STRENGTH_MAX)
const fSpecialCostMin = ref(0)
const fSpecialCostMax = ref(SPECIAL_COST_MAX)
const fSpecialSummon  = ref('')
const fRequirement    = ref('')
const fCardNumber     = ref('')
const fRarity         = ref([])
const fClases         = ref([])
const fKeywordEffects = ref([])
const fEffectTags     = ref([])

// ── Sort ──────────────────────────────────────────────────────────────────────
const sortKey = ref('number')   // 'number' | 'name' | 'cost' | 'level' | 'strength'
const sortDir = ref('asc')      // 'asc' | 'desc'

const SORT_OPTIONS = [
  { value: 'number',   label: 'Número' },
  { value: 'name',     label: 'Nombre' },
  { value: 'cost',     label: 'Coste' },
  { value: 'level',    label: 'Nivel' },
  { value: 'strength', label: 'Fuerza' },
]

function sortVal(c) {
  switch (sortKey.value) {
    case 'name':     return (c.name ?? '').toLowerCase()
    case 'cost':     return c.meta?.cost     ?? Infinity
    case 'level':    return c.meta?.level    ?? Infinity
    case 'strength': return c.meta?.strength ?? Infinity
    default:         return c.number         ?? Infinity
  }
}

const toggleSortDir = () => { sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc' }

const anyFilterActive = computed(() =>
  !!(fEdition.value || fColors.value.length < COLOR_IDENTITIES.length ||
     fSubEdition.value !== null || fName.value || fType.value || fStarter.value ||
     fRequirement.value || fCardNumber.value || fRarity.value.length ||
     fClases.value.length || fKeywordEffects.value.length || fEffectTags.value.length ||
     fSpecialSummon.value ||
     fCostMin.value > 0 || fCostMax.value < COST_MAX ||
     fLevelMin.value > 0 || fLevelMax.value < LEVEL_MAX ||
     fStrengthMin.value > 0 || fStrengthMax.value < STRENGTH_MAX ||
     fSpecialCostMin.value > 0 || fSpecialCostMax.value < SPECIAL_COST_MAX))


const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize.value}px, 1fr))`
}))

// ── Merge ─────────────────────────────────────────────────────────────────────
function buildCardKey(edition, number, sub, color) {
  return `${edition}|${number}|${sub ?? ''}|${color ?? ''}`
}


const metaMap = computed(() => {
  const m = new Map()

  metaCards.value.forEach(c => {
    if (c.edition && c.cardNumber != null) {
      const key =
        c.edition +
        '|' +
        c.cardNumber +
        '|' +
        (c.subEdition ?? '') +
        '|' +
        (c.colorIdentity ?? '')

      m.set(key, c)
    }
  })

  return m
})
const allMerged  = computed(() =>
  driveCards.value.map(dc => ({ ...dc, meta: metaMap.value.get(
  buildCardKey(dc.edition, dc.number, dc.sub_edition, dc.color_identity)
)}))
)
const visibleCards = computed(() => {
  const allColors       = fColors.value.length === COLOR_IDENTITIES.length
  const costFull        = fCostMin.value === 0 && fCostMax.value === COST_MAX
  const levelFull       = fLevelMin.value === 0 && fLevelMax.value === LEVEL_MAX
  const strengthFull    = fStrengthMin.value === 0 && fStrengthMax.value === STRENGTH_MAX
  const specCostFull    = fSpecialCostMin.value === 0 && fSpecialCostMax.value === SPECIAL_COST_MAX

  return allMerged.value
    // Edition filter (client-side — store loads all editions)
    .filter(c => !fEdition.value || c.edition === fEdition.value)
    // Sub-edition filter
    .filter(c => {
      if (fSubEdition.value === null) return true
      if (fSubEdition.value === '') return c.sub_edition === null || c.sub_edition === ''
      return c.sub_edition === fSubEdition.value
    })
    .filter(c => showWithoutMeta.value || c.meta !== null)
    // Name: regex, falls back to includes
    .filter(c => {
      if (!fName.value) return true
      try { return new RegExp(fName.value, 'i').test(c.name ?? '') }
      catch { return (c.name ?? '').toLowerCase().includes(fName.value.toLowerCase()) }
    })
    // Type: single-value field, case-insensitive match
    .filter(c => !fType.value || c.meta?.cardType?.toLowerCase() === fType.value.toLowerCase())
    // Color: identity-only mode checks colorIdentity; any-color mode also checks meta.colors list
    .filter(c => {
      if (allColors) return true
      if (fColorMatchMode.value === 'identity') {
        if (!c.color_identity) return true
        return fColors.value.includes(c.color_identity)
      }
      // 'any': match colorIdentity OR any entry in meta.colors
      const colorsToCheck = [...new Set([c.color_identity, ...(c.meta?.colors ?? [])].filter(Boolean))]
      if (!colorsToCheck.length) return true
      return colorsToCheck.some(col => fColors.value.includes(col))
    })
    // Classes: card must have at least one selected class
    .filter(c => !fClases.value.length || c.meta?.cardClasses?.some(cl => fClases.value.includes(cl)))
    // Cost: null cost passes; full interval = all pass
    .filter(c => {
      if (costFull) return true
      const v = c.meta?.cost
      if (v == null) return true
      return v >= fCostMin.value && v <= fCostMax.value
    })
    // Level: null passes; full interval = all pass
    .filter(c => {
      if (levelFull) return true
      const v = c.meta?.level
      if (v == null) return true
      return v >= fLevelMin.value && v <= fLevelMax.value
    })
    // Strength: null (no-strength cards) always passes
    .filter(c => {
      const v = c.meta?.strength
      if (v == null) return true
      if (strengthFull) return true
      return v >= fStrengthMin.value && v <= fStrengthMax.value
    })
    // Special cost: full interval = all pass; otherwise cards without special cost are hidden
    .filter(c => {
      if (specCostFull) return true
      const v = c.meta?.specialCost
      if (v == null) return false
      return v >= fSpecialCostMin.value && v <= fSpecialCostMax.value
    })
    // Special summon kind
    .filter(c => !fSpecialSummon.value || c.meta?.specialSummonKind === fSpecialSummon.value)
    // Requirement: regex
    .filter(c => {
      if (!fRequirement.value) return true
      try { return new RegExp(fRequirement.value, 'i').test(c.meta?.requirement ?? '') }
      catch { return (c.meta?.requirement ?? '').toLowerCase().includes(fRequirement.value.toLowerCase()) }
    })
    // Card number: regex on the numeric value
    .filter(c => {
      if (!fCardNumber.value) return true
      const num = String(c.number ?? '')
      try { return new RegExp(fCardNumber.value, 'i').test(num) }
      catch { return num.includes(fCardNumber.value) }
    })
    // Rarity: multiselect — card must match at least one selected rarity
    .filter(c => !fRarity.value.length || fRarity.value.includes(c.meta?.rarity))
    // Starter
    .filter(c => !fStarter.value || c.meta?.starter === true)
    // Keyword effects: search in card's keywordEffects list AND in effect text
    .filter(c => {
      if (!fKeywordEffects.value.length) return true
      const kwList = [...(c.meta?.keywordEffects ?? []), ...(c.meta?.inheritKeywordEffects ?? [])]
      const effList = [...(c.meta?.effects ?? []), ...(c.meta?.inheritEffects ?? [])]
      return fKeywordEffects.value.some(kw => {
        if (kwList.some(ke => ke.keyword === kw)) return true
        return effList.some(eff =>
          (eff.effectBlocks ?? []).some(b =>
            [b.activationCondition, b.cost, b.resolution].some(t => t?.toLowerCase().includes(kw.toLowerCase()))
          )
        )
      })
    })
    // Effect tags: card must have at least one effect with at least one selected tag
    .filter(c => {
      if (!fEffectTags.value.length) return true
      const effList = [...(c.meta?.effects ?? []), ...(c.meta?.inheritEffects ?? [])]
      return effList.some(eff => eff.tags?.some(t => fEffectTags.value.includes(t)))
    })
    .sort((a, b) => {
      const va = sortVal(a), vb = sortVal(b)
      if (va === vb) return 0
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb
      return sortDir.value === 'asc' ? cmp : -cmp
    })
})


// ── Collapse duplicate names ──────────────────────────────────────────────────
const collapseByName = ref(true)

const editionReleaseMap = computed(() => editionsStore.releaseMap)

const collapsedCards = computed(() => {
  const newest = new Map() // name.toLowerCase() -> winning card
  visibleCards.value.forEach(card => {
    const name = (card.name || '').toLowerCase()
    if (!name) return
    const existing = newest.get(name)
    if (!existing) {
      newest.set(name, card)
    } else {
      const edDate = editionReleaseMap.value.get(card.edition) || ''
      const exDate = editionReleaseMap.value.get(existing.edition) || ''
      if (edDate > exDate) newest.set(name, card)
    }
  })
  const winnerIds = new Set([...newest.values()].map(c => c.id))
  return visibleCards.value.filter(c => {
    const name = (c.name || '').toLowerCase()
    if (!name) return true
    return winnerIds.has(c.id)
  })
})

const displayedCards = computed(() =>
  collapseByName.value ? collapsedCards.value : visibleCards.value
)

// ── Edition variants navigation (inside detail modal) ────────────────────────
const sameNameCards = computed(() => {
  if (!detailCard.value) return []
  const name = (detailCard.value.name || '').toLowerCase()
  if (!name) return []
  return allMerged.value
    .filter(c => (c.name || '').toLowerCase() === name)
    .sort((a, b) => {
      const da = editionReleaseMap.value.get(a.edition) || ''
      const db = editionReleaseMap.value.get(b.edition) || ''
      return db.localeCompare(da)
    })
})

const editionVariantIdx = computed(() =>
  sameNameCards.value.findIndex(c => c.id === detailCard.value?.id)
)

const prevEditionVariant = () => {
  const i = editionVariantIdx.value
  if (i > 0) { editingNameId.value = null; detailCard.value = sameNameCards.value[i - 1] }
}
const nextEditionVariant = () => {
  const i = editionVariantIdx.value
  if (i < sameNameCards.value.length - 1) { editingNameId.value = null; detailCard.value = sameNameCards.value[i + 1] }
}

// ── Available filter options (dynamic) ───────────────────────────────────────
const availableSubs = computed(() => {
  const s = new Set(driveCards.value.map(c => c.sub_edition))
  return [...s].sort((a, b) => {
    if (a === null || a === '') return -1; if (b === null || b === '') return 1
    return parseInt(a) - parseInt(b)
  })
})
const availableTypes = computed(() =>
  [...new Set(metaCards.value.map(c => c.cardType).filter(Boolean))].sort())

const availableSpecialSummons = computed(() =>
  [...new Set(metaCards.value.map(c => c.specialSummonKind).filter(Boolean))].sort())

const classes                = computed(() => (refData.value.classes ?? []).slice().sort())
const availableInstances     = computed(() => (refData.value.instances ?? []).slice().sort())
const availableKinds         = computed(() => (refData.value.kinds ?? []).slice().sort())
const availableKeywordEffects = computed(() => Object.keys(refData.value.keywordEffects ?? {}).sort())
const availableTags          = computed(() => (refData.value.tags ?? []).slice().sort())

const subLabel   = s => s === null || s === '' ? 'MAIN' : `SUB${s}`
const colorLabel = c => ({ B: 'Blue', G: 'Green', P: 'Purple', R: 'Red', W: 'White' }[c] ?? c)

// ── Detail modal ──────────────────────────────────────────────────────────────
const detailCard = ref(null)
const showDetail = ref(false)

// anchorCard tracks the card's position in displayedCards (the grid slot).
// Edition-variant navigation changes detailCard but never anchorCard, so the
// outer prev/next arrows keep navigating the grid at the original slot.
const anchorCard = ref(null)

const openDetail = card => {
  anchorCard.value = card
  detailCard.value = card
  showDetail.value = true
}
const closeDetail = () => {
  showDetail.value = false
  detailCard.value = null
  anchorCard.value = null
}

const detailIndex = computed(() =>
  anchorCard.value ? displayedCards.value.findIndex(c => c.id === anchorCard.value.id) : -1
)
const prevCard = () => {
  const i = detailIndex.value
  if (i > 0) {
    editingNameId.value = null
    anchorCard.value = displayedCards.value[i - 1]
    detailCard.value = displayedCards.value[i - 1]
  }
}
const nextCard = () => {
  const i = detailIndex.value
  if (i < displayedCards.value.length - 1) {
    editingNameId.value = null
    anchorCard.value = displayedCards.value[i + 1]
    detailCard.value = displayedCards.value[i + 1]
  }
}
const onModalKey = e => {
  if (!showDetail.value) return
  if (e.key === 'ArrowLeft')  prevCard()
  if (e.key === 'ArrowRight') nextCard()
}
watch(showDetail, v => {
  if (v) window.addEventListener('keydown', onModalKey)
  else   window.removeEventListener('keydown', onModalKey)
})

// ── Card form modal ───────────────────────────────────────────────────────────
const showCardForm  = ref(false)
const editingMetaId = ref(null)
const saving        = ref(false)
const formError     = ref('')

const blankForm = () => ({
  cardName: '', cardType: 'creature', edition: fEdition.value || '',
  colorIdentity: 'W', cardNumber: null, strength: null, cost: null, level: null,
  starter: false, cardClasses: [], regulation: '', specialCost: null,
  specialSummonKind: null, requirement: '', rarity: null, colors: [],
  effects: [], inheritEffects: [], keywordEffects: [], inheritKeywordEffects: [],
})
const form = ref(blankForm())

const openCreate = (driveCard = null) => {
  editingMetaId.value = null
  form.value = blankForm()
  if (driveCard) {
    form.value.edition       = driveCard.edition        || ''
    form.value.colorIdentity = driveCard.color_identity || ''
    form.value.cardNumber    = driveCard.number         ?? null
    form.value.cardName      = driveCard.name           || ''
    form.value.colors        = driveCard.color_identity ? [driveCard.color_identity] : []

    // Prefill game-mechanics fields from existing meta card with the same name
    if (driveCard.name) {
      const nameLower = driveCard.name.toLowerCase()
      const existing = metaCards.value.find(m => (m.cardName || '').toLowerCase() === nameLower)
      if (existing) {
        form.value.cardType          = existing.cardType          ?? form.value.cardType
        form.value.strength          = existing.strength          ?? null
        form.value.cost              = existing.cost              ?? null
        form.value.level             = existing.level             ?? null
        form.value.starter           = existing.starter           ?? false
        form.value.cardClasses       = [...(existing.cardClasses  ?? [])]
        form.value.regulation        = existing.regulation        ?? ''
        form.value.specialCost       = existing.specialCost       ?? null
        form.value.specialSummonKind = existing.specialSummonKind ?? null
        form.value.requirement       = existing.requirement       ?? ''
        form.value.rarity            = existing.rarity            ?? null
        form.value.effects               = JSON.parse(JSON.stringify(existing.effects               ?? []))
        form.value.inheritEffects        = JSON.parse(JSON.stringify(existing.inheritEffects        ?? []))
        form.value.keywordEffects        = JSON.parse(JSON.stringify(existing.keywordEffects        ?? []))
        form.value.inheritKeywordEffects = JSON.parse(JSON.stringify(existing.inheritKeywordEffects ?? []))
      }
    }
  }
  formError.value = ''
  showCardForm.value = true
  showDetail.value = false
  // Use the drive card's own image directly (avoids wrong-card API lookup)
  driveCardPreview.value = driveCard ? cardImageUrl(driveCard) : null
  if (!driveCard && form.value.cardName) lookupDriveCard()
}

const openEdit = card => {
  const m = card.meta
  editingMetaId.value = m?.id ?? null
  form.value = {
    cardName:          m?.cardName          ?? card.name           ?? '',
    cardType:          m?.cardType          ?? null,
    edition:           card.edition         ?? '',
    colorIdentity:     m?.colorIdentity     ?? card.color_identity ?? '',
    cardNumber:        m?.cardNumber        ?? card.number         ?? null,
    strength:          m?.strength          ?? null,
    cost:              m?.cost              ?? null,
    level:             m?.level             ?? null,
    starter:           m?.starter           ?? false,
    cardClasses:       [...(m?.cardClasses  ?? [])],
    regulation:        m?.regulation        ?? '',
    specialCost:       m?.specialCost       ?? null,
    specialSummonKind: m?.specialSummonKind ?? null,
    requirement:       m?.requirement       ?? '',
    rarity:            m?.rarity            ?? null,
    colors:            m?.colors?.length ? [...m.colors] : (m?.colorIdentity ? [m.colorIdentity] : []),
    effects:                JSON.parse(JSON.stringify(m?.effects               ?? [])),
    inheritEffects:         JSON.parse(JSON.stringify(m?.inheritEffects        ?? [])),
    keywordEffects:         JSON.parse(JSON.stringify(m?.keywordEffects        ?? [])),
    inheritKeywordEffects:  JSON.parse(JSON.stringify(m?.inheritKeywordEffects ?? [])),
  }
  formError.value = ''
  // Use the card's own image directly — edition+number already known
  driveCardPreview.value = cardImageUrl(card)
  showCardForm.value = true
  showDetail.value = false
}

const toggleClass = cls => {
  const i = form.value.cardClasses.indexOf(cls)
  if (i === -1) form.value.cardClasses.push(cls); else form.value.cardClasses.splice(i, 1)
}

const saveCard = async () => {
  formError.value = ''
  if (!form.value.edition.trim())  { formError.value = 'Edition is required';   return }
  if (!form.value.cardName.trim()) { formError.value = 'Card name is required'; return }

  const payload = {
    cardName: form.value.cardName, cardType: form.value.cardType || null,
    edition: form.value.edition, colorIdentity: form.value.colorIdentity || null,
    cardNumber:    form.value.cardNumber    != null ? Number(form.value.cardNumber)    : null,
    strength:      form.value.strength      != null ? Number(form.value.strength)      : null,
    cost:          form.value.cost          != null ? Number(form.value.cost)          : null,
    level:         form.value.level         != null ? Number(form.value.level)         : null,
    starter:       !!form.value.starter, cardClasses: form.value.cardClasses,
    regulation:    form.value.regulation    || null,
    specialCost:   form.value.specialCost   != null ? Number(form.value.specialCost)   : null,
    specialSummonKind: form.value.specialSummonKind || null,
    requirement:   form.value.requirement   || null,
    rarity:        form.value.rarity        || null,
    colors:        form.value.colors.length ? form.value.colors : null,
    effects:               form.value.effects,
    inheritEffects:        form.value.inheritEffects,
    keywordEffects:        form.value.keywordEffects,
    inheritKeywordEffects: form.value.inheritKeywordEffects,
  }
  saving.value = true
  try {
    if (editingMetaId.value) await axios.put(`/api/cards/${editingMetaId.value}`, payload)
    else                     await axios.post('/api/cards', payload)
    await cardsStore.reload()
    showCardForm.value = false
  } catch (e) {
    formError.value = e?.response?.data?.message || e.message || 'Failed to save'
  } finally { saving.value = false }
}

// ── Drive card image preview (name lookup) ────────────────────────────────────
const driveCardPreview = ref(null)
const previewLoading   = ref(false)

const lookupDriveCard = async () => {
  const name = form.value.cardName.trim()
  if (!name) { driveCardPreview.value = null; return }
  previewLoading.value = true
  try {
    const p = new URLSearchParams({ name })
    if (form.value.edition) p.set('edition', form.value.edition)
    const { data } = await axios.get('/api/drive/cards/db?' + p)
    if (data.length) {
      // Pick the card with the most recent timestamp
      const best = data.reduce((a, b) => {
        const ta = a.time_stamp ? new Date(a.time_stamp).getTime() : 0
        const tb = b.time_stamp ? new Date(b.time_stamp).getTime() : 0
        return tb > ta ? b : a
      })
      driveCardPreview.value = cardImageUrl(best)
    } else {
      driveCardPreview.value = null
    }
  } catch {
    driveCardPreview.value = null
  } finally {
    previewLoading.value = false
  }
}

// ── Effect sub-modal ──────────────────────────────────────────────────────────
const showEffectModal  = ref(false)
const effectTarget     = ref('effects')   // 'effects' | 'inheritEffects'
const editingEffectIdx = ref(null)        // null = new
const newTagInput      = ref('')

const blankEffect = () => ({
  instance: null, ussageLimit: null, kind: null, tags: [],
  effectBlocks: [{ activationCondition: '', cost: '', resolution: '' }],
})
const effectForm = ref(blankEffect())

// Auto-fill kind when instance is picked, if a mapping exists and kind is still unset
watch(() => effectForm.value.instance, (newInstance) => {
  if (!newInstance) return
  const mapped = refData.value.instanceKinds?.[newInstance]
  if (mapped && !effectForm.value.kind) effectForm.value.kind = mapped
})

const blockKwPickers   = ref([])   // { keyword, number } per block
const blockActiveField = ref([])   // last-focused { el, field } per block

const openEffectModal = (target, idx = null) => {
  effectTarget.value    = target
  editingEffectIdx.value = idx
  effectForm.value = idx !== null
    ? JSON.parse(JSON.stringify(form.value[target][idx]))
    : blankEffect()
  blockKwPickers.value   = effectForm.value.effectBlocks.map(() => ({ keyword: null, number: null }))
  blockActiveField.value = effectForm.value.effectBlocks.map(() => null)
  showEffectModal.value = true
}

const addEffectBlock = () => {
  effectForm.value.effectBlocks.push({ activationCondition: '', cost: '', resolution: '' })
  blockKwPickers.value.push({ keyword: null, number: null })
  blockActiveField.value.push(null)
}
const removeEffectBlock = i => {
  if (effectForm.value.effectBlocks.length > 1) {
    effectForm.value.effectBlocks.splice(i, 1)
    blockKwPickers.value.splice(i, 1)
    blockActiveField.value.splice(i, 1)
  }
}

const trackBlockField = (blockIdx, field, event) => {
  blockActiveField.value[blockIdx] = { el: event.target, field }
}

const blockKwPlaceholder = (blockIdx) => {
  const k = blockKwPickers.value[blockIdx]?.keyword
  if (!k) return null
  return k.match(/\{([^}]+)\}/)?.[1] ?? null
}

const insertKwToken = (blockIdx) => {
  const picker = blockKwPickers.value[blockIdx]
  if (!picker?.keyword) return
  const token = (picker.number != null && picker.number !== '')
    ? `[[${picker.keyword}:${picker.number}]]`
    : `[[${picker.keyword}]]`
  const block = effectForm.value.effectBlocks[blockIdx]
  const active = blockActiveField.value[blockIdx]
  if (active?.el && active.field != null) {
    const el  = active.el
    const start = el.selectionStart ?? block[active.field].length
    const end   = el.selectionEnd   ?? start
    block[active.field] = (block[active.field] ?? '').slice(0, start) + token + (block[active.field] ?? '').slice(end)
    nextTick(() => { el.selectionStart = el.selectionEnd = start + token.length; el.focus() })
  } else {
    block.resolution = (block.resolution ? block.resolution + ' ' : '') + token
  }
  picker.keyword = null
  picker.number  = null
}
const toggleEffectTag   = tag => {
  const i = effectForm.value.tags.indexOf(tag)
  if (i === -1) effectForm.value.tags.push(tag); else effectForm.value.tags.splice(i, 1)
}
const submitNewTag = async () => {
  const t = newTagInput.value.trim(); if (!t) return
  await addTag(t)
  if (!effectForm.value.tags.includes(t)) effectForm.value.tags.push(t)
  newTagInput.value = ''
}
const saveEffect = () => {
  const copy = JSON.parse(JSON.stringify(effectForm.value))
  if (editingEffectIdx.value !== null) form.value[effectTarget.value][editingEffectIdx.value] = copy
  else                                 form.value[effectTarget.value].push(copy)
  showEffectModal.value = false
}
const removeEffect = (target, idx) => form.value[target].splice(idx, 1)


// ── HTML rendering helpers ────────────────────────────────────────────────────────────
const escapeHtml = (s) => s
  ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  : ''

const getKwDescription = (kwKey) => {
  const ref = refData.value.keywordEffects?.[kwKey]
  if (!ref) return null
  return ref.displayText || null
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

const renderEffectHtml = (ef) => {
  const parts = []
  if (ef.instance) parts.push(escapeHtml(`<${ef.instance}>`))
  if (ef.ussageLimit === 'once per turn') parts.push('[Una vez por turno]')
  else if (ef.ussageLimit === 'once per turn between copies') parts.push('[once per turn between copies]')
  else if (ef.ussageLimit === 'ultimate effect') parts.push('[Efecto definitivo]')
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

const renderCardKwEffect = (ke) => {
  if (!ke?.keyword) return ''
  const rendered = ke.number != null
    ? ke.keyword.replace(/\{[^}]+\}/, ke.number)
    : ke.keyword
  const desc = getKwDescription(ke.keyword)
  let html = `<span class="kw-name">${escapeHtml(rendered)}</span>`
  if (desc) {
    const descResolved = ke.number != null
      ? desc.replace(/\{[^}]+\}/g, ke.number)
      : desc
    html += ` <span class="kw-desc">(${escapeHtml(descResolved)})</span>`
  }
  return html
}

// ── Keyword Effect sub-modal ──────────────────────────────────────────────────────────
const showKeywordEffectModal  = ref(false)
const KeywordEffectTarget      = ref('keywordEffects')  // 'keywordEffects' | 'inheritKeywordEffects'
const editingKeywordEffectIdx  = ref(null)              // null = new

const blankKeywordEffect = () => ({ keyword: null, number: null })
const keywordEffectForm = ref(blankKeywordEffect())



const saveKeywordEffect = () => {
  const copy = JSON.parse(JSON.stringify(keywordEffectForm.value))
  if (editingKeywordEffectIdx.value !== null) form.value[KeywordEffectTarget.value][editingKeywordEffectIdx.value] = copy
  else                                        form.value[KeywordEffectTarget.value].push(copy)
  showKeywordEffectModal.value = false
}
const removeKeywordEffect = (target, idx) => form.value[target].splice(idx, 1)


const keywordPlaceholder = computed(() => {
  const k = keywordEffectForm.value.keyword
  if (!k) return null
  const match = k.match(/\{([^}]+)\}/)
  return match ? match[1] : null
})

const openKeywordEffectModal = (target = 'keywordEffects', idx = null) => {
  KeywordEffectTarget.value     = target
  editingKeywordEffectIdx.value = idx
  keywordEffectForm.value = idx !== null
    ? JSON.parse(JSON.stringify(form.value[target][idx]))
    : blankKeywordEffect()
  showKeywordEffectModal.value = true
}



// ── Inline name editing ───────────────────────────────────────────────────────
const editingNameId = ref(null)
const editingNameValue = ref('')

const startEditName = (card, event) => {
  event.stopPropagation()
  editingNameId.value = card.id
  editingNameValue.value = card.name
}

const saveCardName = async (card) => {
  const name = editingNameValue.value.trim()
  editingNameId.value = null

  if (!name || name === card.name) return

  try {
    await axios.patch(`/api/drive/cards/db/${card.id}/name`, { name })

    const dc = driveCards.value.find(c => c.id === card.id)
    if (dc) dc.name = name

    if (detailCard.value?.id === card.id) {
      detailCard.value = { ...detailCard.value, name }
    }

  } catch {
    // ignore
  }
}


// ── Lazy rendering (performance) ─────────────────────────────────────────────

const cardImageUrl = (card) => {
  if (!card?.image_url) return null

  const ts = card.time_stamp
    ? new Date(card.time_stamp).getTime()
    : Date.now()

  return `${card.image_url}?v=${ts}`
}


const renderCount = ref(40)

const lazyCards = computed(() =>
  displayedCards.value.slice(0, renderCount.value)
)

watch(() => displayedCards.value, () => {
  renderCount.value = 40
})


// ── Infinite scroll ──────────────────────────────────────────────────────────
const loadMoreRef = ref(null)

const observer = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) {
    renderCount.value += 40
  }
})


// ── Route + initial load ─────────────────────────────────────────────────────
const route = useRoute()

onMounted(async () => {
  if (route.query.edition) {
    fEdition.value = route.query.edition
  }

  await Promise.all([
    editionsStore.load(),
    cardsStore.load(),
    cardsStore.loadRef(),
  ])

  if (loadMoreRef.value) {
    observer.observe(loadMoreRef.value)
  }
})

// ── Lock page scroll when modals open ────────────────────────────────────────
watch([showDetail, showCardForm, showEffectModal], ([d, f, e]) => {
  const anyOpen = d || f || e
  document.body.style.overflow = anyOpen ? 'hidden' : ''
})

</script>

<template>
  <div class="cards-page">


    <!-- ── Body (sidebar + main) ──────────────────────────────────────── -->
    <div class="cp-body">

      <!-- ── Filter column (toggle + collapsible sidebar) ───────────── -->
      <div class="filter-col">
        <button class="sidebar-toggle" @click="sidebarOpen = !sidebarOpen" :title="sidebarOpen ? 'Hide filters' : 'Show filters'">
          <span class="sidebar-toggle-icon">&#9776;</span>
        </button>


      <div class="filter-sidebar" :class="{ 'filter-sidebar--open': sidebarOpen }">
        <div class="filter-sidebar-inner">

          <!-- Ordenar -->
          <div class="filter-group">
            <label class="filter-label">Ordenar por</label>
            <div class="sort-row">
              <select v-model="sortKey" class="filter-select sort-select">
                <option v-for="o in SORT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
              <button class="btn-sort-dir" @click="toggleSortDir" :title="sortDir === 'asc' ? 'Ascendente' : 'Descendente'">
                <i :class="sortDir === 'asc' ? 'bi bi-sort-up' : 'bi bi-sort-down'"></i>
              </button>
            </div>
          </div>

          <!-- Nombre -->
          <div class="filter-group">
            <label class="filter-label">Nombre</label>
            <input v-model="fName" class="filter-input" placeholder="Buscar por nombre…" />
          </div>

          <!-- Tipo -->
          <div v-if="availableTypes.length" class="filter-group">
            <label class="filter-label">Tipo de carta</label>
            <select v-model="fType" class="filter-select">
              <option value="">Todos</option>
              <option v-for="t in availableTypes" :key="t" :value="t">{{ CARD_TYPE_ES[t] ?? t }}</option>
            </select>
          </div>

          <!-- Color -->
          <div class="filter-group">
            <label class="filter-label">Color</label>
            <div class="filter-chips filter-chips--colors">
              <button v-for="c in COLOR_IDENTITIES" :key="c" class="chip chip--color"
                :class="['color-' + c.toLowerCase(), { active: fColors.includes(c) }]"
                @click="() => { if (fColors.length === COLOR_IDENTITIES.length) { fColors = [c] } else if (fColors.includes(c)) { const next = fColors.filter(x => x !== c); fColors = next.length ? next : [...COLOR_IDENTITIES] } else { fColors = [...fColors, c] } }">{{ colorLabel(c) }}</button>
            </div>
            <div class="filter-mode-toggle">
              <button class="mode-btn" :class="{ active: fColorMatchMode === 'any' }" @click="fColorMatchMode = 'any'">Cualquier color</button>
              <button class="mode-btn" :class="{ active: fColorMatchMode === 'identity' }" @click="fColorMatchMode = 'identity'">Solo identidad</button>
            </div>
          </div>

          <!-- Clases -->
          <div v-if="classes.length" class="filter-group">
            <label class="filter-label">Clases</label>
            <div class="filter-chips">
              <button v-for="cl in classes" :key="cl" class="chip"
                :class="{ active: fClases.includes(cl) }"
                @click="fClases = fClases.includes(cl) ? fClases.filter(x => x !== cl) : [...fClases, cl]">{{ cl }}</button>
            </div>
          </div>

          <!-- Coste -->
          <div class="filter-group">
            <label class="filter-label">
              Coste<span v-if="fCostMin > 0 || fCostMax < COST_MAX"> ({{ fCostMin }}–{{ fCostMax }})</span><span v-else> (Todos)</span>
            </label>
            <div class="dual-range"
              :style="{ '--pct-min': (fCostMin / COST_MAX * 100) + '%', '--pct-max': (fCostMax / COST_MAX * 100) + '%' }">
              <div class="dual-range-track"></div>
              <input type="range" min="0" max="8" step="1" v-model.number="fCostMin"
                @input="fCostMax = fCostMin > fCostMax ? fCostMin : fCostMax" />
              <input type="range" min="0" max="8" step="1" v-model.number="fCostMax"
                @input="fCostMin = fCostMax < fCostMin ? fCostMax : fCostMin" />
            </div>
          </div>

          <!-- Nivel -->
          <div class="filter-group">
            <label class="filter-label">
              Nivel<span v-if="fLevelMin > 0 || fLevelMax < LEVEL_MAX"> ({{ fLevelMin }}–{{ fLevelMax }})</span><span v-else> (Todos)</span>
            </label>
            <div class="dual-range"
              :style="{ '--pct-min': (fLevelMin / LEVEL_MAX * 100) + '%', '--pct-max': (fLevelMax / LEVEL_MAX * 100) + '%' }">
              <div class="dual-range-track"></div>
              <input type="range" min="0" :max="LEVEL_MAX" step="1" v-model.number="fLevelMin"
                @input="fLevelMax = fLevelMin > fLevelMax ? fLevelMin : fLevelMax" />
              <input type="range" min="0" :max="LEVEL_MAX" step="1" v-model.number="fLevelMax"
                @input="fLevelMin = fLevelMax < fLevelMin ? fLevelMax : fLevelMin" />
            </div>
          </div>

          <!-- Fuerza -->
          <div class="filter-group">
            <label class="filter-label">
              Fuerza<span v-if="fStrengthMin > 0 || fStrengthMax < STRENGTH_MAX"> ({{ fStrengthMin }}–{{ fStrengthMax }})</span><span v-else> (Todos)</span>
            </label>
            <div class="dual-range"
              :style="{ '--pct-min': (fStrengthMin / STRENGTH_MAX * 100) + '%', '--pct-max': (fStrengthMax / STRENGTH_MAX * 100) + '%' }">
              <div class="dual-range-track"></div>
              <input type="range" min="0" :max="STRENGTH_MAX" step="1" v-model.number="fStrengthMin"
                @input="fStrengthMax = fStrengthMin > fStrengthMax ? fStrengthMin : fStrengthMax" />
              <input type="range" min="0" :max="STRENGTH_MAX" step="1" v-model.number="fStrengthMax"
                @input="fStrengthMin = fStrengthMax < fStrengthMin ? fStrengthMax : fStrengthMin" />
            </div>
          </div>

          <!-- Tipo de invocacion especial -->
          <div v-if="availableSpecialSummons.length" class="filter-group">
            <label class="filter-label">Invocacion especial</label>
            <select v-model="fSpecialSummon" class="filter-select">
              <option value="">Todos</option>
              <option v-for="ss in availableSpecialSummons" :key="ss" :value="ss">{{ SS_KIND_ES[ss] ?? ss }}</option>
            </select>
          </div>

          <!-- Coste especial -->
          <div class="filter-group">
            <label class="filter-label">
              Coste especial<span v-if="fSpecialCostMin > 0 || fSpecialCostMax < SPECIAL_COST_MAX"> ({{ fSpecialCostMin }}–{{ fSpecialCostMax }})</span><span v-else> (Todos)</span>
            </label>
            <div class="dual-range"
              :style="{ '--pct-min': (fSpecialCostMin / SPECIAL_COST_MAX * 100) + '%', '--pct-max': (fSpecialCostMax / SPECIAL_COST_MAX * 100) + '%' }">
              <div class="dual-range-track"></div>
              <input type="range" min="0" :max="SPECIAL_COST_MAX" step="1" v-model.number="fSpecialCostMin"
                @input="fSpecialCostMax = fSpecialCostMin > fSpecialCostMax ? fSpecialCostMin : fSpecialCostMax" />
              <input type="range" min="0" :max="SPECIAL_COST_MAX" step="1" v-model.number="fSpecialCostMax"
                @input="fSpecialCostMin = fSpecialCostMax < fSpecialCostMin ? fSpecialCostMax : fSpecialCostMin" />
            </div>
          </div>

          <!-- Requerimineto -->
          <div class="filter-group">
            <label class="filter-label">Requerimiento</label>
            <input v-model="fRequirement" class="filter-input" placeholder="Buscar por requerimiento…" />
          </div>

          <!-- Edicion -->
          <div class="filter-group">
            <label class="filter-label">Edición</label>
            <select v-model="fEdition" class="filter-select">
              <option value="">Todas</option>
              <option v-for="ed in editions" :key="ed.editionId" :value="ed.editionId">
                {{ ed.editionId }}{{ ed.editionName ? ' — ' + ed.editionName : '' }}
              </option>
            </select>
          </div>

          <!-- Número de carta -->
          <div class="filter-group">
            <label class="filter-label">Número de carta</label>
            <input v-model="fCardNumber" class="filter-input" placeholder="Buscar por número de carta…" />
          </div>

          <!-- Número de carta -->
          <div v-if="availableSubs.length > 1" class="filter-group">
            <label class="filter-label">Sub-edition</label>
            <div class="filter-chips">
              <button class="chip" :class="{ active: fSubEdition === null }" @click="fSubEdition = null">All</button>
              <button v-for="s in availableSubs" :key="s ?? 'main'" class="chip"
                :class="{ active: fSubEdition === s }"
                @click="fSubEdition = fSubEdition === s ? null : s">{{ subLabel(s) }}</button>
            </div>
          </div>

          <!-- Rareza -->
          <div class="filter-group">
            <label class="filter-label">Rareza</label>
            <div class="filter-chips">
              <button v-for="r in RARITIES" :key="r" class="chip"
                :class="{ active: fRarity.includes(r) }"
                @click="fRarity = fRarity.includes(r) ? fRarity.filter(x => x !== r) : [...fRarity, r]">{{ r }}</button>
            </div>
          </div>

          <!-- Starter -->
          <div class="filter-group filter-group--row">
            <input type="checkbox" v-model="fStarter" class="filter-check" />
            <label class="filter-label">Iniciador</label>
          </div>

          <!-- Keywords effects -->
          <div v-if="availableKeywordEffects.length" class="filter-group">
            <label class="filter-label">Efectos Keyword</label>
            <div class="filter-chips">
              <button v-for="kw in availableKeywordEffects" :key="kw" class="chip"
                :class="{ active: fKeywordEffects.includes(kw) }"
                @click="fKeywordEffects = fKeywordEffects.includes(kw) ? fKeywordEffects.filter(x => x !== kw) : [...fKeywordEffects, kw]">{{ kw }}</button>
            </div>
          </div>

          <!-- Tags de efectos -->
          <div v-if="availableTags.length" class="filter-group">
            <label class="filter-label">Tags de efectos</label>
            <div class="filter-chips">
              <button v-for="t in availableTags" :key="t" class="chip"
                :class="{ active: fEffectTags.includes(t) }"
                @click="fEffectTags = fEffectTags.includes(t) ? fEffectTags.filter(x => x !== t) : [...fEffectTags, t]">{{ t }}</button>
            </div>
          </div>


          <div class="filter-group filter-group--row">
            <input type="checkbox" v-model="showWithoutMeta" :disabled="anyFilterActive" class="filter-check" />
            <label class="filter-label" :class="{ muted: anyFilterActive }">Cartas sin metadatos</label>
          </div>

          <div class="filter-group">
            <label class="filter-label">Vista de cartas</label>
            <div class="filter-mode-toggle">
              <button class="mode-btn" :class="{ active: collapseByName }" @click="collapseByName = true">Colapsar repetidas</button>
              <button class="mode-btn" :class="{ active: !collapseByName }" @click="collapseByName = false">Mostrar todas</button>
            </div>
          </div>

          <div class="filter-group">
            <label class="filter-label">Tamaño de cartas ({{ cardSize }}px)</label>
            <input class="filter-input" type="range" min="100" max="500" step="10" v-model="cardSize" />
          </div>

        </div>
      </div>
      </div> <!-- /filter-col -->

      <!-- ── Main content ───────────────────────────────────────────── -->
      <div class="cp-main">

        <!-- ── Status / count ─────────────────────────────────────── -->
        <div v-if="loadingDrive && lazyCards.length === 0" class="cp-empty">
          Loading cards…
        </div>
        <div v-else-if="displayedCards.length === 0" class="cp-empty">
          No se encontraron cartas{{ anyFilterActive ? ' para los filtros actuales' : '' }}.
        </div>
        <div v-if="displayedCards.length > 0" class="cp-count">
          {{ displayedCards.length }} carta{{ displayedCards.length !== 1 ? 's' : '' }}
          <span v-if="anyFilterActive"> (filtradas)</span>
        </div>

        <!-- ── Card grid ───────────────────────────────────────────── -->
        <div
          v-if="!loadingDrive && displayedCards.length > 0"
          class="card-grid"
          :style="gridStyle"
        >
          <div
            v-for="card in lazyCards"
            :key="card.id"
            class="card-item"
            @click="openDetail(card)"
          >
            <div class="card-frame">
              <img
                :src="cardImageUrl(card)"
                :alt="card.name"
                class="card-img"
                loading="lazy"
                decoding="async"
              />
              <div v-if="!card.meta" class="no-meta-badge">Sin metadatos</div>
            </div>


          </div>
          <div ref="loadMoreRef" class="cards-load-trigger"></div>
        </div>

      </div> <!-- /cp-main -->
    </div> <!-- /cp-body -->

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- Detail modal                                                       -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="showDetail" class="modal-overlay" @click.self="closeDetail">
        <button class="modal-nav modal-nav--prev" @click="prevCard" :disabled="detailIndex <= 0">
          <i class="bi bi-chevron-left"></i>
        </button>
        <div class="modal-box">
            <div class="modal-name-row">
              <input
                v-if="editingNameId === detailCard.id"
                class="modal-name-input"
                v-model="editingNameValue"
                @blur="saveCardName(detailCard)"
                @keyup.enter="$event.target.blur()"
                @keyup.escape="editingNameId = null"
              />
              <template v-else>
                <h1 class="modal-card-name">{{ detailCard.name }}</h1>
                <button v-if="auth.can('manage_cards')" class="btn-modal-edit-name" @click="startEditName(detailCard, $event)" title="Edit name">
                  <i class="bi bi-pencil"></i>
                </button>
              </template>
            </div>
            <button class="modal-close" @click="closeDetail">✕</button>
            <div class="form-with-preview">
              

              <div class="form-main">

              
                <div class="modal-info-col">
                  <div class="modal-top-row">
                    <div class="modal-edition-nav">
                      <button
                        v-if="sameNameCards.length > 1"
                        class="edition-nav-btn"
                        :disabled="editionVariantIdx <= 0"
                        @click="prevEditionVariant"
                        title="Edición anterior"
                      ><i class="bi bi-chevron-left"></i></button>

                      <div class="modal-badges">
                        <span class="badge-edition">{{ detailCard.edition }}</span>
                        <span v-if="detailCard.sub_edition" class="badge-sub">{{ subLabel(detailCard.sub_edition) }}</span>
                        <span class="badge-num">#{{ detailCard.number }}</span>
                        <span class="badge-color" :class="'badge-color--' + (detailCard.color_identity || '').toLowerCase()">{{ colorLabel(detailCard.color_identity) }}</span>
                      </div>

                      <button
                        v-if="sameNameCards.length > 1"
                        class="edition-nav-btn"
                        :disabled="editionVariantIdx >= sameNameCards.length - 1"
                        @click="nextEditionVariant"
                        title="Siguiente edición"
                      ><i class="bi bi-chevron-right"></i></button>
                    </div>
                  </div>

                  <div v-if="!detailCard.meta" class="no-meta-notice">
                    Carta sin metadatos aun.
                    <button v-if="auth.can('manage_cards')" class="btn-filled btn-sm" @click="openCreate(detailCard)">Crear</button>
                  </div>

                  <template v-if="detailCard.meta">
                    <div class="meta-grid-badges">
                      <div class="meta-row" v-if="detailCard.meta.cardType"><span class="meta-k">Tipo de carta</span><span class="meta-v">{{ CARD_TYPE_ES[detailCard.meta.cardType] ?? detailCard.meta.cardType }}</span></div>
                      <div class="meta-row" v-if="detailCard.meta.cost != null"><span class="meta-k">Coste</span><span class="meta-v">{{ detailCard.meta.cost }}</span></div>
                      <div class="meta-row" v-if="detailCard.meta.strength != null"><span class="meta-k">Fuerza</span><span class="meta-v">{{ detailCard.meta.strength }}</span></div>
                      <div class="meta-row" v-if="detailCard.meta.level != null"><span class="meta-k">Nivel</span><span class="meta-v">{{ detailCard.meta.level }}</span></div>
                      <div class="meta-row" v-if="detailCard.meta.starter == true"><span class="meta-k">Iniciador</span><span class="meta-v">Si</span></div>
                      <div class="meta-row" v-if="detailCard.meta.cardClasses?.length"><span class="meta-k">Clases</span><span class="meta-v">{{ detailCard.meta.cardClasses.join(', ') }}</span></div>
                      <div class="meta-row" v-if="detailCard.meta.regulation"><span class="meta-k">Regulación</span><span class="meta-v">{{ detailCard.meta.regulation }}</span></div>
                      <div class="meta-row" v-if="detailCard.meta.specialCost != null"><span class="meta-k">Coste Especial</span><span class="meta-v">{{ detailCard.meta.specialCost }}</span></div>
                      <div class="meta-row" v-if="detailCard.meta.specialSummonKind"><span class="meta-k">Método de Invocación Especial</span><span class="meta-v">{{ SS_KIND_ES[detailCard.meta.specialSummonKind] ?? detailCard.meta.specialSummonKind }}</span></div>
                      <div class="meta-row" v-if="detailCard.meta.rarity"><span class="meta-k">Rareza</span><span class="meta-v">{{ detailCard.meta.rarity }}</span></div>
                      <div class="meta-row" v-if="detailCard.meta.colors?.length"><span class="meta-k">Colores</span><span class="meta-v">{{ detailCard.meta.colors.join(', ') }}</span></div>
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
                        <span v-if="ef.tags?.length" class="effect-tags">{{ ef.tags.join(', ') }}</span>
                      </div>
                      <div v-for="(ke, i) in detailCard.meta.inheritKeywordEffects" :key="'ikw'+i" class="effect-pill kw-pill">
                        <span v-html="renderCardKwEffect(ke)"></span>
                      </div>
                    </div>
                  </template>

                  <div class="modal-actions" v-if="auth.can('manage_cards') && detailCard.meta">
                    <button class="btn-filled btn-sm" @click="openEdit(detailCard)">Editar</button>
                  </div>
                </div>

              
              </div><!-- /form-main -->

            
              <div class="modal-img-col">
                <div class="modal-frame">
                  <img :key="detailCard.id + detailCard.time_stamp"
                       :src="cardImageUrl(detailCard)"
                       :alt="detailCard.name" class="modal-img" />
                </div>
              </div>



            </div><!-- /form-with-preview -->
        </div>
        <button class="modal-nav modal-nav--next" @click="nextCard" :disabled="detailIndex >= displayedCards.length - 1">
          <i class="bi bi-chevron-right"></i>
        </button>
      </div>
    </Teleport>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- Card form modal (create / edit)                                    -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="showCardForm" class="modal-overlay" @click.self="showCardForm = false">
        <div class="modal-box modal-box--form" :class="{ 'modal-box--form-wide': driveCardPreview || previewLoading }">
          <button class="modal-close" @click="showCardForm = false">✕</button>
          <h3 class="modal-form-title">{{ editingMetaId ? 'Editar carta' : 'Carta nueva' }}</h3>
          <p v-if="formError" class="form-error">{{ formError }}</p>

          <div class="form-with-preview">
          <div class="form-main">
          <div class="form-grid">
            <!-- Row 1: 4 fields in one row -->
            <div class="form-field">
              <label>Nombre *</label>
              <input v-model="form.cardName" @blur="lookupDriveCard" />
            </div>
            <div class="form-field">
              <label>Tipo</label>
              <select v-model="form.cardType">
                <option v-for="t in CARD_TYPES" :key="t" :value="t">{{ CARD_TYPE_ES[t] ?? t }}</option>
              </select>
            </div>
            <div class="form-field">
              <label>Edición *</label>
              <input v-model="form.edition" :disabled="!!editingMetaId" />
            </div>
            <div class="form-field">
              <label>Identidad de color</label>
              <select v-model="form.colorIdentity">
                <option v-for="c in COLOR_IDENTITIES" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>

            <!-- Colors list -->
            <div class="form-field form-field--full">
              <label>Colores <span class="field-hint">(puede ser más de uno)</span></label>
              <div class="color-chips-row">
                <button v-for="c in COLOR_IDENTITIES" :key="c" type="button"
                  class="chip chip--color"
                  :class="['color-' + c.toLowerCase(), { active: form.colors.includes(c) }]"
                  @click="form.colors = form.colors.includes(c) ? form.colors.filter(x => x !== c) : [...form.colors, c]">{{ colorLabel(c) }}</button>
              </div>
            </div>

            <!-- Row 3 -->
            <div class="form-field form-field--s2">
              <label>Número de carta</label>
              <input v-model.number="form.cardNumber" type="number" />
            </div>
            <div class="form-field form-field--s2">
              <label>Coste</label>
              <input v-model.number="form.cost" type="number" />
            </div>

            <!-- Row 4 -->
            <div class="form-field form-field--s2">
              <label>Fuerza</label>
              <input v-model.number="form.strength" type="number" />
            </div>
            <div class="form-field form-field--s2">
              <label>Nivel</label>
              <input v-model.number="form.level" type="number" />
            </div>

            <!-- Row 5 -->
            <div class="form-field form-field--s2">
              <label>Regulación</label>
              <input :value="form.regulation"
                @input="form.regulation = $event.target.value.toUpperCase()"
                style="text-transform: uppercase;" />
            </div>

            <div class="form-field form-field--s2">
              <label>Rareza</label>
              <select v-model="form.rarity">
                <option v-for="r in RARITIES" :key="r" :value="r">{{ r }}</option>
              </select>
            </div>

            <!-- Row 6 -->
            <div class="form-field form-field--s2">
              <label>Método de invoación especial</label>
              <select v-model="form.specialSummonKind">
                <option :value="null">— none —</option>
                <option v-for="k in SS_KINDS" :key="k" :value="k">{{ SS_KIND_ES[k] ?? k }}</option>
              </select>
            </div>

            <div class="form-field form-field--s2">
              <label>Coste especial</label>
              <input v-model.number="form.specialCost" type="number" />
            </div>


            <div class="form-field form-field--full">
              <label>Requerimiento</label>
              <input v-model="form.requirement" />
            </div>

            <!-- Starter -->
            <div class="form-field form-field--inline">
              <label><input type="checkbox" v-model="form.starter" /> Iniciador</label>
            </div>

            <!-- Classes multi-select -->
            <div class="form-field full" v-if="classes.length">
              <label>Clases</label>
              <div class="chip-select">
                <button
                  v-for="cls in classes" :key="cls"
                  type="button"
                  class="chip"
                  :class="{ active: form.cardClasses.includes(cls) }"
                  @click="toggleClass(cls)"
                >{{ cls }}</button>
              </div>
            </div>
            <div v-else class="form-field full">
              <label>Clases <span class="hint">(add classes via /api/cards/ref to enable this picker)</span></label>
            </div>

            <!-- Effects -->
            <div class="form-field full">
              <div class="effect-section-header">
                <label>Efectos</label>
                <div class="effect-btn-group">
                  <button type="button" class="btn-ghost btn-xs" @click="openEffectModal('effects')">+ Añadir efecto</button>
                  <button type="button" class="btn-ghost btn-xs" @click="openKeywordEffectModal('keywordEffects')">+ Añadir efecto keyword</button>
                </div>
              </div>
              <div v-if="form.effects.length" class="effect-list">
                <div v-for="(ef, i) in form.effects" :key="i" class="effect-list-item">
                  <span class="effect-preview" v-html="renderEffectHtml(ef)"></span>
                  <div class="effect-item-actions">
                    <button type="button" class="btn-ghost btn-xs" @click="openEffectModal('effects', i)">Editar</button>
                    <button type="button" class="btn-ghost btn-xs btn-danger" @click="removeEffect('effects', i)">✕</button>
                  </div>
                </div>
              </div>
              <div v-if="form.keywordEffects.length" class="effect-list">
                <div v-for="(ke, i) in form.keywordEffects" :key="'kw'+i" class="effect-list-item">
                  <span class="effect-preview kw-preview" v-html="renderCardKwEffect(ke)"></span>
                  <div class="effect-item-actions">
                    <button type="button" class="btn-ghost btn-xs" @click="openKeywordEffectModal('keywordEffects', i)">Editar</button>
                    <button type="button" class="btn-ghost btn-xs btn-danger" @click="removeKeywordEffect('keywordEffects', i)">✕</button>
                  </div>
                </div>
              </div>
              <div v-if="!form.effects.length && !form.keywordEffects.length" class="empty-hint">Sin efectos aun.</div>
            </div>

            <!-- Inherit Effects -->
            <div class="form-field full">
              <div class="effect-section-header">
                <label>Efectos heredados</label>
                <div class="effect-btn-group">
                  <button type="button" class="btn-ghost btn-xs" @click="openEffectModal('inheritEffects')">+ Añadir efecto</button>
                  <button type="button" class="btn-ghost btn-xs" @click="openKeywordEffectModal('inheritKeywordEffects')">+ Añadir efecto keyword</button>
                </div>
              </div>
              <div v-if="form.inheritEffects.length" class="effect-list">
                <div v-for="(ef, i) in form.inheritEffects" :key="i" class="effect-list-item">
                  <span class="effect-preview" v-html="renderEffectHtml(ef)"></span>
                  <div class="effect-item-actions">
                    <button type="button" class="btn-ghost btn-xs" @click="openEffectModal('inheritEffects', i)">Editar</button>
                    <button type="button" class="btn-ghost btn-xs btn-danger" @click="removeEffect('inheritEffects', i)">✕</button>
                  </div>
                </div>
              </div>
              <div v-if="form.inheritKeywordEffects.length" class="effect-list">
                <div v-for="(ke, i) in form.inheritKeywordEffects" :key="'ikw'+i" class="effect-list-item">
                  <span class="effect-preview kw-preview" v-html="renderCardKwEffect(ke)"></span>
                  <div class="effect-item-actions">
                    <button type="button" class="btn-ghost btn-xs" @click="openKeywordEffectModal('inheritKeywordEffects', i)">Edit</button>
                    <button type="button" class="btn-ghost btn-xs btn-danger" @click="removeKeywordEffect('inheritKeywordEffects', i)">✕</button>
                  </div>
                </div>
              </div>
              <div v-if="!form.inheritEffects.length && !form.inheritKeywordEffects.length" class="empty-hint">Sin efectos heredados aun.</div>
            </div>
          </div>

          <div class="form-actions">
            <button class="btn-filled" @click="saveCard" :disabled="saving">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
            <button class="btn-ghost" @click="showCardForm = false">Cancelar</button>
          </div>
          </div><!-- /form-main -->

          <div v-if="driveCardPreview || previewLoading" class="form-preview-panel">
            <div v-if="previewLoading" class="preview-loading">Cargando…</div>
            <img v-else-if="driveCardPreview" :src="driveCardPreview" class="preview-img" alt="Card preview" />
            <p v-else class="preview-not-found">No se encontraro imagenes</p>
          </div>
          </div><!-- /form-with-preview -->
        </div>
      </div>
    </Teleport>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- Effect sub-modal                                                   -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="showEffectModal" class="modal-overlay modal-overlay--nested" @click.self="showEffectModal = false">
        <div class="modal-box modal-box--effect">
          <button class="modal-close" @click="showEffectModal = false">✕</button>
          <h3 class="modal-form-title">
            {{ editingEffectIdx !== null ? 'Editar' : 'Añadir' }} efecto
            <span class="subtitle">— {{ effectTarget === 'effects' ? 'Efecto' : 'Efecto heredado' }}</span>
          </h3>

          <div class="form-with-preview">
          <div class="form-main">
          <div class="form-grid">
            <!-- Instance -->
            <div class="form-field">
              <label>Instancia</label>
              <select v-model="effectForm.instance">
                <option :value="null">— ninguna —</option>
                <option v-for="inst in availableInstances" :key="inst" :value="inst">{{ inst }}</option>
              </select>
            </div>

            <!-- Usage limit -->
            <div class="form-field">
              <label>Limite de uso</label>
              <select v-model="effectForm.ussageLimit">
                <option :value="null">— ninguno —</option>
                <option v-for="u in USAGE_LIMITS" :key="u" :value="u">{{ USAGE_LIMIT_ES[u] ?? u }}</option>
              </select>
            </div>

            <!-- Kind -->
            <div class="form-field">
              <label>Naturaleza *</label>
              <select v-model="effectForm.kind">
                <option v-for="k in availableKinds" :key="k" :value="k">{{ k }}</option>
              </select>
            </div>

            <!-- Tags -->
            <div class="form-field full">
              <label>Tags</label>
              <div class="chip-select" v-if="availableTags.length">
                <button
                  v-for="tag in availableTags" :key="tag"
                  type="button"
                  class="chip"
                  :class="{ active: effectForm.tags.includes(tag) }"
                  @click="toggleEffectTag(tag)"
                >{{ tag }}</button>
              </div>
              <div class="new-tag-row">
                <input v-model="newTagInput" class="filter-input" placeholder="Nuevo tag…" @keydown.enter.prevent="submitNewTag" />
                <button type="button" class="btn-ghost btn-xs" @click="submitNewTag">Añadir</button>
              </div>
            </div>

            <!-- Effect blocks -->
            <div class="form-field full">
              <div class="effect-section-header">
                <label>Bloques de efecto</label>
                <button type="button" class="btn-ghost btn-xs" @click="addEffectBlock">+ Añadir bloque</button>
              </div>
              <div v-for="(block, i) in effectForm.effectBlocks" :key="i" class="effect-block-editor">
                <div class="effect-block-num">#{{ i + 1 }}
                  <button v-if="effectForm.effectBlocks.length > 1" type="button"
                    class="btn-ghost btn-xs btn-danger" @click="removeEffectBlock(i)">✕</button>
                </div>
                <div class="form-field" style="grid-column: 1 / -1;">
                  <label>Condición de activación</label>
                  <textarea v-model="block.activationCondition" rows="2" placeholder="Cuando… / Si…"
                    @focus="trackBlockField(i, 'activationCondition', $event)" />
                </div>
                <div class="form-field" style="grid-column: 1 / -1;">
                  <label>Coste</label>
                  <textarea v-model="block.cost" rows="2" placeholder="Paga… / Tributa..."
                    @focus="trackBlockField(i, 'cost', $event)" />
                </div>
                <div class="form-field" style="grid-column: 1 / -1;">
                  <label>Resolución *</label>
                  <textarea v-model="block.resolution" rows="3" placeholder="Texto del efecto…"
                    @focus="trackBlockField(i, 'resolution', $event)" />
                </div>

                <!-- Inline keyword inserter -->
                <div class="form-field" style="grid-column: 1 / -1;" v-if="availableKeywordEffects.length">
                  <div class="block-kw-add">
                    <select v-model="blockKwPickers[i].keyword"
                      @change="blockKwPickers[i].number = null">
                      <option :value="null">— insertar keyword —</option>
                      <option v-for="k in availableKeywordEffects" :key="k" :value="k">{{ k }}</option>
                    </select>
                    <input v-if="blockKwPlaceholder(i)" v-model="blockKwPickers[i].number"
                      :placeholder="`${blockKwPlaceholder(i)} value`" class="block-kw-num" />
                    <button type="button" class="btn-ghost btn-xs"
                      :disabled="!blockKwPickers[i]?.keyword"
                      @click="insertKwToken(i)">Insertar en cursor</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Live preview -->
            <div class="form-field full">
              <label>Vista previa</label>
              <div class="effect-preview-box" v-html="renderEffectHtml(effectForm)"></div>
            </div>
          </div>

          <div class="form-actions">
            <button class="btn-filled" @click="saveEffect">{{ editingEffectIdx !== null ? 'Actualizar' : 'Añadir' }} Efecto</button>
            <button class="btn-ghost" @click="showEffectModal = false">Cancelar</button>
          </div>
          </div><!-- /form-main -->



          <div v-if="driveCardPreview || previewLoading" class="form-preview-panel">
            <div v-if="previewLoading" class="preview-loading">Looking up…</div>
            <img v-else-if="driveCardPreview" :src="driveCardPreview" class="preview-img" alt="Card preview" />
            <p v-else class="preview-not-found">No image found</p>
          </div>
          </div><!-- /form-with-preview -->
        </div>
      </div>
    </Teleport>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- Keyword effect sub-modal                                           -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="showKeywordEffectModal" class="modal-overlay modal-overlay--nested" @click.self="showKeywordEffectModal = false">
        <div class="modal-box modal-box--effect">
          <button class="modal-close" @click="showKeywordEffectModal = false">✕</button>
          <h3 class="modal-form-title">
            {{ editingEffectIdx !== null ? 'Editar' : 'Añadir' }} efecto
            <span class="subtitle">— {{ effectTarget === 'effects' ? 'Efecto' : 'Efecto heredado' }}</span>
          </h3>

          <div class="form-with-preview">
          <div class="form-main">
          <div class="form-grid">

            <!-- Keyword -->
            <div class="form-field">
              <label>Keyword</label>
              <select v-model="keywordEffectForm.keyword">
                <!-- keywordEffects is now a map; iterate over its keys -->
                <option v-for="k in availableKeywordEffects" :key="k" :value="k">{{ k }}</option>
              </select>

            </div>

            <div v-if="keywordPlaceholder" class="form-field">
              <label>{{ keywordPlaceholder }}</label>
              <input v-model="keywordEffectForm.number" :placeholder="`Valor para {${keywordPlaceholder}}`" />
            </div>
            
          </div>

          <div class="form-actions">
            <button class="btn-filled" @click="saveKeywordEffect"
              :disabled="!keywordEffectForm.keyword">
              {{ editingKeywordEffectIdx !== null ? 'Actualizar' : 'Añadir' }} efecto keyword
            </button>
          </div>
          </div><!-- /form-main -->
          <div v-if="driveCardPreview || previewLoading" class="form-preview-panel">
            <div v-if="previewLoading" class="preview-loading">Looking up…</div>
            <img v-else-if="driveCardPreview" :src="driveCardPreview" class="preview-img" alt="Card preview" />
            <p v-else class="preview-not-found">No image found</p>
          </div>
          </div><!-- /form-with-preview -->
        </div>
      </div>
    </Teleport>

  </div>
</template>

<style scoped>
.cards-page { padding: 1.5rem 1rem; }

/* Header */
.cp-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 1.25rem;
}
.cp-header h2 { color: var(--text-primary); margin: 0; }

/* Body layout */
.cp-body { display: flex; gap: 1rem; align-items: stretch; }
.cp-main { flex: 1; min-width: 0; }

/* Filter column — toggle scrolls normally; sidebar sticks */
.filter-col {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}


/* Sidebar toggle button */
.sidebar-toggle {
  background: var(--card-border); border: 1px solid var(--input-border); border-radius: 6px;
  color: var(--text-secondary); width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background 0.15s; flex-shrink: 0;
}
.sidebar-toggle:hover { background: var(--input-border); }
.sidebar-toggle-icon { font-size: 1rem; line-height: 1; }

/* Filter sidebar — ↓ change this one value to resize */
.filter-sidebar {
  width: 0; overflow: clip;
  transition: width 0.25s ease;
}
.filter-sidebar--open { width: 420px; }

.filter-sidebar-inner {
  background: #121314; border: 1px solid #2a2a2a; border-radius: 10px;
  padding: 0.9rem 1rem;
  display: flex; flex-direction: column; gap: 1rem;
}

.filter-group { display: flex; flex-direction: column; gap: 0.3rem; }
.filter-group--row { flex-direction: row; align-items: center; gap: 0.5rem; }
.filter-group--grow { flex: 1 1 140px; }
.filter-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.5); font-weight: 600; }
.filter-label.muted { opacity: 0.3; }
.filter-select, .filter-input {
  background: #1e1e1e; border: 1px solid #3a3a3a; border-radius: 6px;
  color: #e0e0e0; padding: 0.38rem 0.6rem; font-size: 0.88rem; outline: none; min-width: 0; width: 100%; box-sizing: border-box;
}
.filter-select:focus, .filter-input:focus { border-color: #3f51b5; }
.filter-select option { background: #1e1e1e; }
.filter-input::placeholder { color: rgba(255,255,255,0.3); }
.filter-check { width: 16px; height: 16px; cursor: pointer; accent-color: #3f51b5; }
.sort-row { display: flex; gap: 0.4rem; align-items: center; }
.sort-select { flex: 1; }
.btn-sort-dir {
  flex-shrink: 0; background: #1e1e1e; border: 1px solid #3a3a3a; border-radius: 6px;
  color: #e0e0e0; padding: 0.38rem 0.55rem; font-size: 1rem; cursor: pointer; line-height: 1;
}
.btn-sort-dir:hover { border-color: #3f51b5; color: #7986cb; }
.filter-chips { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.filter-chips--colors { flex-wrap: nowrap; }
.chip--color { padding: 0.2rem 0.45rem; font-size: 0.72rem; flex: 1; text-align: center; }

/* Color mode toggle (below color chips in filter) */
.filter-mode-toggle { display: flex; gap: 0.25rem; margin-top: 0.35rem; }
.mode-btn {
  flex: 1; padding: 0.18rem 0.4rem; font-size: 0.68rem; border-radius: 4px;
  border: 1px solid #3a3a3a; background: transparent;
  color: #eeeeee; cursor: pointer; transition: background 0.15s, color 0.15s;
}
.mode-btn.active { background: #3f51b5; color: #fff; border-color: #3f51b5; }

/* Colors chips row in card form */
.color-chips-row { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.field-hint { font-size: 0.7rem; opacity: 0.5; font-weight: 400; }

input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  background: transparent;
  border:none;
  margin: 0;
}

/* track */
input[type="range"]::-webkit-slider-runnable-track {
  width: 100%;
  height: 4px;
  background: #555;
  border-radius: 2px;
}

input[type="range"]::-moz-range-track {
  width: 100%;
  height: 4px;
  background: #555;
  border-radius: 2px;
}

/* thumb */
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 14px;
  width: 14px;
  background: #ccc;
  border-radius: 50%;
  margin-top: -5px; /* centers thumb on track */
}

input[type="range"]::-moz-range-thumb {
  height: 14px;
  width: 14px;
  background: #ccc;
  border-radius: 50%;
  border: none;
}

/* Chips — filter sidebar is always dark (#121314), use hardcoded light values */
.chip {
  padding: 0.25rem 0.65rem; border-radius: 20px; border: 1px solid #3a3a3a;
  background: transparent; color: rgba(255,255,255,0.65); font-size: 0.78rem; font-weight: 600;
  cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.chip:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.95); }
.chip.active { background: #3f51b5; border-color: #3f51b5; color: #fff; }
.chip.color-b.active { background: #1565c0; border-color: #1565c0; }
.chip.color-g.active { background: #2e7d32; border-color: #2e7d32; }
.chip.color-r.active { background: #c62828; border-color: #c62828; }
.chip.color-w.active { background: #d8d8d8;    border-color: #d8d8d8;    color: #111; }
.chip.color-n.active { background: #555;    border-color: #555; }

/* Dual-handle range slider */
.dual-range {
  position: relative;
  height: 20px;
  width: 100%;
}
.dual-range-track {
  position: absolute;
  top: 50%; transform: translateY(-50%);
  left: 0; right: 0; height: 4px;
  border-radius: 2px;
  pointer-events: none;
  background: linear-gradient(
    to right,
    #555 var(--pct-min),
    #3f51b5 var(--pct-min),
    #3f51b5 var(--pct-max),
    #555 var(--pct-max)
  );
}
.dual-range input[type="range"] {
  position: absolute;
  width: 100%; top: 0; left: 0;
  margin: 0; padding: 0;
  background: transparent; border: none;
  -webkit-appearance: none; appearance: none;
  pointer-events: none;
  height: 20px;
}
.dual-range input[type="range"]::-webkit-slider-runnable-track { background: transparent; height: 4px; }
.dual-range input[type="range"]::-moz-range-track           { background: transparent; height: 4px; }
.dual-range input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  pointer-events: all; cursor: pointer;
  height: 14px; width: 14px;
  background: #ccc; border-radius: 50%;
  margin-top: -5px;
}
.dual-range input[type="range"]::-moz-range-thumb {
  pointer-events: all; cursor: pointer;
  height: 14px; width: 14px;
  background: #ccc; border-radius: 50%; border: none;
}

/* Status */
.cp-empty { text-align: center; color: var(--text-muted); padding: 3rem 1rem; font-size: 1rem; }
.cp-count  { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.6rem; }

/* Card grid */
.card-grid {
  display: grid;
  gap: 0.6rem;
}
.card-frame {
  position: relative; width: 100%; aspect-ratio: 63 / 88;
  overflow: hidden; border-radius: 2%; background: var(--input-bg); cursor: pointer;
}
.card-img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.2s; }
.card-item:hover .card-img { transform: scale(1.04); }
.card-label { display: flex; flex-direction: column; margin-top: 0.25rem; gap: 0.1rem; }
.card-name { font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-meta-line { font-size: 0.68rem; color: var(--text-muted); }
.no-meta-badge {
  position: absolute; bottom: 4px; left: 4px; background: rgba(0,0,0,0.7);
  color: #f44; font-size: 0.6rem; font-weight: 700; padding: 1px 5px;
  border-radius: 3px; letter-spacing: 0.05em; pointer-events: none;
}

/* Modal shared */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;
}
.modal-overlay--nested { z-index: 1100; background: rgba(0,0,0,0.5); }
.modal-nav {
  position: fixed; top: 50%; transform: translateY(-50%);
  z-index: 1001; background: rgba(0,0,0,0.45); border: none;
  color: #fff; font-size: 2rem; width: 3rem; height: 5rem;
  border-radius: 8px; cursor: pointer; display: flex;
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
  width: 100%; max-width: 1440px; max-height: 90vh; overflow-y: auto;
  padding: 1.5rem; position: relative;
  transition: background-color 0.2s ease;
  margin-top: 4rem;
}
.modal-box--form        { max-width: 1110px; margin-top: 4rem;}
.modal-box--form-wide   { max-width: 1480px; margin-top: 4rem;}
.modal-box--effect      { max-width: 1480px; margin-top: 4rem;}

.form-with-preview {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}
.form-main { flex: 1; min-width: 0; }

.form-preview-panel {
  flex-shrink: 0;
  width: 35%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 1rem;
  position: sticky;
  top: 0;
  align-self: flex-start;
}
.preview-img {
  width: 100%;
  border-radius: 2%;
  box-shadow: var(--card-shadow);
  display: block;
}
.preview-loading, .preview-not-found {
  color: var(--text-muted);
  font-size: 0.82rem;
  text-align: center;
  padding: 1rem 0;
}
.modal-close {
  position: absolute; top: 0.9rem; right: 1rem;
  background: transparent; border: none; color: var(--text-muted); font-size: 1.2rem; cursor: pointer;
}
.modal-close:hover { color: var(--text-primary); }
.modal-form-title { color: var(--text-primary); margin: 0 0 1.25rem; font-size: 1.1rem; }
.modal-form-title .subtitle { font-size: 0.85rem; color: var(--text-muted); font-weight: 400; }

/* Detail modal layout */
.modal-content { display: flex; gap: 1.5rem; align-items: flex-start;}
.modal-img-col { flex-shrink: 0; width: 35%; position: sticky; top: 0; align-self: flex-start; }
.modal-frame { width: 100%; aspect-ratio: 63 / 88; overflow: hidden; border-radius: 8px; background: var(--input-bg);  }
.modal-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.modal-info-col { flex: 1; min-width: 0; }
.modal-top-row { margin-bottom: 0.75rem; }
.modal-name-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; }
.modal-card-name { color: var(--text-primary); margin: 0; font-size: 1.5rem; }
.btn-modal-edit-name { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 1rem; padding: 0; line-height: 1; }
.btn-modal-edit-name:hover { color: var(--text-primary); }
.modal-name-input { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); background: var(--input-bg); border: 1px solid #3f51b5; border-radius: 6px; padding: 0 0.4rem; outline: none; width: min(100%, 60%); }
.modal-badges { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.badge-edition, .badge-color, .badge-sub, .badge-num {
  font-size: 1rem; font-weight: 700; padding: 0.15rem 0.5rem;
  border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; 
}
.badge-edition { background: #2a2a2a; color: var(--text-muted); }
.badge-color   { background: #2a2a2a; color: var(--text-muted); border: 1px solid var(--card-border); }
.badge-color--b { background: #3b82f6; color: #fff; border: none; }
.badge-color--g { background: #22c55e; color: #fff; border: none; }
.badge-color--p { background: #a855f7; color: #fff; border: none; }
.badge-color--r { background: #ef4444; color: #fff; border: none; }
.badge-color--w { background: #ffffff; color: #1a1a1a; border: 1px solid #ccc; }
.badge-sub     { background: #2a2a2a; color: var(--text-muted); border: 1px solid var(--card-border); }
.badge-num     { background: #2a2a2a; color: var(--text-muted); border: 1px solid var(--card-border); }
.no-meta-notice {
  color: var(--error-color); font-size: 0.85rem; background: rgba(244,67,54,0.08);
  border: 1px solid rgba(244,67,54,0.25); border-radius: 6px;
  padding: 0.6rem 0.8rem; margin-bottom: 0.75rem;
  display: flex; align-items: center; gap: 0.75rem;
}
.meta-grid-badges { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 0.75rem; }
.meta-row { background: var(--input-bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 0.45rem 0.65rem; display: flex; flex-direction: column; gap: 0.1rem; }
.meta-row--full { grid-column: 1 / -1; }
.meta-k   { color: var(--text-muted); font-weight: 600; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.07em; }
.meta-v   { color: var(--text-primary); font-size: 1rem; font-weight: 700; }
.effects-section  { margin-bottom: 0.75rem; background: var(--input-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 0.75rem 0.9rem; }
.effects-label    { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); font-weight: 700; margin-bottom: 0.5rem; }
.effect-pill      { font-size: 0.75rem; color: var(--text-primary); line-height: 1.45; margin-bottom: 0.25rem; }
.kw-pill          { color: #7c8ce8; font-weight: 600; }
.kw-preview       { color: #7c8ce8; font-weight: 600; }
.effect-tags      { font-size: 0.72rem; color: var(--text-muted); margin-left: 0.4rem; }
.modal-actions    { margin-top: 1rem; display: flex; gap: 0.5rem; }

/* Form grid */
.form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0.65rem; }
.form-field { display: flex; flex-direction: column; gap: 0.25rem; }
.form-field.full, .form-field--full { grid-column: 1 / -1; }
.form-field--s2 { grid-column: span 2; }
.form-field--inline { grid-column: 1 / -1; flex-direction: row; align-items: center; gap: 0.5rem; }
.form-field label { font-size: 0.78rem; color: var(--text-secondary); }
.form-field .hint  { font-size: 0.68rem; color: var(--text-muted); }
.form-field input,
.form-field select,
.form-field textarea {
  background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 6px;
  color: var(--text-primary); padding: 0.4rem 0.55rem; font-size: 0.88rem; outline: none; resize: vertical;
  transition: border-color 0.15s ease, background-color 0.2s ease;
}
.form-field input::placeholder,
.form-field textarea::placeholder { color: var(--text-muted); }
.form-field select option { background: var(--card-bg); color: var(--text-primary); }
.form-field input:focus,
.form-field select:focus,
.form-field textarea:focus { border-color: #3f51b5; }
.form-field input:disabled { opacity: 0.5; cursor: not-allowed; }
.form-actions { display: flex; gap: 0.5rem; margin-top: 1.25rem; }
.form-error { color: var(--error-color); font-weight: 600; margin-bottom: 0.75rem; font-size: 0.88rem; }

/* Classes / chips multi-select (inside modal — use theme variables) */
.chip-select { display: flex; flex-wrap: wrap; gap: 0.3rem; padding: 0.4rem 0; }
.chip-select .chip {
  border-color: var(--input-border);
  color: var(--text-primary);
}
.chip-select .chip:hover { background: var(--input-bg); color: var(--text-primary); }
.chip-select .chip.active { background: #3f51b5; border-color: #3f51b5; color: #fff; }

/* Color chips row inside card form (also inside themed modal) */
.color-chips-row .chip {
  border-color: var(--input-border);
  color: var(--text-primary);
}
.color-chips-row .chip:hover { background: var(--input-bg); }
.color-chips-row .chip.active { color: #fff; }

/* Effect list in card form */
.effect-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem; }
.effect-btn-group { display: flex; gap: 0.4rem; }
.effect-list { display: flex; flex-direction: column; gap: 0.35rem; }
.effect-list-item {
  display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
  background: var(--input-bg); border: 1px solid var(--card-border); border-radius: 6px; padding: 0.4rem 0.6rem;
}
.effect-preview    { font-size: 0.8rem; color: var(--text-secondary); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.effect-item-actions { display: flex; gap: 0.3rem; flex-shrink: 0; }
.empty-hint { font-size: 0.8rem; color: var(--text-muted); padding: 0.35rem 0; }

/* Effect block editor — wider layout with 3 columns (condition, cost, resolution) */
.effect-block-editor {
  background: var(--input-bg); border: 1px solid var(--card-border); border-radius: 8px;
  padding: 0.75rem; margin-bottom: 0.5rem;
  display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 0.5rem; align-items: start;
}
.effect-block-num {
  grid-column: 1 / -1; font-size: 0.75rem; color: var(--text-muted); font-weight: 700;
  display: flex; align-items: center; gap: 0.5rem;
}
.block-kw-row { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.2rem; }
.block-kw-text { font-size: 0.8rem; color: #7c8ce8; font-weight: 600; flex: 1; }
.block-kw-add { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.3rem; }
.block-kw-add select { flex: 1; min-width: 120px; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 6px; color: var(--text-primary); padding: 0.3rem 0.45rem; font-size: 0.82rem; outline: none; }
.block-kw-num { width: 80px; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 6px; color: var(--text-primary); padding: 0.3rem 0.45rem; font-size: 0.82rem; outline: none; }
/* Resolution textarea spans full width */
.effect-block-editor .form-field:last-child { grid-column: 1 / -1; }

/* Effect preview box */
.effect-preview-box {
  background: var(--input-bg); border: 1px solid var(--card-border); border-radius: 6px;
  padding: 0.6rem 0.8rem; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;
  min-height: 2.5rem;
}

/* New tag row */
.new-tag-row { display: flex; gap: 0.4rem; margin-top: 0.4rem; align-items: center; }
.new-tag-row .filter-input {
  background: var(--input-bg); border-color: var(--input-border);
  color: var(--text-primary);
}

/* Size modifiers */
.btn-sm  { padding: 0.3rem 0.85rem !important; font-size: 0.82rem !important; }
.btn-xs  { padding: 0.2rem 0.6rem  !important; font-size: 0.75rem !important; }
.btn-danger { border-color: rgba(244,67,54,0.4) !important; color: #f44 !important; }
.btn-danger:hover { background: rgba(244,67,54,0.12) !important; }

@media (max-width: 700px) {
  .modal-content { flex-direction: column; }
  .modal-img-col { width: 100%; max-width: 200px; }
  .form-grid { grid-template-columns: 1fr; }
  .form-field--s2 { grid-column: span 1; }
  .effect-block-editor { grid-template-columns: 1fr; }
  .filter-bar { gap: 0.75rem; }
}

/* ── Themed scrollbars for all modal boxes ───────────────────────────────── */
.modal-box::-webkit-scrollbar { width: 6px; }
.modal-box::-webkit-scrollbar-track { background: var(--card-bg); border-radius: 0 12px 12px 0; }
.modal-box::-webkit-scrollbar-thumb { background: var(--card-border); border-radius: 3px; }
.modal-box::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

.cards-load-trigger{
  height:20px;
  width:100%;
}

/* ── Edition navigation in detail modal ─────────────────────────────────── */
.modal-edition-nav {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.edition-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid var(--card-border);
  border-radius: 4px;
  padding: 0.2rem 0.45rem;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 0.85rem;
  line-height: 1;
  flex-shrink: 0;
}
.edition-nav-btn:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--text-muted);
}
.edition-nav-btn:disabled {
  opacity: 0.25;
  cursor: default;
}
</style>
