<template>
  <div class="lobby">
    <header>
      <h1>超级大满贯 Online</h1>
      <div class="me" v-if="user.user">
        <span>{{ user.user.nickname }}</span>
        <span>Lv.{{ user.user.level }}</span>
        <span>{{ user.user.rank }}</span>
        <span>金币 {{ user.user.gold }}</span>
        <button class="ghost" @click="logout">退出</button>
      </div>
    </header>
    <main>
      <section class="card">
        <h2>单机 AI 对战</h2>
        <p>选择 AI 难度，开始一局半庄（8 局）。</p>
        <div class="levels">
          <button v-for="lv in [1,2,3,4]" :key="lv" @click="start(lv)">
            LV{{ lv }}{{ ['', ' 新手', ' 进阶', ' 高手', ' 大师'][lv] }}
          </button>
        </div>
      </section>
      <section class="card">
        <h2>快速入口</h2>
        <button @click="$router.push('/rank')">排行榜</button>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { useGameStore } from '../stores/game'

const user = useUserStore()
const game = useGameStore()
const router = useRouter()

onMounted(() => user.fetchMe())

async function start(lv: number) {
  const roomId = await game.createMatch(lv)
  router.push(`/game/${roomId}`)
}

function logout() {
  user.logout()
  router.push('/login')
}
</script>
