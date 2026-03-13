import { defineStore } from 'pinia'
import axios from 'axios'

export const useDecksStore = defineStore('decks', {

  state: () => ({
    publicDecks: [],
    loaded: false,
  }),

  actions: {
    async load() {
      if (this.loaded) return
      try {
        const { data } = await axios.get('/api/drive/decklists?publicDecks=true')
        this.publicDecks = data
        this.loaded = true
      } catch {
        this.publicDecks = []
      }
    },

    invalidate() {
      this.loaded = false
    },
  },

})
