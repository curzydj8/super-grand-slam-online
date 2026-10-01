<template>
  <div class="mahjong-table" ref="wrapRef"></div>
  <div class="hand-bar">
    <button
      v-for="(t, i) in hand"
      :key="i"
      class="tile"
      @click="$emit('discard', t)"
    >{{ tileName(t) }}</button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import * as PIXI from 'pixi.js'

defineProps<{ hand: number[] }>()
defineEmits<{ (e: 'discard', tile: number): void }>()

const wrapRef = ref<HTMLDivElement>()
let app: PIXI.Application | null = null

const NAMES = ['一万','二万','三万','四万','五万','六万','七万','八万','九万',
  '一筒','二筒','三筒','四筒','五筒','六筒','七筒','八筒','九筒',
  '一条','二条','三条','四条','五条','六条','七条','八条','九条',
  '东','南','西','北','白','发','中']
function tileName(t: number) { return NAMES[t] || '?' }

// Phase 1：PixiJS 渲染麻将桌（桌布、牌墙动画、打出牌）。
// MVP 先用 DOM 手牌保证可玩，Pixi 画布做桌面背景层。
async function initPixi() {
  if (!wrapRef.value) return
  app = new PIXI.Application()
  await app.init({
    width: wrapRef.value.clientWidth || 800,
    height: 320,
    backgroundColor: 0x0b5d3b,   // 街机麻将桌布绿
  })
  wrapRef.value.appendChild(app.canvas)
  // 中央 Logo 文字
  const style = new PIXI.TextStyle({ fill: 0xffffff, fontSize: 42, fontWeight: 'bold' })
  const logo = new PIXI.Text({ text: '超级大满贯', style })
  logo.anchor.set(0.5)
  logo.position.set(app.screen.width / 2, app.screen.height / 2)
  app.stage.addChild(logo)
}

onMounted(initPixi)
onUnmounted(() => { app?.destroy(true); app = null })
</script>

<style scoped>
.hand-bar { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
.tile { width: 44px; height: 60px; font-size: 15px; cursor: pointer;
  background: #fdfdf5; border: 2px solid #333; border-radius: 6px; }
.tile:hover { border-color: #e33; transform: translateY(-4px); }
.mahjong-table canvas { width: 100%; border-radius: 12px; }
</style>
