<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const roles = ref([])
const allPermissions = ref([])
const loading = ref(false)
const error = ref('')
const successMsg = ref('')

// Create
const showCreate = ref(false)
const createName = ref('')
const createPerms = ref([])
const creating = ref(false)

// Edit
const editingRole = ref(null)
const editName = ref('')
const editPerms = ref([])
const saving = ref(false)

// Delete
const deletingName = ref(null)

const fetch = async () => {
  loading.value = true
  error.value = ''
  try {
    const [rolesRes, permsRes] = await Promise.all([
      axios.get('/api/roles'),
      axios.get('/api/permissions'),
    ])
    roles.value = rolesRes.data
    allPermissions.value = permsRes.data
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Error al cargar datos'
  } finally {
    loading.value = false
  }
}

const permName = (p) => (typeof p === 'string' ? p : p?.name)

const rolePernNames = (role) => (role.permissions || []).map(permName).filter(Boolean)

// Create
const openCreate = () => {
  showCreate.value = true
  createName.value = ''
  createPerms.value = []
}
const cancelCreate = () => { showCreate.value = false }

const toggleCreatePerm = (name) => {
  const idx = createPerms.value.indexOf(name)
  if (idx === -1) createPerms.value.push(name)
  else createPerms.value.splice(idx, 1)
}

const create = async () => {
  if (!createName.value.trim()) return
  creating.value = true
  error.value = ''
  successMsg.value = ''
  try {
    const { data } = await axios.post('/api/roles', {
      name: createName.value.trim(),
      permissions: createPerms.value,
      createMissingPermissions: false,
    })
    roles.value.push(data)
    cancelCreate()
    successMsg.value = 'Rol creado correctamente'
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Error al crear rol'
  } finally {
    creating.value = false
  }
}

// Edit
const startEdit = (role) => {
  editingRole.value = role
  editName.value = role.name
  editPerms.value = [...rolePernNames(role)]
}
const cancelEdit = () => { editingRole.value = null }

const toggleEditPerm = (name) => {
  const idx = editPerms.value.indexOf(name)
  if (idx === -1) editPerms.value.push(name)
  else editPerms.value.splice(idx, 1)
}

const saveEdit = async () => {
  const role = editingRole.value
  const currentPerms = rolePernNames(role)
  const toAdd = editPerms.value.filter(p => !currentPerms.includes(p))
  const toRemove = currentPerms.filter(p => !editPerms.value.includes(p))

  saving.value = true
  error.value = ''
  successMsg.value = ''
  try {
    const { data } = await axios.put('/api/roles', {
      name: role.name,
      newName: editName.value.trim() !== role.name ? editName.value.trim() : undefined,
      permissionsToAdd: toAdd,
      permissionsToRemove: toRemove,
      createMissingPermissions: false,
    })
    const idx = roles.value.findIndex(r => r.name === role.name)
    if (idx !== -1) roles.value[idx] = data
    cancelEdit()
    successMsg.value = 'Rol actualizado'
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Error al actualizar rol'
  } finally {
    saving.value = false
  }
}

// Delete
const remove = async (role) => {
  deletingName.value = role.name
  error.value = ''
  successMsg.value = ''
  try {
    await axios.delete(`/api/roles/${role.name}`)
    roles.value = roles.value.filter(r => r.name !== role.name)
    successMsg.value = 'Rol eliminado'
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Error al eliminar rol'
  } finally {
    deletingName.value = null
  }
}

onMounted(fetch)
</script>

<template>
  <div class="manager-page">
    <div class="manager-header">
      <h1 class="manager-title">Roles</h1>
      <div class="header-actions">
        <button class="btn-filled" @click="openCreate" v-if="!showCreate">
          <i class="bi bi-plus-lg"></i> Nuevo rol
        </button>
        <button class="btn-filled" @click="fetch" :disabled="loading">
          <i class="bi bi-arrow-clockwise"></i> Recargar
        </button>
      </div>
    </div>

    <p v-if="successMsg" class="alert-success-msg">{{ successMsg }}</p>
    <p v-if="error" class="alert-error-msg">{{ error }}</p>

    <!-- Create form -->
    <div v-if="showCreate" class="role-form-card">
      <h3 class="form-card-title">Nuevo rol</h3>
      <div class="form-group-t">
        <label class="form-label-t">Nombre</label>
        <input v-model="createName" class="form-control-t" placeholder="Ej: ROLE_EDITOR" @keyup.enter="create" />
      </div>
      <div class="form-group-t">
        <label class="form-label-t">Permisos</label>
        <div class="perm-grid">
          <label
            v-for="p in allPermissions"
            :key="p.id"
            class="perm-chip"
            :class="{ active: createPerms.includes(p.name) }"
            @click="toggleCreatePerm(p.name)"
          >
            <i class="bi" :class="createPerms.includes(p.name) ? 'bi-check-square-fill' : 'bi-square'"></i>
            {{ p.name }}
          </label>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn-filled" @click="create" :disabled="creating || !createName.trim()">
          {{ creating ? 'Creando…' : 'Crear' }}
        </button>
        <button class="btn-outline" @click="cancelCreate">Cancelar</button>
      </div>
    </div>

    <!-- Edit form (inline modal) -->
    <div v-if="editingRole" class="role-form-card">
      <h3 class="form-card-title">Editar rol: {{ editingRole.name }}</h3>
      <div class="form-group-t">
        <label class="form-label-t">Nombre</label>
        <input v-model="editName" class="form-control-t" />
      </div>
      <div class="form-group-t">
        <label class="form-label-t">Permisos</label>
        <div class="perm-grid">
          <label
            v-for="p in allPermissions"
            :key="p.id"
            class="perm-chip"
            :class="{ active: editPerms.includes(p.name) }"
            @click="toggleEditPerm(p.name)"
          >
            <i class="bi" :class="editPerms.includes(p.name) ? 'bi-check-square-fill' : 'bi-square'"></i>
            {{ p.name }}
          </label>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn-filled" @click="saveEdit" :disabled="saving">
          {{ saving ? 'Guardando…' : 'Guardar cambios' }}
        </button>
        <button class="btn-outline" @click="cancelEdit">Cancelar</button>
      </div>
    </div>

    <!-- Roles list -->
    <div v-if="loading" class="empty-state">Cargando…</div>
    <div v-else-if="!roles.length" class="empty-state">No hay roles registrados.</div>
    <div v-else class="roles-list">
      <div v-for="role in roles" :key="role.id || role.name" class="role-card">
        <div class="role-card-header">
          <span class="role-name">{{ role.name }}</span>
          <div class="action-cell">
            <button class="btn-sm-ghost" @click="startEdit(role)" :disabled="!!editingRole">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn-sm-danger" @click="remove(role)" :disabled="deletingName === role.name">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
        <div class="role-perms">
          <span v-if="!rolePernNames(role).length" class="no-perms">Sin permisos asignados</span>
          <span v-for="p in rolePernNames(role)" :key="p" class="perm-badge">{{ p }}</span>
        </div>
      </div>
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

.header-actions { display: flex; gap: 0.6rem; }

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

/* Form card */
.role-form-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: var(--card-shadow);
}

.form-card-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 1.25rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--hr-color);
}

.form-actions { display: flex; gap: 0.6rem; margin-top: 1rem; }

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

/* Perm chips */
.perm-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.4rem;
}

.perm-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.7rem;
  border-radius: 20px;
  border: 1px solid var(--card-border);
  font-size: 0.82rem;
  color: var(--text-muted);
  cursor: pointer;
  user-select: none;
  transition: all 0.15s;
}
.perm-chip:hover { border-color: #3f51b5; color: #3f51b5; }
.perm-chip.active {
  background: rgba(63,81,181,0.12);
  border-color: #3f51b5;
  color: #3f51b5;
  font-weight: 600;
}

/* Roles list */
.roles-list { display: flex; flex-direction: column; gap: 0.75rem; }

.role-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  box-shadow: var(--card-shadow);
}

.role-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.6rem;
}

.role-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.action-cell { display: flex; gap: 0.4rem; }

.role-perms { display: flex; flex-wrap: wrap; gap: 0.4rem; }

.perm-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  background: rgba(63,81,181,0.1);
  border: 1px solid rgba(63,81,181,0.25);
  color: #3f51b5;
  font-size: 0.78rem;
  font-weight: 500;
}

.no-perms { font-size: 0.82rem; color: var(--text-muted); font-style: italic; }

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
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
}
</style>
