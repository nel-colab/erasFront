import { defineStore } from 'pinia'
import axios from 'axios'

const sortEdId = (a, b) => {
  const sa = a.editionId.startsWith('ST'), sb = b.editionId.startsWith('ST')
  if (sa && !sb) return -1; if (!sa && sb) return 1
  return parseFloat(a.editionId.replace(/[^0-9.]/g, '')) - parseFloat(b.editionId.replace(/[^0-9.]/g, ''))
}

export const useEditionsStore = defineStore('editions', {

  state: () => ({
    editions: [],
    loaded: false,
  }),

  getters: {
    sorted(state) {
      return [...state.editions].sort(sortEdId)
    },
    releaseMap(state) {
      const m = new Map()
      state.editions.forEach(ed => m.set(ed.editionId, ed.releaseDate || ''))
      return m
    },
  },

  actions: {
    async load() {
      if (this.loaded) return
      try {
        const { data } = await axios.get('/api/drive/editions')
        this.editions = data
        this.loaded = true
      } catch {
        this.editions = []
      }
    },

    invalidate() {
      this.loaded = false
    },
  },

})
