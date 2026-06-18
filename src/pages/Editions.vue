<script setup>
import { ref, computed } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { useAuthStore }    from '@/store/login'
import { useEditionsStore } from '@/store/editions'

const auth           = useAuthStore()
const editionsStore  = useEditionsStore()

const canManageEditions = computed(() => auth.can('manage_editions'))
const router = useRouter()

// ── Edition metadata (from store) ────────────────────────────────────────────
const editions        = computed(() => editionsStore.sorted)
const loadingEditions = ref(false)
const editionsError   = ref('')

editionsStore.load()

const selectEdition = (edition) => {
  router.push({ path: '/cards', query: { edition: edition.editionId } })
}

// ── Rarity constants ──────────────────────────────────────────────────────────
const RARITIES     = ['C', 'UC', 'R', 'SR', 'SEC']
const RARITY_COLOR = { C: '#9ca3af', UC: '#34d399', R: '#60a5fa', SR: '#f59e0b', SEC: '#f472b6' }

// ── Create / Edit edition form ────────────────────────────────────────────────
const showForm  = ref(false)
const editingId = ref(null)
const saving    = ref(false)
const formError = ref('')

const blankPackType = () => ({ name: '', cardsPerRarity: { C: 0, UC: 0, R: 0, SR: 0, SEC: 0 } })
const blankBoxEntry = () => ({ packTypeName: '', mode: 'FIXED', quantity: 1, probOptions: [] })
const blankProbOption = () => ({ quantity: 1, prob: 0 })

const blankForm = () => ({
  editionId: '', editionName: '', numberOfCards: 0,
  editionDescription: '', editionImage: '', releaseDate: '',
  packTypes: [],
  boxConfig: { totalPacks: 0, entries: [] },
})

const form = ref(blankForm())

// Pack type management (independent of box entries)
const addPackType    = () => form.value.packTypes.push(blankPackType())
const removePackType = (i) => form.value.packTypes.splice(i, 1)

// Box entry management
const addBoxEntry    = () => form.value.boxConfig.entries.push(blankBoxEntry())
const removeBoxEntry = (i) => form.value.boxConfig.entries.splice(i, 1)
const addProbOption  = (entry) => entry.probOptions.push(blankProbOption())
const removeProbOption = (entry, i) => entry.probOptions.splice(i, 1)

const probSum = (entry) =>
  entry.probOptions.reduce((s, o) => s + (parseFloat(o.prob) || 0), 0)

// Validation before save
const validateBox = () => {
  const { totalPacks, entries } = form.value.boxConfig
  if (!entries.length) return null // no box config = ok

  const flexEntries = entries.filter(e => e.mode === 'FLEX')
  const probEntries = entries.filter(e => e.mode === 'PROB')

  if (flexEntries.length > 1) return 'Solo puede haber un entrada FLEX en la caja.'
  if (probEntries.length > 0 && flexEntries.length === 0)
    return 'Se requiere una entrada FLEX cuando hay entradas PROB.'

  for (const e of probEntries) {
    const sum = probSum(e)
    if (Math.abs(sum - 1) > 0.001)
      return `Las probabilidades del sobre "${e.packTypeName}" suman ${sum.toFixed(3)}, deben sumar 1.`
  }

  const fixedTotal = entries
    .filter(e => e.mode === 'FIXED')
    .reduce((s, e) => s + (parseInt(e.quantity) || 0), 0)
  const probMin = probEntries.reduce((s, e) => {
    const min = Math.min(...e.probOptions.map(o => parseInt(o.quantity) || 0))
    return s + (isFinite(min) ? min : 0)
  }, 0)
  if (fixedTotal + probMin > totalPacks)
    return `El mínimo de sobres asignados (${fixedTotal + probMin}) supera el total de la caja (${totalPacks}).`

  return null
}

const openCreate = () => {
  editingId.value = null
  form.value = blankForm()
  formError.value = ''
  showForm.value = true
}

const openEdit = (ed, event) => {
  event.stopPropagation()
  editingId.value = ed.editionId

  const bc = ed.boxConfig ?? {}
  form.value = {
    editionId:          ed.editionId,
    editionName:        ed.editionName        || '',
    numberOfCards:      ed.numberOfCards       || 0,
    editionDescription: ed.editionDescription || '',
    editionImage:       '',
    releaseDate:        ed.releaseDate         || '',
    packTypes: (ed.packTypes || []).map(pt => ({
      name: pt.name || '',
      cardsPerRarity: {
        C:   pt.cardsPerRarity?.C   ?? 0,
        UC:  pt.cardsPerRarity?.UC  ?? 0,
        R:   pt.cardsPerRarity?.R   ?? 0,
        SR:  pt.cardsPerRarity?.SR  ?? 0,
        SEC: pt.cardsPerRarity?.SEC ?? 0,
      },
    })),
    boxConfig: {
      totalPacks: bc.totalPacks ?? 0,
      entries: (bc.entries || []).map(e => ({
        packTypeName: e.packTypeName || '',
        mode:         e.mode         || 'FIXED',
        quantity:     e.quantity     ?? 1,
        probOptions:  (e.probOptions || []).map(o => ({ quantity: o.quantity ?? 1, prob: o.prob ?? 0 })),
      })),
    },
  }
  formError.value = ''
  showForm.value = true
}

const resetForm = () => {
  form.value = blankForm()
  formError.value = ''
  editingId.value = null
  showForm.value = false
}

const saveEdition = async () => {
  formError.value = ''
  if (!form.value.editionId.trim()) { formError.value = 'Edition ID is required'; return }
  const boxErr = validateBox()
  if (boxErr) { formError.value = boxErr; return }
  saving.value = true
  try {
    await axios.post('/api/drive/editions', { ...form.value })
    resetForm()
    editionsStore.invalidate()
    await editionsStore.load()
  } catch (e) {
    formError.value = e?.response?.data?.error || e.message || 'Failed to save edition'
  } finally {
    saving.value = false
  }
}

// ── Simulate booster opening — modal just picks options, result is a new page ─
const showSimulate   = ref(false)
const simulatingEd   = ref(null)
const simPackTypeIdx = ref(0)
const simResults     = ref([]) // unused after redirect, kept for template refs

const openSimulate = (ed, event) => {
  event.stopPropagation()
  simulatingEd.value  = ed
  simPackTypeIdx.value = 0
  simResults.value    = []
  showSimulate.value  = true
}

const closeSimulate = () => {
  showSimulate.value = false
  simulatingEd.value = null
  simResults.value   = []
}



// How many packs actually go into a box (FIXED + min-PROB counts as actual roll range display,
// but totalPacks is authoritative for the label)
const simBoxTotalPacks = computed(() => simulatingEd.value?.boxConfig?.totalPacks ?? 0)

// Simulate one full box, then pick one random pack from it (reflects true odds)
const pickRandomPackFromBox = (ed) => {
  const entries    = ed.boxConfig?.entries ?? []
  const totalPacks = ed.boxConfig?.totalPacks ?? 0
  if (!totalPacks || !entries.length) return ed.packTypes?.[0]?.name ?? ''

  // Build the pool of pack names exactly as BoosterResult does
  const pool = []

  // 1. FIXED
  for (const entry of entries.filter(e => e.mode === 'FIXED')) {
    for (let i = 0; i < (entry.quantity || 0); i++) pool.push(entry.packTypeName)
  }

  // 2. PROB — roll each entry's distribution
  for (const entry of entries.filter(e => e.mode === 'PROB')) {
    if (!entry.probOptions?.length) continue
    let rand = Math.random()
    let cumulative = 0
    let chosen = entry.probOptions[entry.probOptions.length - 1].quantity
    for (const opt of entry.probOptions) {
      cumulative += parseFloat(opt.prob) || 0
      if (rand <= cumulative) { chosen = opt.quantity || 0; break }
    }
    for (let i = 0; i < chosen; i++) pool.push(entry.packTypeName)
  }

  // 3. FLEX — fill remainder
  const flexEntry = entries.find(e => e.mode === 'FLEX')
  if (flexEntry) {
    const remaining = Math.max(0, totalPacks - pool.length)
    for (let i = 0; i < remaining; i++) pool.push(flexEntry.packTypeName)
  }

  if (!pool.length) return ed.packTypes?.[0]?.name ?? ''
  return pool[Math.floor(Math.random() * pool.length)]
}

const simOpenPack = () => {
  const ed = simulatingEd.value
  if (!ed?.packTypes?.length) return
  const pt = ed.packTypes[simPackTypeIdx.value]
  closeSimulate()
  router.push({ path: '/booster-result', query: { edition: ed.editionId, mode: 'pack', packType: pt.name } })
}

const simOpenRandomPack = () => {
  const ed = simulatingEd.value
  if (!ed?.packTypes?.length || !ed?.boxConfig?.entries?.length) return
  const ptName = pickRandomPackFromBox(ed)
  closeSimulate()
  router.push({ path: '/booster-result', query: { edition: ed.editionId, mode: 'pack', packType: ptName, random: '1' } })
}

const simOpenBox = () => {
  const ed = simulatingEd.value
  if (!ed?.packTypes?.length || !ed?.boxConfig?.entries?.length) return
  closeSimulate()
  router.push({ path: '/booster-result', query: { edition: ed.editionId, mode: 'box' } })
}

const simPackType = computed(() =>
  simulatingEd.value?.packTypes?.[simPackTypeIdx.value] ?? null
)
</script>

<template>
  <div class="editions-page">

    <!-- Header -->
    <div class="ed-header">
      <h2>Editions</h2>
      <button v-if="canManageEditions" class="btn-filled" @click="openCreate">+ New Edition</button>
    </div>

    <!-- Create / Edit form -->
    <div v-if="showForm" class="ed-form">
      <h3>{{ editingId ? `Edit — ${editingId}` : 'New Edition' }}</h3>
      <p v-if="formError" class="form-error">{{ formError }}</p>

      <!-- Basic fields -->
      <div class="form-grid">
        <div class="form-field">
          <label>Edition ID *</label>
          <input v-model.trim="form.editionId" placeholder="E1, E1.1, ST4…" :disabled="!!editingId" />
        </div>
        <div class="form-field">
          <label>Lore Name</label>
          <input v-model="form.editionName" placeholder="El comienzo del fin de los tiempos" />
        </div>
        <div class="form-field">
          <label>Number of Cards</label>
          <input v-model.number="form.numberOfCards" type="number" min="0" />
        </div>
        <div class="form-field">
          <label>Release Date (yyyy-mm-dd-hh)</label>
          <input v-model="form.releaseDate" placeholder="2026-03-11-00" />
        </div>
        <div class="form-field">
          <label>{{ editingId ? 'New Image (Drive file ID — leave empty to keep current)' : 'Edition Image (Drive file ID)' }}</label>
          <input v-model="form.editionImage" placeholder="Paste Drive file ID from URL" />
        </div>
        <div class="form-field full">
          <label>Description / Lore</label>
          <textarea v-model="form.editionDescription" rows="4" placeholder="Lore, card rates, notes…" />
        </div>
      </div>

      <!-- Pack Types -->
      <div class="section-divider">
        <span>Tipos de sobre</span>
        <button class="btn-ghost btn-sm" type="button" @click="addPackType">+ Agregar tipo</button>
      </div>

      <div v-if="form.packTypes.length === 0" class="section-empty">
        Sin tipos de sobre — esta edición no tiene simulación configurada.
      </div>

      <div v-for="(pt, i) in form.packTypes" :key="i" class="pack-type-card">
        <div class="pack-type-header">
          <input v-model="pt.name" class="pt-name-input" placeholder="Nombre del sobre (ej. Standard Pack)" />
          <button class="btn-ghost btn-xs btn-danger" type="button" @click="removePackType(i)">✕</button>
        </div>
        <div class="rarity-slots">
          <div v-for="r in RARITIES" :key="r" class="rarity-slot">
            <label :style="{ color: RARITY_COLOR[r] }">{{ r }}</label>
            <input v-model.number="pt.cardsPerRarity[r]" type="number" min="0" class="slot-input" />
          </div>
        </div>
      </div>

      <!-- Box Configuration -->
      <div class="section-divider">
        <span>Configuración de caja</span>
      </div>

      <div class="box-total-row">
        <label class="box-total-label">Total de sobres por caja</label>
        <input v-model.number="form.boxConfig.totalPacks" type="number" min="0" class="slot-input" />
      </div>

      <div class="section-divider section-divider--sub">
        <span>Entradas de caja</span>
        <button class="btn-ghost btn-sm" type="button" @click="addBoxEntry">+ Agregar entrada</button>
      </div>

      <div v-if="form.boxConfig.entries.length === 0" class="section-empty">
        Sin entradas — la caja no tiene configuración.
      </div>

      <div v-for="(entry, i) in form.boxConfig.entries" :key="i" class="box-entry-card">
        <div class="box-entry-header">
          <!-- Pack type selector -->
          <select v-model="entry.packTypeName" class="pt-name-input">
            <option value="">— Tipo de sobre —</option>
            <option v-for="pt in form.packTypes" :key="pt.name" :value="pt.name">{{ pt.name }}</option>
          </select>
          <!-- Mode selector -->
          <select v-model="entry.mode" class="mode-select">
            <option value="FIXED">FIXED</option>
            <option value="PROB">PROB</option>
            <option value="FLEX">FLEX</option>
          </select>
          <button class="btn-ghost btn-xs btn-danger" type="button" @click="removeBoxEntry(i)">✕</button>
        </div>

        <!-- FIXED: single quantity -->
        <div v-if="entry.mode === 'FIXED'" class="box-qty-row">
          <span class="box-qty-label">Cantidad fija:</span>
          <input v-model.number="entry.quantity" type="number" min="0" class="slot-input" />
          <span class="box-qty-unit">sobres</span>
        </div>

        <!-- PROB: probability options -->
        <div v-if="entry.mode === 'PROB'" class="prob-section">
          <div class="prob-options">
            <div v-for="(opt, oi) in entry.probOptions" :key="oi" class="prob-option-row">
              <span class="box-qty-label">Cant.:</span>
              <input v-model.number="opt.quantity" type="number" min="0" class="slot-input" />
              <span class="box-qty-label" style="margin-left:0.5rem">Prob.:</span>
              <input v-model.number="opt.prob" type="number" min="0" max="1" step="0.01" class="slot-input prob-input" />
              <button class="btn-ghost btn-xs btn-danger" type="button" @click="removeProbOption(entry, oi)">✕</button>
            </div>
          </div>
          <div class="prob-footer">
            <button class="btn-ghost btn-xs" type="button" @click="addProbOption(entry)">+ Opción</button>
            <span class="prob-sum" :class="{ 'prob-sum--ok': Math.abs(probSum(entry) - 1) < 0.001, 'prob-sum--err': Math.abs(probSum(entry) - 1) >= 0.001 }">
              Suma: {{ probSum(entry).toFixed(3) }}
            </span>
          </div>
        </div>

        <!-- FLEX: info only -->
        <div v-if="entry.mode === 'FLEX'" class="flex-hint">
          Completa los sobres restantes hasta llegar al total de la caja.
        </div>
      </div>

      <div class="form-actions">
        <button class="btn-filled" @click="saveEdition" :disabled="saving">
          {{ saving ? 'Saving…' : 'Save Edition' }}
        </button>
        <button class="btn-ghost" @click="resetForm">Cancel</button>
      </div>
    </div>

    <!-- States -->
    <p v-if="editionsError" class="ed-error">{{ editionsError }}</p>
    <div v-if="loadingEditions" class="ed-empty">Loading editions…</div>
    <div v-else-if="!loadingEditions && editions.length === 0 && !editionsError" class="ed-empty">No editions yet.</div>

    <!-- Edition list -->
    <div v-if="editions.length > 0" class="edition-list">
      <div
        v-for="ed in editions"
        :key="ed.editionId"
        class="edition-row"
        @click="selectEdition(ed)"
      >
        <div class="row-image">
          <img v-if="ed.editionImage" :src="ed.editionImage" :alt="ed.editionId" />
          <div v-else class="row-placeholder">{{ ed.editionId }}</div>
        </div>
        <div class="row-info">
          <span class="tile-code">{{ ed.editionId }}</span>
          <span class="tile-name">{{ ed.editionName || '—' }}</span>
          <span class="tile-count" v-if="ed.numberOfCards">{{ ed.numberOfCards }} cards</span>
          <span class="tile-desc"  v-if="ed.editionDescription">{{ ed.editionDescription }}</span>
        </div>
        <div class="row-actions">
          <button
            v-if="ed.packTypes?.length"
            class="btn-ghost btn-sm"
            @click="openSimulate(ed, $event)"
          >Simular apertura</button>
          <button v-if="canManageEditions" class="btn-ghost btn-sm btn-edit" @click="openEdit(ed, $event)">Edit</button>
        </div>
      </div>
    </div>

    <!-- ── Simulation modal ──────────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showSimulate" class="sim-overlay" @click.self="closeSimulate">
        <div class="sim-modal">

          <!-- Header -->
          <div class="sim-header">
            <div>
              <div class="sim-title">Simular apertura</div>
              <div class="sim-subtitle">{{ simulatingEd?.editionId }} — {{ simulatingEd?.editionName }}</div>
            </div>
            <button class="btn-ghost btn-sm" @click="closeSimulate">✕</button>
          </div>

          <!-- Pack type selector (only when multiple types) -->
          <div v-if="(simulatingEd?.packTypes?.length ?? 0) > 1" class="sim-type-row">
            <label class="sim-label">Tipo de sobre:</label>
            <div class="sim-type-chips">
              <button
                v-for="(pt, i) in simulatingEd.packTypes"
                :key="i"
                class="chip"
                :class="{ active: simPackTypeIdx === i }"
                @click="simPackTypeIdx = i"
              >{{ pt.name }}</button>
            </div>
          </div>

          <!-- Pack type summary -->
          <div v-if="simPackType" class="sim-pack-summary">
            <span v-for="r in RARITIES" :key="r" v-show="(simPackType.cardsPerRarity?.[r] ?? 0) > 0" class="pack-slot-badge" :style="{ borderColor: RARITY_COLOR[r], color: RARITY_COLOR[r] }">
              {{ simPackType.cardsPerRarity[r] }}× {{ r }}
            </span>
          </div>

          <!-- Action buttons -->
          <div class="sim-actions">
            <button class="btn-filled" @click="simOpenPack">Abrir sobre</button>
            <button
              class="btn-filled btn-random"
              @click="simOpenRandomPack"
              :disabled="!simulatingEd?.boxConfig?.entries?.length"
              :title="!simulatingEd?.boxConfig?.entries?.length ? 'Requiere configuración de caja' : 'Abre un sobre según la distribución de la caja'"
            >Abrir sobre aleatorio</button>
            <button
              class="btn-filled btn-box"
              @click="simOpenBox"
              :disabled="!simulatingEd?.boxConfig?.entries?.length"
              :title="!simulatingEd?.boxConfig?.entries?.length ? 'No hay configuración de caja' : ''"
            >
              Abrir caja
              <span v-if="simBoxTotalPacks" class="box-count-hint">
                ({{ simBoxTotalPacks }} sobres)
              </span>
            </button>
          </div>


        </div>
      </div>
    </Teleport>

  </div>
</template>

<style scoped>
.editions-page { max-width: 1600px; margin: 0 auto; padding: 1.5rem 1rem; }

/* Header */
.ed-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
.ed-header h2 { color: var(--text-primary); margin: 0; }

/* Form */
.ed-form {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow);
  border-radius: 10px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.ed-form h3 { color: var(--text-primary); margin: 0 0 1rem; }
.form-error { color: var(--error-color); font-weight: 600; margin-bottom: 0.75rem; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.form-field { display: flex; flex-direction: column; gap: 0.3rem; }
.form-field.full { grid-column: 1 / -1; }
.form-field label { font-size: 0.8rem; color: var(--text-secondary); }
.form-field input,
.form-field textarea {
  background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 6px;
  color: var(--text-primary); padding: 0.45rem 0.6rem; font-size: 0.9rem; outline: none;
  resize: vertical; transition: border-color 0.15s, background-color 0.2s;
}
.form-field input::placeholder, .form-field textarea::placeholder { color: var(--text-muted); }
.form-field input:focus, .form-field textarea:focus { border-color: #3f51b5; }
.form-field input:disabled { opacity: 0.5; cursor: not-allowed; }
.form-actions { display: flex; gap: 0.5rem; margin-top: 1rem; }

/* Section divider */
.section-divider {
  display: flex; align-items: center; justify-content: space-between;
  margin: 1.25rem 0 0.75rem;
  font-size: 0.78rem; font-weight: 700; text-transform: uppercase;
  color: var(--text-secondary); letter-spacing: 0.05em;
}
.section-empty { font-size: 0.85rem; color: var(--text-muted); padding: 0.5rem 0 0.75rem; }

/* Pack type card */
.pack-type-card {
  background: var(--input-bg); border: 1px solid var(--card-border);
  border-radius: 8px; padding: 0.75rem; margin-bottom: 0.5rem;
}
.pack-type-header { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.6rem; }
.pt-name-input {
  flex: 1; background: var(--card-bg); border: 1px solid var(--input-border);
  border-radius: 6px; color: var(--text-primary); padding: 0.35rem 0.55rem;
  font-size: 0.9rem; outline: none;
}
.pt-name-input:focus { border-color: #3f51b5; }
.rarity-slots { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
.rarity-slot { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; }
.rarity-slot label { font-size: 0.72rem; font-weight: 700; }
.slot-input {
  width: 3.5rem; text-align: center;
  background: var(--card-bg); border: 1px solid var(--input-border);
  border-radius: 5px; color: var(--text-primary); padding: 0.3rem 0.4rem; font-size: 0.88rem; outline: none;
}
.slot-input:focus { border-color: #3f51b5; }
.box-qty-row { display: flex; align-items: center; gap: 0.5rem; padding-top: 0.5rem; }
.box-qty-label { font-size: 0.8rem; color: var(--text-secondary); white-space: nowrap; }
.box-qty-unit  { font-size: 0.8rem; color: var(--text-muted); }

/* Box config */
.box-total-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
.box-total-label { font-size: 0.85rem; color: var(--text-secondary); }
.section-divider--sub { margin-top: 0.75rem; }

.box-entry-card {
  background: var(--input-bg); border: 1px solid var(--card-border);
  border-radius: 8px; padding: 0.75rem; margin-bottom: 0.5rem;
  display: flex; flex-direction: column; gap: 0.5rem;
}
.box-entry-header { display: flex; gap: 0.5rem; align-items: center; }
.mode-select {
  background: var(--card-bg); border: 1px solid var(--input-border);
  border-radius: 6px; color: var(--text-primary); padding: 0.35rem 0.55rem;
  font-size: 0.85rem; font-weight: 700; outline: none; cursor: pointer;
}

/* PROB options */
.prob-section { display: flex; flex-direction: column; gap: 0.4rem; }
.prob-options  { display: flex; flex-direction: column; gap: 0.3rem; }
.prob-option-row { display: flex; align-items: center; gap: 0.4rem; }
.prob-input { width: 4.5rem; }
.prob-footer { display: flex; align-items: center; gap: 0.75rem; }
.prob-sum { font-size: 0.78rem; font-weight: 700; }
.prob-sum--ok  { color: #34d399; }
.prob-sum--err { color: var(--error-color); }

/* FLEX hint */
.flex-hint { font-size: 0.82rem; color: var(--text-muted); font-style: italic; padding: 0.2rem 0; }

/* States */
.ed-error { color: var(--error-color); font-weight: 600; margin-bottom: 0.75rem; }
.ed-empty { text-align: center; color: var(--text-muted); padding: 3rem 1rem; font-size: 1.05rem; }

/* Edition list */
.edition-list { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 2rem; }
.edition-row {
  display: flex; align-items: center; gap: 1rem; padding: 0.6rem;
  border-radius: 10px; border: 2px solid transparent;
  background: var(--card-bg); box-shadow: var(--card-shadow);
  cursor: pointer; transition: border-color 0.2s, background 0.15s;
}
.edition-row:hover { background: var(--input-bg); border-color: var(--text-muted); }
.row-image {
  flex-shrink: 0; width: 90px; aspect-ratio: 63 / 88;
  border-radius: 6px; overflow: hidden;
  background: var(--input-bg); border: 1px solid var(--card-border);
}
.row-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
.row-placeholder {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  font-size: 1.1rem; font-weight: 700; color: var(--text-muted);
}
.row-info { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; flex: 1; }
.row-actions { display: flex; gap: 0.4rem; flex-shrink: 0; margin-left: auto; }

.tile-code  { font-size: 0.7rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; }
.tile-name  { font-size: 1rem; color: var(--text-primary); font-weight: 700; }
.tile-count { font-size: 0.8rem; color: var(--text-muted); }
.tile-desc  { font-size: 0.8rem; color: var(--text-secondary); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

/* Simulation modal */
.sim-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}
.sim-modal {
  background: var(--card-bg); border: 1px solid var(--card-border);
  border-radius: 14px; padding: 1.5rem;
  width: 100%; max-width: 560px;
  max-height: 85vh; overflow-y: auto;
  display: flex; flex-direction: column; gap: 1rem;
}
.sim-header { display: flex; align-items: flex-start; justify-content: space-between; }
.sim-title  { font-size: 1.2rem; font-weight: 700; color: var(--text-primary); }
.sim-subtitle { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.15rem; }

.sim-type-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.sim-label { font-size: 0.82rem; color: var(--text-secondary); white-space: nowrap; }
.sim-type-chips { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.chip {
  padding: 0.25rem 0.7rem; border-radius: 99px; font-size: 0.82rem;
  border: 1px solid var(--card-border); background: var(--input-bg);
  color: var(--text-secondary); cursor: pointer; transition: all 0.15s;
}
.chip.active { background: #3f51b5; color: #fff; border-color: #3f51b5; }

.sim-pack-summary { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.pack-slot-badge {
  padding: 0.2rem 0.55rem; border-radius: 6px; font-size: 0.78rem; font-weight: 700;
  border: 1px solid; background: transparent;
}

.sim-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.btn-random { background: #0891b2 !important; border-color: #0891b2 !important; }
.btn-random:hover:not(:disabled) { background: #0e7490 !important; }
.btn-random:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-box { background: #7c3aed !important; border-color: #7c3aed !important; }
.btn-box:hover:not(:disabled) { background: #6d28d9 !important; }
.btn-box:disabled { opacity: 0.4; cursor: not-allowed; }
.box-count-hint { font-size: 0.8rem; opacity: 0.85; margin-left: 0.25rem; }


/* Misc */
.btn-xs { font-size: 0.75rem; padding: 0.2rem 0.5rem; }
.btn-danger { color: var(--error-color) !important; }
.btn-edit { font-size: 0.8rem; padding: 0.3rem 0.8rem; }

@media (max-width: 600px) {
  .form-grid { grid-template-columns: 1fr; }
  .sim-actions { flex-direction: column; }
}
@media (max-width: 480px) {
  .ed-header { flex-wrap: wrap; gap: 0.75rem; }
  .edition-row { flex-wrap: wrap; gap: 0.6rem; }
  .row-image { width: 70px; }
  .row-actions { width: 100%; justify-content: flex-end; }
}
</style>
