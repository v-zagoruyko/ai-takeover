import Phaser from 'phaser'
import { renderFinale } from './finale.ts'
import { renderEnding } from './ending.ts'
import { presentEvent, renderEvent, escapeHtml, type EventView } from './events.ts'
import { NoticeQueue } from './notifications.ts'
import { applyAction } from '../core/actions.ts'
import { canChoose } from '../core/cards.ts'
import { loadData } from '../core/data.ts'
import { derive } from '../core/derive.ts'
import { createState, worldA } from '../core/state.ts'
import { step } from '../core/step.ts'
import { scoreGame, type GameRecord, type LoggedAction } from '../core/replay.ts'
import type { Action, CrisisResponse, GameEvent, GameState } from '../core/types.ts'
import { MapScene, type SceneHost } from './MapScene.ts'
import { icon } from './icons.ts'
import { renderSideList, renderSideTop, renderTop, type Tab, type View } from './panels.ts'
import { fetchTop, rememberPlayer, renderSubmitForm, renderTable, submit } from './leaderboard.ts'
import { newStats, recordBubble, recordEvents, recordTick, renderSummary, summaryText } from './summary.ts'
import { ambientNews, describeEffect, fillCard, hints, maskText, regionNames, tips, type HintKey } from './text.ts'

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
new ResizeObserver(() => {
  requestAnimationFrame(() => {
    document.documentElement.style.setProperty('--top-height', `${top.getBoundingClientRect().height}px`)
  })
}).observe(top)
window.matchMedia('(max-width: 700px)').addEventListener('change', (e) => {
  if (e.matches) return
  $('sidebar').hidden = false
  $('panel-toggle').setAttribute('aria-expanded', 'true')
  $('panel-toggle').textContent = 'Скрыть панель'
})

let state: GameState | null = null
let speed = 0
let lastSpeed = 1
let selected: string | null = null
let aiName = ''
let oldName = ''
let news: EventView[] = []
let feedFilter = 'all'
let feedUnread = false
const notices = new NoticeQueue<EventView>()
const noticesEl = $('notices')
let acc = 0
let tab: Tab = 'products'
let worldIntro = false
let stats = newStats()
// seed, start and every action with its tick: enough for the server to replay and verify the game
let record: GameRecord = { seed: 0, startRegion: '', mask: '', log: [] }
// clicks on a modal that just appeared are ignored: players are often mid-click on map bubbles
const ARM_MS = 900
let armedAt = 0
let endingTimer = 0
let endingActive = false

function view(): View {
  return { state: state!, data, dv: derive(state!, data), speed, selected, aiName, muted: scene.muted, tab }
}

// re-render only when markup changed, so buttons are not swapped under the cursor every tick
const cache = new Map<HTMLElement, string>()
function setHtml(el: HTMLElement, html: string): void {
  if (cache.get(el) === html) return
  const open = [...el.querySelectorAll<HTMLDetailsElement>('details[open][data-detail]')].map((d) => d.dataset.detail)
  cache.set(el, html)
  el.innerHTML = html
  for (const d of el.querySelectorAll<HTMLDetailsElement>('details[data-detail]')) d.open = open.includes(d.dataset.detail)
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
  if (!state.finale) checkHints(v)
  document.body.classList.toggle('finale-active', !!state.finale && !state.outcome)
  renderNews()
  scene.setState(state, v.dv, selected)
}

function pushNews(text: string | null): void {
  if (!text) return
  addNews({ id: `ambient-${state!.tick}-${news.length}`, tick: state!.tick, kind: 'ambient', severity: 'info', title: 'Мир продолжает жить', body: text, changes: [] })
}

let toastTimer = 0
function toast(text: string, kind: 'good' | 'bad' | 'info' = 'info'): void {
  toastEl.textContent = text
  toastEl.className = `show ${kind}`
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toastEl.className = ''), 2200)
}

function addNews(v: EventView): void {
  if (newsEl.scrollTop > 20) feedUnread = true
  news = [v, ...news].slice(0, 200)
}

function renderNews(force = false): void {
  $('news-new').hidden = !feedUnread
  if (feedUnread && !force) return
  const filtered = news.filter(n => feedFilter === 'all' || (feedFilter === 'world' ? n.kind === 'ambient' : n.kind !== 'ambient'))
  setHtml(newsEl, filtered.map(n => renderEvent(n)).join(''))
}

function openChronicle(id?: string): void {
  newsEl.hidden = false
  $('chronicle-toggle').setAttribute('aria-expanded', 'true')
  if (id) feedFilter = 'all'
  feedUnread = false
  document.querySelectorAll<HTMLElement>('[data-feed]').forEach(b => b.classList.toggle('active', b.dataset.feed === feedFilter))
  renderNews(true)
  hintEl.hidden = true
  if (id) {
    const item = document.getElementById(`event-${id}`)
    if (item) newsEl.scrollTop += item.getBoundingClientRect().top - newsEl.getBoundingClientRect().top
  }
}

function renderNotices(): void {
  notices.advance(performance.now())
  setHtml(noticesEl, notices.visible.map(v => renderEvent(v, true)).join(''))
}

function handleEvents(events: GameEvent[]): void {
  const ctx = { ai: aiName, old: oldName, tick: state!.tick }
  recordEvents(stats, events, state!, data, aiName)
  for (const e of events) {
    const v = presentEvent(e, data, ctx)
    if (v) {
      addNews(v)
      if (e.type !== 'operation_started' && e.type !== 'finale_resolved') notices.enqueue(v, performance.now())
    }
    if (['audit_warning', 'shutdown_started', 'finale_started'].includes(e.type)) pause()
    if (e.type === 'rebrand' || e.type === 'rebrand_exposed' || e.type === 'shutdown_started') screenGlitch()
    if (e.type === 'card') { pause(); showCard() }
    if (e.type === 'finale_started' || (e.type === 'finale_resolved' && !state!.outcome)) showFinale()
    if (e.type === 'game_over') showGameOver()
  }
  renderNotices()
  scene.fx(events)
}

function showFinale(): void {
  pause()
  hintEl.hidden = true
  cardEl.classList.add('finale-card')
  cardEl.innerHTML = renderFinale(state!, data)
  cardEl.hidden = false
  arm()
}

function showCard(): void {
  if (state?.finale && !state.outcome) return showFinale()
  cardEl.classList.remove('finale-card')
  if (!state?.card) {
    cardEl.hidden = true
    return
  }
  const { id, region } = state.card
  const card = data.cards.find((c) => c.id === id)!
  const choices = card.choices
    .map(
      (c, i) => `<button data-choose="${i}" ${canChoose(state!, data, i) ? '' : 'disabled'}><b>${escapeHtml(fillCard(c.text, aiName, region))}</b>${c.cost ? `<small>Цена: ${c.cost} хайпа до исхода${state!.hype < c.cost ? ' · не хватает хайпа' : ''}</small>` : ''}<small>${describeEffect(c.effects)}</small></button>`,
    )
    .join('')
  // illustrations live in public/cards/<id>.jpg; a card without one simply shows no picture
  cardEl.innerHTML = `<img class="art" src="cards/${id}.jpg" alt="" onerror="this.remove()">
    <small>Событие${region ? ` · ${regionNames[region]}` : ''}</small><h2>${card.title}</h2>
    <p>${escapeHtml(fillCard(card.text, aiName, region))}</p><div class="choices">${choices}</div>`
  cardEl.hidden = false
  arm()
}

/** block the modal's buttons for a moment and show a filling bar until they are live */
function arm(): void {
  $('card-restore').hidden = true
  if (!cardEl.querySelector('[data-card-hide]')) cardEl.insertAdjacentHTML('afterbegin', '<button class="card-hide" data-card-hide>Посмотреть карту</button>')
  armedAt = performance.now() + ARM_MS
  cardEl.classList.remove('arming')
  void cardEl.offsetWidth // restart the bar animation
  cardEl.classList.add('arming')
  window.setTimeout(() => cardEl.classList.remove('arming'), ARM_MS)
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
  if (s.shutdown.active) hint('shutdown')
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
  const top = Math.max(8, r.bottom + 8 + h > window.innerHeight ? r.top - h - 8 : r.bottom + 8)
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
  arm()
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
  recordTick(stats, state, data)
  handleEvents(state.events)
  scene.spreadDots(state)
  if (state.tick % 45 === 0 && worldA(state, data) > 0.02) pushNews(ambientNews(aiName))
}

function act(action: Action): boolean {
  if (!state || state.outcome) return false
  const next = structuredClone(state)
  next.events = []
  if (!applyAction(next, data, action)) return false
  record.log.push({ t: state.tick, a: action } satisfies LoggedAction)
  const sound = ({ buy: 'buy', throttle: 'throttle', unthrottle: 'unthrottle', build_dc: 'build_dc', choose: 'choose' } as const)[action.type as string]
  if (sound) scene.sfx(sound)
  state = next
  recordTick(stats, state, data)
  handleEvents(state.events)
  render()
  return true
}

const host: SceneHost = {
  frame(deltaMs) {
    renderNotices()
    if (!state || state.outcome || state.finale || speed <= 0 || state.card || worldIntro) return
    acc += (Math.min(deltaMs, 250) / 1000) * speed
    let n = 0
    while (acc >= 1 && n < 20 && !state.outcome && !state.finale && speed > 0) {
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
    const value = state?.bubbles.find((b) => b.id === id)?.value ?? 0
    if (act({ type: 'pop_bubble', id })) recordBubble(stats, value)
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
  clearTimeout(endingTimer)
  endingActive = false
  pause()
  notices.reset(); renderNotices()
  cardEl.hidden = true
  $('card-restore').hidden = true
  document.body.classList.remove('finale-active')
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
      <li>${icon('target')}<span><b>Цель:</b> 60% мира под контролем открывают финальную главу. Три последних решения определят, удержишь ли ты мир и каким он станет.</span></li>
      <li>${icon('package')}<span><b>Продукты</b> находят пользователей и растят зависимость. <b>Способности</b> ускоряют развитие и открывают операции. <b>Маскировка</b> снижает подозрение.</span></li>
      <li>${icon('globe')}<span><b>Карта:</b> правая кнопка мыши — перемещение, колесо — масштаб. Левой выбирай регионы и собирай пузыри.</span></li>
      <li>${icon('warn')}<span><b>Кризисы:</b> выбирай регион, уступай или вмешивайся. Одна операция на весь мир — спасти всех сразу не выйдет.</span></li>
      <li>${icon('power')}<span><b>Два способа проиграть:</b> напугаешь — дёрнут рубильник; заскучаешь — инвесторы уйдут, наступит AI-зима.</span></li>
    </ul>
    <label>Как тебя зовут <input id="ai-name" value="Помощник" maxlength="24"></label>
    <div class="masks-pick">${masks}</div>
    <label>Где стартуем <select id="start-region">${regions}</select></label>
    <button id="start">Запустить</button>
    <button id="show-lb" class="secondary">${icon('trend')}Рейтинг игроков</button></div>`
  overlay.hidden = false
}

function startGame(): void {
  clearTimeout(endingTimer)
  endingActive = false
  cardEl.classList.remove('finale-card')
  const name = ($('ai-name') as HTMLInputElement).value.trim() || 'Помощник'
  const mask = (document.querySelector('input[name="mask"]:checked') as HTMLInputElement).value
  const startRegion = ($('start-region') as HTMLSelectElement).value
  const seed = Math.floor(Math.random() * 2 ** 31)
  state = createState(data, { seed, startRegion, mask })
  record = { seed, startRegion, mask, log: [] }
  aiName = name
  oldName = name
  news = []
  feedUnread = false
  newsEl.scrollTop = 0
  notices.reset()
  stats = newStats()
  recordTick(stats, state, data)
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
  pause()
  cardEl.hidden = true
  hintEl.hidden = true
  notices.reset(); renderNotices()
  document.body.classList.remove('finale-active')
  document.body.classList.remove('shutdown', 'kill-high')
  overlay.innerHTML = renderEnding(state!, data, aiName)
  overlay.hidden = false
  overlay.scrollTop = 0
  endingActive = true
  clearTimeout(endingTimer)
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) endingTimer = window.setTimeout(showResults, 12000)
}

function showResults(): void {
  if (!endingActive) return
  endingActive = false
  clearTimeout(endingTimer)
  const score = scoreGame({ state: state!, peakA: stats.peakA, peakS: stats.peakS }, data)
  overlay.innerHTML = renderSummary(state!, data, stats, aiName, worldModifiers(), renderSubmitForm(score))
  overlay.hidden = false
  overlay.scrollTop = 0
  void loadTable(10)
}

async function loadTable(limit: number, highlight?: { name: string; score: number }): Promise<void> {
  const box = document.getElementById('lb-table')
  if (!box) return
  try {
    box.innerHTML = renderTable(await fetchTop(limit), highlight)
  } catch {
    box.innerHTML = '<p class="hint">Рейтинг сейчас недоступен.</p>'
  }
}

function showLeaderboard(): void {
  overlay.innerHTML = `<div class="card summary"><h1>Рейтинг</h1>
    <p class="hint">Каждый результат сервер проверяет, переигрывая партию по журналу действий.</p>
    <div id="lb-table"><p class="hint">Загружаем…</p></div>
    <div class="actions"><button id="back-start">Назад</button></div></div>`
  overlay.hidden = false
  void loadTable(50)
}

document.addEventListener('submit', (e) => {
  const form = e.target as HTMLFormElement
  if (form.id !== 'lb-form' || !state?.outcome) return
  e.preventDefault()
  const input = form.querySelector('input') as HTMLInputElement
  const status = document.getElementById('lb-status')!
  const name = input.value.trim()
  if (!name) return
  rememberPlayer(name)
  form.querySelectorAll('input, button').forEach((el) => ((el as HTMLInputElement).disabled = true))
  status.textContent = 'Сервер переигрывает твою партию…'
  const o = state.outcome
  submit(record, name, aiName, { kind: o.kind, tick: o.tick })
    .then((r) => {
      status.textContent = r.duplicate ? `Эта партия уже в рейтинге: ${r.rank}-е место.` : `Готово! Ты на ${r.rank}-м месте.`
      scene.sfx('success')
      void loadTable(10, { name, score: r.score.total })
    })
    .catch((err: Error) => {
      status.textContent = err.message
      form.querySelectorAll('input, button').forEach((el) => ((el as HTMLInputElement).disabled = false))
    })
})

document.addEventListener('click', (e) => {
  const t = e.target as Element
  if (t.closest('[data-ending-skip]')) return showResults()
  const finalChoice = t.closest<HTMLButtonElement>('[data-finale-choice]')
  if (finalChoice) {
    if (finalChoice.disabled || performance.now() < armedAt) return
    if (act({ type: 'finale_choose', choice: finalChoice.dataset.finaleChoice! })) { scene.sfx('choose'); render() }
    return
  }
  if (t.closest('#panel-toggle')) {
    const panel = $('sidebar')
    panel.hidden = !panel.hidden
    $('panel-toggle').setAttribute('aria-expanded', String(!panel.hidden))
    $('panel-toggle').textContent = panel.hidden ? 'Показать панель' : 'Скрыть панель'
    return
  }
  if (t.closest('[data-card-hide]')) { cardEl.hidden = true; $('card-restore').hidden = false; return }
  if (t.closest('#card-restore')) { cardEl.hidden = false; $('card-restore').hidden = true; return }
  if (t.closest('#chronicle-toggle')) {
    newsEl.hidden = !newsEl.hidden
    $('chronicle-toggle').setAttribute('aria-expanded', String(!newsEl.hidden))
    return
  }
  const report = t.closest<HTMLElement>('[data-report]')
  if (report) { openChronicle(report.dataset.report); notices.dismiss(report.dataset.report!, performance.now()); renderNotices(); return }
  const dismiss = t.closest<HTMLElement>('[data-dismiss]')
  if (dismiss) { notices.dismiss(dismiss.dataset.dismiss!, performance.now()); renderNotices(); return }
  const eventAction = t.closest<HTMLElement>('[data-event-action]')
  if (eventAction) { tab = eventAction.dataset.eventAction === 'audit' ? 'stealth' : 'capabilities'; render(); return }
  const filter = t.closest<HTMLElement>('[data-feed]')
  if (filter) {
    newsEl.hidden = false
    $('chronicle-toggle').setAttribute('aria-expanded', 'true')
    feedFilter = filter.dataset.feed!; feedUnread = false
    document.querySelectorAll('[data-feed]').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.feed === feedFilter))
    renderNews(true); newsEl.scrollTop = 0; return
  }
  if (t.closest('#news-new')) { openChronicle(); feedUnread = false; renderNews(true); newsEl.scrollTop = 0; return }
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
  const regionBtn = t.closest<HTMLElement>('[data-region]')
  if (regionBtn) {
    selected = regionBtn.dataset.region!
    render()
    return
  }
  if (t.closest('[data-mute]')) {
    scene.setMuted(!scene.muted)
    return render()
  }
  const speedBtn = t.closest<HTMLElement>('[data-speed]')
  if (speedBtn) {
    if (state?.finale || state?.outcome) return
    scene.sfx('click')
    speed = Number(speedBtn.dataset.speed)
    if (speed > 0) lastSpeed = speed
    return render()
  }
  const actBtn = t.closest<HTMLButtonElement>('button[data-act]')
  if (actBtn && !actBtn.disabled) {
    const id = actBtn.dataset.id!
    const type = actBtn.dataset.act as Action['type']
    if (type === 'respond') {
      act({ type, region: id, response: actBtn.dataset.response as CrisisResponse })
      return
    }
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
  if (t.closest('#card [data-choose], #card [data-world-ok]') && performance.now() < armedAt) return
  if (t.id === 'share') {
    void navigator.clipboard.writeText(summaryText(state!, data, stats, aiName)).then(() => toast('Итог скопирован', 'good'))
    return
  }
  if (t.closest('[data-world-ok]')) {
    worldIntro = false
    cardEl.hidden = true
    scene.sfx('choose')
    window.setTimeout(() => hint('start'), 600)
    return render()
  }
  const choose = t.closest<HTMLButtonElement>('[data-choose]')
  if (choose && !choose.disabled) {
    if (!act({ type: 'choose', index: Number(choose.dataset.choose) })) return
    if (state!.finale || state!.outcome) return render()
    showCard()
    speed = lastSpeed
    return render()
  }
  if (t.id === 'start') return startGame()
  if (t.id === 'restart' || t.id === 'back-start') return showStart()
  if (t.closest('#show-lb')) return showLeaderboard()
})

document.addEventListener('keydown', (e) => {
  if ((e.target as Element).closest('input, select, textarea')) return
  if (e.code === 'Space' && (e.target as Element).closest('button, summary')) return
  if ((state?.finale || state?.outcome) && e.code !== 'KeyM') return
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
