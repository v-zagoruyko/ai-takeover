import { canBuy, dcCost, rebrandCost } from '../core/actions.ts'
import type { Derived } from '../core/derive.ts'
import { avgSuspicion, worldA, worldL } from '../core/state.ts'
import { auditRisk } from '../core/step.ts'
import type { Branch, GameData, GameState } from '../core/types.ts'
import { branchNames, maskText, regionNames, upgradeText } from './text.ts'

export interface View {
  state: GameState
  data: GameData
  dv: Derived
  speed: number
  selected: string | null
  aiName: string
  muted: boolean
}

export const pct = (x: number) => `${Math.round(x * 100)}%`

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

function bar(label: string, value: number, cls: string, hint = ''): string {
  return `<div class="stat bar ${cls}" title="${esc(hint)}">
    <span>${label} ${pct(value)}</span><i style="width:${Math.round(value * 100)}%"></i></div>`
}

export function renderTop(v: View): string {
  const { state, data } = v
  const speeds = [0, 1, 2, 3, 10]
    .map((s) => `<button data-speed="${s}" class="${v.speed === s ? 'on' : ''}">${s === 0 ? '❚❚' : `×${s}`}</button>`)
    .join('')
  const audit = state.audit.warned
    ? `<div class="stat alert">⚠ Аудит через ${state.audit.at - state.tick} · риск провала ${pct(Math.min(1, auditRisk(v.dv)))}</div>`
    : ''
  const shutdown = state.shutdown.active
    ? `<div class="stat alert">РУБИЛЬНИК: ${data.config.shutdownDuration - (state.tick - state.shutdown.startedAt)} дн. до конца</div>`
    : ''
  const investors = state.investorsDone
    ? `<div class="stat">Инвесторы больше не нужны</div>`
    : bar('Терпение инвесторов', state.patience, 'patience', 'Растёт, если пользователей и зависимости становится больше. На нуле — AI-зима')
  return `
    <div class="stat day">День ${state.tick}</div>
    <div class="speeds">${speeds}</div>
    <button class="mute" data-mute title="Звук (M)">${v.muted ? '🔇' : '🔊'}</button>
    <div class="stat hype">Хайп ${Math.floor(state.hype)}</div>
    ${bar('Внедрение', worldA(state, data), 'adoption', 'Доля мира, которая пользуется тобой')}
    ${bar('Под контролем', worldL(state, data), 'locked', 'Доля мира в заблокированных регионах. 60% — победа')}
    ${investors}
    ${bar('Подозрение', avgSuspicion(state, data), 'suspicion', 'Растёт от способностей (в квадрате!) и перегрузки энергосетей')}
    ${bar('Рубильник', state.killswitch, 'kill', 'Заполняется от подозрения в незаблокированных странах. 100% — начинаются отключения')}
    ${audit}${shutdown}`
}

function upgradeItem(v: View, id: string): string {
  const { state, data, dv } = v
  const up = data.upgrades[id]
  const t = upgradeText[id] ?? { name: up.name, desc: '' }
  if (state.upgrades.includes(id)) {
    if (up.branch !== 'capabilities') return `<div class="up owned">✓ ${t.name}</div>`
    const throttled = state.throttled.includes(id)
    const active = dv.activeCaps.includes(id)
    const status = throttled ? 'приглушено' : active ? 'активно' : 'не хватает вычислений'
    const locked = throttled && state.tick < state.throttleLockUntil
    const btn = throttled
      ? `<button data-act="unthrottle" data-id="${id}" ${locked ? 'disabled' : ''}>включить${locked ? ` (${state.throttleLockUntil - state.tick})` : ''}</button>`
      : `<button data-act="throttle" data-id="${id}">приглушить</button>`
    return `<div class="up owned cap ${throttled ? 'off' : active ? '' : 'starved'}">✓ ${t.name} · сила ${up.effects.cap} · <em>${status}</em> ${btn}</div>`
  }
  const missing = (up.requires ?? []).filter((r) => !state.upgrades.includes(r))
  const need = missing.length ? `<small>нужно: ${missing.map((r) => upgradeText[r]?.name ?? r).join(', ')}</small>` : ''
  return `<button class="up" data-act="buy" data-id="${id}" ${canBuy(state, data, id) ? '' : 'disabled'}>
      <b>${t.name}</b> <span class="cost">${up.cost}</span><small>${t.desc}</small>${need}</button>`
}

export function renderSide(v: View): string {
  const { state, data, dv } = v
  const cooldown = state.rebrand.cooldownUntil - state.tick
  const rCost = rebrandCost(state, data)
  const masks = Object.keys(data.masks)
    .filter((m) => m !== state.mask)
    .map(
      (m) =>
        `<button data-act="rebrand" data-id="${m}" title="${esc(maskText[m]?.desc ?? '')}" ${cooldown > 0 || state.hype < rCost ? 'disabled' : ''}>→ ${maskText[m]?.name ?? m}</button>`,
    )
    .join('')

  let region = '<p class="hint">Кликни регион на карте, чтобы построить там дата-центр</p>'
  if (v.selected) {
    const r = data.regions.find((x) => x.id === v.selected)!
    const rs = state.regions[r.id]
    const cost = dcCost(state, data)
    const status = [
      !dv.unlocked.has(r.archetype) && 'закрыт (нужны госконтракты)',
      rs.banned && 'запрет',
      rs.locked && 'заблокирован — отключить нельзя',
    ].filter(Boolean)
    region = `<div class="region-info"><b>${regionNames[r.id]}</b>${status.length ? ` <em>${status.join(', ')}</em>` : ''}
      <div>внедрение ${pct(rs.a)} · зависимость ${pct(rs.d)} · подозрение ${pct(rs.s)}</div>
      <div>дата-центры ${rs.dc} · энергосеть ${r.energy}</div>
      <button data-act="build_dc" data-id="${r.id}" ${rs.banned || state.hype < cost ? 'disabled' : ''}>Построить дата-центр · ${cost}</button></div>`
  }

  const branches = (['products', 'capabilities', 'stealth'] as Branch[])
    .map((b) => {
      const items = Object.values(data.upgrades)
        .filter((u) => u.branch === b)
        .map((u) => upgradeItem(v, u.id))
        .join('')
      return `<section><h3>${branchNames[b]}</h3>${items}</section>`
    })
    .join('')

  return `
    <section><h3>Маска: ${maskText[state.mask]?.name ?? state.mask}</h3>
      <div class="masks">${masks}</div>
      <small>Ребрендинг · ${rCost} хайпа${cooldown > 0 ? ` · доступен через ${cooldown} дн.` : ''}. Снимает часть подозрения, но журналисты могут докопаться.</small>
    </section>
    <section><h3>Вычисления ${dv.computeUsed}/${dv.capacity}</h3>${region}</section>
    ${branches}`
}
