import { defineStore } from 'pinia'
import axios from 'axios'

export const useDecksStore = defineStore('decks', {

  state: () => ({
    publicDecks:       [],
    publicLoaded:      false,

    myDecks:           [],
    myDecksUserId:     null,  // whose decks are cached
    myLoaded:          false,
  }),

  actions: {

    async loadPublic() {
      if (this.publicLoaded) return
      try {
        const { data } = await axios.get('/api/drive/decklists?publicDecks=true')
        this.publicDecks  = data
        this.publicLoaded = true
      } catch {
        this.publicDecks = []
      }
    },

    async loadMine(userId) {
      if (this.myLoaded && this.myDecksUserId === userId) return
      try {
        const { data } = await axios.get(`/api/drive/decklists?userId=${userId}`)
        this.myDecks      = data
        this.myDecksUserId = userId
        this.myLoaded     = true
      } catch {
        this.myDecks = []
      }
    },

    removeMyDeck(id) {
      this.myDecks = this.myDecks.filter(d => d.id !== id)
      // also remove from public list in case it was there
      this.publicDecks = this.publicDecks.filter(d => d.id !== id)
    },

    invalidatePublic() {
      this.publicLoaded = false
    },

    invalidateMine() {
      this.myLoaded = false
    },

  },

})
