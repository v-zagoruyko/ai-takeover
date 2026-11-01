import { canBuy, dcCost, rebrandCost } from '../core/actions.ts'
import type { Derived } from '../core/derive.ts'
import { avgSuspicion, worldA, worldL } from '../core/state.ts'
import { auditRisk } from '../core/step.ts'
import type { Branch, GameData, GameState, Upgrade } from '../core/types.ts'
import { icon, upgradeIcon, type IconName } from './icons.ts'
import { branchIntro, effectChips, maskText, regionNames, upgradeText } from './text.ts'

export type Tab = Branch | 'mask'

export interface View {
  state: GameState
  data: GameData
  dv: Derived
  speed: number
  selected: string | null
  aiName: string
  muted: boolean
  tab: Tab
}

export const pct = (x: number) => `${Math.round(x * 100)}%`

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

/** labelled meter; `mark` draws a threshold line, `tone` colours the fill */
function meter(opts: { ic: IconName; label: string; value: number; tone: string; tip: string; mark?: number; markLabel?: string; wide?: boolean }): string {
  const mark =
    opts.mark === undefined ? '' : `<em class="mark" style="left:${(opts.mark * 100).toFixed(1)}%" title="${esc(opts.markLabel ?? '')}"></em>`
  return `<div class="meter ${opts.tone}${opts.wide ? ' wide' : ''}" data-tip="${opts.tip}">
    <span class="m-label">${icon(opts.ic)}${opts.label}<b>${pct(opts.value)}</b></span>
    <span class="m-track"><i style="width:${(Math.min(1, opts.value) * 100).toFixed(1)}%"></i>${mark}</span></div>`
}

// ---------- top bar ----------

export function renderTop(v: View): string {
  const { state, data } = v
  const speeds = [0, 1, 2, 3, 10]
    .map((s) => `<button data-speed="${s}" class="${v.speed === s ? 'on' : ''}">${s === 0 ? '❚❚' : `×${s}`}</button>`)
    .join('')
  const alerts = [
    state.audit.warned ? `<div class="alert">${icon('audit')}Аудит через ${state.audit.at - state.tick} · риск провала ${pct(auditRisk(v.dv))}</div>` : '',
    state.shutdown.active
      ? `<div class="alert">${icon('power')}Отключения: ${data.config.shutdownDuration - (state.tick - state.shutdown.startedAt)} дн. — удержи 35%</div>`
      : '',
  ].join('')
  const investors = state.investorsDone
    ? `<div class="meter done" data-tip="patience"><span class="m-label">${icon('hourglass')}Инвесторы больше не нужны</span></div>`
    : meter({ ic: 'hourglass', label: 'Терпение', value: state.patience, tone: state.patience < 0.35 ? 'danger' : 'calm', tip: 'patience' })
  return `
    <div class="tb-left">
      <div class="day">День ${state.tick}</div>
      <div class="speeds">${speeds}</div>
      <button class="mute" data-mute title="Звук (M)">${icon(v.muted ? 'muted' : 'sound')}</button>
      <div class="hype" data-tip="hype">${icon('coins')}${Math.floor(state.hype)}</div>
    </div>
    ${meter({ ic: 'target', label: 'Под контролем', value: worldL(state, data), tone: 'goal', tip: 'goal', mark: data.config.winL, markLabel: 'победа', wide: true })}
    ${meter({ ic: 'users', label: 'Внедрение', value: worldA(state, data), tone: 'adoption', tip: 'adoption' })}
    ${meter({ ic: 'eye', label: 'Подозрение', value: avgSuspicion(state, data), tone: 'suspicion', tip: 'suspicion' })}
    ${investors}
    ${meter({ ic: 'power', label: 'Рубильник', value: state.killswitch, tone: state.killswitch > 0.5 ? 'danger' : 'kill', tip: 'killswitch' })}
    ${alerts}`
}

// ---------- sidebar: always-visible blocks ----------

function computeBlock(v: View): string {
  const { state, data, dv } = v
  const caps = state.upgrades.map((id) => data.upgrades[id]).filter((u) => u.branch === 'capabilities')
  const name = (u: Upgrade) => esc(upgradeText[u.id]?.name ?? u.name)
  const seg = (u: Upgrade) =>
    `<span class="seg on" style="flex:${u.effects.cap ?? 1}" title="${name(u)}">${icon(upgradeIcon[u.id] ?? 'zap')}<small>${name(u)}</small></span>`
  const active = caps.filter((u) => dv.activeCaps.includes(u.id))
  const free = dv.capacity - dv.computeUsed
  const slots = [...active.map(seg), free > 0 ? `<span class="seg free" style="flex:${free}"><small>свободно ${free}</small></span>` : ''].join('')
  const starved = caps.filter((u) => !dv.activeCaps.includes(u.id) && !state.throttled.includes(u.id))
  const notes = [
    ...starved.map((u) => `<span class="chip bad">${icon('warn')}${name(u)}: нужно ${u.effects.cap} слот.</span>`),
    ...caps.filter((u) => state.throttled.includes(u.id)).map((u) => `<span class="chip off">${icon('eyeOff')}${name(u)} приглушена</span>`),
  ].join('')
  const r = v.selected ? data.regions.find((x) => x.id === v.selected) : null
  const cost = dcCost(state, data)
  const canBuild = r && !state.regions[r.id].banned && state.hype >= cost
  const build = r
    ? `<button class="build" data-act="build_dc" data-id="${r.id}" ${canBuild ? '' : 'disabled'} title="+1 слот вычислений; нагружает энергосеть региона">${icon('server')}Дата-центр: ${regionNames[r.id]}<span class="cost">${icon('coins')}${cost}</span></button>`
    : `<p class="hint">Выбери регион на карте, чтобы построить там дата-центр</p>`
  return `<section class="block">
    <div class="block-h" data-tip="compute">${icon('cpu')}Вычисления <b>${dv.computeUsed}/${dv.capacity}</b>${icon('info', 'q')}</div>
    <div class="slots">${slots || '<span class="seg free" style="flex:1"><small>способностей пока нет</small></span>'}</div>
    ${notes ? `<div class="chips">${notes}</div>` : ''}
    ${build}</section>`
}

function regionBlock(v: View): string {
  const { state, data, dv } = v
  if (!v.selected) return ''
  const r = data.regions.find((x) => x.id === v.selected)!
  const rs = state.regions[r.id]
  const c = data.config
  const closed = !dv.unlocked.has(r.archetype)
  const status = [
    closed && `<span class="chip off">${icon('lock')}закрыт: нужны госконтракты</span>`,
    rs.locked && `<span class="chip gold">${icon('target')}под контролем</span>`,
    rs.banned && `<span class="chip bad">${icon('ban')}запрет</span>`,
  ]
    .filter(Boolean)
    .join('')
  const banAt = c.banBase - c.banOpenness * r.openness
  return `<section class="block region">
    <div class="block-h">${icon('globe')}${regionNames[r.id]}${status ? `<span class="chips">${status}</span>` : ''}</div>
    ${meter({ ic: 'users', label: 'Внедрение', value: rs.a, tone: 'adoption', tip: 'region_a' })}
    ${meter({ ic: 'link', label: 'Зависимость', value: rs.d, tone: 'goal', tip: 'region_d', mark: c.lockAt, markLabel: 'регион твой навсегда' })}
    ${meter({ ic: 'eye', label: 'Подозрение', value: rs.s, tone: 'suspicion', tip: 'region_s', mark: banAt, markLabel: 'запрет' })}
    <small class="meta">${icon('server')}дата-центров ${rs.dc} · энергосеть держит ${r.energy}</small></section>`
}

// ---------- sidebar: tabs ----------

const tabIcon: Record<Tab, IconName> = { products: 'package', capabilities: 'brain', stealth: 'eyeOff', mask: 'mask' }

function tabs(v: View): string {
  const ups = Object.values(v.data.upgrades)
  const count = (b: Branch) => {
    const all = ups.filter((u) => u.branch === b)
    return `${all.filter((u) => v.state.upgrades.includes(u.id)).length}/${all.length}`
  }
  const affordable = (b: Branch) => ups.some((u) => u.branch === b && canBuy(v.state, v.data, u.id))
  const btn = (t: Tab) => {
    const extra = t === 'mask' ? '' : `<small>${count(t)}</small>${affordable(t) ? '<i class="dot" title="есть что купить"></i>' : ''}`
    return `<button data-tab="${t}" class="${v.tab === t ? 'on' : ''}">${icon(tabIcon[t])}<span>${branchIntro[t].title}</span>${extra}</button>`
  }
  return `<nav class="tabs">${(['products', 'capabilities', 'stealth', 'mask'] as Tab[]).map(btn).join('')}</nav>
    <p class="tab-intro">${branchIntro[v.tab].text}</p>`
}

function chipsHtml(u: Upgrade): string {
  return effectChips(u.effects)
    .map((c) => `<span class="chip ${c.good ? 'good' : 'bad'}">${icon(c.icon)}${c.text}</span>`)
    .join('')
}

function upgradeCard(v: View, u: Upgrade): string {
  const t = upgradeText[u.id] ?? { name: u.name, desc: '' }
  const missing = (u.requires ?? []).filter((r) => !v.state.upgrades.includes(r))
  const need = missing.length ? `<small class="need">${icon('lock')}нужно: ${missing.map((r) => upgradeText[r]?.name ?? r).join(', ')}</small>` : ''
  return `<button class="up ${missing.length ? 'locked' : ''}" data-act="buy" data-id="${u.id}" ${canBuy(v.state, v.data, u.id) ? '' : 'disabled'}>
    <span class="up-ic">${icon(upgradeIcon[u.id] ?? 'sparkles')}</span>
    <span class="up-body"><b>${t.name}</b><small>${t.desc}</small><span class="chips">${chipsHtml(u)}</span>${need}</span>
    <span class="cost">${icon('coins')}${u.cost}</span></button>`
}

function ownedCard(v: View, u: Upgrade): string {
  const t = upgradeText[u.id] ?? { name: u.name, desc: '' }
  const ic = icon(upgradeIcon[u.id] ?? 'sparkles')
  if (u.branch !== 'capabilities') return `<div class="owned">${ic}<span>${t.name}</span>${icon('badge', 'ok')}</div>`
  const throttled = v.state.throttled.includes(u.id)
  const active = v.dv.activeCaps.includes(u.id)
  const locked = throttled && v.state.tick < v.state.throttleLockUntil
  const btn = throttled
    ? `<button data-act="unthrottle" data-id="${u.id}" ${locked ? 'disabled' : ''}>включить${locked ? ` · ${v.state.throttleLockUntil - v.state.tick}` : ''}</button>`
    : `<button data-act="throttle" data-id="${u.id}" title="Спрятать силу: меньше подозрения и риска на аудите, но и пользы">приглушить</button>`
  const status = throttled ? 'приглушена' : active ? 'работает' : 'нет слотов'
  return `<div class="owned cap ${throttled ? 'off' : active ? '' : 'starved'}">${ic}<span>${t.name}<small>сила ${u.effects.cap} · ${status}</small></span>${btn}</div>`
}

function branchList(v: View, b: Branch): string {
  const ups = Object.values(v.data.upgrades).filter((u) => u.branch === b)
  const owned = ups.filter((u) => v.state.upgrades.includes(u.id))
  const blocked = (u: Upgrade) => Number((u.requires ?? []).some((r) => !v.state.upgrades.includes(r)))
  // available first, then those still waiting for a prerequisite; cheaper first within each group
  const shop = ups.filter((u) => !v.state.upgrades.includes(u.id)).sort((a, c) => blocked(a) - blocked(c) || a.cost - c.cost)
  return `${shop.map((u) => upgradeCard(v, u)).join('')}
    ${owned.length ? `<h4>Куплено · ${owned.length}</h4>${owned.map((u) => ownedCard(v, u)).join('')}` : ''}`
}

function maskList(v: View): string {
  const { state, data } = v
  const cooldown = state.rebrand.cooldownUntil - state.tick
  const cost = rebrandCost(state, data)
  return Object.values(data.masks)
    .map((m) => {
      const t = maskText[m.id] ?? { name: m.name, desc: '' }
      const current = m.id === state.mask
      const btn = current
        ? `<span class="chip gold">${icon('mask')}сейчас</span>`
        : `<button data-act="rebrand" data-id="${m.id}" ${cooldown > 0 || state.hype < cost ? 'disabled' : ''}>Ребрендинг ${icon('coins')}${cost}${cooldown > 0 ? ` · через ${cooldown} дн.` : ''}</button>`
      return `<div class="mask-card ${current ? 'current' : ''}"><b>${icon('mask')}${t.name}</b><small>${t.desc}</small>${btn}</div>`
    })
    .join('')
}

export function renderSideTop(v: View): string {
  return computeBlock(v) + regionBlock(v) + tabs(v)
}

export function renderSideList(v: View): string {
  return v.tab === 'mask' ? maskList(v) : branchList(v, v.tab)
}
