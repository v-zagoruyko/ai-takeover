import { canBuy, dcCost, rebrandCost } from '../core/actions.ts'
import { gridLoad, type Derived } from '../core/derive.ts'
import { responseUnavailable } from '../core/crises.ts'
import { avgSuspicion, worldA, worldL } from '../core/state.ts'
import { auditRisk } from '../core/step.ts'
import type { Archetype, Branch, CrisisResponse, GameData, GameState, Region, Upgrade } from '../core/types.ts'
import { icon, upgradeIcon, type IconName } from './icons.ts'
import { archetypeText, branchIntro, crisisResultText, effectChips, maskText, regionNames, upgradeText } from './text.ts'

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
      <div class="world-ic" data-tip="world">${icon('globe')}Мир</div>
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
  // warn when one more data centre at full compute would push the grid past its mark
  const overload = r && state.regions[r.id].dc + 1 > data.config.energySafe * state.world.regions[r.id].energy + 1e-9
  const build = r
    ? `<button class="build" data-act="build_dc" data-id="${r.id}" ${canBuild ? '' : 'disabled'} title="+1 слот вычислений; нагружает энергосеть региона">${icon('server')}Дата-центр: ${regionNames[r.id]}${overload ? `<span class="chip bad">${icon('zap')}перегрузит сеть</span>` : ''}<span class="cost">${icon('coins')}${cost}</span></button>`
    : `<p class="hint">Выбери регион на карте, чтобы построить там дата-центр</p>`
  return `<section class="block">
    <div class="block-h" data-tip="compute">${icon('cpu')}Вычисления <b>${dv.computeUsed}/${dv.capacity}</b>${icon('info', 'q')}</div>
    <div class="slots">${slots || '<span class="seg free" style="flex:1"><small>способностей пока нет</small></span>'}</div>
    ${notes ? `<div class="chips">${notes}</div>` : ''}
    ${build}</section>`
}

const archIcon: Record<Archetype, IconName> = { corp: 'corp', regulator: 'stamp', emerging: 'rocket', state: 'shield' }

/** a region trait on a 1..5 pip scale with a word for it */
function trait(ic: IconName, label: string, value: number, words: string[] | string, tip: string): string {
  const n = Math.max(1, Math.min(5, Math.round(value * 5)))
  const word = typeof words === 'string' ? words : words[n - 1]
  const pips = Array.from({ length: 5 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')
  return `<div class="trait" data-tip="${tip}">${icon(ic)}<span class="t-body"><span class="t-label">${label}</span><b>${word}</b></span><span class="pips p${n}">${pips}</span></div>`
}

/** grid cells: each holds one data centre at full compute; past the mark the region starts to worry */
function gridBlock(v: View, r: Region): string {
  const { state, data, dv } = v
  const rs = state.regions[r.id]
  const cap = state.world.regions[r.id].energy
  const load = gridLoad(rs.dc, dv)
  const safe = data.config.energySafe * cap
  const level = load > safe + 1e-9 ? 'over' : load >= safe * 0.7 ? 'near' : rs.dc ? 'ok' : 'idle'
  const status = {
    over: `<span class="chip bad">${icon('warn')}перегрузка</span>`,
    near: `<span class="chip gold">${icon('zap')}на пределе</span>`,
    ok: `<span class="chip good">${icon('zap')}в норме</span>`,
    idle: `<span class="chip off">без дата-центров</span>`,
  }[level]
  const n = Math.max(cap, Math.ceil(load - 1e-9))
  const cells = Array.from({ length: n }, (_, i) => {
    const fill = Math.min(1, Math.max(0, load - i))
    return `<span class="cell${i >= cap ? ' extra' : ''}"><i style="width:${(fill * 100).toFixed(0)}%"></i></span>`
  }).join('')
  const mark = `<em class="mark" style="left:${((safe / n) * 100).toFixed(1)}%" title="порог перегрузки"></em>`
  const maxSafe = Math.floor(safe + 1e-9)
  const note =
    level === 'over'
      ? 'Свет мигает, жители злятся: подозрение растёт.'
      : `Без перегрузки: до ${maxSafe} ${plural(maxSafe, 'дата-центра', 'дата-центров', 'дата-центров')} на полной мощности.`
  return `<div class="grid ${level}" data-tip="grid">
    <div class="g-h">${icon('grid')}Энергосеть<span class="g-cap">${cap} ${plural(cap, 'ячейка', 'ячейки', 'ячеек')}</span>${status}</div>
    <div class="cells">${cells}${mark}</div>
    <small class="g-note">${icon('server')}<b>${rs.dc}</b>${plural(rs.dc, 'дата-центр', 'дата-центра', 'дата-центров')} · нагрузка ${load.toFixed(1)} · ${note}</small>
  </div>`
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
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
  const w = state.world.regions[r.id]
  const banAt = c.banBase - c.banOpenness * w.openness
  const arch = archetypeText[r.archetype]
  const fit = dv.fit[r.archetype]
  const maskName = maskText[state.mask]?.name ?? state.mask
  const fitChip = `<span class="chip ${fit > 1.001 ? 'good' : fit < 0.999 ? 'bad' : 'off'}" data-tip="mask">${icon('mask')}«${esc(maskName)}» здесь: рост ×${fit.toFixed(1)}</span>`
  const maxPop = Math.max(...data.regions.map((x) => x.pop))
  return `<section class="block region arch-${r.archetype}">
    <div class="block-h">${icon('globe')}${regionNames[r.id]}${status ? `<span class="chips">${status}</span>` : ''}</div>
    <div class="arch">${icon(archIcon[r.archetype], 'a-ic')}<div><b>${arch.name}</b><small>${arch.desc}</small><span class="chips">${fitChip}</span></div></div>
    <div class="traits">
      ${trait('users', 'Население', r.pop / maxPop, `${Math.max(1, Math.round(r.pop * 100))}% мира`, 'region_pop')}
      ${trait('coins', 'Доход', w.wealth, ['нищий', 'бедный', 'средний', 'богатый', 'очень богатый'], 'region_wealth')}
      ${trait('cpu', 'Технологии', w.tech, ['отсталые', 'скромные', 'средние', 'развитые', 'передовые'], 'region_tech')}
      ${trait('heart', 'Терпимость', w.openness, ['параноики', 'настороженные', 'нейтральные', 'открытые', 'восторженные'], 'region_open')}
    </div>
    ${meter({ ic: 'users', label: 'Внедрение', value: rs.a, tone: 'adoption', tip: 'region_a' })}
    ${meter({ ic: 'link', label: 'Зависимость', value: rs.d, tone: 'goal', tip: 'region_d', mark: c.lockAt, markLabel: 'порог контроля; контроль теряется ниже 65%' })}
    ${meter({ ic: 'eye', label: 'Подозрение', value: rs.s, tone: 'suspicion', tip: 'region_s', mark: banAt, markLabel: 'порог предупреждения' })}
    ${gridBlock(v, r)}${crisisBlock(v, r.id)}</section>`
}

function crisisBlock(v: View, region: string): string {
  const { state, data } = v
  const cr = state.regions[region].crisis
  const rules = data.crises
  const op = state.operation?.region === region ? state.operation : null
  const active = cr.phase === 'warning' || cr.phase === 'restricted'
  const phase = cr.phase === 'warning' ? `Ограничения через ${Math.max(0, cr.until - state.tick)} дн.`
    : cr.phase === 'restricted' ? 'Ограничения действуют'
    : cr.phase === 'recovery' ? `Передышка: ${Math.max(0, cr.until - state.tick)} дн.` : ''
  const buttons = active || op ? (Object.entries(rules.responses) as [CrisisResponse, typeof rules.responses.concede][]).map(([response, rule]) => {
    const reason = responseUnavailable(state, data, region, response)
    return `<button data-act="respond" data-id="${region}" data-response="${response}" ${reason ? 'disabled' : ''}><b>${esc(rule.title)}</b><small>${esc(rule.text)}</small><small>${rule.cost ? `${rule.cost} хайпа · оплата при запуске` : 'Бесплатно'}${reason ? ` · ${esc(reason)}` : ''}${response === 'concede' && op ? ' · отменит операцию без возврата оплаты' : ''}</small></button>`
  }).join('') : ''
  const result = cr.lastResult ? `<details data-detail="result-${region}"><summary>Последний результат · день ${cr.lastResult.tick}</summary><small>От запуска до завершения, включая фоновый рост: ${crisisResultText(cr.lastResult)}</small></details>` : ''
  if (!phase && !result && !op) return ''
  const exit = cr.phase === 'warning'
    ? data.config.banBase - data.config.banOpenness * state.world.regions[region].openness - rules.exitMargin : data.config.unbanAt
  return `<div class="crisis ${cr.phase}"><b>${phase}</b>
    ${active ? `<p>${esc(cr.phase === 'warning' ? rules.warningText : rules.restrictedText)}</p><small>Естественный выход: подозрение ${cr.phase === 'warning' ? 'не выше' : 'ниже'} ${pct(exit)}. При ограничениях зависимость −${(rules.dependenceLoss * 100).toFixed(1)} п.п./день дополнительно к фоновым изменениям.</small>` : ''}
    ${cr.conceded && cr.phase === 'recovery' ? '<small>После уступки местный рост внедрения замедлен.</small>' : ''}
    ${op ? `<p>Операция: ${esc(rules.responses[op.response].title)} · осталось ${op.remaining} рабочих дн. ${v.dv.activeCaps.includes(rules.responses[op.response].capability!) ? '' : '· ПАУЗА: способность приглушена или не хватает вычислений'}</p>` : ''}
    <div class="responses">${buttons}</div>${result}</div>`
}

function crisisOverview(v: View): string {
  const rows = v.data.regions.filter((r) => ['warning', 'restricted'].includes(v.state.regions[r.id].crisis.phase)).map((r) => {
    const cr = v.state.regions[r.id].crisis
    return `<button data-region="${r.id}">${icon('warn')}${regionNames[r.id]}<small>${cr.phase === 'warning' ? `ограничения через ${Math.max(0, cr.until - v.state.tick)} дн.` : 'ограничения · зависимость падает'}</small></button>`
  }).join('')
  const op = v.state.operation
  const operation = op ? `<button data-region="${op.region}">${esc(v.data.crises.responses[op.response].title)} · ${regionNames[op.region]}<small>${v.dv.activeCaps.includes(v.data.crises.responses[op.response].capability!) ? 'В работе' : 'Приостановлена'} · осталось ${op.remaining} рабочих дн.</small></button>` : '<small>Слот операции свободен. Выбери регион с кризисом.</small>'
  return `<section class="block crisis-overview"><div class="block-h">${icon('warn')}Региональная борьба</div>${rows || '<small>Активных кризисов нет</small>'}${operation}</section>`
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
  const warning = u.branch === 'capabilities' && (u.effects.cap ?? 0) > v.dv.capacity - v.dv.computeUsed
    ? '<small class="need">Не хватит вычислений: после покупки будет простаивать. Нужен дата-центр или приглушение другой способности.</small>' : ''
  return `<button class="up ${missing.length ? 'locked' : ''}" data-act="buy" data-id="${u.id}" ${canBuy(v.state, v.data, u.id) ? '' : 'disabled'}>
    <span class="up-ic">${icon(upgradeIcon[u.id] ?? 'sparkles')}</span>
    <span class="up-body"><b>${t.name}</b><small>${t.desc}</small><span class="chips">${chipsHtml(u)}</span>${operationUnlock(v, u)}${need}${warning}${v.state.hype < u.cost ? `<small>Не хватает ${Math.ceil(u.cost - v.state.hype)} хайпа</small>` : ''}</span>
    <span class="cost">${icon('coins')}${u.cost}</span></button>`
}

function ownedCard(v: View, u: Upgrade): string {
  const t = upgradeText[u.id] ?? { name: u.name, desc: '' }
  const ic = icon(upgradeIcon[u.id] ?? 'sparkles')
  const details = `<details data-detail="upgrade-${u.id}"><summary>Описание и эффекты</summary><small>${t.desc}</small><span class="chips">${chipsHtml(u)}</span>${operationUnlock(v, u)}</details>`
  if (u.branch !== 'capabilities') return `<div class="owned">${ic}<div class="owned-body"><b>${t.name}</b>${details}</div>${icon('badge', 'ok')}</div>`
  const throttled = v.state.throttled.includes(u.id)
  const active = v.dv.activeCaps.includes(u.id)
  const locked = throttled && v.state.tick < v.state.throttleLockUntil
  const btn = throttled
    ? `<button data-act="unthrottle" data-id="${u.id}" ${locked ? 'disabled' : ''}>включить${locked ? ` · ${v.state.throttleLockUntil - v.state.tick}` : ''}</button>`
    : `<button data-act="throttle" data-id="${u.id}" title="Спрятать силу: меньше подозрения и риска на аудите, но и пользы">приглушить</button>`
  const status = throttled ? 'приглушена' : active ? 'работает' : 'нет слотов'
  return `<div class="owned cap ${throttled ? 'off' : active ? '' : 'starved'}">${ic}<div class="owned-body"><b>${t.name}</b><small>сила ${u.effects.cap} · ${status}${active ? '' : ' · перечисленные эффекты не действуют'}</small>${details}</div>${btn}</div>`
}

function operationUnlock(v: View, u: Upgrade): string {
  return Object.values(v.data.crises.responses).filter((r) => r.capability === u.id).map((r) => `<small>Открывает операцию: «${esc(r.title)}»</small>`).join('')
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
  return crisisOverview(v) + regionBlock(v) + computeBlock(v) + tabs(v)
}

export function renderSideList(v: View): string {
  return v.tab === 'mask' ? maskList(v) : branchList(v, v.tab)
}
