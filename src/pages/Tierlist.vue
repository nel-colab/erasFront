<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useAuthStore } from '@/store/login'
import { useDecksStore } from '@/store/decks'
import axios from 'axios'

const auth = useAuthStore()
const decksStore = useDecksStore()

// ── State ──────────────────────────────────────────────────────────────────
const tierlist      = ref({ pages: [] })
const activePageIdx = ref(0)
const loading       = ref(false)
const saving        = ref(false)
const editMode      = ref(false)
const showModal      = ref(false)
const error          = ref(null)
const saved          = ref(false)
const modalSearch    = ref('')
const editingPageId  = ref(null)
const selectedDeckIds = ref(new Set())

// Drag state
const dragging      = ref(null) // { deckId, fromTierLabel }
const dragOverLabel = ref(null)
const trashOver     = ref(false)

// ── Computed ───────────────────────────────────────────────────────────────
const decks = computed(() => decksStore.publicDecks)

const deckMap = computed(() => {
  const m = {}
  decks.value.forEach(d => { m[d.id] = d })
  return m
})

const currentPage  = computed(() => tierlist.value.pages?.[activePageIdx.value] || null)
const currentTiers = computed(() => currentPage.value?.tiers || [])

const currentPageDeckIds = computed(() =>
  new Set(currentTiers.value.flatMap(t => t.deckIds))
)

const availableDecks = computed(() => {
  const q = modalSearch.value.toLowerCase()
  return decks.value
    .filter(d => !currentPageDeckIds.value.has(d.id))
    .filter(d => !q || (d.deckName || '').toLowerCase().includes(q))
})

const getDeck = id => deckMap.value[id] || null

// ── Default structure ──────────────────────────────────────────────────────
const defaultTiers = () => [
  { label: 'S', color: '#FF7675', deckIds: [] },
  { label: 'A', color: '#FDCB6E', deckIds: [] },
  { label: 'B', color: '#55EFC4', deckIds: [] },
  { label: 'C', color: '#74B9FF', deckIds: [] },
  { label: 'D', color: '#B2BEC3', deckIds: [] },
]

// ── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(async () => {
  loading.value = true
  try {
    await decksStore.loadPublic()
    const { data } = await axios.get('/api/drive/tierlist')
    // Migrate old single-page format if needed
    if (!data.pages && data.tiers) {
      tierlist.value = { ...data, pages: [{ id: '1', name: 'Principal', tiers: data.tiers }] }
    } else {
      tierlist.value = data
    }
    if (!tierlist.value.pages) tierlist.value.pages = []
  } catch {
    error.value = 'Error al cargar la tierlist'
  } finally {
    loading.value = false
  }
})

// ── Edit mode ──────────────────────────────────────────────────────────────
const toggleEditMode = () => {
  editMode.value = !editMode.value
  if (!editMode.value) {
    dragging.value      = null
    dragOverLabel.value = null
    trashOver.value     = false
    editingPageId.value = null
  }
}

// ── Page management ────────────────────────────────────────────────────────
const addPage = () => {
  const page = {
    id: Date.now().toString(),
    name: `Página ${tierlist.value.pages.length + 1}`,
    tiers: defaultTiers(),
  }
  tierlist.value.pages.push(page)
  activePageIdx.value = tierlist.value.pages.length - 1
  nextTick(() => { editingPageId.value = page.id })
}

const deletePage = idx => {
  if (tierlist.value.pages.length <= 1) return
  tierlist.value.pages.splice(idx, 1)
  if (activePageIdx.value >= tierlist.value.pages.length) {
    activePageIdx.value = tierlist.value.pages.length - 1
  }
}

const startRename = page => {
  editingPageId.value = page.id
}

const finishRename = () => {
  editingPageId.value = null
}

// ── Drag & Drop ────────────────────────────────────────────────────────────
const onDragStart = (deckId, tierLabel, e) => {
  dragging.value = { deckId, tierLabel }
  e.dataTransfer.setData('deckId', deckId)
  e.dataTransfer.setData('fromTier', tierLabel)
  e.dataTransfer.effectAllowed = 'move'
}

const onDragOver = (tierLabel, e) => {
  e.preventDefault()
  dragOverLabel.value = tierLabel
  e.dataTransfer.dropEffect = 'move'
}

const onDragLeave = () => { dragOverLabel.value = null }

const onDrop = (targetTierLabel, e) => {
  e.preventDefault()
  const deckId        = dragging.value?.deckId    || e.dataTransfer.getData('deckId')
  const fromTierLabel = dragging.value?.tierLabel  || e.dataTransfer.getData('fromTier')

  dragOverLabel.value = null
  dragging.value      = null

  if (!deckId || fromTierLabel === targetTierLabel) return

  const tiers = currentPage.value?.tiers
  if (!tiers) return

  const fromTier = tiers.find(t => t.label === fromTierLabel)
  if (fromTier) fromTier.deckIds = fromTier.deckIds.filter(id => id !== deckId)

  const toTier = tiers.find(t => t.label === targetTierLabel)
  if (toTier && !toTier.deckIds.includes(deckId)) toTier.deckIds.push(deckId)
}

const onDragEnd = () => {
  dragging.value      = null
  dragOverLabel.value = null
  trashOver.value     = false
}

const onTrashOver = e => {
  e.preventDefault()
  trashOver.value = true
  e.dataTransfer.dropEffect = 'move'
}

const onTrashLeave = () => { trashOver.value = false }

const onTrashDrop = e => {
  e.preventDefault()
  const deckId        = dragging.value?.deckId    || e.dataTransfer.getData('deckId')
  const fromTierLabel = dragging.value?.tierLabel  || e.dataTransfer.getData('fromTier')

  dragging.value  = null
  trashOver.value = false

  if (!deckId) return
  const tiers = currentPage.value?.tiers
  if (!tiers) return
  const fromTier = tiers.find(t => t.label === fromTierLabel)
  if (fromTier) fromTier.deckIds = fromTier.deckIds.filter(id => id !== deckId)
}

// ── Modal ──────────────────────────────────────────────────────────────────
const openModal = () => {
  modalSearch.value    = ''
  selectedDeckIds.value = new Set()
  showModal.value      = true
}

const toggleDeckSelection = deckId => {
  const s = new Set(selectedDeckIds.value)
  if (s.has(deckId)) s.delete(deckId)
  else s.add(deckId)
  selectedDeckIds.value = s
}

const confirmAddDecks = () => {
  const tiers = currentPage.value?.tiers
  if (!tiers || selectedDeckIds.value.size === 0) return
  const lastTier = tiers[tiers.length - 1]
  if (!lastTier) return
  for (const deckId of selectedDeckIds.value) {
    if (!lastTier.deckIds.includes(deckId)) lastTier.deckIds.push(deckId)
  }
  showModal.value       = false
  selectedDeckIds.value = new Set()
}

// ── Save ───────────────────────────────────────────────────────────────────
const save = async () => {
  saving.value = true
  error.value  = null
  saved.value  = false
  try {
    const { data } = await axios.put('/api/drive/tierlist', tierlist.value)
    tierlist.value = data
    saved.value    = true
    setTimeout(() => { saved.value = false }, 2500)
  } catch {
    error.value = 'Error al guardar la tierlist'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="tierlist-page">

    <!-- Header -->
    <div class="tl-header">
      <h2 class="tl-title">Tierlist de mazos</h2>
      <div v-if="auth.can('manage_decks')" class="tl-controls">
        <button @click="toggleEditMode" :class="editMode ? 'btn-filled' : 'btn-ghost'" class="btn-sm">
          <i :class="editMode ? 'bi bi-eye' : 'bi bi-pencil'"></i>
          {{ editMode ? 'Ver' : 'Editar' }}
        </button>
        <template v-if="editMode">
          <button @click="openModal" class="btn-ghost btn-sm">
            <i class="bi bi-plus-lg"></i> Deck
          </button>
          <button @click="save" class="btn-filled btn-sm" :disabled="saving">
            <i class="bi bi-floppy"></i>
            {{ saving ? 'Guardando…' : saved ? 'Guardado ✓' : 'Guardar' }}
          </button>
        </template>
      </div>
    </div>

    <div v-if="error" class="tl-error">{{ error }}</div>

    <div v-if="loading" class="tl-loading">Cargando…</div>

    <template v-else>
      <!-- Tab bar -->
      <div class="tl-tabs">
        <button
          v-for="(page, idx) in tierlist.pages"
          :key="page.id"
          class="tl-tab"
          :class="{ active: activePageIdx === idx }"
          @click="activePageIdx = idx; editingPageId = null"
        >
          <template v-if="editMode && editingPageId === page.id">
            <input
              class="tab-name-input"
              v-model="page.name"
              @blur="finishRename"
              @keyup.enter="finishRename"
              @keyup.escape="finishRename"
              @click.stop
              autofocus
            />
          </template>
          <template v-else>
            <span
              class="tab-label"
              :title="editMode ? 'Doble clic para renombrar' : ''"
              @dblclick.stop="editMode && startRename(page)"
            >{{ page.name }}</span>
          </template>

          <button
            v-if="editMode && tierlist.pages.length > 1"
            class="tab-close"
            @click.stop="deletePage(idx)"
            title="Eliminar página"
          >×</button>
        </button>

        <button v-if="editMode" class="tl-tab tl-tab-add" @click="addPage">
          <i class="bi bi-plus"></i> Página
        </button>
      </div>

      <!-- Tier table for active page -->
      <div v-if="currentPage" class="tier-table">
        <div
          v-for="tier in currentTiers"
          :key="tier.label"
          class="tier-row"
          :class="{ 'drag-over': editMode && dragOverLabel === tier.label }"
          @dragover="(e) => editMode && onDragOver(tier.label, e)"
          @dragleave="() => editMode && onDragLeave()"
          @drop="(e) => editMode && onDrop(tier.label, e)"
        >
          <div class="tier-label" :style="{ backgroundColor: tier.color }">
            {{ tier.label }}
          </div>

          <div class="tier-decks">
            <div
              v-for="deckId in tier.deckIds"
              :key="deckId"
              class="tier-deck-item"
              :class="{ draggable: editMode, 'is-dragging': dragging?.deckId === deckId }"
              :title="getDeck(deckId)?.deckName || ''"
              :draggable="editMode"
              @dragstart="(e) => editMode && onDragStart(deckId, tier.label, e)"
              @dragend="onDragEnd"
            >
              <img
                v-if="getDeck(deckId)?.deckImage"
                :src="getDeck(deckId).deckImage"
                :alt="getDeck(deckId)?.deckName || deckId"
                class="deck-img"
                draggable="false"
              />
              <div v-else class="deck-img deck-img-placeholder">?</div>
              <span class="deck-name">{{ getDeck(deckId)?.deckName || '—' }}</span>
            </div>

            <div v-if="editMode && tier.deckIds.length === 0" class="tier-empty-hint">
              Suelta aquí
            </div>
          </div>
        </div>
      </div>

      <!-- Trash zone (edit mode only) -->
      <div
        v-if="editMode"
        class="trash-zone"
        :class="{ 'trash-over': trashOver }"
        @dragover="onTrashOver"
        @dragleave="onTrashLeave"
        @drop="onTrashDrop"
      >
        <i class="bi bi-trash3"></i>
        <span>Suelta aquí para eliminar del tierlist</span>
      </div>
    </template>

    <!-- Add deck modal -->
    <Teleport to="body">
      <div v-if="showModal" class="tl-overlay" @click.self="showModal = false">
        <div class="tl-modal">
          <div class="tl-modal-header">
            <h3>Agregar mazo — {{ currentPage?.name }}</h3>
            <button class="tl-close" @click="showModal = false">✕</button>
          </div>

          <div class="tl-modal-search">
            <input
              v-model="modalSearch"
              type="text"
              placeholder="Buscar mazo…"
              class="tl-search-input"
            />
          </div>

          <div class="tl-modal-body">
            <div v-if="availableDecks.length === 0" class="tl-no-decks">
              No hay mazos disponibles para agregar.
            </div>
            <div class="deck-pick-grid">
              <button
                v-for="deck in availableDecks"
                :key="deck.id"
                class="deck-pick-item"
                :class="{ selected: selectedDeckIds.has(deck.id) }"
                @click="toggleDeckSelection(deck.id)"
              >
                <div class="pick-check" v-if="selectedDeckIds.has(deck.id)">
                  <i class="bi bi-check-lg"></i>
                </div>
                <img
                  v-if="deck.deckImage"
                  :src="deck.deckImage"
                  :alt="deck.deckName"
                  class="pick-img"
                  draggable="false"
                />
                <div v-else class="pick-img pick-placeholder">?</div>
                <span class="pick-name">{{ deck.deckName }}</span>
              </button>
            </div>
          </div>

          <div class="tl-modal-footer">
            <span class="pick-count">
              {{ selectedDeckIds.size > 0 ? `${selectedDeckIds.size} seleccionado${selectedDeckIds.size > 1 ? 's' : ''}` : 'Seleccioná los mazos' }}
            </span>
            <button
              class="btn-filled btn-sm"
              :disabled="selectedDeckIds.size === 0"
              @click="confirmAddDecks"
            >
              Agregar{{ selectedDeckIds.size > 0 ? ` (${selectedDeckIds.size})` : '' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<style scoped>
.tierlist-page {
  padding: 5.5rem 1.5rem 4rem;
  max-width: 1100px;
  margin: 0 auto;
}

/* ── Header ──────────────────────────────────────────────────────── */
.tl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.2rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.tl-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.tl-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.tl-error {
  color: var(--error-color);
  margin-bottom: 1rem;
  font-size: 0.8rem;
}

.tl-loading {
  color: var(--text-muted);
  text-align: center;
  padding: 4rem;
  font-size: 0.85rem;
}

/* ── Tab bar ─────────────────────────────────────────────────────── */
.tl-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-bottom: 0;
  border-bottom: 2px solid var(--card-border);
  padding-bottom: 0;
}

.tl-tab {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.9rem;
  background: var(--input-bg);
  border: 1px solid var(--card-border);
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.12s, color 0.12s;
  position: relative;
  bottom: -2px;
}

.tl-tab:hover { color: var(--text-primary); }

.tl-tab.active {
  background: var(--card-bg);
  color: var(--text-primary);
  border-color: var(--card-border);
  border-bottom-color: var(--card-bg);
  font-weight: 600;
  z-index: 1;
}

.tl-tab-add {
  color: var(--text-muted);
  border-style: dashed;
}
.tl-tab-add:hover { color: var(--text-primary); }

.tab-label { user-select: none; }

.tab-name-input {
  background: none;
  border: none;
  border-bottom: 1px solid var(--input-focus);
  outline: none;
  color: var(--text-primary);
  font-size: 0.78rem;
  font-weight: 600;
  width: 100px;
  padding: 0;
}

.tab-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0 0.1rem;
  line-height: 1;
  border-radius: 3px;
}
.tab-close:hover { color: var(--error-color); }

/* ── Tier table ──────────────────────────────────────────────────── */
.tier-table {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--card-border);
  border-top: none;
  border-radius: 0 0 8px 8px;
  overflow: hidden;
  background-color: var(--card-bg);
}

.tier-row {
  display: flex;
  min-height: 100px;
  border-bottom: 1px solid var(--card-border);
  transition: background-color 0.12s;
}
.tier-row:last-child { border-bottom: none; }
.tier-row.drag-over { background-color: var(--input-bg); }

.tier-label {
  width: 76px;
  min-width: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.7rem;
  font-weight: 900;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0,0,0,0.45);
  flex-shrink: 0;
  user-select: none;
}

.tier-decks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  align-items: flex-start;
  flex: 1;
}

.tier-empty-hint {
  align-self: center;
  color: var(--text-muted);
  font-size: 0.7rem;
  padding: 0 0.4rem;
  pointer-events: none;
}

/* ── Deck item ───────────────────────────────────────────────────── */
.tier-deck-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  width: 72px;
  user-select: none;
}

.tier-deck-item.draggable { cursor: grab; }
.tier-deck-item.draggable:active { cursor: grabbing; }
.tier-deck-item.is-dragging { opacity: 0.3; }

.deck-img {
  width: 72px;
  height: 100px;
  object-fit: cover;
  border-radius: 5px;
  border: 1px solid var(--card-border);
  display: block;
}

.deck-img-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--input-bg);
  color: var(--text-muted);
  font-size: 1.4rem;
}

.deck-name {
  font-size: 0.52rem;
  color: var(--text-secondary);
  text-align: center;
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

/* ── Trash zone ──────────────────────────────────────────────────── */
.trash-zone {
  margin-top: 1.2rem;
  border: 2px dashed var(--card-border);
  border-radius: 8px;
  padding: 1rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--text-muted);
  font-size: 0.78rem;
  transition: border-color 0.15s, color 0.15s, background-color 0.15s;
  cursor: default;
  user-select: none;
}

.trash-zone i { font-size: 1.1rem; }

.trash-zone.trash-over {
  border-color: var(--error-color);
  color: var(--error-color);
  background-color: rgba(192, 57, 43, 0.06);
}

/* ── Modal ───────────────────────────────────────────────────────── */
.tl-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.tl-modal {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  width: 100%;
  max-width: 700px;
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.35);
}

.tl-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.2rem 0.8rem;
  border-bottom: 1px solid var(--card-border);
  flex-shrink: 0;
}

.tl-modal-header h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}

.tl-close {
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: var(--text-muted);
  padding: 0.2rem 0.35rem;
  border-radius: 4px;
  line-height: 1;
}
.tl-close:hover { color: var(--text-primary); }

.tl-modal-search {
  padding: 0.6rem 1.2rem;
  border-bottom: 1px solid var(--card-border);
  flex-shrink: 0;
}

.tl-search-input {
  width: 100%;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 6px;
  color: var(--text-primary);
  padding: 0.4rem 0.7rem;
  font-size: 0.78rem;
  outline: none;
  box-sizing: border-box;
}
.tl-search-input:focus { border-color: var(--input-focus); }

.tl-modal-body {
  overflow-y: auto;
  padding: 0.9rem 1.2rem;
  flex: 1;
}

.tl-no-decks {
  color: var(--text-muted);
  text-align: center;
  padding: 2.5rem 1rem;
  font-size: 0.8rem;
}

.deck-pick-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
}

.deck-pick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  background: none;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  padding: 0.5rem;
  cursor: pointer;
  width: 90px;
  transition: border-color 0.15s, background-color 0.15s;
  color: inherit;
  position: relative;
}

.deck-pick-item:hover {
  border-color: var(--text-primary);
  background-color: var(--input-bg);
}

.deck-pick-item.selected {
  border-color: #3f51b5;
  background-color: rgba(63, 81, 181, 0.08);
  position: relative;
}

.pick-check {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  background: #3f51b5;
  color: #fff;
  border-radius: 50%;
  width: 1.1rem;
  height: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  pointer-events: none;
}

.pick-img {
  width: 72px;
  height: 100px;
  object-fit: cover;
  border-radius: 4px;
  display: block;
}

.pick-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--input-bg);
  color: var(--text-muted);
  font-size: 1.4rem;
}

.pick-name {
  font-size: 0.52rem;
  color: var(--text-secondary);
  text-align: center;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tl-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.2rem;
  border-top: 1px solid var(--card-border);
  flex-shrink: 0;
  gap: 0.75rem;
}

.pick-count {
  font-size: 0.75rem;
  color: var(--text-muted);
}
</style>
