<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/store/login'
import axios from 'axios'

const auth = useAuthStore()

const permissions = ref([])
const loading = ref(false)
const error = ref('')
const successMsg = ref('')

const newName = ref('')
const newDescription = ref('')
const creating = ref(false)

const editingId = ref(null)
const editingName = ref('')
const editingDescription = ref('')
const saving = ref(false)

const deletingId = ref(null)

const fetch = async () => {
  loading.value = true
  error.value = ''
  try {
    const { data } = await axios.get('/api/permissions')
    permissions.value = data
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Error al cargar permisos'
  } finally {
    loading.value = false
  }
}

const create = async () => {
  if (!newName.value.trim()) return
  creating.value = true
  error.value = ''
  successMsg.value = ''
  try {
    const { data } = await axios.post('/api/permissions', {
      name: newName.value.trim(),
      description: newDescription.value.trim() || null,
    })
    permissions.value.push(data)
    newName.value = ''
    newDescription.value = ''
    successMsg.value = 'Permiso creado correctamente'
  } catch (e) {
    error.value = e?.response?.data?.error || e?.response?.data?.message || e.message || 'Error al crear permiso'
  } finally {
    creating.value = false
  }
}

const startEdit = (p) => {
  editingId.value = p.id
  editingName.value = p.name
  editingDescription.value = p.description || ''
}

const cancelEdit = () => {
  editingId.value = null
  editingName.value = ''
  editingDescription.value = ''
}

const saveEdit = async (p) => {
  if (!editingName.value.trim()) return
  saving.value = true
  error.value = ''
  successMsg.value = ''
  try {
    const { data } = await axios.put(`/api/permissions/${p.id}`, {
      newName: editingName.value.trim(),
      description: editingDescription.value.trim() || null,
    })
    const idx = permissions.value.findIndex(x => x.id === p.id)
    if (idx !== -1) permissions.value[idx] = data
    cancelEdit()
    successMsg.value = 'Permiso actualizado'
  } catch (e) {
    error.value = e?.response?.data?.error || e?.response?.data?.message || e.message || 'Error al actualizar permiso'
  } finally {
    saving.value = false
  }
}

const remove = async (p) => {
  deletingId.value = p.id
  error.value = ''
  successMsg.value = ''
  try {
    await axios.delete(`/api/permissions/${p.id}`)
    permissions.value = permissions.value.filter(x => x.id !== p.id)
    successMsg.value = 'Permiso eliminado'
  } catch (e) {
    error.value = e?.response?.data?.error || e?.response?.data?.message || e.message || 'Error al eliminar permiso'
  } finally {
    deletingId.value = null
  }
}

onMounted(fetch)
</script>

<template>
  <div class="manager-page">
    <div class="manager-header">
      <h1 class="manager-title">Permisos</h1>
      <button class="btn-filled" @click="fetch" :disabled="loading">
        <i class="bi bi-arrow-clockwise"></i> Recargar
      </button>
    </div>

    <p v-if="successMsg" class="alert-success-msg">{{ successMsg }}</p>
    <p v-if="error" class="alert-error-msg">{{ error }}</p>

    <!-- Create -->
    <div class="create-card"  v-if="auth.can('manage_permissions')">
      <div class="create-fields">
        <input
          v-model="newName"
          class="form-control-t"
          placeholder="Nombre del permiso"
          @keyup.enter="create"
        />
        <input
          v-model="newDescription"
          class="form-control-t"
          placeholder="Descripción (opcional)"
          @keyup.enter="create"
        />
      </div>
      <button class="btn-filled" @click="create" :disabled="creating || !newName.trim()">
        <i class="bi bi-plus-lg"></i> {{ creating ? 'Creando…' : 'Crear' }}
      </button>
    </div>

    <!-- Edit panel -->
    <div v-if="editingId && auth.can('manage_permissions')" class="edit-panel" >
      <h3 class="edit-panel-title">Editar permiso</h3>
      <div class="edit-fields">
        <div class="form-group-t">
          <label class="form-label-t">Nombre</label>
          <input v-model="editingName" class="form-control-t" @keyup.escape="cancelEdit" />
        </div>
        <div class="form-group-t">
          <label class="form-label-t">Descripción</label>
          <input v-model="editingDescription" class="form-control-t" placeholder="Descripción (opcional)" @keyup.escape="cancelEdit" />
        </div>
      </div>
      <div class="edit-actions">
        <button class="btn-filled" @click="saveEdit(permissions.find(p => p.id === editingId))" :disabled="saving || !editingName.trim()">
          {{ saving ? 'Guardando…' : 'Guardar cambios' }}
        </button>
        <button class="btn-outline" @click="cancelEdit">Cancelar</button>
      </div>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <div v-if="loading" class="empty-state">Cargando…</div>
      <div v-else-if="!permissions.length" class="empty-state">No hay permisos registrados.</div>
      <table v-else class="mgr-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Descripción</th>
            <th style="width: 100px" v-if="auth.can('manage_permissions')">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in permissions" :key="p.id" :class="{ 'row-editing': editingId === p.id }">
            <td class="cell-name">{{ p.name }}</td>
            <td class="cell-desc">{{ p.description || '—' }}</td>
            <td class="action-cell"  v-if="auth.can('manage_permissions')">
              <button class="btn-sm-ghost" @click="startEdit(p)" :disabled="!!editingId && editingId !== p.id">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn-sm-danger" @click="remove(p)" :disabled="deletingId === p.id" >
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.manager-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.manager-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.manager-title {
  font-size: 1.6rem;
  font-weight: 800;
  margin: 0;
  color: var(--text-primary);
}

.alert-success-msg {
  background: rgba(39,174,96,0.1);
  border: 1px solid rgba(39,174,96,0.35);
  border-left: 4px solid var(--success-color);
  border-radius: 8px;
  color: var(--success-color);
  padding: 0.65rem 1rem;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}
.alert-error-msg {
  background: rgba(192,57,43,0.1);
  border: 1px solid rgba(192,57,43,0.35);
  border-left: 4px solid var(--error-color);
  border-radius: 8px;
  color: var(--error-color);
  padding: 0.65rem 1rem;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

/* Create */
.create-card {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
  margin-bottom: 1.25rem;
}
.create-fields {
  display: flex;
  gap: 0.6rem;
  flex: 1;
}
.create-fields .form-control-t { flex: 1; }

/* Edit panel */
.edit-panel {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.25rem;
  box-shadow: var(--card-shadow);
}
.edit-panel-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--hr-color);
}
.edit-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.edit-actions {
  display: flex;
  gap: 0.6rem;
  margin-top: 1rem;
}

.btn-outline {
  padding: 0.5rem 1.25rem;
  border-radius: 8px;
  border: 1px solid var(--card-border);
  background: transparent;
  color: var(--text-primary);
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-outline:hover { background: var(--hover-bg, rgba(0,0,0,0.05)); }

/* Table */
.table-wrap {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  overflow: hidden;
}
.mgr-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.mgr-table th {
  background: var(--card-bg);
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--card-border);
  text-align: left;
}
.mgr-table td {
  padding: 0.7rem 1rem;
  color: var(--text-primary);
  border-bottom: 1px solid var(--card-border);
  vertical-align: middle;
}
.mgr-table tbody tr:last-child td { border-bottom: none; }
.mgr-table tbody tr:hover { background: var(--hover-bg, rgba(0,0,0,0.03)); }
.row-editing { background: rgba(63,81,181,0.05) !important; }

.cell-name { font-weight: 600; }
.cell-desc { color: var(--text-muted); font-size: 0.85rem; }

.action-cell { display: flex; gap: 0.4rem; align-items: center; }

.btn-sm-ghost, .btn-sm-danger {
  padding: 0.3rem 0.55rem;
  border-radius: 6px;
  border: none;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-sm-ghost {
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--card-border);
}
.btn-sm-ghost:hover { background: var(--hover-bg, rgba(0,0,0,0.06)); }
.btn-sm-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-sm-danger { background: rgba(192,57,43,0.12); color: var(--error-color, #c0392b); }
.btn-sm-danger:hover { background: rgba(192,57,43,0.22); }
.btn-sm-danger:disabled { opacity: 0.5; cursor: not-allowed; }

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9rem;
}

@media (max-width: 600px) {
  .create-card { flex-direction: column; align-items: stretch; }
  .create-fields { flex-direction: column; }
  .edit-fields { grid-template-columns: 1fr; }
}
</style>
