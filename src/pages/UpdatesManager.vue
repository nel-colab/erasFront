<script setup>
import { useCardsStore } from '@/store/cards'
import { ref, onMounted } from 'vue'
import axios from 'axios'

const changes = ref([])
const loading = ref(false)
const applyingAll = ref(false)
const error = ref('')
const successMsg = ref('')
const itemState = ref({}) // { [id]: 'applying' | 'rejecting' | 'done' | 'error' }

const cardsStore = useCardsStore()

const fetchChanges = async () => {
  loading.value = true
  error.value = ''
  try {
    const { data } = await axios.get('/api/drive/staged')
    changes.value = data
    itemState.value = {}
  } catch (e) {
    error.value = e?.response?.data?.error || e.message || 'Failed to load staged changes'
  } finally {
    loading.value = false
  }
}

const applyOne = async (fileId) => {
  itemState.value[fileId] = 'applying'
  successMsg.value = ''
  error.value = ''

  try {
    await axios.post(`/api/drive/staged/apply/${fileId}`)

    // remove from staged list
    changes.value = changes.value.filter(c => c.id !== fileId)

    // 🔹 invalidate cards cache
    await cardsStore.reload()

    successMsg.value = `Change applied: ${fileId}`
  } catch (e) {
    itemState.value[fileId] = 'error'
    error.value = e?.response?.data?.error || e.message || 'Failed to apply change'
  }
}

const rejectOne = async (fileId) => {
  itemState.value[fileId] = 'rejecting'
  successMsg.value = ''
  error.value = ''

  try {
    await axios.delete(`/api/drive/staged/${fileId}`)
    changes.value = changes.value.filter(c => c.id !== fileId)
    successMsg.value = `Change rejected: ${fileId}`
  } catch (e) {
    itemState.value[fileId] = 'error'
    error.value = e?.response?.data?.error || e.message || 'Failed to reject change'
  }
}

const applyAll = async () => {
  applyingAll.value = true
  successMsg.value = ''
  error.value = ''

  try {
    const { data } = await axios.post('/api/drive/staged/apply')

    // 🔹 invalidate cards cache
    await cardsStore.reload()

    successMsg.value = `Applied ${data.applied} change(s) successfully`

    await fetchChanges()
  } catch (e) {
    error.value = e?.response?.data?.error || e.message || 'Failed to apply all changes'
  } finally {
    applyingAll.value = false
  }
}

const formatDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

onMounted(fetchChanges)
</script>

<template>
  <div class="updates-manager">
    <div class="um-header">
      <h2>Manage Updates</h2>
      <div class="um-header-actions">
        <button class="btn-refresh" @click="fetchChanges" :disabled="loading">
          {{ loading ? 'Loading...' : 'Refresh' }}
        </button>
        <button
          class="btn-apply-all"
          @click="applyAll"
          :disabled="applyingAll || changes.length === 0"
        >
          {{ applyingAll ? 'Applying...' : 'Approve All' }}
        </button>
      </div>
    </div>

    <p v-if="successMsg" class="um-success">{{ successMsg }}</p>
    <p v-if="error" class="um-error">{{ error }}</p>

    <div v-if="loading && changes.length === 0" class="um-empty">Loading staged changes...</div>

    <div v-else-if="!loading && changes.length === 0" class="um-empty">
      No staged changes pending.
    </div>

    <div v-else class="um-table-wrapper">
      <table class="um-table">
        <thead>
          <tr>
            <th>Action</th>
            <th>Name</th>
            <th>#</th>
            <th>Color</th>
            <th>Edition</th>
            <th>Sub-edition</th>
            <th>Staged at</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in changes"
            :key="c.id"
            :class="{ 'row-delete': c.action === 'delete', 'row-upsert': c.action === 'upsert' }"
          >
            <td>
              <span class="badge" :class="c.action === 'delete' ? 'badge-delete' : 'badge-upsert'">
                {{ c.action }}
              </span>
            </td>
            <td>
              <div>{{ c.name || '—' }}</div>
              <div class="cell-file">{{ c.fileName || '' }}</div>
            </td>
            <td>{{ c.number ?? '—' }}</td>
            <td>{{ c.colorIdentity || '—' }}</td>
            <td>{{ c.edition || '—' }}</td>
            <td>{{ c.subEdition || '—' }}</td>
            <td class="cell-date">{{ formatDate(c.stagedAt) }}</td>
            <td class="cell-actions">
              <button
                class="btn-apply"
                @click="applyOne(c.id)"
                :disabled="itemState[c.id] === 'applying' || itemState[c.id] === 'rejecting'"
              >
                {{ itemState[c.id] === 'applying' ? '...' : 'Apply' }}
              </button>
              <button
                class="btn-reject"
                @click="rejectOne(c.id)"
                :disabled="itemState[c.id] === 'applying' || itemState[c.id] === 'rejecting'"
              >
                {{ itemState[c.id] === 'rejecting' ? '...' : 'Reject' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.updates-manager {
  padding: 1.5rem 1rem;
}

.um-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.um-header h2 {
  color: var(--text-primary, #fff);
  margin: 0;
}

.um-header-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-refresh,
.btn-apply-all {
  padding: 0.45rem 1.1rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-refresh {
  background: #444;
  color: #fff;
}

.btn-apply-all {
  background: #3f51b5;
  color: #fff;
}

.btn-refresh:disabled,
.btn-apply-all:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.um-success {
  color: #4caf50;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.um-error {
  color: #f44336;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.um-empty {
  text-align: center;
  color: var(--text-muted, #aaa);
  padding: 3rem 1rem;
  font-size: 1.05rem;
}

.um-table-wrapper {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #333;
}

.um-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.um-table thead tr {
  background: #1a1a2e;
  color: #ccc;
  text-align: left;
}

.um-table th,
.um-table td {
  padding: 0.5rem 0.65rem;
  border-bottom: 1px solid #2a2a2a;
  white-space: nowrap;
}

.um-table tbody tr:last-child td {
  border-bottom: none;
}

.um-table tbody tr:hover {
  background: rgba(63, 81, 181, 0.08);
}

.row-delete {
  border-left: 3px solid #f44336;
}

.row-upsert {
  border-left: 3px solid #4caf50;
}

.badge {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.badge-upsert {
  background: rgba(76, 175, 80, 0.2);
  color: #81c784;
}

.badge-delete {
  background: rgba(244, 67, 54, 0.2);
  color: #e57373;
}

.cell-file {
  color: #888;
  font-size: 0.75rem;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.cell-date {
  color: #999;
  font-size: 0.8rem;
}

.cell-actions {
  display: flex;
  gap: 0.4rem;
}

.btn-apply,
.btn-reject {
  padding: 0.3rem 0.7rem;
  border: none;
  border-radius: 5px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  min-width: 52px;
}

.btn-apply {
  background: #4caf50;
  color: #fff;
}

.btn-reject {
  background: #f44336;
  color: #fff;
}

.btn-apply:disabled,
.btn-reject:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
