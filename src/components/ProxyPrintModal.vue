<script setup>
import { ref, computed } from 'vue'
import axios from 'axios'

const props = defineProps({
  deckEntries: { type: Array,  required: true  },
  deckName:    { type: String, default: 'mazo' },
})

// ── State ──────────────────────────────────────────────────────────────────
const showModal       = ref(false)
const proxyPaperSize  = ref('letter')
const proxyOrient     = ref('landscape')
const proxyBrightness = ref(20)
const proxyContrast   = ref(20)
const proxyGenerating = ref(false)

const PAPER_SIZES = [
  { value: 'letter', label: 'Carta (8.5 × 11 in)',   w: 8.5,   h: 11    },
  { value: 'a4',     label: 'A4 (210 × 297 mm)',      w: 8.27,  h: 11.69 },
  { value: 'legal',  label: 'Legal (8.5 × 14 in)',    w: 8.5,   h: 14    },
]
const CARD_W      = 2.5
const CARD_H      = 3.5
const MIN_MARGIN  = 0.25  // Word's minimum printable margin (inches)

const proxyMargin = ref(0.5)

// ── Computed ───────────────────────────────────────────────────────────────
const proxyCardCount = computed(() =>
  props.deckEntries.reduce((s, e) => s + e.count, 0)
)

const proxyCardsPerPage = computed(() => {
  const paper     = PAPER_SIZES.find(p => p.value === proxyPaperSize.value)
  const landscape = proxyOrient.value === 'landscape'
  const pw = landscape ? paper.h : paper.w
  const ph = landscape ? paper.w : paper.h
  const m = proxyMargin.value
  return Math.floor((pw - m * 2) / CARD_W) * Math.floor((ph - m * 2) / CARD_H)
})

const marginTooSmall = computed(() => proxyMargin.value < MIN_MARGIN)

// ── Actions ────────────────────────────────────────────────────────────────
async function printProxies() {
  const cardIds = props.deckEntries.flatMap(e => Array(e.count).fill(e.card.id))
  proxyGenerating.value = true
  try {
    const response = await axios.post('/api/drive/proxy-print', {
      cardIds,
      paperSize:   proxyPaperSize.value,
      orientation: proxyOrient.value,
      margin:      proxyMargin.value,
      brightness:  proxyBrightness.value,
      contrast:    proxyContrast.value,
    }, { responseType: 'blob' })

    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
    const a   = document.createElement('a')
    a.href     = url
    a.download = `proxies-${props.deckName || 'mazo'}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('Error generating PDF', e)
  } finally {
    proxyGenerating.value = false
  }
}

defineExpose({ open: () => { showModal.value = true } })
</script>

<template>
  <Teleport to="body">
    <div v-if="showModal" class="proxy-overlay" @click.self="showModal = false">
      <div class="proxy-modal">
        <button class="proxy-close" @click="showModal = false">✕</button>
        <h2 class="proxy-title"><i class="bi bi-printer"></i> Imprimir proxies</h2>
        <p class="proxy-info">
          Cartas a <strong>2.5 × 3.5 in</strong> &mdash;
          <strong>{{ proxyCardCount }}</strong> carta{{ proxyCardCount !== 1 ? 's' : '' }},
          <strong>{{ proxyCardsPerPage }}</strong> por hoja.
        </p>

        <label class="proxy-label">Orientación</label>
        <div class="proxy-orient-row">
          <label class="proxy-size-opt" :class="{ active: proxyOrient === 'portrait' }">
            <input type="radio" value="portrait" v-model="proxyOrient" hidden />
            <i class="bi bi-file-earmark"></i> Vertical
          </label>
          <label class="proxy-size-opt" :class="{ active: proxyOrient === 'landscape' }">
            <input type="radio" value="landscape" v-model="proxyOrient" hidden />
            <i class="bi bi-file-earmark-text"></i> Horizontal
          </label>
        </div>

        <label class="proxy-label">Tamaño de papel</label>
        <div class="proxy-sizes">
          <label v-for="p in PAPER_SIZES" :key="p.value" class="proxy-size-opt" :class="{ active: proxyPaperSize === p.value }">
            <input type="radio" :value="p.value" v-model="proxyPaperSize" hidden />
            <i class="bi bi-file-earmark"></i> {{ p.label }}
          </label>
        </div>

        <label class="proxy-label">Márgenes</label>
        <div class="proxy-adjust-row" style="margin-bottom:1rem">
          <span class="proxy-adjust-lbl">Margen</span>
          <input type="number" v-model.number="proxyMargin" min="0.1" max="2" step="0.05" class="proxy-margin-input" />
          <span class="proxy-adjust-val" style="width:auto">in</span>
        </div>
        <p v-if="marginTooSmall" class="proxy-warn proxy-warn--danger">
          <i class="bi bi-exclamation-triangle-fill"></i>
          El margen es demasiado pequeño ({{ MIN_MARGIN }} in). Es posible que tu impresora recorte los bordes.
        </p>

        <label class="proxy-label">Ajustes de imagen</label>
        <div class="proxy-adjust-row">
          <span class="proxy-adjust-lbl">Brillo</span>
          <input type="range" v-model.number="proxyBrightness" min="0" max="100" step="5" class="proxy-slider" />
          <span class="proxy-adjust-val">{{ proxyBrightness > 0 ? '+' : '' }}{{ proxyBrightness }}</span>
        </div>
        <div class="proxy-adjust-row">
          <span class="proxy-adjust-lbl">Contraste</span>
          <input type="range" v-model.number="proxyContrast" min="0" max="100" step="5" class="proxy-slider" />
          <span class="proxy-adjust-val">{{ proxyContrast > 0 ? '+' : '' }}{{ proxyContrast }}</span>
        </div>

        <p class="proxy-warn">
          <i class="bi bi-exclamation-triangle"></i>
          Te recomendamos utilizar brillo y contrastes positivos para mejorar la legibilidad de las cartas impresas, especialmente si tu impresora no es de alta calidad.
        </p>
        <button class="btn-filled proxy-print-btn" :disabled="proxyCardCount === 0 || proxyGenerating" @click="printProxies">
          <span v-if="proxyGenerating"><i class="bi bi-hourglass-split"></i> Generando PDF…</span>
          <span v-else><i class="bi bi-file-earmark-pdf-fill"></i> Descargar PDF</span>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.proxy-overlay  { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 3000; padding: 4.5rem 1rem 1rem; overflow: hidden; }
.proxy-modal    { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; box-shadow: var(--card-shadow); width: 100%; max-width: 480px; max-height: calc(100vh - 6rem); overflow-y: auto; padding: 1.75rem; position: relative; }
.proxy-close    { position: absolute; top: 0.75rem; right: 0.75rem; background: none; border: none; color: var(--text-secondary); font-size: 1.1rem; cursor: pointer; line-height: 1; }
.proxy-close:hover { color: var(--text-primary); }
.proxy-title    { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.6rem; display: flex; align-items: center; gap: 0.5rem; }
.proxy-info     { font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 1.25rem; }
.proxy-label    { display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
.proxy-orient-row { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.proxy-orient-row .proxy-size-opt { flex: 1; justify-content: center; }
.proxy-sizes    { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1.5rem; }
.proxy-size-opt { display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 0.75rem; border-radius: 6px; border: 1px solid var(--input-border); cursor: pointer; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); background: transparent; transition: background-color 0.15s, color 0.15s, border-color 0.15s; user-select: none; }
.proxy-size-opt.active { background: var(--btn-bg); color: var(--btn-text); border-color: var(--btn-bg); }
.proxy-size-opt:hover:not(.active) { background: var(--input-bg); color: var(--text-primary); }
.proxy-adjust-row { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem; }
.proxy-adjust-lbl { font-size: 0.82rem; color: var(--text-secondary); width: 5rem; flex-shrink: 0; }
.proxy-slider { flex: 1; accent-color: var(--btn-bg); cursor: pointer; }
.proxy-adjust-val { font-size: 0.82rem; color: var(--text-primary); font-weight: 600; width: 2.5rem; text-align: right; flex-shrink: 0; }
.proxy-margin-input { width: 5rem; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 6px; color: var(--text-primary); padding: 0.3rem 0.5rem; font-size: 0.88rem; outline: none; }
.proxy-margin-input:focus { border-color: var(--btn-bg); }
.proxy-warn     { font-size: 0.78rem; color: var(--text-secondary); background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 6px; padding: 0.5rem 0.65rem; margin-top: 0.5rem; margin-bottom: 0.9rem; line-height: 1.4; }
.proxy-warn i   { color: #f59e0b; margin-right: 0.3rem; }
.proxy-warn--danger { color: #ff6b6b; background: rgba(220,53,69,0.08); border-color: rgba(220,53,69,0.35); }
.proxy-warn--danger i { color: #ff6b6b; }
.proxy-print-btn { width: 100%; justify-content: center; gap: 0.5rem; padding: 0.5rem 1rem; font-size: 0.9rem; display: flex; }
</style>
