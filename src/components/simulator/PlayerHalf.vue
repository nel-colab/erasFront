<script setup>
import LifeStack      from './LifeStack.vue'
import FieldZone      from './FieldZone.vue'
import DeckZone       from './DeckZone.vue'
import TributeZone    from './TributeZone.vue'
import DiscardZone    from './DiscardZone.vue'
import HandZone       from './HandZone.vue'
import DeckBottomZone   from './DeckBottomZone.vue'
import ResourceCounter  from './ResourceCounter.vue'
import { computed } from 'vue'
import { useGameStore } from '@/store/game'

const props = defineProps({
  state:      { type: Object,  required: true },
  isOpponent: { type: Boolean, default: false },
})

const game = useGameStore()
const targetPlayerId = computed(() =>
  props.isOpponent ? (game.opponentState?.userId ?? null) : null
)
</script>

<template>
  <div class="player-half" :class="{ opponent: isOpponent }">

    <!-- Life column — spans both rows via grid -->
    <div class="lc">
      <ResourceCounter :isOpponent="isOpponent" :resourceCount="state.resourceCount ?? 0" />
      <LifeStack
        :slots="state.lifeStack"
        :isOpponent="isOpponent"
      />
    </div>

    <!-- Field — middle column, row 1 (player) / row 2 (opponent) -->
    <div class="fc">
      <FieldZone
        :slots="state.field"
        :isOpponent="isOpponent"
      />
    </div>

    <!-- Hand — middle column, row 2 (player) / row 1 (opponent) -->
    <div class="hc">
      <HandZone :slots="state.hand" :isOpponent="isOpponent" />
    </div>

    <!-- Right column — spans both rows via grid -->
    <div class="rc">
      <DeckZone
        :count="state.deck.length"
        :deck="state.deck"
        :isOpponent="isOpponent"
      />
      <TributeZone
        :slots="state.tributeZone"
        :isOpponent="isOpponent"
        :targetPlayerId="targetPlayerId"
      />
      <DeckBottomZone :isOpponent="isOpponent" />
      <DiscardZone
        :slots="state.discardPile"
        :isOpponent="isOpponent"
        :targetPlayerId="targetPlayerId"
      />
    </div>

  </div>
</template>

<style scoped>
.player-half {
  flex: 1;
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: 1fr auto;
  min-height: 0;
  overflow: hidden;
  gap: 0.25rem;
  padding: 0.25rem;
}

/* Opponent: hand on top, field below */
.player-half.opponent {
  grid-template-rows: auto 1fr;
}

/* Life column: full height */
.lc {
  grid-column: 1;
  grid-row: 1 / 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  min-width: 130px;
}

/* Field: middle column */
.fc {
  grid-column: 2;
  grid-row: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
}
.player-half.opponent .fc {
  grid-row: 2;
}

/* Hand: middle column, other row */
.hc {
  grid-column: 2;
  grid-row: 2;
  overflow: hidden;
}
.player-half.opponent .hc {
  grid-row: 1;
}

/* Right column: full height */
.rc {
  grid-column: 3;
  grid-row: 1 / 3;
  width: 236px;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto auto;
  gap: 0.3rem;
  padding: 0.2rem 0;
  align-content: start;
  overflow: visible;
}
</style>
