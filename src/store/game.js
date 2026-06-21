import { defineStore } from 'pinia'
import { Client } from '@stomp/stompjs'
import { useAuthStore } from './login'
import { targetingSource } from '@/composables/targetingState'

function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws`
}

export const useGameStore = defineStore('game', {
  state: () => ({
    client:                null,
    roomId:                null,
    gameState:             null,
    connected:             false,
    error:                 null,
    targetedInstanceId:    null,
    targetingSourceId:     null,
    revealedCards:         [],
    deckWarning:           null,
    originalDeck:          [],
  }),

  getters: {
    myState: (state) => {
      const auth = useAuthStore()
      return state.gameState?.players?.[auth.userId] ?? null
    },
    opponentState: (state) => {
      const auth = useAuthStore()
      if (!state.gameState?.players) return null
      return Object.values(state.gameState.players).find(p => p.userId !== auth.userId) ?? null
    },
    isMyTurn: (state) => {
      const auth = useAuthStore()
      return state.gameState?.currentTurnUserId === auth.userId
    },
    roomStatus:     (state) => state.gameState?.status           ?? null,
    currentPhase:   (state) => state.gameState?.currentPhase    ?? 'MAIN',
    hostId:         (state) => state.gameState?.hostId           ?? null,
    postGameChoices:(state) => state.gameState?.postGameChoices  ?? {},
    isHost: (state) => {
      const auth = useAuthStore()
      return state.gameState?.hostId === auth.userId
    },
    isFirstPlayer: (state) => {
      const auth = useAuthStore()
      if (!state.gameState?.players) return true
      const ids = Object.keys(state.gameState.players)
      return ids.length === 0 || ids[0] === auth.userId
    },
  },

  actions: {
    connect(roomId) {
      if (this.client?.active) return
      this.roomId = roomId
      const auth  = useAuthStore()

      this.client = new Client({
        brokerURL: wsUrl(),
        connectHeaders: { Authorization: `Bearer ${auth.token}` },
        reconnectDelay: 3000,
        onConnect: () => {
          this.connected = true
          this.client.subscribe(`/topic/room/${roomId}`, (msg) => {
            const update = JSON.parse(msg.body)
            if (update.error) {
              this.error = update.error
            } else {
              this.gameState = update
              this.error = null
              if (['JOIN_ROOM', 'RECONNECT'].includes(update.event)) {
                const auth = useAuthStore()
                const myDeck         = update.players?.[auth.userId]?.deck         ?? []
                const myOriginalDeck = update.players?.[auth.userId]?.originalDeck ?? []
                if (myOriginalDeck.length > 0) {
                  this.originalDeck = [...myOriginalDeck]
                }
                if (update.event === 'JOIN_ROOM') {
                  const missingImage = myOriginalDeck.filter(s => !s.imageUrl)
                  const missingMeta  = myOriginalDeck.filter(s => s.imageUrl && !s.cardType)
                  const warnings = []
                  if (myOriginalDeck.length < 50) warnings.push(`Mazo incompleto: ${myOriginalDeck.length}/50 cartas cargadas`)
                  if (missingImage.length > 0) warnings.push(`${missingImage.length} carta(s) sin imagen en base de datos`)
                  if (missingMeta.length > 0) {
                    const groups = {}
                    missingMeta.forEach(s => { const k = s.cardName || '?'; groups[k] = (groups[k] || 0) + 1 })
                    const parts = Object.entries(groups).map(([name, n]) => n > 1 ? `×${n} ${name}` : name)
                    warnings.push(`Sin metadatos: ${parts.join(', ')}`)
                  }
                  if (warnings.length > 0) {
                    this.deckWarning = warnings.join(' · ')
                    setTimeout(() => { this.deckWarning = null }, 10000)
                  }
                }
              }
              if (update.event === 'REFRESH_CARD_METADATA') {
                const auth = useAuthStore()
                const updatedOriginal = update.players?.[auth.userId]?.originalDeck ?? []
                if (updatedOriginal.length > 0) {
                  this.originalDeck = [...updatedOriginal]
                }
              }
              if (update.event === 'REVEAL_TO_HAND' && update.revealedCardImageUrl) {
                const entry = { id: Date.now() + Math.random(), imageUrl: update.revealedCardImageUrl, name: update.revealedCardName ?? null }
                this.revealedCards.push(entry)
                setTimeout(() => {
                  this.revealedCards = this.revealedCards.filter(c => c.id !== entry.id)
                }, 3000)
              }
              if (update.event === 'TARGET_CARD' && update.targetedInstanceId) {
                const auth = useAuthStore()
                const isActor = update.actorId === auth.userId
                let tgtId = update.targetedInstanceId
                if (!isActor && tgtId.startsWith('zone:')) {
                  if (tgtId.startsWith('zone:opp:'))      tgtId = tgtId.replace('zone:opp:', 'zone:own:')
                  else if (tgtId.startsWith('zone:own:')) tgtId = tgtId.replace('zone:own:', 'zone:opp:')
                }
                this.targetedInstanceId = tgtId
                this.targetingSourceId  = update.targetingSourceInstanceId ?? null
                setTimeout(() => {
                  this.targetedInstanceId = null
                  this.targetingSourceId  = null
                }, 3000)
              }
            }
          })
        },
        onStompError: (frame) => {
          this.error     = frame.headers?.message ?? 'WebSocket error'
          this.connected = false
        },
        onDisconnect: () => {
          this.connected = false
        },
      })

      this.client.activate()
    },

    disconnect() {
      this.client?.deactivate()
      this.client      = null
      this.roomId      = null
      this.gameState   = null
      this.connected   = false
      this.error        = null
      this.deckWarning  = null
      this.originalDeck = []
    },

    sendAction(type, payload = {}) {
      if (!this.client?.connected || !this.roomId) return
      this.client.publish({
        destination: `/app/room/${this.roomId}/action`,
        body: JSON.stringify({ type, payload }),
      })
    },

    joinRoom(deckId, username) { this.sendAction('JOIN_ROOM',    { deckId, username }) },
    drawCard()                  { this.sendAction('DRAW_CARD')                         },
    shuffleDeck()               { this.sendAction('SHUFFLE_DECK')                      },
    passTurn()                  { this.sendAction('PASS_TURN')                         },
    enterEndPhase()             { this.sendAction('ENTER_END_PHASE')                    },
    endTurn()                   { this.sendAction('END_TURN')                           },
    startGame(firstPlayerId)    { this.sendAction('START_GAME', { firstPlayerId })      },
    selectStarter(instanceId)   { this.sendAction('SELECT_STARTER', { instanceId })    },
    confirmMulligan(toBottom)   { this.sendAction('CONFIRM_MULLIGAN', { toBottom })    },
    surrender()                 { this.sendAction('SURRENDER')                          },
    postGameChoice(choice)      { this.sendAction('POST_GAME_CHOICE', { choice })      },
    setMarker(value)            { this.sendAction('SET_MARKER', { value })              },
    forfeit()                   { this.sendAction('FORFEIT')                           },

    moveCard(instanceId, fromZone, toZone, x, y, toPosition, targetPlayerId = null, faceDown = null) {
      if (!targetPlayerId && this.gameState?.players) {
        const auth = useAuthStore()
        const player = this.gameState.players[auth.userId]
        if (player) {
          const fromList = this._getZone(player, fromZone)
          const toList   = this._getZone(player, toZone)
          if (fromList && toList) {
            const idx = fromList.findIndex(c => c.instanceId === instanceId)
            if (idx !== -1) {
              const [card] = fromList.splice(idx, 1)
              if (toZone === 'field')       { card.x = x; card.y = y }
              else                          { card.x = null; card.y = null }
              if (toZone === 'discardPile') card.faceDown = false
              if (toZone === 'deck')        card.faceDown = true
              if (toZone !== 'field')       card.tapped = false
              if (fromZone === 'field' && toZone !== 'field') {
                ;(card.materials ?? []).forEach(m => { m.faceDown = false; m.tapped = false; player.discardPile.push(m) })
                ;(card.resources ?? []).forEach(r => { r.faceDown = false; r.tapped = false; player.discardPile.push(r) })
                card.materials = []; card.resources = []; card.strengthModifier = 0
              }
              toList.push(card)
            }
          }
        }
      }
      this.sendAction('MOVE_CARD', { instanceId, fromZone, toZone, x, y, toPosition, targetPlayerId, ...(faceDown != null && { faceDown }) })
    },

    _getZone(player, zoneName) {
      const map = { hand: 'hand', deck: 'deck', lifeStack: 'lifeStack', tributeZone: 'tributeZone', discardPile: 'discardPile', field: 'field' }
      return player[map[zoneName]] ?? null
    },
    flipCard(instanceId, zone) {
      this.sendAction('FLIP_CARD', { instanceId, zone })
    },

    lifeHeal()    { this.sendAction('LIFE_HEAL')     },
    lifeShuffle() { this.sendAction('LIFE_SHUFFLE')  },
    lifeAllDown() { this.sendAction('LIFE_ALL_DOWN') },
    lifeAllUp()   { this.sendAction('LIFE_ALL_UP')   },
    lifeRestart() { this.sendAction('LIFE_RESTART')  },

    deckReorderTop(instanceIds, position, shuffle) {
      this.sendAction('DECK_REORDER_TOP', { instanceIds, position, shuffle })
    },
    zoneReorder(zone, instanceIds) {
      this.sendAction('ZONE_REORDER', { zone, instanceIds })
    },
    deckIncludeDiscard()  { this.sendAction('DECK_INCLUDE_DISCARD')  },
    deckIncludeTribute()  { this.sendAction('DECK_INCLUDE_TRIBUTE')  },
    tapCard(instanceId, zone, targetPlayerId = null) { this.sendAction('TAP_CARD', { instanceId, zone, targetPlayerId }) },
    setCounter(value)         { this.sendAction('SET_COUNTER', { value }) },
    useResources(amount)      { this.sendAction('USE_RESOURCES', { amount }) },
    grantResource()           { this.sendAction('GRANT_RESOURCE') },

    modifyStrength(instanceId, delta, targetPlayerId = null) {
      this.sendAction('MODIFY_STRENGTH', { instanceId, delta, targetPlayerId })
    },
    addMaterial({ instanceId, fromZone, targetInstanceId, attachmentChoice }) {
      this.sendAction('ADD_MATERIAL', { instanceId, fromZone, targetInstanceId, attachmentChoice })
    },
    addResource({ instanceId, fromZone, targetInstanceId }) {
      this.sendAction('ADD_RESOURCE', { instanceId, fromZone, targetInstanceId })
    },
    moveFromAttachment({ instanceId, attachmentOf, attachmentType, toZone, faceDown = false, position = 'bottom', targetPlayerId = null }) {
      this.sendAction('MOVE_FROM_ATTACHMENT', { instanceId, attachmentOf, attachmentType, toZone, faceDown, position, targetPlayerId })
    },
    swapWithMain({ instanceId, attachmentType, parentId, targetPlayerId = null }) {
      this.sendAction('SWAP_WITH_MAIN', { instanceId, attachmentType, parentId, targetPlayerId })
    },
    revealToHand(instanceId) {
      this.sendAction('REVEAL_TO_HAND', { instanceId })
    },
    targetCard(targetInstanceId) {
      const sourceInstanceId = targetingSource.value
      targetingSource.value = null
      this.sendAction('TARGET_CARD', { targetInstanceId, sourceInstanceId })
    },
    refreshCardMetadata(cardId) {
      this.sendAction('REFRESH_CARD_METADATA', { cardId })
    },

    reclassifyAttachment({ instanceId, fromType, parentId, targetPlayerId = null }) {
      this.sendAction('RECLASSIFY_ATTACHMENT', { instanceId, fromType, parentId, targetPlayerId })
    },
    reorderAttachment({ parentId, attachmentType, instanceIds, targetPlayerId = null }) {
      this.sendAction('REORDER_ATTACHMENT', { parentId, attachmentType, instanceIds, targetPlayerId })
    },
    specialSummon({ summonedId, fromZone, summonerId, summonType }) {
      this.sendAction('SPECIAL_SUMMON', { summonedId, fromZone, summonerId, summonType })
    },
  },
})
