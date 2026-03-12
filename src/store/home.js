import { defineStore } from 'pinia'
import axios from 'axios'

export const useHomeStore = defineStore('home', {

  state: () => ({
    loaded: false,

    selectedEdition: null,

    latestSet: {},

    topDecks: {
      decks: [
        { rank:1,name:'',author:'',cardImage:null,raw:null },
        { rank:2,name:'',author:'',cardImage:null,raw:null },
        { rank:3,name:'',author:'',cardImage:null,raw:null },
        { rank:4,name:'',author:'',cardImage:null,raw:null },
        { rank:5,name:'',author:'',cardImage:null,raw:null },
        { rank:6,name:'',author:'',cardImage:null,raw:null },
      ]
    }

  }),

  actions: {

    async loadHome(cardMap) {

      if (this.loaded) return

      const { data } = await axios.get('/api/drive/front-content/home')

      if (data.edition) {

        this.selectedEdition = data.edition

        this.latestSet = {
          name: data.edition.editionName,
          subtitle: data.edition.editionDescription || '',
          image: data.edition.editionImage
        }

      }

      if (data.decks) {

        data.decks.forEach((deck, i) => {

          if (!deck) return

          const slot = this.topDecks.decks[i]

          slot.name = deck.deckName
          slot.author = deck.username
          slot.cardImage = deck.deckImage ? cardMap[deck.deckImage] : null
          slot.raw = deck

        })

      }

      this.loaded = true

    }

  }

})