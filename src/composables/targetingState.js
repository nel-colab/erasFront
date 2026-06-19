import { ref } from 'vue'

// Module-level: the instanceId of the card that triggered "Hacer objetivo"
// null = not in targeting mode
export const targetingSource = ref(null)
