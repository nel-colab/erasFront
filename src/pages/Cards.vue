<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/store/login'

const auth = useAuthStore()
const isAuth = computed(() => auth.isAuthenticated)

const sidebarOpen = ref(true)

// ── Constants (hardcoded by game rules) ───────────────────────────────────────
const CARD_TYPES   = ['creature', 'utility', 'structure']
const COLOR_IDENTITIES = ['B', 'G', 'P', 'R', 'W']
const SS_KINDS     = ['materialization', 'promotion', 'ritual', 'evolution']
const USAGE_LIMITS = ['once per turn', 'once per turn between copies', 'ultimate effect']

// ── Ref data (classes, instances, kinds, tags) ────────────────────────────────
const refData = ref({ classes: [], instances: [], kinds: [], tags: [], instanceKinds: {}, keywordEffects: {} })

const fetchRef = async () => {
  try {
    const { data } = await axios.get('/api/cards/ref')
    refData.value = data
  } catch { /* keep defaults */ }
}

const addTag = async (tag) => {
  try {
    const { data } = await axios.post('/api/cards/ref/tags', { value: tag })
    refData.value = data
  } catch { /* ignore */ }
}

// ── Editions list (for filter dropdown) ──────────────────────────────────────
const editions = ref([])
const fetchEditions = async () => {
  try {
    const { data } = await axios.get('/api/drive/editions')
    editions.value = data.sort((a, b) => sortEdId(a.editionId, b.editionId))
  } catch { editions.value = [] }
}
const sortEdId = (a, b) => {
  const sa = a.startsWith('ST'), sb = b.startsWith('ST')
  if (sa && !sb) return -1; if (!sa && sb) return 1
  return parseFloat(a.replace(/[^0-9.]/g, '')) - parseFloat(b.replace(/[^0-9.]/g, ''))
}

// ── Drive cards (images db) ───────────────────────────────────────────────────
const driveCards   = ref([])
const loadingDrive = ref(false)
const fetchDriveCards = async () => {
  loadingDrive.value = true
  try {
    const p = new URLSearchParams()
    if (fEdition.value)          p.set('edition',    fEdition.value)
    if (fSubEdition.value !== null) p.set('subEdition', fSubEdition.value)
    const { data } = await axios.get('/api/drive/cards/db?' + p)
    driveCards.value = data.sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
  } catch { driveCards.value = [] }
  finally { loadingDrive.value = false }
}

// ── Metadata cards (cards collection) ────────────────────────────────────────
const metaCards   = ref([])
const loadingMeta = ref(false)
const fetchMeta = async () => {
  loadingMeta.value = true
  try {
    const p = new URLSearchParams()
    if (fEdition.value) p.set('edition', fEdition.value)
    const { data } = await axios.get('/api/cards/search' + (p.toString() ? '?' + p : ''))
    metaCards.value = data
  } catch { metaCards.value = [] }
  finally { loadingMeta.value = false }
}

// ── Filters ───────────────────────────────────────────────────────────────────
const fEdition    = ref('')
const fColors     = ref([])   // excluded colors; empty = show all
const fSubEdition = ref(null)   // null = all, '' = MAIN, '1'/'2'/… = SUBn
const fName       = ref('')
const fType       = ref('')
const fStarter    = ref(false)
const showWithoutMeta = ref(true)
const cardSize     = ref(200) // px, for responsive grid
const fCostMin   = ref(0)
const fCostMax   = ref(8)
const fLevelMin   = ref(0)
const fLevelMax   = ref(12)
const fStrengthMin   = ref(0)
const fStrengthMax   = ref(15)
const fSpecialCostMin = ref(0)
const fSpecialCostMax = ref(5)
const fRequirement = ref('')
const fCardNumber = ref('')

const anyFilterActive = computed(() =>
  !!(fEdition.value || fColors.value.length || fSubEdition.value !== null ||
     fName.value || fType.value || fStarter.value || fRequirement.value))

watch(anyFilterActive, v => { if (v) showWithoutMeta.value = false })
watch([fEdition, fSubEdition], () => { fetchDriveCards(); fetchMeta() })

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize.value}px, 1fr))`
}))

// ── Merge ─────────────────────────────────────────────────────────────────────
const metaMap = computed(() => {
  const m = new Map()
  metaCards.value.forEach(c => {
    if (c.edition && c.cardNumber != null) m.set(c.edition + '|' + c.cardNumber, c)
  })
  return m
})
const allMerged  = computed(() =>
  driveCards.value.map(dc => ({ ...dc, meta: metaMap.value.get(dc.edition + '|' + dc.number) ?? null }))
)
const visibleCards = computed(() =>
  allMerged.value
    .filter(c => showWithoutMeta.value || c.meta !== null)
    .filter(c => !fColors.value.length || !fColors.value.includes(c.color_identity))
    .filter(c => !fName.value    || c.name?.toLowerCase().includes(fName.value.toLowerCase()))
    .filter(c => !fType.value    || c.meta?.cardType === fType.value)
    .filter(c => !fStarter.value || c.meta?.starter === true)
    .filter(c => {
      const lv = c.meta?.level
      if (lv == null) return true
      return lv >= fLevelMin.value && lv <= fLevelMax.value
    })
)

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

const subLabel   = s => s === null || s === '' ? 'MAIN' : `SUB${s}`
const colorLabel = c => ({ B: 'Blue', G: 'Green', P: 'Purple', R: 'Red', W: 'White' }[c] ?? c)

// ── Detail modal ──────────────────────────────────────────────────────────────
const detailCard = ref(null)
const showDetail = ref(false)
const openDetail = card => { detailCard.value = card; showDetail.value = true }
const closeDetail = () => { showDetail.value = false; detailCard.value = null }

// ── Card form modal ───────────────────────────────────────────────────────────
const showCardForm  = ref(false)
const editingMetaId = ref(null)
const saving        = ref(false)
const formError     = ref('')

const blankForm = () => ({
  cardName: '', cardType: 'creature', edition: fEdition.value || '',
  colorIdentity: 'W', cardNumber: null, strength: null, cost: null, level: null,
  starter: false, cardClasses: [], regulation: '', specialCost: null,
  specialSummonKind: null, requirement: '', effects: [], inheritEffects: [],
  keywordEffects: [], inheritKeywordEffects: [],
})
const form = ref(blankForm())

const openCreate = (driveCard = null) => {
  editingMetaId.value = null
  form.value = blankForm()
  if (driveCard) {
    form.value.edition       = driveCard.edition       || ''
    form.value.colorIdentity = driveCard.color_identity || ''
    form.value.cardNumber    = driveCard.number         ?? null
    form.value.cardName      = driveCard.name           || ''
  }
  formError.value = ''
  driveCardPreview.value = null
  showCardForm.value = true
  showDetail.value = false
  if (driveCard?.name) lookupDriveCard()
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
    effects:                JSON.parse(JSON.stringify(m?.effects               ?? [])),
    inheritEffects:         JSON.parse(JSON.stringify(m?.inheritEffects        ?? [])),
    keywordEffects:         JSON.parse(JSON.stringify(m?.keywordEffects        ?? [])),
    inheritKeywordEffects:  JSON.parse(JSON.stringify(m?.inheritKeywordEffects ?? [])),
  }
  formError.value = ''
  driveCardPreview.value = null
  showCardForm.value = true
  showDetail.value = false
  if (form.value.cardName) lookupDriveCard()
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
    effects:               form.value.effects,
    inheritEffects:        form.value.inheritEffects,
    keywordEffects:        form.value.keywordEffects,
    inheritKeywordEffects: form.value.inheritKeywordEffects,
  }
  saving.value = true
  try {
    if (editingMetaId.value) await axios.put(`/api/cards/${editingMetaId.value}`, payload)
    else                     await axios.post('/api/cards', payload)
    await fetchMeta()
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
    driveCardPreview.value = data.length ? data[0].image_url : null
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
  if (ef.ussageLimit === 'once per turn') parts.push('[once per turn]')
  else if (ef.ussageLimit === 'once per turn between copies') parts.push('(1)')
  else if (ef.ussageLimit === 'ultimate effect') parts.push('[ultimate]')
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
  return parts.join(' ') || 'empty effect'
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



// ── Init ──────────────────────────────────────────────────────────────────────
onMounted(() => { fetchEditions(); fetchDriveCards(); fetchMeta(); fetchRef() })

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

      <div class="filter-sidebar-sticky">
      <div class="filter-sidebar" :class="{ 'filter-sidebar--open': sidebarOpen }">
        <div class="filter-sidebar-inner">

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
              <option v-for="t in availableTypes" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>

          <!-- Color -->
          <div class="filter-group">
            <label class="filter-label">Color</label>
            <div class="filter-chips filter-chips--colors">
              <button v-for="c in COLOR_IDENTITIES" :key="c" class="chip chip--color"
                :class="['color-' + c.toLowerCase(), { active: !fColors.includes(c) }]"
                @click="fColors = fColors.includes(c) ? fColors.filter(x => x !== c) : [...fColors, c]">{{ colorLabel(c) }}</button>
            </div>
          </div>

          <!-- Clases -->
          <div class="filter-group">
            <label class="filter-label">Clases</label>
            <select v-model="fClases" class="filter-select">
              <option value="">Todas</option>
              <option v-for="cl in classes" :key="cl" :value="cl">
                {{ cl }}
              </option>
            </select>
          </div>

          <!-- Coste -->
          <div class="filter-group">
            <label class="filter-label">
              Coste<span v-if="fCostMax > 0 || fCostMax < 8"> ({{ fCostMin }}–{{ fCostMax }})</span><span v-else> (all)</span>
            </label>
            <div class="dual-range"
              :style="{ '--pct-min': (fCostMin / 8 * 100) + '%', '--pct-max': (fCostMax / 8 * 100) + '%' }">
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
              Nivel<span v-if="fLevelMin > 0 || fLevelMax < 6"> ({{ fLevelMin }}–{{ fLevelMax }})</span><span v-else> (Todos)</span>
            </label>
            <div class="dual-range"
              :style="{ '--pct-min': (fLevelMin / 6 * 100) + '%', '--pct-max': (fLevelMax / 6 * 100) + '%' }">
              <div class="dual-range-track"></div>
              <input type="range" min="0" max="6" step="1" v-model.number="fLevelMin"
                @input="fLevelMax = fLevelMin > fLevelMax ? fLevelMin : fLevelMax" />
              <input type="range" min="0" max="6" step="1" v-model.number="fLevelMax"
                @input="fLevelMin = fLevelMax < fLevelMin ? fLevelMax : fLevelMin" />
            </div>
          </div>

          <!-- Fuerza -->
          <div class="filter-group">
            <label class="filter-label">
              Fuerza<span v-if="fStrengthMax > 0 || fStrengthMax < 8"> ({{ fStrengthMin }}–{{ fStrengthMax }})</span><span v-else> (all)</span>
            </label>
            <div class="dual-range"
              :style="{ '--pct-min': (fStrengthMin / 8 * 100) + '%', '--pct-max': (fStrengthMax / 8 * 100) + '%' }">
              <div class="dual-range-track"></div>
              <input type="range" min="0" max="8" step="1" v-model.number="fStrengthMin"
                @input="fStrengthMax = fStrengthMin > fStrengthMax ? fStrengthMin : fStrengthMax" />
              <input type="range" min="0" max="8" step="1" v-model.number="fStrengthMax"
                @input="fStrengthMin = fStrengthMax < fStrengthMin ? fStrengthMax : fStrengthMin" />
            </div>
          </div>

          <!-- Tipo de invocacion especial -->
          <div v-if="availableSpecialSummons.length" class="filter-group">
            <label class="filter-label">Invocacion especial</label>
            <select v-model="fSpecialSummon" class="filter-select">
              <option value="">Todos</option>
              <option v-for="ss in availableSpecialSummons" :key="ss" :value="ss">{{ ss }}</option>
            </select>
          </div>

          <!-- Coste especial -->
          <div class="filter-group">
            <label class="filter-label">
              Coste especial<span v-if="fSpecialCostMax > 0 || fSpecialCostMax < 8"> ({{ fSpecialCostMin }}–{{ fSpecialCostMax }})</span><span v-else> (all)</span>
            </label>
            <div class="dual-range"
              :style="{ '--pct-min': (fSpecialCostMin / 8 * 100) + '%', '--pct-max': (fSpecialCostMax / 8 * 100) + '%' }">
              <div class="dual-range-track"></div>
              <input type="range" min="0" max="8" step="1" v-model.number="fSpecialCostMin"
                @input="fSpecialCostMax = fSpecialCostMin > fSpecialCostMax ? fSpecialCostMin : fSpecialCostMax" />
              <input type="range" min="0" max="8" step="1" v-model.number="fSpecialCostMax"
                @input="fSpecialCostMin = fSpecialCostMax < fSpecialCostMin ? fSpecialCostMax : fSpecialCostMin" />
            </div>
          </div>

          <!-- Requerimineto -->
          <div class="filter-group">
            <label class="filter-label">Requerimiento</label>
            <input v-model="fRequirement" class="filter-input" placeholder="Buscar por requerimiento…" />
          </div>


          <div class="filter-group">
            <label class="filter-label">Edition</label>
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

          <div v-if="availableSubs.length > 1" class="filter-group">
            <label class="filter-label">Sub-edition</label>
            <div class="filter-chips">
              <button class="chip" :class="{ active: fSubEdition === null }" @click="fSubEdition = null">All</button>
              <button v-for="s in availableSubs" :key="s ?? 'main'" class="chip"
                :class="{ active: fSubEdition === s }"
                @click="fSubEdition = fSubEdition === s ? null : s">{{ subLabel(s) }}</button>
            </div>
          </div>

          <div class="filter-group filter-group--row">
            <input type="checkbox" v-model="fStarter" class="filter-check" />
            <label class="filter-label">Starter</label>
          </div>

          <div class="filter-group filter-group--row">
            <input type="checkbox" v-model="showWithoutMeta" :disabled="anyFilterActive" class="filter-check" />
            <label class="filter-label" :class="{ muted: anyFilterActive }">NO METADATA</label>
          </div>

          <div class="filter-group">
            <label class="filter-label">Card Size ({{ cardSize }}px)</label>
            <input class="filter-input" type="range" min="100" max="500" step="10" v-model="cardSize" />
          </div>

        </div>
      </div>
      </div> <!-- /filter-sidebar-sticky -->
      </div> <!-- /filter-col -->

      <!-- ── Main content ───────────────────────────────────────────── -->
      <div class="cp-main">

        <!-- ── Status / count ─────────────────────────────────────── -->
        <div v-if="loadingDrive" class="cp-empty">Loading cards…</div>
        <div v-else-if="visibleCards.length === 0" class="cp-empty">
          No cards found{{ anyFilterActive ? ' for the current filters' : '' }}.
        </div>
        <div v-if="visibleCards.length > 0" class="cp-count">
          {{ visibleCards.length }} card{{ visibleCards.length !== 1 ? 's' : '' }}
          <span v-if="anyFilterActive"> (filtered)</span>
        </div>

        <!-- ── Card grid ───────────────────────────────────────────── -->
        <div
          v-if="!loadingDrive && visibleCards.length > 0"
          class="card-grid"
          :style="gridStyle"
        >
      <div
        v-for="card in visibleCards"
        :key="card.id"
        class="card-item"
        @click="openDetail(card)"
      >
        <div class="card-frame">
          <img :src="card.image_url" :alt="card.name" class="card-img" loading="lazy" />
          <div v-if="!card.meta" class="no-meta-badge">NO METADATA</div>
        </div>

        <div class="card-label">
          <span class="card-name" style="text-align: center;">{{ card.name }}</span>
        </div>
      </div>
    </div>

      </div> <!-- /cp-main -->
    </div> <!-- /cp-body -->

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- Detail modal                                                       -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="showDetail" class="modal-overlay" @click.self="closeDetail">
        <div class="modal-box">
            <h1 class="modal-card-name">{{ detailCard.name }}</h1>
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
                    No metadata yet.
                    <button v-if="isAuth" class="btn-filled btn-sm" @click="openCreate(detailCard)">Create</button>
                  </div>

                  <template v-if="detailCard.meta">
                    <div class="meta-grid-badges">
                      <div class="meta-row" v-if="detailCard.meta.cardType"><span class="meta-k">Type</span><span class="meta-v">{{ detailCard.meta.cardType }}</span></div>
                      <div class="meta-row" v-if="detailCard.meta.cost != null"><span class="meta-k">Cost</span><span class="meta-v">{{ detailCard.meta.cost }}</span></div>
                      <div class="meta-row" v-if="detailCard.meta.strength != null"><span class="meta-k">Strength</span><span class="meta-v">{{ detailCard.meta.strength }}</span></div>
                      <div class="meta-row" v-if="detailCard.meta.level != null"><span class="meta-k">Level</span><span class="meta-v">{{ detailCard.meta.level }}</span></div>
                      <div class="meta-row" v-if="detailCard.meta.starter != null"><span class="meta-k">Starter</span><span class="meta-v">{{ detailCard.meta.starter ? 'Yes' : 'No' }}</span></div>
                      <div class="meta-row" v-if="detailCard.meta.cardClasses?.length"><span class="meta-k">Classes</span><span class="meta-v">{{ detailCard.meta.cardClasses.join(', ') }}</span></div>
                      <div class="meta-row" v-if="detailCard.meta.regulation"><span class="meta-k">Regulation</span><span class="meta-v">{{ detailCard.meta.regulation }}</span></div>
                      <div class="meta-row" v-if="detailCard.meta.specialCost != null"><span class="meta-k">Special Cost</span><span class="meta-v">{{ detailCard.meta.specialCost }}</span></div>
                      <div class="meta-row" v-if="detailCard.meta.specialSummonKind"><span class="meta-k">SS Kind</span><span class="meta-v">{{ detailCard.meta.specialSummonKind }}</span></div>
                      <div class="meta-row meta-row--full" v-if="detailCard.meta.requirement"><span class="meta-k">Requirement</span><span class="meta-v">{{ detailCard.meta.requirement }}</span></div>
                    </div>

                    <div v-if="detailCard.meta.effects?.length || detailCard.meta.keywordEffects?.length" class="effects-section">
                      <div class="effects-label">Effects</div>
                      <div v-for="(ef, i) in detailCard.meta.effects" :key="i" class="effect-pill">
                        <span v-html="renderEffectHtml(ef)"></span>
                        <span v-if="ef.tags?.length" class="effect-tags">{{ ef.tags.join(', ') }}</span>
                      </div>
                      <div v-for="(ke, i) in detailCard.meta.keywordEffects" :key="'kw'+i" class="effect-pill kw-pill">
                        <span v-html="renderCardKwEffect(ke)"></span>
                      </div>
                    </div>

                    <div v-if="detailCard.meta.inheritEffects?.length || detailCard.meta.inheritKeywordEffects?.length" class="effects-section">
                      <div class="effects-label">Inherit Effects</div>
                      <div v-for="(ef, i) in detailCard.meta.inheritEffects" :key="i" class="effect-pill">
                        <span v-html="renderEffectHtml(ef)"></span>
                        <span v-if="ef.tags?.length" class="effect-tags">{{ ef.tags.join(', ') }}</span>
                      </div>
                      <div v-for="(ke, i) in detailCard.meta.inheritKeywordEffects" :key="'ikw'+i" class="effect-pill kw-pill">
                        <span v-html="renderCardKwEffect(ke)"></span>
                      </div>
                    </div>
                  </template>

                  <div class="modal-actions" v-if="isAuth && detailCard.meta">
                    <button class="btn-filled btn-sm" @click="openEdit(detailCard)">Edit metadata</button>
                  </div>
                </div>

              
              </div><!-- /form-main -->

            
              <div class="modal-img-col">
                <div class="modal-frame">
                  <img :src="detailCard.image_url" :alt="detailCard.name" class="modal-img" />
                </div>
              </div>



            </div><!-- /form-with-preview -->
        </div>
      </div>
    </Teleport>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- Card form modal (create / edit)                                    -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="showCardForm" class="modal-overlay" @click.self="showCardForm = false">
        <div class="modal-box modal-box--form" :class="{ 'modal-box--form-wide': driveCardPreview || previewLoading }">
          <button class="modal-close" @click="showCardForm = false">✕</button>
          <h3 class="modal-form-title">{{ editingMetaId ? 'Edit Card' : 'New Card' }}</h3>
          <p v-if="formError" class="form-error">{{ formError }}</p>

          <div class="form-with-preview">
          <div class="form-main">
          <div class="form-grid">
            <!-- Row 1 -->
            <div class="form-field">
              <label>Card Name *</label>
              <input v-model="form.cardName" @blur="lookupDriveCard" />
            </div>
            <div class="form-field">
              <label>Type</label>
              <select v-model="form.cardType">
                <option v-for="t in CARD_TYPES" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>

            <!-- Row 2 -->
            <div class="form-field">
              <label>Edition *</label>
              <input v-model="form.edition" :disabled="!!editingMetaId" />
            </div>
            <div class="form-field">
              <label>Color Identity</label>
              <select v-model="form.colorIdentity">
                <option v-for="c in COLOR_IDENTITIES" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>

            <!-- Row 3 -->
            <div class="form-field">
              <label>Card #</label>
              <input v-model.number="form.cardNumber" type="number" />
            </div>
            <div class="form-field">
              <label>Cost</label>
              <input v-model.number="form.cost" type="number" />
            </div>

            <!-- Row 4 -->
            <div class="form-field">
              <label>Strength</label>
              <input v-model.number="form.strength" type="number" />
            </div>
            <div class="form-field">
              <label>Level</label>
              <input v-model.number="form.level" type="number" />
            </div>

            <!-- Row 5 -->
            <div class="form-field">
              <label>Regulation</label>
              <input v-model="form.regulation" />
            </div>
            <div class="form-field">
              <label>Special Cost</label>
              <input v-model.number="form.specialCost" type="number" />
            </div>

            <!-- Row 6 -->
            <div class="form-field">
              <label>Special Summon Kind</label>
              <select v-model="form.specialSummonKind">
                <option :value="null">— none —</option>
                <option v-for="k in SS_KINDS" :key="k" :value="k">{{ k }}</option>
              </select>
            </div>
            <div class="form-field">
              <label>Requirement</label>
              <input v-model="form.requirement" />
            </div>

            <!-- Starter -->
            <div class="form-field form-field--inline">
              <label><input type="checkbox" v-model="form.starter" /> Starter card</label>
            </div>

            <!-- Classes multi-select -->
            <div class="form-field full" v-if="refData.classes.length">
              <label>Classes</label>
              <div class="chip-select">
                <button
                  v-for="cls in refData.classes" :key="cls"
                  type="button"
                  class="chip"
                  :class="{ active: form.cardClasses.includes(cls) }"
                  @click="toggleClass(cls)"
                >{{ cls }}</button>
              </div>
            </div>
            <div v-else class="form-field full">
              <label>Classes <span class="hint">(add classes via /api/cards/ref to enable this picker)</span></label>
            </div>

            <!-- Effects -->
            <div class="form-field full">
              <div class="effect-section-header">
                <label>Effects</label>
                <button type="button" class="btn-ghost btn-xs" @click="openEffectModal('effects')">+ Add effect</button>
                <button type="button" class="btn-ghost btn-xs" @click="openKeywordEffectModal('keywordEffects')">+ Add keyword effect</button>
              </div>
              <div v-if="form.effects.length" class="effect-list">
                <div v-for="(ef, i) in form.effects" :key="i" class="effect-list-item">
                  <span class="effect-preview" v-html="renderEffectHtml(ef)"></span>
                  <div class="effect-item-actions">
                    <button type="button" class="btn-ghost btn-xs" @click="openEffectModal('effects', i)">Edit</button>
                    <button type="button" class="btn-ghost btn-xs btn-danger" @click="removeEffect('effects', i)">✕</button>
                  </div>
                </div>
              </div>
              <div v-if="form.keywordEffects.length" class="effect-list">
                <div v-for="(ke, i) in form.keywordEffects" :key="'kw'+i" class="effect-list-item">
                  <span class="effect-preview kw-preview" v-html="renderCardKwEffect(ke)"></span>
                  <div class="effect-item-actions">
                    <button type="button" class="btn-ghost btn-xs" @click="openKeywordEffectModal('keywordEffects', i)">Edit</button>
                    <button type="button" class="btn-ghost btn-xs btn-danger" @click="removeKeywordEffect('keywordEffects', i)">✕</button>
                  </div>
                </div>
              </div>
              <div v-if="!form.effects.length && !form.keywordEffects.length" class="empty-hint">No effects yet.</div>
            </div>

            <!-- Inherit Effects -->
            <div class="form-field full">
              <div class="effect-section-header">
                <label>Inherit Effects</label>
                <button type="button" class="btn-ghost btn-xs" @click="openEffectModal('inheritEffects')">+ Add effect</button>
                <button type="button" class="btn-ghost btn-xs" @click="openKeywordEffectModal('inheritKeywordEffects')">+ Add keyword effect</button>
              </div>
              <div v-if="form.inheritEffects.length" class="effect-list">
                <div v-for="(ef, i) in form.inheritEffects" :key="i" class="effect-list-item">
                  <span class="effect-preview" v-html="renderEffectHtml(ef)"></span>
                  <div class="effect-item-actions">
                    <button type="button" class="btn-ghost btn-xs" @click="openEffectModal('inheritEffects', i)">Edit</button>
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
              <div v-if="!form.inheritEffects.length && !form.inheritKeywordEffects.length" class="empty-hint">No inherit effects yet.</div>
            </div>
          </div>

          <div class="form-actions">
            <button class="btn-filled" @click="saveCard" :disabled="saving">{{ saving ? 'Saving…' : 'Save Card' }}</button>
            <button class="btn-ghost" @click="showCardForm = false">Cancel</button>
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
    <!-- Effect sub-modal                                                   -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="showEffectModal" class="modal-overlay modal-overlay--nested" @click.self="showEffectModal = false">
        <div class="modal-box modal-box--effect">
          <button class="modal-close" @click="showEffectModal = false">✕</button>
          <h3 class="modal-form-title">
            {{ editingEffectIdx !== null ? 'Edit' : 'Add' }} Effect
            <span class="subtitle">— {{ effectTarget === 'effects' ? 'Effect' : 'Inherit Effect' }}</span>
          </h3>

          <div class="form-with-preview">
          <div class="form-main">
          <div class="form-grid">
            <!-- Instance -->
            <div class="form-field">
              <label>Instance</label>
              <select v-model="effectForm.instance">
                <option :value="null">— none —</option>
                <option v-for="inst in refData.instances" :key="inst" :value="inst">{{ inst }}</option>
              </select>
            </div>

            <!-- Usage limit -->
            <div class="form-field">
              <label>Usage Limit</label>
              <select v-model="effectForm.ussageLimit">
                <option :value="null">— none —</option>
                <option v-for="u in USAGE_LIMITS" :key="u" :value="u">{{ u }}</option>
              </select>
            </div>

            <!-- Kind -->
            <div class="form-field">
              <label>Kind</label>
              <select v-model="effectForm.kind">
                <option :value="null">— none —</option>
                <option v-for="k in refData.kinds" :key="k" :value="k">{{ k }}</option>
              </select>
            </div>

            <!-- Tags -->
            <div class="form-field full">
              <label>Tags</label>
              <div class="chip-select" v-if="refData.tags.length">
                <button
                  v-for="tag in refData.tags" :key="tag"
                  type="button"
                  class="chip"
                  :class="{ active: effectForm.tags.includes(tag) }"
                  @click="toggleEffectTag(tag)"
                >{{ tag }}</button>
              </div>
              <div class="new-tag-row">
                <input v-model="newTagInput" class="filter-input" placeholder="New tag…" @keydown.enter.prevent="submitNewTag" />
                <button type="button" class="btn-ghost btn-xs" @click="submitNewTag">Add</button>
              </div>
            </div>

            <!-- Effect blocks -->
            <div class="form-field full">
              <div class="effect-section-header">
                <label>Effect Blocks</label>
                <button type="button" class="btn-ghost btn-xs" @click="addEffectBlock">+ Add block</button>
              </div>
              <div v-for="(block, i) in effectForm.effectBlocks" :key="i" class="effect-block-editor">
                <div class="effect-block-num">#{{ i + 1 }}
                  <button v-if="effectForm.effectBlocks.length > 1" type="button"
                    class="btn-ghost btn-xs btn-danger" @click="removeEffectBlock(i)">✕</button>
                </div>
                <div class="form-field">
                  <label>Activation Condition</label>
                  <input v-model="block.activationCondition" placeholder="When… / If…"
                    @focus="trackBlockField(i, 'activationCondition', $event)" />
                </div>
                <div class="form-field">
                  <label>Cost</label>
                  <input v-model="block.cost" placeholder="Pay… / Tribute…"
                    @focus="trackBlockField(i, 'cost', $event)" />
                </div>
                <div class="form-field" style="grid-column: 1 / -1;">
                  <label>Resolution *</label>
                  <textarea v-model="block.resolution" rows="3" placeholder="Effect text…"
                    @focus="trackBlockField(i, 'resolution', $event)" />
                </div>

                <!-- Inline keyword inserter -->
                <div class="form-field" style="grid-column: 1 / -1;" v-if="Object.keys(refData.keywordEffects).length">
                  <div class="block-kw-add">
                    <select v-model="blockKwPickers[i].keyword"
                      @change="blockKwPickers[i].number = null">
                      <option :value="null">— insert keyword —</option>
                      <option v-for="k in Object.keys(refData.keywordEffects)" :key="k" :value="k">{{ k }}</option>
                    </select>
                    <input v-if="blockKwPlaceholder(i)" v-model="blockKwPickers[i].number"
                      :placeholder="`${blockKwPlaceholder(i)} value`" class="block-kw-num" />
                    <button type="button" class="btn-ghost btn-xs"
                      :disabled="!blockKwPickers[i]?.keyword"
                      @click="insertKwToken(i)">Insert at cursor</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Live preview -->
            <div class="form-field full">
              <label>Preview</label>
              <div class="effect-preview-box" v-html="renderEffectHtml(effectForm)"></div>
            </div>
          </div>

          <div class="form-actions">
            <button class="btn-filled" @click="saveEffect">{{ editingEffectIdx !== null ? 'Update' : 'Add' }} Effect</button>
            <button class="btn-ghost" @click="showEffectModal = false">Cancel</button>
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
            {{ editingEffectIdx !== null ? 'Edit' : 'Add' }} Effect
            <span class="subtitle">— {{ effectTarget === 'effects' ? 'Effect' : 'Inherit Effect' }}</span>
          </h3>

          <div class="form-with-preview">
          <div class="form-main">
          <div class="form-grid">

            <!-- Keyword -->
            <div class="form-field">
              <label>Keyword</label>
              <select v-model="keywordEffectForm.keyword">
                <!-- keywordEffects is now a map; iterate over its keys -->
                <option v-for="k in Object.keys(refData.keywordEffects || {})" :key="k" :value="k">{{ k }}</option>
              </select>

            </div>

            <div v-if="keywordPlaceholder" class="form-field">
              <label>{{ keywordPlaceholder }}</label>
              <input v-model="keywordEffectForm.number" :placeholder="`Value for {${keywordPlaceholder}}`" />
            </div>
            
          </div>

          <div class="form-actions">
            <button class="btn-filled" @click="saveKeywordEffect"
              :disabled="!keywordEffectForm.keyword">
              {{ editingKeywordEffectIdx !== null ? 'Update' : 'Add' }} Keyword Effect
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
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

/* Sticky wrapper — only the sidebar panel sticks, not the toggle */
.filter-sidebar-sticky {
  position: sticky;
  top: 4.5rem;
  align-self: flex-start;
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
.filter-sidebar--open { width: 20vw; min-width: 180px; max-width: 280px; }

.filter-sidebar-inner {
  width: 100%; box-sizing: border-box;
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
.filter-chips { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.filter-chips--colors { flex-wrap: nowrap; }
.chip--color { padding: 0.2rem 0.45rem; font-size: 0.72rem; flex: 1; text-align: center; }

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

/* Chips — used in filter bar (always dark) and in form modals (theme-aware via CSS vars) */
.chip {
  padding: 0.25rem 0.65rem; border-radius: 20px; border: 1px solid #3a3a3a;
  background: transparent; color: rgba(255,255,255,0.5); font-size: 0.78rem; font-weight: 600;
  cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.chip:hover { background: rgba(255,255,255,0.08); color: #fff; }
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
.card-name      { font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
.modal-img-col { flex-shrink: 0; width: 35%; }
.modal-frame { width: 100%; aspect-ratio: 63 / 88; overflow: hidden; border-radius: 8px; background: var(--input-bg);  }
.modal-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.modal-info-col { flex: 1; min-width: 0; }
.modal-top-row { margin-bottom: 0.75rem; }
.modal-card-name { color: var(--text-primary); margin: 0 0 0.4rem; font-size: 1.5rem;}
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
.form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.65rem; }
.form-field { display: flex; flex-direction: column; gap: 0.25rem; }
.form-field.full { grid-column: 1 / -1; }
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

/* Classes / chips multi-select (inside modal — use card-border for chips) */
.chip-select { display: flex; flex-wrap: wrap; gap: 0.3rem; padding: 0.4rem 0; }
.chip-select .chip {
  border-color: var(--card-border);
  color: var(--text-secondary);
}
.chip-select .chip:hover { background: var(--input-bg); color: var(--text-primary); }
.chip-select .chip.active { background: #3f51b5; border-color: #3f51b5; color: #fff; }

/* Effect list in card form */
.effect-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem; }
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
  .effect-block-editor { grid-template-columns: 1fr; }
  .filter-bar { gap: 0.75rem; }
}
</style>
