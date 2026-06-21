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
import { effectSummonPending } from '@/composables/effectSummonState'

const props = defineProps({
  state:      { type: Object,  required: true },
  isOpponent: { type: Boolean, default: false },
})

const game = useGameStore()
const targetPlayerId = computed(() =>
  props.isOpponent ? (game.opponentState?.userId ?? null) : null
)

function onEffectYes() { game.drawCard(); effectSummonPending.value = false }
function onEffectNo()  { effectSummonPending.value = false }
</script>

<template>
  <div
    class="player-half"
    :class="{ opponent: isOpponent }"
    @click="!isOpponent && effectSummonPending && onEffectNo()"
    @contextmenu.prevent="!isOpponent && effectSummonPending && onEffectNo()"
  >

    <!-- Life column — spans both rows via grid -->
    <div class="lc">
      <div class="lc-inner">
        <ResourceCounter :isOpponent="isOpponent" :resourceCount="state.resourceCount ?? 0" />
        <LifeStack
          :slots="state.lifeStack"
          :isOpponent="isOpponent"
        />
      </div>
    </div>

    <!-- Field — middle column, row 1 (player) / row 2 (opponent) -->
    <div class="fc">
      <FieldZone
        :slots="state.field"
        :isOpponent="isOpponent"
      />
    </div>

    <!-- Hand — middle column, row 2 (player) / row 1 (opponent) -->
    <div class="hc" style="position:relative">
      <HandZone :slots="state.hand" :isOpponent="isOpponent" />

      <!-- Effect summon prompt — own player only, floats over the hand -->
      <Transition name="es-pop">
        <div
          v-if="!isOpponent && effectSummonPending"
          class="effect-prompt"
          @click.stop
          @contextmenu.prevent.stop
        >
          <span class="es-label">¿Invocación por efecto?</span>
          <div class="es-btns">
            <button class="es-btn yes" @click.stop="onEffectYes">Sí — Robar</button>
            <button class="es-btn no"  @click.stop="onEffectNo">No</button>
          </div>
        </div>
      </Transition>
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
  min-width: 236px;
}

/* Inner wrapper constrains content to life-stack width for visual alignment */
.lc-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  width: 108px;
  height: 100%;
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

/* Effect summon prompt */
.effect-prompt {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: rgba(0,0,0,0.55);
  z-index: 50;
  border-radius: 6px;
}
.es-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0,0,0,0.8);
}
.es-btns { display: flex; gap: 0.5rem; }
.es-btn {
  padding: 0.3rem 1rem;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.2);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s;
}
.es-btn.yes {
  background: rgba(99,102,241,0.7);
  color: #fff;
  border-color: rgba(99,102,241,0.9);
}
.es-btn.yes:hover { background: rgba(99,102,241,0.95); }
.es-btn.no {
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.8);
}
.es-btn.no:hover { background: rgba(255,255,255,0.2); color: #fff; }

.es-pop-enter-active { transition: opacity 0.15s, transform 0.15s; }
.es-pop-leave-active { transition: opacity 0.12s, transform 0.12s; }
.es-pop-enter-from   { opacity: 0; transform: translateY(6px); }
.es-pop-leave-to     { opacity: 0; transform: translateY(4px); }

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
