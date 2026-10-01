<template>
  <div class="game-page">
    <MahjongTable :hand="game.hand" @discard="onDiscard" />
    <div class="scores">
      <div v-for="s in game.scores" :key="s.seat">
        {{ s.nickname }}：{{ s.score }}
      </div>
    </div>
    <div class="events" v-if="lastEvent">{{ lastEvent }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '../stores/game'
import MahjongTable from '../components/MahjongTable.vue'

const game = useGameStore()
const lastEvent = ref('')

async function onDiscard(tile: number) {
  const ev = await game.discard(tile)
  if (ev.match_event) {
    const m = ev.match_event
    lastEvent.value = `${m.yaku.map((y: any) => y[0]).join(' ')} ${m.score}点`
  }
}
</script>
