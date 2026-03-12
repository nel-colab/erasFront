import { defineStore } from 'pinia'
import axios from 'axios'

export const useCardsStore = defineStore('cards', {

  state: () => ({
    driveCards: [],
    metaCards: [],
    refData: null,
    loaded: false
  }),

  actions: {

    async loadCards(edition) {

      if (this.loaded && this.lastEdition === edition) return

      const p = new URLSearchParams()
      if (edition) p.set('edition', edition)

      const [driveRes, metaRes] = await Promise.all([
        axios.get('/api/drive/cards/db?' + p),
        axios.get('/api/cards/search?' + p)
      ])

      this.driveCards = driveRes.data
      this.metaCards = metaRes.data
      this.lastEdition = edition
      this.loaded = true
    },

    async loadRef() {
      if (this.refData) return
      const { data } = await axios.get('/api/cards/ref')
      this.refData = data
    }

  }

})