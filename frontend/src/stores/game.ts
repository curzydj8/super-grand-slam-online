import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useUserStore } from './user'

export const useGameStore = defineStore('game', () => {
  const roomId = ref('')
  const hand = ref<number[]>([])
  const discards = ref<number[][]>([[], [], [], []])
  const scores = ref<any[]>([])
  const turn = ref(0)

  async function createMatch(aiLevel: number) {
    const user = useUserStore()
    const r = await fetch('/api/match/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...user.authHeader() },
      body: JSON.stringify({ mode: 'ai', ai_level: aiLevel }),
    })
    const j = await r.json()
    if (!j.success) throw new Error(j.error || '创建对局失败')
    roomId.value = j.data.room_id
    hand.value = j.data.hand
    scores.value = j.data.scores
    return j.data.room_id
  }

  async function discard(tile: number) {
    const user = useUserStore()
    const r = await fetch(`/api/match/${roomId.value}/discard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...user.authHeader() },
      body: JSON.stringify({ tile }),
    })
    const j = await r.json()
    if (!j.success) throw new Error(j.error || '出牌失败')
    // 更新手牌：移除打出的 1 张，加入摸到的
    const idx = hand.value.indexOf(tile)
    if (idx >= 0) hand.value.splice(idx, 1)
    if (typeof j.data.draw === 'number') hand.value.push(j.data.draw)
    hand.value.sort((a, b) => a - b)
    return j.data
  }

  return { roomId, hand, discards, scores, turn, createMatch, discard }
})
