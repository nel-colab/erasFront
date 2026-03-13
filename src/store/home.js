import { defineStore } from 'pinia'
import axios from 'axios'
import { useCardsStore } from './cards'

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

    async loadHome() {
      if (this.loaded) return

      // Ensure cards are loaded so we can resolve deck cover images
      const cardsStore = useCardsStore()
      await cardsStore.load()

      const cardMap = {}
      cardsStore.driveCards.forEach(c => { cardMap[c.id] = c.image_url })

      const { data } = await axios.get('/api/drive/front-content/home')

      if (data.edition) {
        this.selectedEdition = data.edition
        this.latestSet = {
          name:     data.edition.editionName,
          subtitle: data.edition.editionDescription || '',
          image:    data.edition.editionImage,
        }
      }

      if (data.decks) {
        data.decks.forEach((deck, i) => {
          if (!deck) return
          const slot = this.topDecks.decks[i]
          slot.name      = deck.deckName
          slot.author    = deck.username
          slot.cardImage = deck.deckImage ? (cardMap[deck.deckImage] ?? null) : null
          slot.raw       = deck
        })
      }

      this.loaded = true
    },

  },

})
