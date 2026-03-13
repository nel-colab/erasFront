<script setup>
import { ref, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/store/login'
import { useRouter } from 'vue-router'
import { useHomeStore } from '@/store/home'
import { useEditionsStore } from '@/store/editions'
import { useDecksStore } from '@/store/decks'
import { useCardsStore } from '@/store/cards'

const home          = useHomeStore()
const editionsStore = useEditionsStore()
const decksStore    = useDecksStore()
const cardsStore    = useCardsStore()

const router = useRouter()
const auth   = useAuthStore()

// ── Start loading immediately (before mount) ───────────────────────
editionsStore.load()
decksStore.load()
home.loadHome()   // internally loads cardsStore first, then home content

// ── Newsletter ────────────────────────────────────────────────────
const newsItems = [
  {
    date: 'Mar 11, 2026',
    title: 'Primera edición',
    excerpt: 'También está disponible la primera edición, por favor sientase libre de crear mazos y compartirlos con el resto, su motivación es nuestra motivación.',
    url: '#',
  },
  {
    date: 'Mar 11, 2026',
    title: 'Estructuras',
    excerpt: 'Los mazos de estructura ya están disponibles, puedes verlos en la barra de navecación en la sección de Mazos, también puedes crear los tuyos propios si te registras.',
    url: '#',
  },
  {
    date: 'Mar 11, 2026',
    title: 'Porfin página nueva!',
    excerpt: 'Primera noticia del sistema, aún sin contenido pero con ganas de llenarla de cosas interesantes. Ninguna de las noticias es accessible en profundidad (dicho menú esta en desarollo).',
    url: '#',
  },
]

// ── Computed card map for deck cover images ───────────────────────
const cardMap = computed(() => {
  const m = {}
  cardsStore.driveCards.forEach(c => { m[c.id] = c.image_url })
  return m
})

// ── Modals ─────────────────────────────────────
const showEditionModal = ref(false)
const showDeckModal    = ref(false)
const deckSlotEditing  = ref(null)

const openEditionModal = () => { showEditionModal.value = true }

const openDeckModal = (rank) => {
  deckSlotEditing.value = rank
  showDeckModal.value = true
}

// ── Selection actions ──────────────────────────
const selectEdition = ({ editionId }) => {
  router.push({ path: '/cards', query: { edition: editionId } })
}

const selectDeck = (deck) => {
  const slot = home.topDecks.decks.find(d => d.rank === deckSlotEditing.value)
  if (slot) {
    slot.name      = deck.deckName
    slot.author    = deck.username
    slot.cardImage = deck.deckImage ? (cardMap.value[deck.deckImage] ?? null) : null
    slot.raw       = deck
  }
  showDeckModal.value = false
}

// ── SAVE HOME ─────────────────────────────────
const editMode = ref(false)

const changeToEditMode = () => { editMode.value = true }

const saveHome = async () => {
  try {
    const payload = {
      edition: home.selectedEdition,
      decks: home.topDecks.decks.map((d, i) => ({
        deckPosition: String(i),
        deck: d.raw
      }))
    }
    await axios.post('/api/drive/front-content/home', payload)
    editMode.value = false
  } catch (e) {
    console.error('Error saving home', e)
  }
}

const deckLink = deck =>
  deck.raw ? `/deck-builder?id=${deck.raw.id}&copy=true` : '#'


</script>
<template>
  <div class="page-container">
      <div class="ed-header">
        <button v-if="auth.can('manage_home') && !editMode" class="btn-filled" @click="changeToEditMode">
          + Modo Edición
        </button>
        <button v-if="auth.can('manage_home') && editMode" class="btn-filled" @click="saveHome">
          💾 Guardar Cambios
        </button>
      </div>

    <section class="home-hero">



      <!-- Latest Set Card -->
      <router-link
        v-if="home.selectedEdition"
        :to="{ path: '/cards', query: { edition: home.selectedEdition.editionId } }"
        class="hero-set-card"
        :style="home.latestSet.image ? `background-image:url(${home.latestSet.image})` : ''"
      >
        <div class="hero-set-overlay">

          <p class="hero-eyebrow">
            Latest Set

            <button
              v-if="auth.can('manage_home') && editMode"
              class="btn-modal-edit-name"
              @click.prevent="openEditionModal"
            >
              <i class="bi bi-pencil"></i>
            </button>

          </p>

          <h2 class="hero-title">
            {{ home.latestSet.name }}
          </h2>

          <p class="hero-sub">
            {{ home.latestSet.subtitle }}
          </p>

        </div>
      </router-link>


      <!-- Top decks -->
      <div v-if="home.loaded" class="hero-decks">



        <router-link
          v-for="deck in home.topDecks.decks.slice(0,6)"
          :to="deckLink(deck)"
          :key="deck.rank"
          class="hero-deck"
        >

        <div class="hero-deck-left">

          <span class="hero-deck-rank">
            #{{ deck.rank }}
          </span>

          <div class="hero-deck-info">
            <div class="hero-deck-name">
              {{ deck.name }}
              <button
                v-if="auth.can('manage_home') && editMode"
                class="btn-modal-edit-name"
                @click.prevent="openDeckModal(deck.rank)"
              >
                <i class="bi bi-pencil"></i>
              </button>
            </div>

            <div class="hero-deck-author">
              {{ deck.author }}
            </div>
          </div>

        </div>

        <div v-if="deck.cardImage" class="hero-deck-image">
          <img :src="deck.cardImage">
        </div>

      </router-link>

      </div>


    </section>

    <!-- ── Newsletter ────────────────────────────────────────── -->
    <section class="home-section">
      <div class="section-header">
        <h2 class="section-title">Noticias recientes</h2>
        <a href="#" class="section-link">Ver todas &rarr;</a>
      </div>

      <div class="news-grid">
        <a v-for="item in newsItems" :key="item.title" :href="item.url" class="news-card">
          <span class="news-date">{{ item.date }}</span>
          <h3 class="news-title">{{ item.title }}</h3>
          <p class="news-excerpt">{{ item.excerpt }}</p>
          <span class="section-link">Leer más &rarr;</span>
        </a>
      </div>
    </section>
  </div>

    <!-- ── Edit modals ────────────────────────────────────────── -->
    <div v-if="showEditionModal" class="modal-overlay">

      <div class="modal-box">

        <h3>Elige que edición mostrar</h3>

        <div class="modal-list">
          <div
            v-for="ed in editionsStore.sorted"
            :key="ed.editionId"
            class="modal-item"
            @click="selectEdition(ed)"
          >
            {{ ed.editionId }} - {{ ed.editionName }}
          </div>
        </div>

        <button class="btn-ghost" @click="showEditionModal=false">
          Cancel
        </button>

      </div>

    </div>

    <div v-if="showDeckModal" class="modal-overlay">

      <div class="modal-box">

        <h3>Select Deck</h3>

        <div class="modal-list">

          <div
            v-for="deck in decksStore.publicDecks"
            :key="deck.id"
            class="modal-item"
            @click="selectDeck(deck)"
          >
            {{ deck.deckName }} — {{ deck.username }}
          </div>

        </div>

        <button class="modal-close" @click="showDeckModal=false">
          Cancel
        </button>

      </div>

    </div>
</template>

<style scoped>
.page-container{
  max-width:1600px;
  margin:0 auto;
  padding:0 1.5rem;
}

/* ─── HERO LAYOUT ───────────────────────────── */

.home-hero{
  display:grid;
  grid-template-columns:300px 1fr;
  gap: 1.5rem;
  margin-bottom:1rem;
  align-items:stretch;
}

/* ─── Latest Set Card ───────────────────────── */

.hero-set-card{
  aspect-ratio:5/7;
  width:100%;
  border-radius:10px;
    text-decoration:none;
  color:inherit;

  background-size:cover;
  background-position:center;

  border:1px solid var(--card-border);
  overflow:hidden;

  display:flex;
  align-items:flex-end;

  position:relative;
}

/* overlay gradient */

.hero-set-overlay{
  width:100%;
  padding:1.5rem;

  background:linear-gradient(
    to top,
    rgba(0,0,0,0.9),
    rgba(0,0,0,0.45),
    transparent
  );

  display:flex;
  flex-direction:column;
  gap:0.4rem;
}

/* eyebrow */

.hero-eyebrow{
  font-size:0.7rem;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:0.1em;
  color:rgba(255,255,255,0.7);
  margin:0;
}

/* title */

.hero-title{
  font-size:1.5rem;
  font-weight:800;
  color:white;
  margin:0;
  line-height:1.1;
}

/* subtitle */

.hero-sub{
  font-size:0.85rem;
  color:rgba(255,255,255,0.85);
  margin:0 0 0.5rem;
}


/* ─── TOP DECKS GRID ───────────────────────── */

.hero-decks{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:0.75rem;
}

@media (max-width:1100px){
  .hero-decks{
    grid-template-columns:repeat(2,1fr);
  }
}

@media (max-width:600px){
  .hero-decks{
    grid-template-columns:1fr;
  }
}

.hero-decks-header{
  grid-column:1 / -1;
  font-weight:700;
  margin-bottom:0.3rem;
}

/* deck card */
.hero-deck{
  display:grid;
  grid-template-columns: 1fr 140px;

  background:var(--card-bg);
  border:1px solid var(--card-border);
  border-radius:8px;

  overflow:hidden;
  text-decoration:none;
  color:inherit;

  transition:border-color .15s, box-shadow .15s;
}

.hero-deck:hover{
  border-color:var(--text-muted);
  box-shadow:0 3px 10px rgba(0,0,0,0.25);
}

.hero-deck-cover{
  position:relative;
  width:70px;
  flex-shrink:0;
  overflow:hidden;
  border-left:1px solid var(--card-border);
}

.hero-deck-left{
  display:flex;
  flex-direction:column;
  justify-content:center;
  padding:0.8rem;
  gap:0.15rem;
}

.hero-deck-info{
  display:flex;
  flex-direction:column;
}

.hero-deck-name{
  font-size:1rem;
  font-weight:700;
  color:var(--text-primary);
}

.hero-deck-author{
  font-size:0.85rem;
  color:var(--text-secondary);
}

.hero-deck-rank{
  font-size:1rem;
  font-weight:800;
  color:var(--text-muted);
  min-width:30px;
}

.hero-deck-image{
  position:relative;
  overflow:hidden;
}


.hero-deck-image img{
  position:absolute;
  border-radius: 8px;
  
  top:0;
  left:0;
  width:100%;
  height:100%;

  display:flex;
  align-items:center;
  justify-content:center;
  object-fit:contain;
}



/* ───────────────── NEWS SECTION ───────────────── */

.home-section{
  margin-bottom:3rem;
}

.section-header{
  display:flex;
  align-items:baseline;
  justify-content:space-between;
  margin-bottom:1.25rem;
  border-bottom:1px solid var(--hr-color);
  padding-bottom:0.6rem;
}

.section-title{
  font-size:1.2rem;
  font-weight:700;
  color:var(--text-primary);
  margin:0;
}

.section-link{
  font-size:0.85rem;
  font-weight:600;
  color:var(--text-secondary);
  text-decoration:none;
}

.section-link:hover{
  color:var(--text-primary);
}


/* ───────────────── NEWS GRID ───────────────── */

.news-grid{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:1rem;
}

.news-card{
  display:flex;
  flex-direction:column;
  gap:0.5rem;
  background:var(--card-bg);
  border:1px solid var(--card-border);
  border-radius:8px;
  padding:1.25rem;
  text-decoration:none;
  transition:border-color 0.15s, box-shadow 0.15s;
}

.news-card:hover{
  border-color:var(--text-muted);
  box-shadow:0 2px 8px rgba(0,0,0,0.08);
}

.news-date{
  font-size:0.75rem;
  font-weight:600;
  text-transform:uppercase;
  letter-spacing:0.05em;
  color:var(--text-muted);
}

.news-title{
  font-size:0.95rem;
  font-weight:700;
  color:var(--text-primary);
  margin:0;
}

.news-excerpt{
  font-size:0.85rem;
  color:var(--text-secondary);
  line-height:1.5;
  margin:0;
  flex:1;
}




/* ───────────────── EDIT BUTTON ───────────────── */
.btn-modal-edit-name { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 1rem; padding: 0; line-height: 1; }
.btn-modal-edit-name:hover { color: var(--text-primary); }


/* ───── MODAL ───── */

.modal-overlay{
  position:fixed;
  inset:0;
  background:rgba(0,0,0,0.6);

  display:flex;
  align-items:center;
  justify-content:center;

  z-index:999;
}

.modal-box{
  background:var(--card-bg);
  border:1px solid var(--card-border);
  border-radius:8px;

  padding:1.5rem;
  width:540px;
  max-height:70vh;

  display:flex;
  flex-direction:column;
  gap:1rem;
}

.modal-list{
  overflow:auto;
  display:flex;
  flex-direction:column;
  gap:0.35rem;
}

.modal-item{
  padding:0.5rem 0.6rem;
  border-radius:4px;
  cursor:pointer;
}

.modal-item:hover{
  background:rgba(255,255,255,0.05);
}

.modal-close{
  align-self:flex-end;
}
</style>
