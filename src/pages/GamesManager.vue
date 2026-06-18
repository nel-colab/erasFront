<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/login'
import { useDecksStore } from '@/store/decks'
import axios from 'axios'
import DeckPicker from '@/components/DeckPicker.vue'

const router     = useRouter()
const auth       = useAuthStore()
const decksStore = useDecksStore()

if (!auth.can('manage_decks')) router.replace('/home')

// ── State ──────────────────────────────────────────────────────────────────
const games      = ref([])
const notes      = ref([])
const loading    = ref(false)
const saving     = ref(false)
const error      = ref(null)
const success    = ref(null)
const deletingId = ref(null)

// Edit state — games
const editGame      = ref(null)   // deep copy of game being edited
const savingEdit    = ref(false)
const editError     = ref(null)

// Edit state — notes
const editNoteId    = ref(null)
const editNoteText  = ref('')
const savingNoteEdit = ref(false)

// Stats modal
const statsOpen   = ref(false)
const statsFilter = ref({ deckName: '', player1: '', player2: '', dateFrom: '', dateTo: '' })
const statsSort   = ref({ field: 'deckName', asc: true })

// Note form
const noteText    = ref('')
const savingNote  = ref(false)
const noteError   = ref(null)

const emptyPlayer = () => ({ playerName: '', deckId: '', lives: [] })

const form = ref({
  player1:     emptyPlayer(),
  player2:     emptyPlayer(),
  winner:      'player1',
  firstPlayer: 'player1',
  comment:     '',
  durationMin: 0,
  durationSec: 0,
})

// ── Decks ──────────────────────────────────────────────────────────────────
const decks   = computed(() => decksStore.publicDecks)
const deckMap = computed(() => {
  const m = {}
  decks.value.forEach(d => { m[d.id] = d })
  return m
})
const deckName = id => deckMap.value[id]?.deckName || id || '—'

// ── Timeline (games + notes merged by date desc) ───────────────────────────
const timeline = computed(() => {
  const items = [
    ...games.value.map(g => ({ type: 'game', data: g, ts: g.createdAt })),
    ...notes.value.map(n => ({ type: 'note', data: n, ts: n.createdAt })),
  ]
  return items.sort((a, b) => (b.ts > a.ts ? 1 : b.ts < a.ts ? -1 : 0))
})

// ── Stats ──────────────────────────────────────────────────────────────────
const statsRows = computed(() => {
  const f  = statsFilter.value
  const p1 = f.player1.trim().toLowerCase()
  const p2 = f.player2.trim().toLowerCase()

  const deckStats = {}

  for (const game of games.value) {
    // Date filter (compare YYYY-MM-DD strings — avoids timezone headaches)
    const gameDate = (game.createdAt || '').slice(0, 10)
    if (f.dateFrom && gameDate < f.dateFrom) continue
    if (f.dateTo   && gameDate > f.dateTo)   continue

    for (const [side, opp] of [['player1', 'player2'], ['player2', 'player1']]) {
      const player   = game[side]
      const opponent = game[opp]
      if (!player?.deckId) continue

      const pName   = (player.playerName   || '').toLowerCase()
      const oppName = (opponent?.playerName || '').toLowerCase()

      if (p1 && !pName.includes(p1))     continue
      if (p2 && !oppName.includes(p2))   continue

      const id = player.deckId
      if (!deckStats[id]) deckStats[id] = { played: 0, won: 0 }
      deckStats[id].played++
      if (game.winner === side) deckStats[id].won++
    }
  }

  const dn = f.deckName.trim().toLowerCase()
  let rows = decks.value
    .filter(d => !dn || (d.deckName || '').toLowerCase().includes(dn))
    .map(d => {
      const s = deckStats[d.id] || { played: 0, won: 0 }
      return { deck: d, played: s.played, won: s.won, ratio: s.played > 0 ? s.won / s.played : 0 }
    })

  if (p1 || p2) rows = rows.filter(r => r.played > 0)

  const { field, asc } = statsSort.value
  rows.sort((a, b) => {
    let va, vb
    if      (field === 'deckName') { va = (a.deck.deckName || '').toLowerCase(); vb = (b.deck.deckName || '').toLowerCase() }
    else if (field === 'played')   { va = a.played;  vb = b.played  }
    else if (field === 'won')      { va = a.won;     vb = b.won     }
    else                           { va = a.ratio;   vb = b.ratio   }
    return va < vb ? (asc ? -1 : 1) : va > vb ? (asc ? 1 : -1) : 0
  })

  return rows
})

// ── Load ───────────────────────────────────────────────────────────────────
onMounted(async () => {
  loading.value = true
  try {
    await decksStore.loadPublic()
    const [gRes, nRes] = await Promise.all([
      axios.get('/api/drive/games'),
      axios.get('/api/drive/game-notes'),
    ])
    games.value = gRes.data
    notes.value = nRes.data
  } catch {
    error.value = 'Error al cargar los datos'
  } finally {
    loading.value = false
  }
})

// ── Submit game ────────────────────────────────────────────────────────────
const submit = async () => {
  saving.value  = true
  error.value   = null
  success.value = null
  try {
    const { durationMin, durationSec, ...rest } = form.value
    const payload = { ...rest, duration: durationMin * 60 + durationSec || null }
    const { data } = await axios.post('/api/drive/games', payload)
    games.value.unshift(data)
    form.value    = {
      player1:     { playerName: form.value.player1.playerName, deckId: form.value.player1.deckId, lives: [] },
      player2:     { playerName: form.value.player2.playerName, deckId: form.value.player2.deckId, lives: [] },
      winner:      'player1',
      firstPlayer: 'player1',
      comment:     '',
      durationMin: 0,
      durationSec: 0,
    }
    success.value = 'Partida registrada'
    setTimeout(() => { success.value = null }, 3000)
  } catch (e) {
    error.value = e?.response?.data?.error || 'Error al registrar la partida'
  } finally {
    saving.value = false
  }
}

// ── Submit note ────────────────────────────────────────────────────────────
const submitNote = async () => {
  if (!noteText.value.trim()) return
  savingNote.value = true
  noteError.value  = null
  try {
    const { data } = await axios.post('/api/drive/game-notes', { text: noteText.value.trim() })
    notes.value.unshift(data)
    noteText.value = ''
  } catch (e) {
    noteError.value = e?.response?.data?.error || 'Error al guardar la nota'
  } finally {
    savingNote.value = false
  }
}

// ── Lives editing ──────────────────────────────────────────────────────────
const LIFE_EMOJI = { up: '🔲', down: '🟦' }

const addLife    = (target, type = 'up') => target.lives.push(type)
const toggleLife = (target, idx) => {
  target.lives[idx] = target.lives[idx] === 'up' ? 'down' : 'up'
}
const removeLife = (target, idx) => target.lives.splice(idx, 1)

// ── Edit game ──────────────────────────────────────────────────────────────
const openEditGame = game => {
  const copy = JSON.parse(JSON.stringify(game))
  if (!copy.player1) copy.player1 = emptyPlayer()
  if (!copy.player2) copy.player2 = emptyPlayer()
  if (!Array.isArray(copy.player1.lives)) copy.player1.lives = []
  if (!Array.isArray(copy.player2.lives)) copy.player2.lives = []
  copy.durationMin = copy.duration ? Math.floor(copy.duration / 60) : 0
  copy.durationSec = copy.duration ? copy.duration % 60 : 0
  editGame.value = copy
  editError.value = null
}

const saveEditGame = async () => {
  savingEdit.value = true
  editError.value  = null
  try {
    const { durationMin, durationSec, ...rest } = editGame.value
    const payload = { ...rest, duration: durationMin * 60 + durationSec || null }
    const { data } = await axios.put(`/api/drive/games/${editGame.value.id}`, payload)
    const idx = games.value.findIndex(g => g.id === data.id)
    if (idx !== -1) games.value[idx] = data
    editGame.value = null
  } catch (e) {
    editError.value = e?.response?.data?.error || 'Error al guardar'
  } finally {
    savingEdit.value = false
  }
}

// ── Edit note ──────────────────────────────────────────────────────────────
const openEditNote = note => {
  editNoteId.value   = note.id
  editNoteText.value = note.text
}

const saveEditNote = async () => {
  if (!editNoteText.value.trim()) return
  savingNoteEdit.value = true
  try {
    const { data } = await axios.put(`/api/drive/game-notes/${editNoteId.value}`, { text: editNoteText.value.trim() })
    const idx = notes.value.findIndex(n => n.id === data.id)
    if (idx !== -1) notes.value[idx] = data
    editNoteId.value = null
  } catch {
    // silently keep open
  } finally {
    savingNoteEdit.value = false
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────
const deleteItem = async (type, id) => {
  const key = `${type}:${id}`
  if (deletingId.value === key) {
    const url = type === 'game' ? `/api/drive/games/${id}` : `/api/drive/game-notes/${id}`
    try {
      await axios.delete(url)
      if (type === 'game') games.value = games.value.filter(g => g.id !== id)
      else notes.value = notes.value.filter(n => n.id !== id)
    } catch {
      error.value = 'Error al eliminar'
    } finally {
      deletingId.value = null
    }
  } else {
    deletingId.value = key
    setTimeout(() => { if (deletingId.value === key) deletingId.value = null }, 3000)
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
const formatDate = iso => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const winnerLabel = g => g.winner === 'player1' ? g.player1?.playerName : g.player2?.playerName
const firstLabel  = g => g.firstPlayer === 'player1' ? g.player1?.playerName : g.player2?.playerName

const formatDuration = secs => {
  if (!secs) return null
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const livesDisplay = (lives = []) => {
  if (!lives || lives.length === 0) return '—'
  return lives.map(l => l === 'up' ? '🔲' : '🟦').join('')
}
</script>

<template>
  <div class="gm-page">

    <div class="gm-header">
      <h2 class="gm-title">Registro de partidas</h2>
      <button class="btn-ghost btn-sm" @click="statsOpen = true">
        <i class="bi bi-bar-chart-line"></i> Estadísticas
      </button>
    </div>

    <!-- ── Game form ─────────────────────────────────────────────────────── -->
    <div class="gm-card">
      <h3 class="section-title">Nueva partida</h3>

      <div class="players-grid">
        <div class="player-block" v-for="pKey in ['player1', 'player2']" :key="pKey">
          <div class="player-heading">{{ pKey === 'player1' ? 'Jugador 1' : 'Jugador 2' }}</div>

          <label class="gm-label">Nombre</label>
          <input v-model="form[pKey].playerName" type="text" class="gm-input" placeholder="Nombre del jugador" />

          <label class="gm-label">Mazo</label>
          <DeckPicker v-model="form[pKey].deckId" :decks="decks" />

          <label class="gm-label">Vidas</label>
          <div class="lives-editor">
            <div class="lives-add-row">
              <button type="button" class="life-add" title="Agregar vida boca arriba" @click="addLife(form[pKey], 'up')">🔲<span class="life-add-plus">+</span></button>
              <button type="button" class="life-add" title="Agregar vida boca abajo" @click="addLife(form[pKey], 'down')">🟦<span class="life-add-plus">+</span></button>
            </div>
            <div class="lives-list">
              <button
                v-for="(life, idx) in form[pKey].lives"
                :key="idx"
                type="button"
                class="life-btn"
                :title="life === 'up' ? 'Boca arriba — clic voltear, doble clic quitar' : 'Boca abajo — clic voltear, doble clic quitar'"
                @click="toggleLife(form[pKey], idx)"
                @dblclick.prevent="removeLife(form[pKey], idx)"
              >{{ LIFE_EMOJI[life] }}</button>
            </div>
          </div>
        </div>
      </div>

      <div class="meta-row">
        <div class="meta-group" v-for="field in [{ key: 'firstPlayer', label: 'Primer jugador' }, { key: 'winner', label: 'Ganador' }]" :key="field.key">
          <span class="gm-label">{{ field.label }}</span>
          <div class="radio-group">
            <label class="radio-opt">
              <input type="radio" v-model="form[field.key]" value="player1" />
              <span>{{ form.player1.playerName || 'Jugador 1' }}</span>
            </label>
            <label class="radio-opt">
              <input type="radio" v-model="form[field.key]" value="player2" />
              <span>{{ form.player2.playerName || 'Jugador 2' }}</span>
            </label>
          </div>
        </div>
      </div>

      <label class="gm-label">Duración (opcional)</label>
      <div class="duration-row">
        <input v-model.number="form.durationMin" type="number" min="0" max="999" class="gm-input duration-input" placeholder="0" />
        <span class="duration-sep">min</span>
        <input v-model.number="form.durationSec" type="number" min="0" max="59" class="gm-input duration-input" placeholder="0" />
        <span class="duration-sep">seg</span>
      </div>

      <label class="gm-label">Comentario de la partida (opcional)</label>
      <textarea
        v-model="form.comment"
        class="gm-input gm-textarea"
        placeholder="Notas sobre esta partida…"
        rows="2"
      ></textarea>

      <div v-if="error"   class="gm-error">{{ error }}</div>
      <div v-if="success" class="gm-success">{{ success }}</div>

      <button @click="submit" class="btn-filled btn-sm gm-submit" :disabled="saving">
        {{ saving ? 'Registrando…' : 'Registrar partida' }}
      </button>
    </div>

    <!-- ── Note form ──────────────────────────────────────────────────────── -->
    <div class="gm-card note-form-card">
      <h3 class="section-title">Añadir nota</h3>
      <div class="note-form-row">
        <textarea
          v-model="noteText"
          class="gm-input gm-textarea note-textarea"
          placeholder="Anota cambios, observaciones o cualquier contexto entre partidas…"
          rows="2"
          @keydown.ctrl.enter="submitNote"
        ></textarea>
        <button
          @click="submitNote"
          class="btn-ghost btn-sm note-submit"
          :disabled="savingNote || !noteText.trim()"
        >
          <i class="bi bi-send"></i>
        </button>
      </div>
      <div v-if="noteError" class="gm-error" style="margin-top:0.4rem">{{ noteError }}</div>
      <span class="note-hint">Ctrl+Enter para enviar</span>
    </div>

    <!-- ── Timeline ───────────────────────────────────────────────────────── -->
    <div class="gm-card">
      <h3 class="section-title">Historial</h3>

      <div v-if="loading" class="gm-loading">Cargando…</div>

      <div v-else-if="timeline.length === 0" class="gm-empty">No hay registros aún.</div>

      <div v-else class="timeline">
        <template v-for="item in timeline" :key="item.data.id">

          <!-- ── Game entry ── -->
          <div v-if="item.type === 'game'" class="tl-entry tl-game">
            <div class="tl-icon game-icon"><i class="bi bi-controller"></i></div>
            <div class="tl-body">
              <div class="tl-date">{{ formatDate(item.data.createdAt) }}</div>
              <div class="game-row">
                <!-- Player 1 -->
                <div class="game-player" :class="{ winner: item.data.winner === 'player1' }">
                  <span class="p-name">
                    {{ item.data.player1?.playerName || '—' }}
                    <span v-if="item.data.firstPlayer === 'player1'" class="first-badge" title="Primer jugador">1°</span>
                    <i v-if="item.data.winner === 'player1'" class="bi bi-trophy-fill trophy"></i>
                  </span>
                  <span class="p-deck">{{ deckName(item.data.player1?.deckId) }}</span>
                  <span class="p-lives">{{ livesDisplay(item.data.player1?.lives) }}</span>
                </div>

                <span class="vs">VS</span>

                <!-- Player 2 -->
                <div class="game-player" :class="{ winner: item.data.winner === 'player2' }">
                  <span class="p-name">
                    {{ item.data.player2?.playerName || '—' }}
                    <span v-if="item.data.firstPlayer === 'player2'" class="first-badge" title="Primer jugador">1°</span>
                    <i v-if="item.data.winner === 'player2'" class="bi bi-trophy-fill trophy"></i>
                  </span>
                  <span class="p-deck">{{ deckName(item.data.player2?.deckId) }}</span>
                  <span class="p-lives">{{ livesDisplay(item.data.player2?.lives) }}</span>
                </div>
              </div>

              <!-- Duration -->
              <div v-if="item.data.duration" class="game-duration">
                <i class="bi bi-clock"></i> {{ formatDuration(item.data.duration) }}
              </div>

              <!-- Game comment -->
              <div v-if="item.data.comment" class="game-comment">
                <i class="bi bi-chat-left-text"></i> {{ item.data.comment }}
              </div>
            </div>
            <div class="tl-actions">
              <button class="btn-edit" title="Editar" @click="openEditGame(item.data)">
                <i class="bi bi-pencil"></i>
              </button>
              <button
                class="btn-delete"
                :title="deletingId === `game:${item.data.id}` ? 'Confirmar' : 'Eliminar'"
                @click="deleteItem('game', item.data.id)"
              >
                <i :class="deletingId === `game:${item.data.id}` ? 'bi bi-check-lg' : 'bi bi-trash3'"></i>
              </button>
            </div>
          </div>

          <!-- ── Note entry ── -->
          <div v-else class="tl-entry tl-note">
            <div class="tl-icon note-icon"><i class="bi bi-pencil-square"></i></div>
            <div class="tl-body">
              <div class="tl-date">{{ formatDate(item.data.createdAt) }}</div>
              <template v-if="editNoteId === item.data.id">
                <textarea
                  v-model="editNoteText"
                  class="gm-input gm-textarea"
                  rows="2"
                  @keydown.escape="editNoteId = null"
                  autofocus
                ></textarea>
                <div class="note-edit-actions">
                  <button class="btn-filled btn-sm" :disabled="savingNoteEdit" @click="saveEditNote">
                    {{ savingNoteEdit ? 'Guardando…' : 'Guardar' }}
                  </button>
                  <button class="btn-ghost btn-sm" @click="editNoteId = null">Cancelar</button>
                </div>
              </template>
              <p v-else class="note-text">{{ item.data.text }}</p>
            </div>
            <div class="tl-actions" v-if="editNoteId !== item.data.id">
              <button class="btn-edit" title="Editar" @click="openEditNote(item.data)">
                <i class="bi bi-pencil"></i>
              </button>
              <button
                class="btn-delete"
                :title="deletingId === `note:${item.data.id}` ? 'Confirmar' : 'Eliminar'"
                @click="deleteItem('note', item.data.id)"
              >
                <i :class="deletingId === `note:${item.data.id}` ? 'bi bi-check-lg' : 'bi bi-trash3'"></i>
              </button>
            </div>
          </div>

        </template>
      </div>
    </div>

  </div>

  <!-- ── Stats modal ─────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <div v-if="statsOpen" class="em-overlay" @click.self="statsOpen = false">
      <div class="em-modal st-modal">

        <div class="em-header">
          <h3><i class="bi bi-bar-chart-line"></i> Estadísticas de mazos</h3>
          <button class="tl-close" @click="statsOpen = false">✕</button>
        </div>

        <!-- Filters -->
        <div class="st-filters">
          <div class="st-filter-group">
            <label class="gm-label">Mazo</label>
            <input v-model="statsFilter.deckName" type="text" class="gm-input" placeholder="Buscar mazo…" />
          </div>
          <div class="st-filter-group">
            <label class="gm-label">Jugador 1</label>
            <input v-model="statsFilter.player1" type="text" class="gm-input" placeholder="Nombre…" />
          </div>
          <div class="st-filter-group">
            <label class="gm-label">Jugador 2 (oponente)</label>
            <input v-model="statsFilter.player2" type="text" class="gm-input" placeholder="Nombre…" />
          </div>
          <div class="st-filter-group">
            <label class="gm-label">Desde</label>
            <input v-model="statsFilter.dateFrom" type="date" class="gm-input" />
          </div>
          <div class="st-filter-group">
            <label class="gm-label">Hasta</label>
            <input v-model="statsFilter.dateTo" type="date" class="gm-input" />
          </div>
        </div>

        <!-- Sort controls -->
        <div class="st-sort-row">
          <span class="gm-label" style="margin:0">Ordenar por:</span>
          <button
            v-for="opt in [
              { field: 'deckName', label: 'Mazo' },
              { field: 'played',   label: 'Jugadas' },
              { field: 'won',      label: 'Ganadas' },
              { field: 'ratio',    label: 'Win %' },
            ]"
            :key="opt.field"
            type="button"
            class="st-sort-btn"
            :class="{ active: statsSort.field === opt.field }"
            @click="statsSort.field === opt.field ? statsSort.asc = !statsSort.asc : (statsSort.field = opt.field, statsSort.asc = true)"
          >
            {{ opt.label }}
            <i
              v-if="statsSort.field === opt.field"
              :class="statsSort.asc ? 'bi bi-sort-up' : 'bi bi-sort-down'"
            ></i>
          </button>
        </div>

        <!-- Table -->
        <div class="st-table-wrap">
          <div v-if="statsRows.length === 0" class="gm-empty">Sin resultados.</div>
          <table v-else class="st-table">
            <thead>
              <tr>
                <th></th>
                <th>Mazo</th>
                <th class="st-num">Jugadas</th>
                <th class="st-num">Ganadas</th>
                <th class="st-num">Win %</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in statsRows" :key="row.deck.id">
                <td class="st-thumb-cell">
                  <img v-if="row.deck.deckImage" :src="row.deck.deckImage" class="st-thumb" alt="" />
                  <div v-else class="st-thumb st-thumb-empty">?</div>
                </td>
                <td class="st-name">{{ row.deck.deckName }}</td>
                <td class="st-num">{{ row.played }}</td>
                <td class="st-num">{{ row.won }}</td>
                <td class="st-num">
                  <span v-if="row.played > 0" :class="['st-ratio', row.ratio >= 0.5 ? 'ratio-good' : 'ratio-bad']">
                    {{ (row.ratio * 100).toFixed(0) }}%
                  </span>
                  <span v-else class="st-ratio ratio-none">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  </Teleport>

  <!-- ── Edit game modal ───────────────────────────────────────────────────── -->
  <Teleport to="body">
    <div v-if="editGame" class="em-overlay" @click.self="editGame = null">
      <div class="em-modal">
        <div class="em-header">
          <h3>Editar partida</h3>
          <button class="tl-close" @click="editGame = null">✕</button>
        </div>
        <div class="em-body">
          <div class="players-grid">
            <div class="player-block" v-for="pKey in ['player1', 'player2']" :key="pKey">
              <div class="player-heading">{{ pKey === 'player1' ? 'Jugador 1' : 'Jugador 2' }}</div>

              <label class="gm-label">Nombre</label>
              <input v-model="editGame[pKey].playerName" type="text" class="gm-input" placeholder="Nombre del jugador" />

              <label class="gm-label">Mazo</label>
              <DeckPicker v-model="editGame[pKey].deckId" :decks="decks" />

              <label class="gm-label">Vidas</label>
              <div class="lives-editor">
                <div class="lives-add-row">
                  <button type="button" class="life-add" title="Agregar vida boca arriba" @click="addLife(editGame[pKey], 'up')">🔲<span class="life-add-plus">+</span></button>
                  <button type="button" class="life-add" title="Agregar vida boca abajo" @click="addLife(editGame[pKey], 'down')">🟦<span class="life-add-plus">+</span></button>
                </div>
                <div class="lives-list">
                  <button
                    v-for="(life, idx) in editGame[pKey].lives"
                    :key="idx"
                    type="button"
                    class="life-btn"
                    :title="life === 'up' ? 'Boca arriba — clic voltear, doble clic quitar' : 'Boca abajo — clic voltear, doble clic quitar'"
                    @click="toggleLife(editGame[pKey], idx)"
                    @dblclick.prevent="removeLife(editGame[pKey], idx)"
                  >{{ LIFE_EMOJI[life] }}</button>
                </div>
              </div>
            </div>
          </div>

          <div class="meta-row">
            <div class="meta-group" v-for="field in [{ key: 'firstPlayer', label: 'Primer jugador' }, { key: 'winner', label: 'Ganador' }]" :key="field.key">
              <span class="gm-label">{{ field.label }}</span>
              <div class="radio-group">
                <label class="radio-opt">
                  <input type="radio" v-model="editGame[field.key]" value="player1" />
                  <span>{{ editGame.player1.playerName || 'Jugador 1' }}</span>
                </label>
                <label class="radio-opt">
                  <input type="radio" v-model="editGame[field.key]" value="player2" />
                  <span>{{ editGame.player2.playerName || 'Jugador 2' }}</span>
                </label>
              </div>
            </div>
          </div>

          <label class="gm-label">Duración (opcional)</label>
          <div class="duration-row">
            <input v-model.number="editGame.durationMin" type="number" min="0" max="999" class="gm-input duration-input" placeholder="0" />
            <span class="duration-sep">min</span>
            <input v-model.number="editGame.durationSec" type="number" min="0" max="59" class="gm-input duration-input" placeholder="0" />
            <span class="duration-sep">seg</span>
          </div>

          <label class="gm-label">Comentario (opcional)</label>
          <textarea v-model="editGame.comment" class="gm-input gm-textarea" rows="2" placeholder="Notas sobre esta partida…"></textarea>

          <div v-if="editError" class="gm-error">{{ editError }}</div>
        </div>
        <div class="em-footer">
          <button class="btn-ghost btn-sm" @click="editGame = null">Cancelar</button>
          <button class="btn-filled btn-sm" :disabled="savingEdit" @click="saveEditGame">
            {{ savingEdit ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

</template>

<style scoped>
.gm-page {
  padding: 5.5rem 1.5rem 4rem;
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.gm-header { margin-bottom: 0.25rem; }

.gm-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.gm-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 1.4rem 1.6rem;
  box-shadow: var(--card-shadow);
}

.section-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 1.1rem;
}

/* ── Game form ────────────────────────────────────────────────────── */
.players-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.2rem;
  margin-bottom: 1rem;
}
@media (max-width: 600px) { .players-grid { grid-template-columns: 1fr; } }

.player-block {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.9rem;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  background: var(--input-bg);
}

.player-heading {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-primary);
  margin-bottom: 0.3rem;
}

.gm-label {
  font-size: 0.68rem;
  color: var(--text-muted);
  font-weight: 600;
  margin-top: 0.25rem;
}

.gm-input {
  background: var(--card-bg);
  border: 1px solid var(--input-border);
  border-radius: 6px;
  color: var(--text-primary);
  padding: 0.35rem 0.6rem;
  font-size: 0.76rem;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}
.gm-input:focus { border-color: var(--input-focus); }

.gm-textarea { resize: vertical; font-family: inherit; }

.lives-editor {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-top: 0.15rem;
}

.lives-add-row {
  display: flex;
  gap: 0.3rem;
}

.lives-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  min-height: 1.6rem;
}

.life-btn {
  background: none;
  border: 1px solid var(--card-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0.2rem 0.25rem;
  transition: border-color 0.12s, transform 0.1s;
  user-select: none;
}
.life-btn:hover { border-color: var(--input-focus); transform: scale(1.15); }

.life-add {
  background: none;
  border: 1px dashed var(--card-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  line-height: 1;
  padding: 0.2rem 0.25rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 0;
  transition: border-color 0.12s;
}
.life-add:hover { border-color: var(--input-focus); }
.life-add-plus { font-size: 0.65rem; font-weight: 700; margin-left: 0.1rem; }

.duration-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}
.duration-input { width: 64px; text-align: center; }
.duration-sep { font-size: 0.72rem; color: var(--text-muted); }

.game-duration {
  margin-top: 0.3rem;
  font-size: 0.65rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.meta-row { display: flex; gap: 2rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
.meta-group { display: flex; flex-direction: column; gap: 0.35rem; }

.radio-group { display: flex; gap: 1rem; }
.radio-opt {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.76rem;
  color: var(--text-primary);
  cursor: pointer;
}
.radio-opt input { cursor: pointer; }

.gm-error   { color: var(--error-color);   font-size: 0.75rem; margin: 0.5rem 0; }
.gm-success { color: var(--success-color); font-size: 0.75rem; margin: 0.5rem 0; }
.gm-submit  { margin-top: 0.5rem; }

/* ── Note form ────────────────────────────────────────────────────── */
.note-form-card { padding-bottom: 1rem; }

.note-form-row {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
}

.note-textarea { flex: 1; min-height: 56px; }

.note-submit {
  flex-shrink: 0;
  align-self: flex-end;
  padding: 0.4rem 0.7rem;
}

.note-hint {
  font-size: 0.62rem;
  color: var(--text-muted);
  margin-top: 0.3rem;
  display: block;
}

/* ── Timeline ─────────────────────────────────────────────────────── */
.gm-loading, .gm-empty {
  color: var(--text-muted);
  font-size: 0.8rem;
  text-align: center;
  padding: 2rem;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.tl-entry {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.75rem 0.9rem;
  border-radius: 8px;
  border: 1px solid var(--card-border);
  background: var(--input-bg);
}

.tl-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  flex-shrink: 0;
  margin-top: 0.05rem;
}

.game-icon { background: rgba(63, 81, 181, 0.15); color: #3f51b5; }
.note-icon { background: rgba(253, 203, 110, 0.2); color: #c9a84c; }

.tl-body { flex: 1; min-width: 0; }

.tl-date {
  font-size: 0.62rem;
  color: var(--text-muted);
  margin-bottom: 0.4rem;
}

/* Game layout */
.game-row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  flex-wrap: wrap;
}

.game-player {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 130px;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  flex: 1;
}

.game-player.winner {
  border-color: var(--success-color);
  background: rgba(39, 174, 96, 0.05);
}

.p-name {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.trophy { color: #f0c040; font-size: 0.72rem; }

.first-badge {
  font-size: 0.55rem;
  background: rgba(63, 81, 181, 0.15);
  color: #3f51b5;
  border-radius: 3px;
  padding: 0.05rem 0.25rem;
  font-weight: 700;
}

.p-deck {
  font-size: 0.65rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.p-lives {
  font-size: 0.62rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.vs {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--text-muted);
  flex-shrink: 0;
}

.game-comment {
  margin-top: 0.5rem;
  font-size: 0.7rem;
  color: var(--text-secondary);
  background: var(--card-bg);
  border-left: 2px solid var(--card-border);
  padding: 0.3rem 0.6rem;
  border-radius: 0 4px 4px 0;
  display: flex;
  gap: 0.4rem;
  align-items: flex-start;
}
.game-comment i { flex-shrink: 0; margin-top: 0.1rem; color: var(--text-muted); }

/* Note layout */
.note-text {
  font-size: 0.76rem;
  color: var(--text-primary);
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.5;
}

/* Action buttons group */
.tl-actions {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex-shrink: 0;
  align-self: flex-start;
}

.btn-edit {
  background: none;
  border: 1px solid transparent;
  border-radius: 5px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  font-size: 0.75rem;
  transition: color 0.15s, border-color 0.15s;
}
.btn-edit:hover { color: #3f51b5; border-color: #3f51b5; }

.note-edit-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.4rem;
}

/* Delete button */
.btn-delete {
  background: none;
  border: 1px solid transparent;
  border-radius: 5px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  font-size: 0.75rem;
  flex-shrink: 0;
  transition: color 0.15s, border-color 0.15s;
  align-self: flex-start;
}
.btn-delete:hover { color: var(--error-color); border-color: var(--error-color); }

/* ── Edit modal ───────────────────────────────────────────────────── */
.em-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.em-modal {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  width: 100%;
  max-width: 1000px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 40px rgba(0,0,0,0.35);
}

.em-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.2rem 0.8rem;
  border-bottom: 1px solid var(--card-border);
  flex-shrink: 0;
}

.em-header h3 {
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

.em-body {
  overflow-y: auto;
  padding: 1.2rem 1.4rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.em-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.8rem 1.2rem;
  border-top: 1px solid var(--card-border);
  flex-shrink: 0;
}

/* ── Header button ────────────────────────────────────────────────── */
.gm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

/* ── Stats modal ──────────────────────────────────────────────────── */
.st-modal {
  max-width: 780px;
  max-height: 90vh;
}

.st-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem 1rem;
  padding: 0.9rem 1.2rem;
  border-bottom: 1px solid var(--card-border);
  flex-shrink: 0;
}

.st-filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 130px;
  flex: 1;
}

.st-sort-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  padding: 0.55rem 1.2rem;
  border-bottom: 1px solid var(--card-border);
  flex-shrink: 0;
}

.st-sort-btn {
  background: none;
  border: 1px solid var(--card-border);
  border-radius: 5px;
  color: var(--text-secondary);
  font-size: 0.7rem;
  padding: 0.2rem 0.55rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  transition: border-color 0.12s, color 0.12s;
}
.st-sort-btn:hover  { border-color: var(--input-focus); color: var(--text-primary); }
.st-sort-btn.active { border-color: #3f51b5; color: #3f51b5; font-weight: 700; }

.st-table-wrap {
  overflow-y: auto;
  overflow-x: auto;
  flex: 1;
  padding: 0.6rem 1.2rem 1rem;
}

.st-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.76rem;
}

.st-table th {
  text-align: left;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--card-border);
}

.st-table td {
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--card-border);
  vertical-align: middle;
  color: var(--text-primary);
}

.st-table tbody tr:hover { background: var(--input-bg); }

.st-num { text-align: right; }

.st-thumb-cell { width: 36px; }
.st-thumb {
  width: 28px;
  height: 38px;
  object-fit: cover;
  border-radius: 3px;
  border: 1px solid var(--card-border);
  display: block;
}
.st-thumb-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--input-bg);
  color: var(--text-muted);
  font-size: 0.7rem;
}

.st-name {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.st-ratio { font-weight: 700; font-size: 0.72rem; }
.ratio-good { color: var(--success-color); }
.ratio-bad  { color: var(--error-color); }
.ratio-none { color: var(--text-muted); font-weight: 400; }
</style>
