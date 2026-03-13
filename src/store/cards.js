import { defineStore } from 'pinia'
import axios from 'axios'

export const useCardsStore = defineStore('cards', {

  state: () => ({
    driveCards: [],
    metaCards: [],
    refData: null,
    loaded: false,
  }),

  actions: {

    async load() {
      if (this.loaded) return
      const [driveRes, metaRes] = await Promise.all([
        axios.get('/api/drive/cards/db'),
        axios.get('/api/cards/search'),
      ])
      this.driveCards = driveRes.data
      this.metaCards  = metaRes.data
      this.loaded = true
    },

    async reload() {
      this.loaded = false
      await this.load()
    },

    async loadRef() {
      if (this.refData) return
      const { data } = await axios.get('/api/cards/ref')
      this.refData = data
    },

  },

})
