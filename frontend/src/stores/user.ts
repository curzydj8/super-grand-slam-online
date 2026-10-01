import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface UserInfo {
  uid: number
  nickname: string
  level: number
  gold: number
  diamond: number
  rank: string
}

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('sgs_token') || '')
  const user = ref<UserInfo | null>(null)

  async function login(username: string, password: string) {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const j = await r.json()
    if (!j.success) throw new Error(j.error || '登录失败')
    token.value = j.data.token
    user.value = j.data.user
    localStorage.setItem('sgs_token', token.value)
  }

  async function fetchMe() {
    if (!token.value) return
    const r = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token.value}` },
    })
    const j = await r.json()
    if (j.success) user.value = j.data
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('sgs_token')
  }

  function authHeader() {
    return { Authorization: `Bearer ${token.value}` }
  }

  return { token, user, login, fetchMe, logout, authHeader }
})
