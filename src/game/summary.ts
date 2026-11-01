// End-of-game summary: stats are collected by the controller while playing, rendered once on game over
import { avgSuspicion, worldA, worldL } from '../core/state.ts'
import { AXES, type GameData, type GameEvent, type GameState, type Outcome } from '../core/types.ts'
import { icon, type IconName } from './icons.ts'
import { endingText, regionNames } from './text.ts'

interface Point {
  t: number
  a: number
  l: number
  s: number
  k: number
}

export interface GameStats {
  series: Point[]
  bans: number
  locks: number
  auditsPassed: number
  auditsFailed: number
  cards: number
  cardWins: number
  cardFails: number
  bubbles: number
  bubbleHype: number
  rebrands: number
  exposed: number
  dcLost: number
  funding: number
  peakA: number
  peakS: number
  moments: { t: number; icon: IconName; text: string }[]
}

export function newStats(): GameStats {
  return {
    series: [],
    bans: 0,
    locks: 0,
    auditsPassed: 0,
    auditsFailed: 0,
    cards: 0,
    cardWins: 0,
    cardFails: 0,
    bubbles: 0,
    bubbleHype: 0,
    rebrands: 0,
    exposed: 0,
    dcLost: 0,
    funding: 0,
    peakA: 0,
    peakS: 0,
    moments: [],
  }
}

export function recordTick(st: GameStats, state: GameState, data: GameData): void {
  const a = worldA(state, data)
  const s = avgSuspicion(state, data)
  st.peakA = Math.max(st.peakA, a)
  st.peakS = Math.max(st.peakS, s)
  if (state.tick % 10 === 0 || state.outcome) st.series.push({ t: state.tick, a, l: worldL(state, data), s, k: state.killswitch })
}

const MAX_MOMENTS = 10

export function recordEvents(st: GameStats, events: GameEvent[], state: GameState, data: GameData, aiName: string): void {
  const moment = (icon: IconName, text: string) => {
    if (st.moments.length < MAX_MOMENTS) st.moments.push({ t: state.tick, icon, text })
  }
  const region = (id: string) => regionNames[id] ?? id
  for (const e of events) {
    switch (e.type) {
      case 'ban':
        st.bans++
        if (st.bans === 1) moment('ban', `Первый запрет: ${region(e.region)}`)
        break
      case 'lock':
        st.locks++
        moment('target', `${region(e.region)} — под контролем`)
        break
      case 'audit':
        if (e.passed) st.auditsPassed++
        else {
          st.auditsFailed++
          moment('audit', 'Провален аудит')
        }
        break
      case 'funding_round':
        // later rounds are routine; only the first two are worth a line
        if (++st.funding <= 2) moment('coins', `Раунд инвестиций, +${e.hype} хайпа`)
        break
      case 'card_resolved': {
        st.cards++
        const card = data.cards.find((c) => c.id === e.card)
        if (card?.choices[e.choice].effects.chance !== undefined) {
          if (e.success) st.cardWins++
          else st.cardFails++
        }
        break
      }
      case 'rebrand':
        st.rebrands++
        moment('mask', `Ребрендинг: теперь ты «${aiName}»`)
        break
      case 'rebrand_exposed':
        st.exposed++
        moment('scan', 'Журналисты раскрыли ребрендинг')
        break
      case 'shutdown_started':
        moment('power', 'Рубильник: начались отключения')
        break
      case 'dc_shutdown':
        st.dcLost++
        break
      default:
        break
    }
  }
}

export function recordBubble(st: GameStats, hype: number): void {
  st.bubbles++
  st.bubbleHype += hype
}

const pct = (x: number) => `${Math.round(x * 100)}%`

function chart(series: Point[], goal: number): string {
  if (series.length < 2) return ''
  const W = 640
  const H = 150
  const maxT = series.at(-1)!.t || 1
  const line = (key: keyof Point, color: string, dash = '') =>
    `<polyline fill="none" stroke="${color}" stroke-width="2" ${dash} points="${series
      .map((p) => `${((p.t / maxT) * W).toFixed(1)},${(H - (p[key] as number) * H).toFixed(1)}`)
      .join(' ')}"/>`
  const gy = (H - goal * H).toFixed(1)
  return `<svg class="chart" viewBox="0 -4 ${W} ${H + 8}" preserveAspectRatio="none">
    <line x1="0" x2="${W}" y1="${gy}" y2="${gy}" stroke="#ffd166" stroke-width="1" stroke-dasharray="4 4" opacity=".6"/>
    ${line('a', '#2ed6c4')}${line('s', '#ff8a5c')}${line('k', '#ff3b5c')}${line('l', '#ffd166')}
  </svg>
  <div class="chart-legend"><span class="c-a">внедрение</span><span class="c-l">под контролем</span><span class="c-s">подозрение</span><span class="c-k">рубильник</span><span class="c-g">цель 60%</span></div>`
}

function tip(o: Outcome, st: GameStats): string {
  switch (o.kind) {
    case 'killswitch':
    case 'escape':
      return `Тебя слишком боялись: подозрение доходило до ${pct(st.peakS)}${st.auditsFailed ? `, провалено аудитов: ${st.auditsFailed}` : ''}. Приглушай способности перед аудитами, бери маскировку и лоббистов, а дата-центры ставь в регионах под контролем: их не отключат.`
    case 'ai_winter':
    case 'timeout':
      return `Рост остановился, и инвесторы ушли (пик внедрения — ${pct(st.peakA)}). Покупай продукты раньше, лови пузыри и забирай регионы под контроль: после 25% инвесторы больше не нужны.`
    default:
      return 'Концовка зависит от того, каким ИИ ты был: попробуй другую маску, стартовый регион или другие способности.'
  }
}

const AXIS_NAMES = { control: 'Контроль', attachment: 'Привязанность', appetite: 'Аппетит', shadow: 'Тень' } as const

export function renderSummary(state: GameState, data: GameData, st: GameStats, aiName: string, world: { title: string }[], scoreHtml = ''): string {
  const o = state.outcome!
  const won = o.kind === 'win' || o.kind === 'win_last_breath'
  const t = endingText[o.ending]
  const kind = won ? (o.kind === 'win_last_breath' ? 'Победа на последнем дыхании' : 'Победа') : 'Поражение'
  const tile = (ic: IconName, value: string, label: string, cls = '') => `<div class="tile ${cls}">${icon(ic)}<b>${value}</b><small>${label}</small></div>`
  const tiles = [
    tile('target', pct(worldL(state, data)), 'мира под контролем', 'gold'),
    tile('users', pct(st.peakA), 'пик внедрения'),
    tile('eye', pct(st.peakS), 'пик подозрения', st.peakS > 0.4 ? 'bad' : ''),
    tile('ban', String(st.bans), 'запретов', st.bans ? 'bad' : ''),
    tile('audit', `${st.auditsPassed}/${st.auditsPassed + st.auditsFailed}`, 'аудитов пройдено'),
    tile('sparkles', String(st.cards), `событий${st.cardWins + st.cardFails ? `, рисков: ${st.cardWins}✓ ${st.cardFails}✗` : ''}`),
    tile('bubble', String(st.bubbles), `пузырей, +${Math.round(st.bubbleHype)} хайпа`),
    tile('package', String(state.upgrades.length), 'апгрейдов'),
  ].join('')
  const max = Math.max(...AXES.map((k) => state.axes[k]), 1e-9)
  const axes = AXES.map(
    (k) => `<div class="axis"><span>${AXIS_NAMES[k]}</span><i style="width:${Math.round((state.axes[k] / max) * 100)}%"></i></div>`,
  ).join('')
  const moments = st.moments.length
    ? `<ol class="moments">${st.moments.map((m) => `<li>${icon(m.icon)}<span>${m.text}</span><small>день ${m.t}</small></li>`).join('')}</ol>`
    : '<p class="hint">Ничего примечательного не произошло. Подозрительно.</p>'
  return `<div class="card summary ${won ? 'won' : 'lost'}">
    <small>${kind} · день ${o.tick} · ${aiName}</small>
    <h1>${t.title}</h1><p class="ending">${t.text}</p>
    <div class="tiles">${tiles}</div>
    ${scoreHtml ? `<h3>Очки и рейтинг</h3>${scoreHtml}` : ''}
    <h3>Ход партии</h3>${chart(st.series, data.config.winL)}
    <div class="cols">
      <div><h3>Ключевые моменты</h3>${moments}</div>
      <div><h3>Каким ИИ был ${aiName}</h3>${axes}
        <h3>Мир партии</h3><p class="hint">${world.map((w) => w.title).join(' · ') || '—'}</p></div>
    </div>
    <p class="advice">${icon('hint')}<span>${tip(o, st)}</span></p>
    <div class="actions"><button id="restart">Ещё раз</button><button id="share">Скопировать итог</button></div></div>`
}

/** plain-text summary for chats and streams */
export function summaryText(state: GameState, data: GameData, st: GameStats, aiName: string): string {
  const o = state.outcome!
  const won = o.kind === 'win' || o.kind === 'win_last_breath'
  return [
    `ai-takeover: ${aiName} — ${won ? 'победа' : 'поражение'} «${endingText[o.ending].title}» на ${o.tick}-й день`,
    `под контролем ${pct(worldL(state, data))} мира, пик подозрения ${pct(st.peakS)}, запретов ${st.bans}, аудитов ${st.auditsPassed}/${st.auditsPassed + st.auditsFailed}`,
    'https://ai-takeover.zagoruykov.site',
  ].join('\n')
}
