<template>
  <div class="rank-page">
    <h1>排行榜</h1>
    <div class="tabs">
      <button v-for="b in boards" :key="b.key" @click="load(b.key)">{{ b.name }}</button>
    </div>
    <table>
      <tr><th>排名</th><th>玩家</th><th>段位</th><th>数据</th></tr>
      <tr v-for="r in rows" :key="r.uid">
        <td>{{ r.rank }}</td><td>{{ r.nickname }}</td><td>{{ r.rank_name }}</td>
        <td>{{ stat(r) }}</td>
      </tr>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '../stores/user'

const user = useUserStore()
const rows = ref<any[]>([])
const cur = ref('gold')
const boards = [
  { key: 'gold', name: '金币榜' },
  { key: 'winrate', name: '胜率榜' },
  { key: 'rank', name: '段位榜' },
  { key: 'streak', name: '连胜榜' },
]

function stat(r: any) {
  if (cur.value === 'gold') return r.gold
  if (cur.value === 'winrate') return r.win_rate + '%'
  if (cur.value === 'streak') return r.win_streak + '连'
  return r.rank_score
}

async function load(key: string) {
  cur.value = key
  const r = await fetch(`/api/rank/${key}`, { headers: user.authHeader() })
  const j = await r.json()
  if (j.success) rows.value = j.data
}
load('gold')
</script>
