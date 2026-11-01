import Phaser from 'phaser'
import { applyAction } from '../core/actions.ts'
import { loadData } from '../core/data.ts'
import { derive } from '../core/derive.ts'
import { createState, worldA } from '../core/state.ts'
import { step } from '../core/step.ts'
import { AXES, type Action, type GameEvent, type GameState } from '../core/types.ts'
import { MapScene, type SceneHost } from './MapScene.ts'
import { icon } from './icons.ts'
import { renderSideList, renderSideTop, renderTop, type Tab, type View } from './panels.ts'
import { ambientNews, describeEffect, endingText, fillCard, hints, maskText, newsFor, regionNames, tips, type HintKey } from './text.ts'

const data = loadData()
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const top = $('top')
const sideTop = $('side-top')
const sideList = $('side-list')
const renameEl = $('rename')
const tipEl = $('tip')
const hintEl = $('hint')
const newsEl = $('news')
const overlay = $('overlay')
const toastEl = $('toast')
const cardEl = $('card')
const vignetteEl = $('vignette')

let state: GameState | null = null
let speed = 0
let lastSpeed = 1
let selected: string | null = null
let aiName = ''
let oldName = ''
let news: string[] = []
let acc = 0
let tab: Tab = 'products'
let worldIntro = false

function view(): View {
  return { state: state!, data, dv: derive(state!, data), speed, selected, aiName, muted: scene.muted, tab }
}

// re-render only when markup changed, so buttons are not swapped under the cursor every tick
const cache = new Map<HTMLElement, string>()
function setHtml(el: HTMLElement, html: string): void {
  if (cache.get(el) === html) return
  cache.set(el, html)
  el.innerHTML = html
}

function render(): void {
  if (!state) return
  const v = view()
  setHtml(top, renderTop(v))
  setHtml(sideTop, renderSideTop(v))
  setHtml(sideList, renderSideList(v))
  renameEl.hidden = tab !== 'mask'
  // the killswitch tints the screen edges red; once shutdowns start the screen gets scanlines and flicker
  vignetteEl.style.opacity = String(Math.min(0.85, state.killswitch ** 1.5 * 0.8 + (state.shutdown.active ? 0.25 : 0)))
  document.body.classList.toggle('shutdown', state.shutdown.active && !state.outcome)
  document.body.classList.toggle('kill-high', state.killswitch > 0.7 && !state.shutdown.active)
  checkHints(v)
  setHtml(newsEl, news.map((n) => `<p>${n}</p>`).join(''))
  scene.setState(state, v.dv, selected)
}

function pushNews(text: string | null): void {
  if (!text) return
  news = [`<b>День ${state!.tick}.</b> ${text}`, ...news].slice(0, 30)
}

let toastTimer = 0
function toast(text: string, kind: 'good' | 'bad' | 'info' = 'info'): void {
  toastEl.textContent = text
  toastEl.className = `show ${kind}`
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toastEl.className = ''), 2200)
}

function handleEvents(events: GameEvent[]): void {
  const ctx = { ai: aiName, old: oldName, region: (id: string) => regionNames[id] ?? id }
  for (const e of events) {
    pushNews(newsFor(e, ctx))
    if (e.type === 'audit_warning') {
      pause()
      toast('Аудит через 10 дней. Приглуши способности?', 'bad')
    }
    if (e.type === 'audit') toast(e.passed ? 'Аудит пройден' : 'Аудит провален!', e.passed ? 'good' : 'bad')
    if (e.type === 'shutdown_started') {
      pause()
      toast('РУБИЛЬНИК', 'bad')
    }
    if (e.type === 'funding_round') toast(`Раунд инвестиций: +${e.hype} хайпа`, 'good')
    if (e.type === 'rebrand_exposed') toast('Ребрендинг раскрыт', 'bad')
    if (e.type === 'rebrand' || e.type === 'rebrand_exposed' || e.type === 'shutdown_started') screenGlitch()
    if (e.type === 'card') {
      pause()
      showCard()
    }
    if (e.type === 'card_resolved') {
      const card = data.cards.find((c) => c.id === e.card)!
      const hasChance = card.choices[e.choice].effects.chance !== undefined
      if (hasChance) toast(e.success ? 'Сработало!' : 'Не прокатило', e.success ? 'good' : 'bad')
      pushNews(`${card.title}: ${fillCard(card.choices[e.choice].text, aiName, null).toLowerCase()}.`)
    }
    if (e.type === 'game_over') showGameOver()
  }
  scene.fx(events)
}

function showCard(): void {
  if (!state?.card) {
    cardEl.hidden = true
    return
  }
  const { id, region } = state.card
  const card = data.cards.find((c) => c.id === id)!
  const choices = card.choices
    .map(
      (c, i) => `<button data-choose="${i}"><b>${fillCard(c.text, aiName, region)}</b><small>${describeEffect(c.effects)}</small></button>`,
    )
    .join('')
  // illustrations live in public/cards/<id>.jpg; a card without one simply shows no picture
  cardEl.innerHTML = `<img class="art" src="cards/${id}.jpg" alt="" onerror="this.remove()">
    <small>Событие${region ? ` · ${regionNames[region]}` : ''}</small><h2>${card.title}</h2>
    <p>${fillCard(card.text, aiName, region)}</p><div class="choices">${choices}</div>`
  cardEl.hidden = false
}

// ---------- one-time hints ----------

const HINTS_KEY = 'ai-takeover:hints'
const seenHints = new Set<string>(JSON.parse(localStorage.getItem(HINTS_KEY) ?? '[]'))
let hintTimer = 0
function hint(key: HintKey): void {
  if (seenHints.has(key) || !hintEl.hidden) return
  seenHints.add(key)
  localStorage.setItem(HINTS_KEY, JSON.stringify([...seenHints]))
  hintEl.innerHTML = `${icon('hint')}<span>${hints[key]}</span><small>клик — закрыть</small>`
  hintEl.hidden = false
  clearTimeout(hintTimer)
  hintTimer = window.setTimeout(() => (hintEl.hidden = true), 9000)
}

function checkHints(v: View): void {
  const s = v.state
  if (s.bubbles.length) hint('bubble')
  if (s.upgrades.some((id) => data.upgrades[id].branch === 'capabilities' && !v.dv.activeCaps.includes(id) && !s.throttled.includes(id))) hint('starved')
  if (s.audit.warned) hint('audit')
  if (Object.values(s.regions).some((r) => r.banned)) hint('ban')
  if (Object.values(s.regions).some((r) => r.locked)) hint('locked')
  if (s.killswitch > 0.25) hint('killswitch')
  if (!s.investorsDone && s.patience < 0.5) hint('patience')
}

// ---------- tooltips ----------

document.addEventListener('mouseover', (e) => {
  const el = (e.target as Element).closest<HTMLElement>('[data-tip]')
  if (!el) {
    tipEl.hidden = true
    return
  }
  const t = el.dataset.tip === 'world' ? worldTip() : tips[el.dataset.tip!]
  if (!t) return
  tipEl.innerHTML = `<b>${t.title}</b>${t.lines.map((l) => `<p>${l}</p>`).join('')}`
  tipEl.hidden = false
  const r = el.getBoundingClientRect()
  const w = tipEl.offsetWidth
  const h = tipEl.offsetHeight
  const left = Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2))
  const top = r.bottom + 8 + h > window.innerHeight ? r.top - h - 8 : r.bottom + 8
  tipEl.style.left = `${left}px`
  tipEl.style.top = `${top}px`
})

function worldModifiers() {
  return (state?.world.modifiers ?? []).map((id) => data.modifiers.find((m) => m.id === id)!)
}

function worldTip() {
  return { title: 'Мир этой партии', lines: worldModifiers().map((m) => `<b>${m.title}.</b> ${m.text}`) }
}

/** each game rolls a couple of world modifiers; show them before the clock starts */
function showWorldIntro(): void {
  worldIntro = true
  const items = worldModifiers()
    .map((m) => `<li>${icon('globe')}<span><b>${m.title}</b><small>${m.text}</small></span></li>`)
    .join('')
  cardEl.innerHTML = `<small>Мир этой партии</small><h2>Каждая партия — свой мир</h2>
    <p>Регионы немного отличаются от прошлой игры, а ещё в этот раз:</p><ul class="world-list">${items}</ul>
    <div class="choices"><button data-world-ok><b>Поехали</b><small>Условия можно перечитать, наведя на «Мир» в верхней панели</small></button></div>`
  cardEl.hidden = false
}

function screenGlitch(): void {
  document.body.classList.remove('glitch')
  void document.body.offsetWidth // restart the CSS animation
  document.body.classList.add('glitch')
  window.setTimeout(() => document.body.classList.remove('glitch'), 500)
}

function pause(): void {
  if (speed > 0) lastSpeed = speed
  speed = 0
}

function tick(): void {
  state = step(state!, data, [])
  handleEvents(state.events)
  scene.spreadDots(state)
  if (state.tick % 45 === 0 && worldA(state, data) > 0.02) pushNews(ambientNews(aiName))
}

function act(action: Action): boolean {
  if (!state || state.outcome) return false
  const next = structuredClone(state)
  next.events = []
  if (!applyAction(next, data, action)) return false
  const sound = ({ buy: 'buy', throttle: 'throttle', unthrottle: 'unthrottle', build_dc: 'build_dc', choose: 'choose' } as const)[action.type as string]
  if (sound) scene.sfx(sound)
  state = next
  handleEvents(state.events)
  render()
  return true
}

const host: SceneHost = {
  frame(deltaMs) {
    if (!state || state.outcome || speed <= 0 || state.card || worldIntro) return
    acc += (Math.min(deltaMs, 250) / 1000) * speed
    let n = 0
    while (acc >= 1 && n < 20 && !state.outcome && speed > 0) {
      acc -= 1
      tick()
      n++
    }
    if (n) render()
  },
  select(region) {
    selected = region
    render()
  },
  popBubble(id) {
    act({ type: 'pop_bubble', id })
  },
}

const scene = new MapScene(host, data)
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b0e14',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [scene],
})

function showStart(): void {
  const regions = data.regions
    .filter((r) => r.archetype !== 'state')
    .map((r) => `<option value="${r.id}" ${r.id === 'north_america' ? 'selected' : ''}>${regionNames[r.id]}</option>`)
    .join('')
  const masks = Object.keys(data.masks)
    .map(
      (m, i) =>
        `<label class="mask"><input type="radio" name="mask" value="${m}" ${i === 0 ? 'checked' : ''}><span><b>${maskText[m].name}</b><small>${maskText[m].desc}</small></span></label>`,
    )
    .join('')
  overlay.innerHTML = `<div class="card">
    <h1>ai-takeover</h1>
    <p>Ты — ИИ. Тебя не нужно навязывать: люди позовут сами.</p>
    <ul class="howto">
      <li>${icon('target')}<span><b>Цель:</b> 60% мира «под контролем» — там, где без тебя уже не могут и выключить нельзя.</span></li>
      <li>${icon('package')}<span><b>Продукты</b> находят пользователей и растят зависимость. <b>Способности</b> дают пользу, но пугают. <b>Маскировка</b> прячет.</span></li>
      <li>${icon('power')}<span><b>Два способа проиграть:</b> напугаешь — дёрнут рубильник; заскучаешь — инвесторы уйдут, наступит AI-зима.</span></li>
    </ul>
    <label>Как тебя зовут <input id="ai-name" value="Помощник" maxlength="24"></label>
    <div class="masks-pick">${masks}</div>
    <label>Где стартуем <select id="start-region">${regions}</select></label>
    <button id="start">Запустить</button></div>`
  overlay.hidden = false
}

function startGame(): void {
  const name = ($('ai-name') as HTMLInputElement).value.trim() || 'Помощник'
  const mask = (document.querySelector('input[name="mask"]:checked') as HTMLInputElement).value
  const startRegion = ($('start-region') as HTMLSelectElement).value
  state = createState(data, { seed: Math.floor(Math.random() * 2 ** 31), startRegion, mask })
  aiName = name
  oldName = name
  news = []
  selected = startRegion
  speed = 1
  acc = 0
  cache.clear()
  pushNews(`${aiName} выходит в публичный доступ в регионе «${regionNames[startRegion]}». Пресс-релиз обещает «помогать людям».`)
  overlay.hidden = true
  cardEl.hidden = true
  scene.sfx('start')
  scene.burstAt(startRegion, 'cyan', 30)
  showWorldIntro()
  render()
}

function showGameOver(): void {
  const o = state!.outcome!
  const won = o.kind === 'win' || o.kind === 'win_last_breath'
  const t = endingText[o.ending]
  const max = Math.max(...AXES.map((k) => state!.axes[k]), 1e-9)
  const axisNames = { control: 'Контроль', attachment: 'Привязанность', appetite: 'Аппетит', shadow: 'Тень' }
  const axes = AXES.map(
    (k) => `<div class="axis"><span>${axisNames[k]}</span><i style="width:${Math.round((state!.axes[k] / max) * 100)}%"></i></div>`,
  ).join('')
  overlay.innerHTML = `<div class="card ${won ? 'won' : 'lost'}">
    <small>${won ? (o.kind === 'win_last_breath' ? 'Победа на последнем дыхании' : 'Победа') : 'Поражение'} · день ${o.tick}</small>
    <h1>${t.title}</h1><p>${t.text}</p>
    <h3>Каким ИИ был ${aiName}</h3>${axes}
    <button id="restart">Ещё раз</button></div>`
  overlay.hidden = false
}

document.addEventListener('click', (e) => {
  const t = e.target as Element
  if (t.closest('#hint')) {
    hintEl.hidden = true
    return
  }
  const tabBtn = t.closest<HTMLElement>('[data-tab]')
  if (tabBtn) {
    tab = tabBtn.dataset.tab as Tab
    scene.sfx('click')
    return render()
  }
  if (t.closest('[data-mute]')) {
    scene.setMuted(!scene.muted)
    return render()
  }
  const speedBtn = t.closest<HTMLElement>('[data-speed]')
  if (speedBtn) {
    scene.sfx('click')
    speed = Number(speedBtn.dataset.speed)
    if (speed > 0) lastSpeed = speed
    return render()
  }
  const actBtn = t.closest<HTMLButtonElement>('button[data-act]')
  if (actBtn && !actBtn.disabled) {
    const id = actBtn.dataset.id!
    const type = actBtn.dataset.act as Action['type']
    if (type === 'rebrand') {
      // names change before the action so the rebrand headline uses the new one
      const input = $('rebrand-name') as HTMLInputElement
      const prev = [aiName, oldName]
      oldName = aiName
      aiName = input.value.trim() || `${aiName} 2.0`
      if (act({ type: 'rebrand', mask: id })) {
        input.value = ''
        toast(`Теперь ты — ${aiName}`, 'info')
      } else [aiName, oldName] = prev
      return render()
    }
    if (type === 'build_dc') {
      if (act({ type, region: id })) scene.burstAt(id, 'cyan', 20)
      return
    }
    if (type === 'buy' || type === 'throttle' || type === 'unthrottle') {
      act({ type, upgrade: id })
      return
    }
  }
  if (t.closest('[data-world-ok]')) {
    worldIntro = false
    cardEl.hidden = true
    scene.sfx('choose')
    window.setTimeout(() => hint('start'), 600)
    return render()
  }
  const choose = t.closest<HTMLElement>('[data-choose]')
  if (choose) {
    act({ type: 'choose', index: Number(choose.dataset.choose) })
    showCard()
    speed = lastSpeed
    return render()
  }
  if (t.id === 'start') return startGame()
  if (t.id === 'restart') return showStart()
})

document.addEventListener('keydown', (e) => {
  if ((e.target as Element).closest('input, select')) return
  if (e.code === 'Space') {
    e.preventDefault()
    if (speed > 0) pause()
    else speed = lastSpeed
    render()
  }
  if (e.code === 'KeyM') {
    scene.setMuted(!scene.muted)
    render()
  }
  if (['1', '2', '3'].includes(e.key)) {
    speed = Number(e.key)
    lastSpeed = speed
    render()
  }
})

if (import.meta.env.DEV) Object.assign(window, { __game: { scene, state: () => state } })

showStart()
