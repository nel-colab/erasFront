<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const users = ref([])
const roles = ref([])
const loading = ref(false)
const error = ref('')
const successMsg = ref('')

const search = ref('')

// Edit
const editing = ref(null)
const editUsername = ref('')
const editEmail = ref('')
const editRoleId = ref('')
const saving = ref(false)

// Password
const newPassword = ref('')
const confirmPassword = ref('')
const savingPassword = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')

// Delete
const deletingId = ref(null)
const confirmDeleteId = ref(null)

const filteredUsers = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter(u =>
    u.username?.toLowerCase().includes(q) ||
    u.email?.toLowerCase().includes(q) ||
    (u.role || '').toLowerCase().includes(q)
  )
})

const fetch = async () => {
  loading.value = true
  error.value = ''
  try {
    const [usersRes, rolesRes] = await Promise.all([
      axios.get('/api/users'),
      axios.get('/api/roles'),
    ])
    users.value = usersRes.data
    roles.value = rolesRes.data
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Error al cargar datos'
  } finally {
    loading.value = false
  }
}

const roleIdForName = (name) => {
  if (!name) return ''
  const found = roles.value.find(r => r.name === name)
  return found ? found.id : ''
}

const startEdit = (user) => {
  editing.value = user
  editUsername.value = user.username
  editEmail.value = user.email
  editRoleId.value = roleIdForName(user.role)
}

const cancelEdit = () => {
  editing.value = null
  newPassword.value = ''
  confirmPassword.value = ''
  passwordError.value = ''
  passwordSuccess.value = ''
}

const saveEdit = async () => {
  saving.value = true
  error.value = ''
  successMsg.value = ''
  try {
    const body = {
      username: editUsername.value.trim(),
      email: editEmail.value.trim(),
    }
    if (editRoleId.value) body.roleId = editRoleId.value
    await axios.put(`/api/users/update/${editing.value.id}`, body)
    // update local list
    const idx = users.value.findIndex(u => u.id === editing.value.id)
    if (idx !== -1) {
      const roleName = roles.value.find(r => r.id === editRoleId.value)?.name || null
      users.value[idx] = { ...users.value[idx], username: body.username, email: body.email, role: roleName }
    }
    cancelEdit()
    successMsg.value = 'Usuario actualizado correctamente'
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Error al actualizar usuario'
  } finally {
    saving.value = false
  }
}

const savePassword = async () => {
  passwordError.value = ''
  passwordSuccess.value = ''
  if (!newPassword.value) { passwordError.value = 'Ingresa una contraseña'; return }
  if (newPassword.value !== confirmPassword.value) { passwordError.value = 'Las contraseñas no coinciden'; return }
  savingPassword.value = true
  try {
    await axios.put(`/api/users/set-password/${editing.value.id}`, { newPassword: newPassword.value })
    newPassword.value = ''
    confirmPassword.value = ''
    passwordSuccess.value = 'Contraseña actualizada'
  } catch (e) {
    passwordError.value = e?.response?.data?.message || e.message || 'Error al cambiar contraseña'
  } finally {
    savingPassword.value = false
  }
}

const askDelete = (user) => { confirmDeleteId.value = user.id }
const cancelDelete = () => { confirmDeleteId.value = null }

const remove = async (user) => {
  deletingId.value = user.id
  error.value = ''
  successMsg.value = ''
  try {
    await axios.delete(`/api/users/delete/${user.id}`)
    users.value = users.value.filter(u => u.id !== user.id)
    confirmDeleteId.value = null
    successMsg.value = 'Usuario eliminado'
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Error al eliminar usuario'
  } finally {
    deletingId.value = null
  }
}

onMounted(fetch)
</script>

<template>
  <div class="manager-page">
    <div class="manager-header">
      <h1 class="manager-title">Usuarios</h1>
      <button class="btn-filled" @click="fetch" :disabled="loading">
        <i class="bi bi-arrow-clockwise"></i> Recargar
      </button>
    </div>

    <p v-if="successMsg" class="alert-success-msg">{{ successMsg }}</p>
    <p v-if="error" class="alert-error-msg">{{ error }}</p>

    <!-- Edit panel -->
    <div v-if="editing" class="edit-panel">
      <h3 class="edit-panel-title">Editar usuario</h3>

      <div class="edit-grid">
        <div class="form-group-t">
          <label class="form-label-t">Nombre de usuario</label>
          <input v-model="editUsername" class="form-control-t" />
        </div>

        <div class="form-group-t">
          <label class="form-label-t">Correo electrónico</label>
          <input v-model="editEmail" type="email" class="form-control-t" />
        </div>

        <div class="form-group-t">
          <label class="form-label-t">Rol</label>
          <select v-model="editRoleId" class="form-control-t">
            <option value="">— Sin rol —</option>
            <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select>
        </div>
      </div>

      <div class="edit-actions">
        <button class="btn-filled" @click="saveEdit" :disabled="saving">
          {{ saving ? 'Guardando…' : 'Guardar cambios' }}
        </button>
        <button class="btn-outline" @click="cancelEdit">Cancelar</button>
      </div>

      <div class="password-section">
        <h4 class="password-section-title">Cambiar contraseña</h4>
        <p v-if="passwordSuccess" class="alert-success-msg small-alert">{{ passwordSuccess }}</p>
        <p v-if="passwordError" class="alert-error-msg small-alert">{{ passwordError }}</p>
        <div class="password-grid">
          <div class="form-group-t">
            <label class="form-label-t">Nueva contraseña</label>
            <input v-model="newPassword" type="password" class="form-control-t" placeholder="Nueva contraseña" />
          </div>
          <div class="form-group-t">
            <label class="form-label-t">Confirmar contraseña</label>
            <input v-model="confirmPassword" type="password" class="form-control-t" placeholder="Repetir contraseña" />
          </div>
        </div>
        <button class="btn-outline mt-2" @click="savePassword" :disabled="savingPassword || !newPassword">
          <i class="bi bi-key"></i> {{ savingPassword ? 'Actualizando…' : 'Establecer contraseña' }}
        </button>
      </div>
    </div>

    <!-- Search -->
    <div class="search-bar">
      <i class="bi bi-search search-icon"></i>
      <input v-model="search" class="form-control-t search-input" placeholder="Buscar por usuario, email o rol…" />
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <div v-if="loading" class="empty-state">Cargando…</div>
      <div v-else-if="!filteredUsers.length" class="empty-state">No se encontraron usuarios.</div>
      <table v-else class="mgr-table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Verificado</th>
            <th style="width: 120px">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in filteredUsers" :key="user.id" :class="{ 'row-editing': editing?.id === user.id }">
            <td class="cell-username">
              <div class="avatar">{{ (user.username || '?').charAt(0).toUpperCase() }}</div>
              <span>{{ user.username }}</span>
            </td>
            <td class="cell-muted">{{ user.email }}</td>
            <td>
              <span v-if="user.role" class="role-badge">{{ user.role }}</span>
              <span v-else class="no-role">—</span>
            </td>
            <td>
              <span class="verified-dot" :class="user.verified ? 'verified' : 'unverified'">
                <i class="bi" :class="user.verified ? 'bi-check-circle-fill' : 'bi-x-circle-fill'"></i>
                {{ user.verified ? 'Sí' : 'No' }}
              </span>
            </td>
            <td class="action-cell">
              <template v-if="confirmDeleteId === user.id">
                <button class="btn-sm-danger" @click="remove(user)" :disabled="deletingId === user.id">
                  <i class="bi bi-check-lg"></i>
                </button>
                <button class="btn-sm-ghost" @click="cancelDelete">
                  <i class="bi bi-x-lg"></i>
                </button>
              </template>
              <template v-else>
                <button class="btn-sm-ghost" @click="startEdit(user)" :title="'Editar ' + user.username">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn-sm-danger" @click="askDelete(user)" :title="'Eliminar ' + user.username">
                  <i class="bi bi-trash"></i>
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.manager-page {
  max-width: 1000px;
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

/* Alerts */
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

/* Edit panel */
.edit-panel {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: var(--card-shadow);
}

.edit-panel-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 1.25rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--hr-color);
}

.edit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
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

/* Search */
.search-bar {
  position: relative;
  margin-bottom: 1rem;
}
.search-icon {
  position: absolute;
  left: 0.85rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  font-size: 0.9rem;
  pointer-events: none;
}
.search-input { padding-left: 2.2rem; }

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
.mgr-table tbody tr:hover { background: var(--hover-bg, rgba(0,0,0,0.025)); }
.row-editing { background: rgba(63,81,181,0.05) !important; }

/* Cells */
.cell-username {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 600;
}
.cell-muted { color: var(--text-muted); }

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #3f51b5;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.role-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  background: rgba(63,81,181,0.1);
  border: 1px solid rgba(63,81,181,0.25);
  color: #3f51b5;
  font-size: 0.78rem;
  font-weight: 500;
}
.no-role { color: var(--text-muted); }

.verified-dot {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.82rem;
  font-weight: 500;
}
.verified-dot.verified { color: var(--success-color, #27ae60); }
.verified-dot.unverified { color: var(--text-muted); }

/* Action buttons */
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
.btn-sm-danger { background: rgba(192,57,43,0.12); color: var(--error-color, #c0392b); }
.btn-sm-danger:hover { background: rgba(192,57,43,0.22); }
.btn-sm-danger:disabled { opacity: 0.5; cursor: not-allowed; }

.empty-state {
  padding: 2.5rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9rem;
}

/* Password section */
.password-section {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--hr-color);
}
.password-section-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 0.85rem;
}
.password-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.small-alert {
  font-size: 0.82rem;
  padding: 0.45rem 0.8rem;
  margin-bottom: 0.75rem;
}
.mt-2 { margin-top: 0.5rem; }

@media (max-width: 680px) {
  .edit-grid { grid-template-columns: 1fr; }
  .password-grid { grid-template-columns: 1fr; }
}
</style>
