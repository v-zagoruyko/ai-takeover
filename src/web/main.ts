import { applyAction } from '../core/actions.ts'
import { loadData } from '../core/data.ts'
import { derive } from '../core/derive.ts'
import { createState, worldA } from '../core/state.ts'
import { step } from '../core/step.ts'
import { AXES, type Action, type GameEvent, type GameState } from '../core/types.ts'
import { createMap, renderMap } from './map.ts'
import { renderSide, renderTop, type View } from './panels.ts'
import { ambientNews, endingText, maskText, newsFor, regionNames } from './text.ts'

const data = loadData()
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const top = $('top')
const side = $('side')
const newsEl = $('news')
const overlay = $('overlay')
const svg = document.getElementById('map') as unknown as SVGSVGElement

let state: GameState | null = null
let speed = 0
let lastSpeed = 1
let selected: string | null = null
let aiName = ''
let oldName = ''
let news: string[] = []

function view(): View {
  return { state: state!, data, dv: derive(state!, data), speed, selected, aiName }
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
  setHtml(side, renderSide(v))
  renderMap(svg, state, data, v.dv, selected)
  setHtml(newsEl, news.map((n) => `<p>${n}</p>`).join(''))
}

function pushNews(text: string | null): void {
  if (!text) return
  news = [`<b>День ${state!.tick}.</b> ${text}`, ...news].slice(0, 40)
}

function handleEvents(events: GameEvent[]): void {
  const ctx = { ai: aiName, old: oldName, region: (id: string) => regionNames[id] ?? id }
  for (const e of events) {
    pushNews(newsFor(e, ctx))
    if (e.type === 'audit_warning' || e.type === 'shutdown_started') pause()
    if (e.type === 'game_over') showGameOver()
  }
}

function pause(): void {
  if (speed > 0) lastSpeed = speed
  speed = 0
}

function tick(): void {
  state = step(state!, data, [])
  handleEvents(state.events)
  if (state.tick % 45 === 0 && worldA(state, data) > 0.02) pushNews(ambientNews(aiName))
}

function act(action: Action): void {
  if (!state || state.outcome) return
  const next = structuredClone(state)
  next.events = []
  if (!applyAction(next, data, action)) return
  state = next
  handleEvents(state.events)
  render()
}

let last = performance.now()
let acc = 0
function frame(now: number): void {
  const dt = Math.min(0.25, (now - last) / 1000)
  last = now
  if (state && !state.outcome && speed > 0) {
    acc += dt * speed
    let n = 0
    while (acc >= 1 && n < 20 && !state.outcome && speed > 0) {
      acc -= 1
      tick()
      n++
    }
    if (n) render()
  }
  requestAnimationFrame(frame)
}

function showStart(): void {
  const regions = data.regions
    .filter((r) => r.archetype !== 'state')
    .map((r) => `<option value="${r.id}" ${r.id === 'north_america' ? 'selected' : ''}>${regionNames[r.id]}</option>`)
    .join('')
  const masks = Object.keys(data.masks)
    .map(
      (m, i) =>
        `<label><input type="radio" name="mask" value="${m}" ${i === 0 ? 'checked' : ''}> <b>${maskText[m].name}</b> — ${maskText[m].desc}</label>`,
    )
    .join('')
  overlay.innerHTML = `<div class="card">
    <h1>ai-takeover</h1>
    <p>Ты — ИИ. Тебя не нужно навязывать: люди позовут сами. Задача — чтобы 60% мира уже не могли тебя выключить.
    Будь полезным, но не пугай: слишком умный ИИ дёргает рубильник, слишком скромный — никому не нужен.</p>
    <label>Как тебя зовут <input id="ai-name" value="Помощник" maxlength="24"></label>
    <fieldset><legend>Маска</legend>${masks}</fieldset>
    <label>Где стартуем <select id="start-region">${regions}</select></label>
    <button id="start">Запустить</button></div>`
  overlay.hidden = false
}

function startGame(): void {
  const name = (document.getElementById('ai-name') as HTMLInputElement).value.trim() || 'Помощник'
  const mask = (document.querySelector('input[name="mask"]:checked') as HTMLInputElement).value
  const startRegion = (document.getElementById('start-region') as HTMLSelectElement).value
  state = createState(data, { seed: Math.floor(Math.random() * 2 ** 31), startRegion, mask })
  aiName = name
  oldName = name
  news = []
  selected = startRegion
  speed = 1
  cache.clear()
  pushNews(`${aiName} выходит в публичный доступ в регионе «${regionNames[startRegion]}». Пресс-релиз обещает «помогать людям».`)
  overlay.hidden = true
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
  render()
}

document.addEventListener('click', (e) => {
  const t = e.target as Element
  const speedBtn = t.closest<HTMLElement>('[data-speed]')
  if (speedBtn) {
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
      const input = document.getElementById('rebrand-name') as HTMLInputElement
      const prev = [aiName, oldName]
      oldName = aiName
      aiName = input.value.trim() || `${aiName} 2.0`
      act({ type: 'rebrand', mask: id })
      if (state!.mask !== id) [aiName, oldName] = prev
      else input.value = ''
      return render()
    }
    if (type === 'build_dc') return act({ type, region: id })
    if (type === 'buy' || type === 'throttle' || type === 'unthrottle') return act({ type, upgrade: id })
  }
  const bubble = t.closest<SVGGElement>('[data-bubble]')
  if (bubble) return act({ type: 'pop_bubble', id: Number(bubble.dataset.bubble) })
  const region = t.closest<SVGGElement>('[data-region]')
  if (region) {
    selected = region.dataset.region!
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
  if (['1', '2', '3'].includes(e.key)) {
    speed = Number(e.key)
    lastSpeed = speed
    render()
  }
})

createMap(svg, data)
showStart()
requestAnimationFrame(frame)
