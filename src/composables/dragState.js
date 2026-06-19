import { ref } from 'vue'

// Module-level reactive so CardToken and FieldZone can share drag context
export const draggingCard = ref(null) // { instanceId, fromZone } | null
