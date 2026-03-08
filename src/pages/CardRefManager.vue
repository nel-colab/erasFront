<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'

const FIELDS = [
  { key: 'instances', label: 'Instances', desc: 'Effect instance labels' },
  { key: 'kinds',     label: 'Kinds',     desc: 'Effect kind labels' },
  { key: 'tags',      label: 'Tags',      desc: 'Effect tag labels' },
  { key: 'classes',   label: 'Classes',   desc: 'Card class labels' },
  { key: 'keywordEffects', label: 'Keyword effects', desc: 'Keyword effect labels' },
]

const USAGE_LIMITS = ['once per turn', 'once per turn between copies', 'ultimate effect']

const refData  = ref({ classes: [], instances: [], kinds: [], tags: [], instanceKinds: {}, keywordEffects: {} })
const inputs   = ref({ classes: '', instances: '', kinds: '', tags: '', keywordEffects: '' })
const keywordInputs = ref({ keyword: '', parameter: '', description: '' })
const searches = ref({ classes: '', instances: '', kinds: '', tags: '', keywordEffects: '' })
const errors   = ref({ classes: '', instances: '', kinds: '', tags: '', keywordEffects: '' })
const loading  = ref(false)
const busy     = ref({})

// ── Effect modal for keyword effects ──────────────────────────────────────────
const showEffectModal  = ref(false)
const editingEffectIdx = ref(null)        // null = new
const newTagInput      = ref('')

const blankEffect = () => ({
  keywordName: '',
  placeholder: { name: '' },
  instance: null, ussageLimit: null, kind: null, tags: [],
  effectBlocks: [{ activationCondition: '', cost: '', resolution: '' }],
})
const effectForm = ref(blankEffect())

// Filtered list per section
const filtered = computed(() => {
  const result = {}
  FIELDS.forEach(f => {
    const q = searches.value[f.key].toLowerCase()
    if (f.key === 'keywordEffects') {
      const effects = refData.value[f.key] || {}
      result[f.key] = q
        ? Object.keys(effects).filter(k => {
            const effect = effects[k]
            return k.toLowerCase().includes(q) || 
              (effect && (effect.effect ? effectSummary(effect.effect).toLowerCase().includes(q) : 
               (effect.description && effect.description.toLowerCase().includes(q)) ||
               (effect.parameter && effect.parameter.toLowerCase().includes(q))))
          })
        : Object.keys(effects)
    } else {
      result[f.key] = q
        ? (refData.value[f.key] ?? []).filter(v => v.toLowerCase().includes(q))
        : (refData.value[f.key] ?? [])
    }
  })
  return result
})

// ── Usage-check modal ─────────────────────────────────────────────────────────
const checkModal        = ref(false)
const checkField        = ref('')
const checkValue        = ref('')
const checkCount        = ref(0)
const checkCards        = ref([])
const checkLoading      = ref(false)
const purging           = ref(false)
const checkError        = ref('')
const replacementValue  = ref('')

const replacementOptions = computed(() => {
  const field = checkField.value;
  const data = refData.value[field];
  let arr = [];
  if (field === 'keywordsEffects') {
    arr = Object.keys(data || {});
  } else {
    arr = data || [];
  }
  return arr.filter(v => v !== checkValue.value);
})

const fetchRef = async () => {
  loading.value = true
  try {
    const { data } = await axios.get('/api/cards/ref')
    refData.value = data
  } finally {
    loading.value = false
  }
}

const addItem = async (field) => {
  if (field === 'keywordEffects') {
    // Open effect modal for keyword effects
    effectForm.value = blankEffect()
    showEffectModal.value = true
    return
  }
  
  const value = inputs.value[field].trim()
  if (!value) return
  errors.value[field] = ''
  busy.value[field + '_add'] = true
  try {
    const body = { value }
    const { data } = await axios.post(`/api/cards/ref/${field}`, body)
    refData.value = data
    inputs.value[field] = ''
  } catch (e) {
    errors.value[field] = e?.response?.data?.error || e.message || 'Failed to add'
  } finally {
    busy.value[field + '_add'] = false
  }
}

const requestDelete = async (field, value) => {
  errors.value[field] = ''
  checkLoading.value = true
  checkError.value   = ''
  checkField.value   = field
  checkValue.value   = value
  checkCards.value      = []
  checkCount.value      = 0
  replacementValue.value = ''
  checkModal.value      = true
  try {
    const { data } = await axios.get(`/api/cards/ref/${field}/check`, { params: { value } })
    checkCount.value = data.count
    checkCards.value = data.cards
  } catch (e) {
    checkError.value = e?.response?.data?.error || e.message || 'Check failed'
  } finally {
    checkLoading.value = false
  }
}

const confirmDirectDelete = async () => {
  busy.value[checkField.value + '_del'] = true
  try {
    const body = checkField.value === 'keywordEffects'
                   ? { keyword: checkValue.value }
                   : { value: checkValue.value };
    const { data } = await axios.delete(`/api/cards/ref/${checkField.value}`, { data: body })
    refData.value = data
    checkModal.value = false
  } catch (e) {
    checkError.value = e?.response?.data?.error || e.message || 'Delete failed'
  } finally {
    busy.value[checkField.value + '_del'] = false
  }
}

const confirmReplace = async () => {
  purging.value    = true
  checkError.value = ''
  try {
    const { data } = await axios.post(
      `/api/cards/ref/${checkField.value}/replace`,
      { value: checkValue.value, replacement: replacementValue.value || null }
    )
    refData.value    = data
    checkModal.value = false
  } catch (e) {
    checkError.value = e?.response?.data?.error || e.message || 'Failed'
  } finally {
    purging.value = false
  }
}

const closeCheckModal = () => { checkModal.value = false; checkError.value = '' }

// ── Effect modal functions ────────────────────────────────────────────────────
const addEffectBlock    = () => effectForm.value.effectBlocks.push({ activationCondition: '', cost: '', resolution: '' })
const removeEffectBlock = i  => { if (effectForm.value.effectBlocks.length > 1) effectForm.value.effectBlocks.splice(i, 1) }
const toggleEffectTag   = tag => {
  const i = effectForm.value.tags.indexOf(tag)
  if (i === -1) effectForm.value.tags.push(tag); else effectForm.value.tags.splice(i, 1)
}
const submitNewTag = async () => {
  const t = newTagInput.value.trim(); if (!t) return
  await addTag(t)
  if (!effectForm.value.tags.includes(t)) effectForm.value.tags.push(t)
  newTagInput.value = ''
}

const addTag = async (tag) => {
  busy.value['tags_add'] = true
  try {
    const { data } = await axios.post('/api/cards/ref/tags', { value: tag })
    refData.value = data
  } catch (e) {
    errors.value.tags = e?.response?.data?.error || e.message || 'Failed to add tag'
  } finally {
    busy.value['tags_add'] = false
  }
}

const saveEffect = async () => {
  const keyword = effectForm.value.keywordName.trim()
  if (!keyword) return
  const effect = JSON.parse(JSON.stringify(effectForm.value))
  delete effect.keywordName
  const placeholderName = effect.placeholder?.name?.trim()
  delete effect.placeholder
  let finalKeyword = keyword
  if (placeholderName) {
    const deepReplace = (obj) => {
      if (typeof obj === 'string') return obj.replace(/@/g, `{${placeholderName}}`)
      if (Array.isArray(obj)) return obj.map(deepReplace)
      if (obj && typeof obj === 'object') {
        const out = {}
        for (const k of Object.keys(obj)) out[k] = deepReplace(obj[k])
        return out
      }
      return obj
    }
    finalKeyword = deepReplace(keyword)
    Object.assign(effect, deepReplace(effect))
  }
  busy.value['keywordEffects_add'] = true
  try {
    const { data } = await axios.post('/api/cards/ref/keywordEffects', { keyword: finalKeyword, effect })
    refData.value = data
    showEffectModal.value = false
  } catch (e) {
    errors.value.keywordEffects = e?.response?.data?.error || e.message || 'Failed to add keyword effect'
  } finally {
    busy.value['keywordEffects_add'] = false
  }
}

// Mirror Java Effect.getPlainEffect()
const effectSummary = (ef) => {
  let plainEffect = ''
  if (ef.instance) plainEffect += `<${ef.instance}> `
  if (ef.ussageLimit === 'once per turn') plainEffect += '[once per turn] '
  if (ef.ussageLimit === 'once per turn between copies') plainEffect += '(1) '
  if (ef.effectBlocks) {
    ef.effectBlocks.forEach(block => {
      if (block.activationCondition) plainEffect += block.activationCondition + ': '
      if (block.cost) plainEffect += block.cost + '; '
      if (block.resolution) plainEffect += block.resolution + ' '
    })
  }
  if (ef.placeholder?.name) plainEffect = plainEffect.replace(/@/g, `{${ef.placeholder.name}}`)
  return plainEffect.trim()
}

// return just the keyword name; effect details handled separately in template
const getItemDisplayText = (field, item) => {
  return item
}

// provide the effect summary/description for keyword effects
const getKeywordEffectText = (keyword) => {
  const effect = refData.value.keywordEffects?.[keyword]
  if (!effect) return ''
  if (effect.effect) return effectSummary(effect.effect)
  // legacy
  const param = effect.parameter ? ` (${effect.parameter})` : ''
  const desc = effect.description || ''
  return `${param}${desc}`.trim()
}

// ── Instance → Kind mapping ────────────────────────────────────────────────────
const setInstanceKind = async (instance, kind) => {
  try {
    const { data } = await axios.patch('/api/cards/ref/instance-kind', { instance, kind: kind || null })
    refData.value = data
  } catch (e) {
    errors.value.instances = e?.response?.data?.error || e.message || 'Failed to update mapping'
  }
}

onMounted(fetchRef)

watch([checkModal, showEffectModal], ([checkOpen, effectOpen]) => {
  const anyOpen = checkOpen || effectOpen
  document.body.style.overflow = anyOpen ? 'hidden' : ''
})
</script>

<template>
  <div class="ref-page">
    <div class="ref-header">
      <h2>Card Reference Data</h2>
      <p class="ref-subtitle">Manage the vocabulary lists used in the card editor.</p>
    </div>

    <div v-if="loading" class="ref-loading">Loading…</div>

    <div v-else class="ref-columns">
      <div v-for="f in FIELDS" :key="f.key" class="ref-col">

        <!-- Column header -->
        <div class="col-head">
          <div class="col-title-row">
            <span class="col-title">{{ f.label }}</span>
            <span class="col-count">
            {{ f.key === 'keywordEffects'
                ? Object.keys(refData[f.key] || {}).length
                : (refData[f.key]?.length ?? 0) }}
          </span>
          </div>
          <span class="col-desc">{{ f.desc }}</span>
        </div>

        <!-- Search -->
        <div class="col-search">
          <span class="search-icon">⌕</span>
          <input
            v-model="searches[f.key]"
            class="search-input"
            :placeholder="`Search ${f.label.toLowerCase()}…`"
          />
          <button v-if="searches[f.key]" class="search-clear" @click="searches[f.key] = ''">✕</button>
        </div>

        <p v-if="errors[f.key]" class="col-error">{{ errors[f.key] }}</p>

        <!-- Add row -->
        <div class="col-add" v-if="f.key !== 'keywordEffects'">
          <input
            v-model="inputs[f.key]"
            class="add-input"
            :placeholder="`New ${f.label.toLowerCase().slice(0, -1)}…`"
            @keydown.enter.prevent="addItem(f.key)"
          />
          <button
            class="add-btn"
            :disabled="!inputs[f.key].trim() || busy[f.key + '_add']"
            @click="addItem(f.key)"
          >{{ busy[f.key + '_add'] ? '…' : 'Add' }}</button>
        </div>

        <!-- Keyword effect add row -->
        <div class="col-add" v-if="f.key === 'keywordEffects'">
          <button
            class="add-btn"
            :disabled="busy[f.key + '_add']"
            @click="addItem(f.key)"
          >{{ busy[f.key + '_add'] ? '…' : 'Add Effect' }}</button>
        </div>

        <!-- Item list -->
        <div class="item-list">
          <div v-if="!filtered[f.key]?.length" class="item-empty">
            {{ searches[f.key] ? 'No matches.' : 'No items yet.' }}
          </div>
          <div
            v-for="item in filtered[f.key]"
            :key="item"
            class="item-row"
          >
            <span class="item-text">{{ item }}</span>

            <!-- Kind selector — only for Instances column -->
            <select
              v-if="f.key === 'instances'"
              class="instance-kind-select"
              :value="refData.instanceKinds?.[item] ?? ''"
              @change="setInstanceKind(item, $event.target.value)"
              :title="`Default kind for ${item}`"
            >
              <option value="">— no kind —</option>
              <option v-for="k in refData.kinds" :key="k" :value="k">{{ k }}</option>
            </select>

            <button
              class="item-delete"
              :disabled="busy[f.key + '_' + item]"
              @click="requestDelete(f.key, item)"
              title="Delete"
            >✕</button>
          </div>
        </div>


      </div>
    </div>

    <!-- ── Usage-check / purge modal ──────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="checkModal" class="modal-overlay" @click.self="closeCheckModal">
        <div class="modal-box">
          <button class="modal-close" @click="closeCheckModal">✕</button>

          <div v-if="checkLoading" class="check-loading">Checking card usage…</div>

          <template v-else>
            <p v-if="checkError" class="col-error">{{ checkError }}</p>

            <template v-if="checkCount === 0 && !checkError">
              <h3 class="modal-title">Delete "{{ checkValue }}"?</h3>
              <p class="modal-body">No cards use this value. It will be removed from the reference list.</p>
              <div class="modal-actions">
                <button class="btn-filled" @click="confirmDirectDelete" :disabled="busy[checkField + '_del']">
                  {{ busy[checkField + '_del'] ? 'Deleting…' : 'Delete' }}
                </button>
                <button class="btn-ghost" @click="closeCheckModal">Cancel</button>
              </div>
            </template>

            <template v-if="checkCount > 0">
              <h3 class="modal-title">
                "{{ checkValue }}" is used by {{ checkCount }} card{{ checkCount !== 1 ? 's' : '' }}
              </h3>
              <div class="affected-list">
                <div v-for="card in checkCards" :key="card.id" class="affected-row">
                  <span class="affected-edition">{{ card.edition }}</span>
                  <span class="affected-name">{{ card.cardName }}</span>
                  <span class="affected-num">#{{ card.cardNumber }}</span>
                </div>
              </div>
              <template v-if="checkField !== 'keywordEffects'">
                <div class="replacement-section">
                  <label class="replacement-label">
                    Replace with in all {{ checkCount }} card{{ checkCount !== 1 ? 's' : '' }}:
                  </label>
                  <select v-model="replacementValue" class="replacement-select">
                    <option value="">— remove / set to null —</option>
                    <option v-for="opt in replacementOptions" :key="opt" :value="opt">{{ opt }}</option>
                  </select>
                </div>
              </template>
              <div class="modal-actions">
                <button class="btn-filled btn-danger-filled" @click="confirmReplace" :disabled="purging">
                  {{ purging ? 'Applying…' : replacementValue ? `Replace with "${replacementValue}" & delete` : `Remove from all & delete` }}
                </button>
                <button class="btn-ghost" @click="closeCheckModal" :disabled="purging">Cancel</button>
              </div>
            </template>
          </template>
        </div>
      </div>
    </Teleport>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- Effect sub-modal for keyword effects                              -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="showEffectModal" class="modal-overlay modal-overlay--nested" @click.self="showEffectModal = false">
        <div class="modal-box modal-box--effect">
          <button class="modal-close" @click="showEffectModal = false">✕</button>
          <h3 class="modal-form-title">Create Keyword Effect</h3>

          <div class="form-grid">
            <!-- Keyword Name -->
            <div class="form-field">
              <label>Keyword Name *</label>
              <input
                v-model="effectForm.keywordName"
                class="form-field-input"
                placeholder="e.g., 'Drain', 'Protect'…"
              />
            </div>

            <!-- Placeholder name -->
            <div class="form-field">
              <label>Placeholder name <span class="placeholder-hint">(use @ in text → replaced with {name})</span></label>
              <input
                v-model="effectForm.placeholder.name"
                class="form-field-input"
                placeholder="e.g., 'X', 'target'…"
              />
            </div>

            <!-- Instance -->
            <div class="form-field">
              <label>Instance</label>
              <select v-model="effectForm.instance">
                <option :value="null">— none —</option>
                <option v-for="inst in refData.instances" :key="inst" :value="inst">{{ inst }}</option>
              </select>
            </div>

            <!-- Usage limit -->
            <div class="form-field">
              <label>Usage Limit</label>
              <select v-model="effectForm.ussageLimit">
                <option :value="null">— none —</option>
                <option v-for="u in USAGE_LIMITS" :key="u" :value="u">{{ u }}</option>
              </select>
            </div>

            <!-- Kind -->
            <div class="form-field">
              <label>Kind</label>
              <select v-model="effectForm.kind">
                <option :value="null">— none —</option>
                <option v-for="k in refData.kinds" :key="k" :value="k">{{ k }}</option>
              </select>
            </div>

            <!-- Tags -->
            <div class="form-field full">
              <label>Tags</label>
              <div class="chip-select" v-if="refData.tags.length">
                <button
                  v-for="tag in refData.tags" :key="tag"
                  type="button"
                  class="chip"
                  :class="{ active: effectForm.tags.includes(tag) }"
                  @click="toggleEffectTag(tag)"
                >{{ tag }}</button>
              </div>
              <div class="new-tag-row">
                <input v-model="newTagInput" class="filter-input" placeholder="New tag…" @keydown.enter.prevent="submitNewTag" />
                <button type="button" class="btn-ghost btn-xs" @click="submitNewTag">Add</button>
              </div>
            </div>

            <!-- Effect blocks -->
            <div class="form-field full">
              <div class="effect-section-header">
                <label>Effect Blocks</label>
                <button type="button" class="btn-ghost btn-xs" @click="addEffectBlock">+ Add block</button>
              </div>
              <div v-for="(block, i) in effectForm.effectBlocks" :key="i" class="effect-block-editor">
                <div class="effect-block-num">#{{ i + 1 }}
                  <button v-if="effectForm.effectBlocks.length > 1" type="button"
                    class="btn-ghost btn-xs btn-danger" @click="removeEffectBlock(i)">✕</button>
                </div>
                <div class="form-field">
                  <label>Activation Condition</label>
                  <input v-model="block.activationCondition" placeholder="When… / If…" />
                </div>
                <div class="form-field">
                  <label>Cost</label>
                  <input v-model="block.cost" placeholder="Pay… / Tribute…" />
                </div>
                <div class="form-field" style="grid-column: 1 / -1;">
                  <label>Resolution *</label>
                  <textarea v-model="block.resolution" rows="3" placeholder="Effect text…" />
                </div>
              </div>
            </div>

            <!-- Live preview -->
            <div class="form-field full">
              <label>Preview</label>
              <div class="effect-preview-box">{{ effectSummary(effectForm) }}</div>
            </div>
          </div>

          <div class="form-actions">
            <button class="btn-filled" @click="saveEffect"
              :disabled="!effectForm.keywordName.trim() || busy['keywordEffects_add']">
              {{ busy['keywordEffects_add'] ? 'Saving…' : 'Create Keyword Effect' }}
            </button>
            <button class="btn-ghost" @click="showEffectModal = false">Cancel</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.ref-page {
  padding: 1.5rem 1.25rem;
}
.ref-header { margin-bottom: 1.75rem; }
.ref-header h2 { color: var(--text-primary); margin: 0 0 0.3rem; font-size: 1.6rem; }
.ref-subtitle  { color: var(--text-muted); font-size: 0.85rem; margin: 0; }
.ref-loading   { color: var(--text-muted); padding: 3rem; text-align: center; }

/* ── 4-column layout ────────────────────────────────────────────── */
.ref-columns {
  display: grid;
  grid-template-columns: 1.7fr 1fr 1fr 1fr 1fr;
  gap: 1rem;
  align-items: start;
}

.ref-col {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

/* Column header */
.col-head {
  padding: 0.9rem 1rem 0.7rem;
  border-bottom: 1px solid var(--card-border);
}
.col-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.2rem;
}
.col-title { color: var(--text-primary); font-size: 0.95rem; font-weight: 700; letter-spacing: 0.02em; }
.col-count {
  background: var(--input-bg);
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.1rem 0.5rem;
  border-radius: 10px;
  min-width: 22px;
  text-align: center;
}
.col-desc { font-size: 0.72rem; color: var(--text-muted); }

/* Search */
.col-search {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid var(--card-border);
  background: var(--input-bg);
}
.search-icon  { color: var(--text-muted); font-size: 1rem; line-height: 1; flex-shrink: 0; }
.search-input {
  flex: 1; background: transparent; border: none; outline: none;
  color: var(--text-primary); font-size: 0.82rem;
}
.search-input::placeholder { color: var(--text-muted); }
.search-clear {
  background: transparent; border: none; color: var(--text-muted); font-size: 0.72rem;
  cursor: pointer; padding: 0; line-height: 1; flex-shrink: 0;
}
.search-clear:hover { color: var(--text-primary); }

.col-error { color: var(--error-color); font-size: 0.78rem; margin: 0.4rem 0.75rem 0; }

/* Add row */
.col-add {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--card-border);
}

.add-input {
  flex: 1;
  background: var(--input-bg);
  border: none;
  border-right: 1px solid var(--card-border);
  color: var(--text-primary);
  padding: 0.55rem 0.75rem;
  font-size: 0.82rem;
  outline: none;
  min-width: 0;
}
.add-input::placeholder { color: var(--text-muted); }

.add-btn {
  background: var(--btn-bg);
  color: var(--btn-text);
  border: none;
  padding: 0.5rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.15s ease;
}
.add-btn:hover:not(:disabled) { background: var(--btn-hover); }
.add-btn:disabled { opacity: 0.35; cursor: not-allowed; }

/* Item list */
.item-list {
  flex: 1;
  min-height: 40px;
}
.item-empty {
  padding: 1rem 0.75rem;
  font-size: 0.8rem;
  color: var(--text-muted);
  text-align: center;
}
.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--hr-color);
  transition: background 0.1s;
}
.item-row:last-child { border-bottom: none; }
.item-row:hover { background: var(--input-bg); }
.item-text {
  font-size: 0.85rem;
  color: var(--text-secondary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-summary {
  font-size: 0.85rem;
  color: var(--text-secondary);
  flex: 2;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: 0.75rem;
}
/* Instance → Kind inline selector */
.instance-kind-select {
  flex-shrink: 0;
  background: var(--input-bg);
  border: 1px solid var(--card-border);
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 0.7rem;
  padding: 0.1rem 0.3rem;
  outline: none;
  cursor: pointer;
  max-width: 140px;
  transition: border-color 0.15s, color 0.15s;
}
.instance-kind-select:focus { border-color: #3f51b5; color: var(--text-primary); }
.instance-kind-select option { background: var(--card-bg); }

.item-delete {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.72rem;
  cursor: pointer;
  padding: 0.15rem 0.3rem;
  border-radius: 3px;
  transition: color 0.15s, background 0.15s;
  margin-left: 0.4rem;
}
.item-delete:hover:not(:disabled) { color: #f44336; background: rgba(244, 68, 68, 0.1); }
.item-delete:disabled { opacity: 0.3; cursor: not-allowed; }

/* ── Modal ───────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 1rem;
}
.modal-box {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow);
  border-radius: 12px;
  width: 100%; max-width: 520px; max-height: 80vh; overflow-y: auto;
  padding: 1.5rem; position: relative;
}
.modal-close {
  position: absolute; top: 0.9rem; right: 1rem;
  background: transparent; border: none; color: var(--text-muted); font-size: 1.1rem; cursor: pointer;
}
.modal-close:hover { color: var(--text-primary); }
.modal-title  { color: var(--text-primary); margin: 0 0 0.6rem; font-size: 1rem; font-weight: 700; }
.modal-body   { color: var(--text-secondary); font-size: 0.85rem; margin: 0 0 1rem; line-height: 1.5; }
.modal-body strong { color: var(--text-primary); }
.modal-actions { display: flex; gap: 0.5rem; margin-top: 1.25rem; flex-wrap: wrap; }
.check-loading { color: var(--text-muted); text-align: center; padding: 1.5rem; font-size: 0.88rem; }

.affected-list {
  max-height: 220px; overflow-y: auto;
  border: 1px solid var(--card-border); border-radius: 6px; background: var(--input-bg);
}
.affected-row {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.45rem 0.8rem; border-bottom: 1px solid var(--hr-color); font-size: 0.83rem;
}
.affected-row:last-child { border-bottom: none; }
.affected-edition { color: #3f51b5; font-weight: 700; font-size: 0.72rem; min-width: 36px; }
.affected-name    { color: var(--text-secondary); flex: 1; }
.affected-num     { color: var(--text-muted); font-size: 0.75rem; }

.replacement-section {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.replacement-label {
  font-size: 0.82rem;
  color: var(--text-secondary);
}
.replacement-select {
  background: var(--input-bg);
  border: 1px solid var(--card-border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.85rem;
  padding: 0.4rem 0.6rem;
  outline: none;
  cursor: pointer;
  width: 100%;
}
.replacement-select:focus { border-color: #3f51b5; }
.replacement-select option { background: var(--card-bg); }

.btn-danger-filled {
  background-color: #7f1d1d !important;
  color: #fca5a5 !important;
}
.btn-danger-filled:hover:not(:disabled) { background-color: #991b1b !important; color: #fff !important; }

/* Effect modal styles */
.modal-box--effect { max-width: 1480px; margin-top: 4rem; max-height: fit-content;}

.form-with-preview {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}
.form-main { flex: 1; min-width: 0; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; }
.form-field { display: flex; flex-direction: column; gap: 0.25rem; }
.form-field.full { grid-column: 1 / -1; }
.form-field label { font-size: 0.78rem; color: var(--text-secondary); }
.form-field input,
.form-field select,
.form-field textarea {
  background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 6px;
  color: var(--text-primary); padding: 0.4rem 0.55rem; font-size: 0.88rem; outline: none; resize: vertical;
  transition: border-color 0.15s ease, background-color 0.2s ease;
}
.form-field input::placeholder,
.form-field textarea::placeholder { color: var(--text-muted); }
.form-field select option { background: var(--card-bg); color: var(--text-primary); }
.form-field input:focus,
.form-field select:focus,
.form-field textarea:focus { border-color: #3f51b5; }
.form-actions { display: flex; gap: 0.5rem; margin-top: 1.25rem; }

/* Chips — used in form modals (theme-aware via CSS vars) */
.chip {
  padding: 0.25rem 0.65rem; border-radius: 20px; border: 1px solid #3a3a3a;
  background: transparent; color: rgba(255,255,255,0.5); font-size: 0.78rem; font-weight: 600;
  cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.chip:hover { background: rgba(255,255,255,0.08); color: #fff; }
.chip.active { background: #3f51b5; border-color: #3f51b5; color: #fff; }

.chip-select { display: flex; flex-wrap: wrap; gap: 0.3rem; padding: 0.4rem 0; }
.chip-select .chip {
  border-color: var(--card-border);
  color: var(--text-secondary);
}
.chip-select .chip:hover { background: var(--input-bg); color: var(--text-primary); }
.chip-select .chip.active { background: #3f51b5; border-color: #3f51b5; color: #fff; }

.placeholder-hint { color: var(--text-muted); font-weight: 400; font-size: 0.73rem; }
.effect-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem; }
.effect-block-editor {
  background: var(--input-bg); border: 1px solid var(--card-border); border-radius: 6px; padding: 0.6rem; margin-bottom: 0.5rem;
}
.effect-block-num {
  font-size: 0.75rem; color: var(--text-muted); font-weight: 700; margin-bottom: 0.4rem;
  display: flex; align-items: center; justify-content: space-between;
}
.effect-preview-box {
  background: var(--input-bg); border: 1px solid var(--card-border); border-radius: 6px;
  padding: 0.5rem 0.7rem; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.4;
  min-height: 2.5rem; white-space: pre-wrap;
}


@media (max-width: 1100px) {
  .ref-columns { grid-template-columns: 1.5fr 1fr; }
}
@media (max-width: 580px) {
  .ref-columns { grid-template-columns: 1fr; }
}
</style>
