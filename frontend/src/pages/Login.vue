<template>
  <div class="login-page">
    <h1>超级大满贯 Online</h1>
    <div class="card">
      <input v-model="username" placeholder="用户名" />
      <input v-model="password" type="password" placeholder="密码" @keyup.enter="doLogin" />
      <p class="err" v-if="err">{{ err }}</p>
      <button @click="doLogin">登录</button>
      <button class="ghost" @click="doRegister">注册新账号</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'

const username = ref('')
const password = ref('')
const err = ref('')
const router = useRouter()
const user = useUserStore()

async function doLogin() {
  err.value = ''
  try {
    await user.login(username.value, password.value)
    router.push('/lobby')
  } catch (e: any) {
    err.value = e.message
  }
}

async function doRegister() {
  err.value = ''
  try {
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value }),
    })
    const j = await r.json()
    if (!j.success) throw new Error(j.error || '注册失败')
    await doLogin()
  } catch (e: any) {
    err.value = e.message
  }
}
</script>
