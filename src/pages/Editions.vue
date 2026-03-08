<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/store/login'

const auth = useAuthStore()
const isAuth = computed(() => auth.isAuthenticated)

// ── Edition metadata ──────────────────────────────────────────────────────────
const editions = ref([])
const loadingEditions = ref(false)
const editionsError = ref('')

const fetchEditions = async () => {
  loadingEditions.value = true
  editionsError.value = ''
  try {
    const { data } = await axios.get('/api/drive/editions')
    editions.value = data.sort((a, b) => sortEditionId(a.editionId, b.editionId))
  } catch (e) {
    editionsError.value = e?.response?.data?.error || e.message || 'Failed to load editions'
  } finally {
    loadingEditions.value = false
  }
}

const sortEditionId = (a, b) => {
  const isStA = a.startsWith('ST'), isStB = b.startsWith('ST')
  if (isStA && !isStB) return -1
  if (!isStA && isStB) return 1
  return parseFloat(a.replace(/[^0-9.]/g, '')) - parseFloat(b.replace(/[^0-9.]/g, ''))
}

// ── Card gallery ──────────────────────────────────────────────────────────────
const selectedEdition = ref(null)
const cards = ref([])
const loadingCards = ref(false)
const selectedSub = ref(null)

const selectEdition = async (edition) => {
  if (selectedEdition.value?.editionId === edition.editionId) {
    selectedEdition.value = null
    cards.value = []
    return
  }
  selectedEdition.value = edition
  selectedSub.value = null
  loadingCards.value = true
  cards.value = []
  try {
    const { data } = await axios.get(`/api/drive/cards/db?edition=${edition.editionId}`)
    cards.value = data.sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
  } catch {
    cards.value = []
  } finally {
    loadingCards.value = false
  }
}

const isStructure = computed(() => selectedEdition.value?.editionId?.startsWith('ST'))

const subEditions = computed(() => {
  const subs = new Set(cards.value.map(c => c.sub_edition))
  return [...subs].sort((a, b) => {
    if (a === null) return -1
    if (b === null) return 1
    return parseInt(a) - parseInt(b)
  })
})

const visibleCards = computed(() => {
  if (!selectedEdition.value) return []
  if (isStructure.value) return cards.value
  return cards.value.filter(c => c.sub_edition === selectedSub.value)
})

const subLabel = (sub) => sub === null ? 'MAIN' : `SUB${sub}`

// ── Create / Edit edition form ────────────────────────────────────────────────
const showForm = ref(false)
const editingId = ref(null) // null = create mode, string = edit mode
const saving = ref(false)
const formError = ref('')
const form = ref({
  editionId: '',
  editionName: '',
  numberOfCards: 0,
  editionDescription: '',
  editionImage: ''
})

const openCreate = () => {
  editingId.value = null
  form.value = { editionId: '', editionName: '', numberOfCards: 0, editionDescription: '', editionImage: '' }
  formError.value = ''
  showForm.value = true
}

const openEdit = (ed, event) => {
  event.stopPropagation() // don't trigger selectEdition
  editingId.value = ed.editionId
  form.value = {
    editionId: ed.editionId,
    editionName: ed.editionName || '',
    numberOfCards: ed.numberOfCards || 0,
    editionDescription: ed.editionDescription || '',
    editionImage: '' // leave empty — only fill to replace with a new Drive file ID
  }
  formError.value = ''
  showForm.value = true
}

const resetForm = () => {
  form.value = { editionId: '', editionName: '', numberOfCards: 0, editionDescription: '', editionImage: '' }
  formError.value = ''
  editingId.value = null
  showForm.value = false
}

const saveEdition = async () => {
  formError.value = ''
  if (!form.value.editionId.trim()) {
    formError.value = 'Edition ID is required'
    return
  }
  saving.value = true
  try {
    await axios.post('/api/drive/editions', { ...form.value })
    resetForm()
    await fetchEditions()
  } catch (e) {
    formError.value = e?.response?.data?.error || e.message || 'Failed to save edition'
  } finally {
    saving.value = false
  }
}

onMounted(fetchEditions)
</script>

<template>
  <div class="editions-page">

    <!-- Header -->
    <div class="ed-header">
      <h2>Editions</h2>
      <button v-if="isAuth" class="btn-filled" @click="openCreate">
        + New Edition
      </button>
    </div>

    <!-- Create / Edit form -->
    <div v-if="showForm" class="ed-form">
      <h3>{{ editingId ? `Edit — ${editingId}` : 'New Edition' }}</h3>
      <p v-if="formError" class="form-error">{{ formError }}</p>
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
          <label>{{ editingId ? 'New Image (Drive file ID — leave empty to keep current)' : 'Edition Image (Drive file ID — auto-pulled to R2)' }}</label>
          <input v-model="form.editionImage" placeholder="Paste Drive file ID from URL" />
        </div>
        <div class="form-field full">
          <label>Description / Lore</label>
          <textarea v-model="form.editionDescription" rows="4" placeholder="Lore, card rates, notes…" />
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
    <div v-else-if="!loadingEditions && editions.length === 0 && !editionsError" class="ed-empty">
      No editions yet.
    </div>

    <!-- Edition list -->
    <div v-if="editions.length > 0" class="edition-list">
      <div
        v-for="ed in editions"
        :key="ed.editionId"
        class="edition-row"
        :class="{ selected: selectedEdition?.editionId === ed.editionId }"
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
          <span class="tile-desc" v-if="ed.editionDescription">{{ ed.editionDescription }}</span>
        </div>
        <button v-if="isAuth" class="btn-ghost btn-edit" @click="openEdit(ed, $event)">Edit</button>
      </div>
    </div>

    <!-- Card gallery -->
    <template v-if="selectedEdition">
      <div class="gallery-header">
        <h3>{{ selectedEdition.editionId }}<span v-if="selectedEdition.editionName"> — {{ selectedEdition.editionName }}</span></h3>
      </div>

      <!-- Sub-edition tabs (E* only, multiple subs) -->
      <div v-if="!isStructure && subEditions.length > 1" class="sub-bar">
        <button
          v-for="sub in subEditions"
          :key="sub ?? 'main'"
          class="sub-btn"
          :class="{ active: selectedSub === sub }"
          @click="selectedSub = sub"
        >
          {{ subLabel(sub) }}
        </button>
      </div>

      <div v-if="loadingCards" class="ed-empty">Loading cards…</div>
      <div v-else-if="visibleCards.length === 0 && !loadingCards" class="ed-empty">No cards found for this selection.</div>

      <div v-else class="card-grid">
        <div v-for="card in visibleCards" :key="card.id" class="card-item">
          <div class="card-frame">
            <img :src="card.image_url" :alt="card.name" class="card-img" loading="lazy" />
          </div>
          <div class="card-label">
            <span class="card-name">{{ card.name }}</span>
            <span class="card-meta">{{ card.color_identity }} · #{{ card.number }}</span>
          </div>
        </div>
      </div>
    </template>

  </div>
</template>

<style scoped>
.editions-page {
  padding: 1.5rem 1rem;
}

/* Header */
.ed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}
.ed-header h2 { color: var(--text-primary); margin: 0; }

/* Create form */
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

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.form-field { display: flex; flex-direction: column; gap: 0.3rem; }
.form-field.full { grid-column: 1 / -1; }
.form-field label { font-size: 0.8rem; color: var(--text-secondary); }
.form-field input,
.form-field textarea {
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 6px;
  color: var(--text-primary);
  padding: 0.45rem 0.6rem;
  font-size: 0.9rem;
  outline: none;
  resize: vertical;
  transition: border-color 0.15s ease, background-color 0.2s ease;
}
.form-field input::placeholder,
.form-field textarea::placeholder { color: var(--text-muted); }
.form-field input:focus,
.form-field textarea:focus { border-color: #3f51b5; }
.form-field input:disabled { opacity: 0.5; cursor: not-allowed; }

.form-actions { display: flex; gap: 0.5rem; margin-top: 1rem; }

/* States */
.ed-error { color: var(--error-color); font-weight: 600; margin-bottom: 0.75rem; }
.ed-empty { text-align: center; color: var(--text-muted); padding: 3rem 1rem; font-size: 1.05rem; }

/* Edition list */
.edition-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-bottom: 2rem;
}
.edition-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem;
  border-radius: 10px;
  border: 2px solid transparent;
  background: var(--card-bg);
  box-shadow: var(--card-shadow);
  cursor: pointer;
  transition: border-color 0.2s, background 0.15s, box-shadow 0.15s;
}
.edition-row:hover { background: var(--input-bg); border-color: var(--text-muted); }
.edition-row.selected { border-color: #3f51b5; }

.row-image {
  flex-shrink: 0;
  width: 90px;
  aspect-ratio: 63 / 88;
  border-radius: 6px;
  overflow: hidden;
  background: var(--input-bg);
  border: 1px solid var(--card-border);
}
.row-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
.row-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-muted);
}

.row-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}
.btn-edit {
  flex-shrink: 0;
  margin-left: auto;
  font-size: 0.8rem;
  padding: 0.3rem 0.8rem;
}

.tile-code { font-size: 0.7rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; }
.tile-name { font-size: 1rem; color: var(--text-primary); font-weight: 700; }
.tile-count { font-size: 0.8rem; color: var(--text-muted); }
.tile-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Gallery */
.gallery-header { margin-bottom: 0.75rem; }
.gallery-header h3 { color: var(--text-primary); margin: 0; }

/* Sub-edition tabs */
.sub-bar { display: flex; gap: 0.35rem; margin-bottom: 1rem; flex-wrap: wrap; }
.sub-btn {
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--card-border);
  border-radius: 5px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.sub-btn.active { background: #4caf50; border-color: #4caf50; color: #fff; }

/* Card grid */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
}
.card-frame {
  width: 100%;
  aspect-ratio: 63 / 88;
  overflow: hidden;
  border-radius: 6px;
  background: var(--input-bg);
}
.card-img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.2s; }
.card-item:hover .card-img { transform: scale(1.04); }
.card-label { display: flex; flex-direction: column; margin-top: 0.3rem; gap: 0.1rem; }
.card-name { font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-meta { font-size: 0.68rem; color: var(--text-muted); }

@media (max-width: 600px) {
  .form-grid { grid-template-columns: 1fr; }
}
</style>
