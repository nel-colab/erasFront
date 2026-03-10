<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '@/store/login'

const auth   = useAuthStore()
const router = useRouter()

const decks    = ref([])
const cardMap  = ref({})   // id → image_url
const loading  = ref(true)
const deleting = ref(null) // deck id being deleted

const deckCoverUrl = deck =>
  deck.deckImage ? (cardMap.value[deck.deckImage] ?? null) : null

onMounted(async () => {
  try {
    const [decksRes, cardsRes] = await Promise.all([
      axios.get(`/api/drive/decklists?userId=${auth.userId}`),
      axios.get('/api/drive/cards/db'),
    ])
    decks.value = decksRes.data
    cardsRes.data.forEach(c => { cardMap.value[c.id] = c.image_url })
  } catch (e) { console.error('Error loading decks', e) }
  finally { loading.value = false }
})

const editDeck = deck => {
  router.push(`/deck-builder?id=${deck.id}`)
}

const deleteDeck = async deck => {
  if (!confirm(`¿Eliminar el mazo "${deck.deckName}"?`)) return
  deleting.value = deck.id
  try {
    await axios.delete(`/api/drive/decklists/${deck.id}`)
    decks.value = decks.value.filter(d => d.id !== deck.id)
  } catch (e) { console.error('Error deleting deck', e) }
  finally { deleting.value = null }
}
</script>

<template>
  <div class="my-decks-page">
    <h2 class="md-title">Mis mazos</h2>

    <div v-if="loading" class="md-loading">
      <div class="spinner-border text-light" role="status"></div>
    </div>

    <div v-else-if="decks.length === 0" class="md-empty">
      <i class="bi bi-collection md-empty-icon"></i>
      <p>No tienes mazos guardados.</p>
      <router-link to="/deck-builder" class="btn-filled">Crear mazo</router-link>
    </div>

    <div v-else class="md-grid">
      <div v-for="deck in decks" :key="deck.id" class="md-card">
        <!-- Cover image -->
        <div class="md-cover">
          <img v-if="deckCoverUrl(deck)" :src="deckCoverUrl(deck)" :alt="deck.deckName" class="md-cover-img" />
          <div v-else class="md-cover-placeholder">
            <i class="bi bi-collection-fill"></i>
          </div>
          <div class="md-card-count">{{ deck.cards?.length ?? 0 }} cartas</div>
        </div>

        <!-- Info -->
        <div class="md-info">
          <div class="md-name">{{ deck.deckName }}</div>
          <div class="md-actions">
            <button class="md-btn md-btn-edit" @click="editDeck(deck)" title="Editar mazo">
              <i class="bi bi-pencil-fill"></i> Editar
            </button>
            <button class="md-btn md-btn-delete"
              @click="deleteDeck(deck)"
              :disabled="deleting === deck.id"
              title="Eliminar mazo">
              <i class="bi bi-trash-fill"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- FAB to create new deck -->
    <router-link to="/deck-builder" class="md-fab" title="Nuevo mazo">
      <i class="bi bi-plus-lg"></i>
    </router-link>
  </div>
</template>

<style scoped>
.my-decks-page {
  min-height: calc(100vh - 7.5rem);
  padding: 1.5rem 1rem 4rem;
  position: relative;
}

.md-title {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  color: var(--text-primary);
}

.md-loading, .md-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: 40vh;
  color: var(--text-muted);
}

.md-empty-icon {
  font-size: 3rem;
  opacity: 0.4;
}

.md-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.25rem;
}

.md-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}
.md-card:hover {
  box-shadow: 0 4px 20px rgba(0,0,0,0.35);
  transform: translateY(-2px);
}

.md-cover {
  position: relative;
  aspect-ratio: 3/4;
  background: #1a1a1a;
  overflow: hidden;
}
.md-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.md-cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  color: rgba(255,255,255,0.15);
}
.md-card-count {
  position: absolute;
  bottom: 6px;
  right: 8px;
  background: rgba(0,0,0,0.65);
  color: #fff;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 10px;
  backdrop-filter: blur(4px);
}

.md-info {
  padding: 0.6rem 0.75rem 0.75rem;
}
.md-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.md-actions {
  display: flex;
  gap: 0.5rem;
}
.md-btn {
  border: none;
  border-radius: 6px;
  padding: 0.3rem 0.6rem;
  font-size: 0.8rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  transition: opacity 0.1s;
}
.md-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.md-btn-edit {
  background: #3f51b5;
  color: #fff;
  flex: 1;
}
.md-btn-edit:hover:not(:disabled) { background: #5c6bc0; }
.md-btn-delete {
  background: rgba(220,53,69,0.2);
  color: #ff6b6b;
  border: 1px solid rgba(220,53,69,0.4);
}
.md-btn-delete:hover:not(:disabled) {
  background: rgba(220,53,69,0.35);
}

/* btn-filled from global — redefine locally for the empty state */
.btn-filled {
  display: inline-block;
  background: #3f51b5;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.5rem 1.4rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s;
}
.btn-filled:hover { background: #5c6bc0; }

/* FAB */
.md-fab {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #3f51b5;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  text-decoration: none;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  transition: background 0.15s, transform 0.15s;
  z-index: 100;
}
.md-fab:hover {
  background: #5c6bc0;
  transform: scale(1.08);
}
</style>
