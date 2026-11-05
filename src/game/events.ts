import audits from '../../data/audits.json' with { type: 'json' }
import type { EventDelta, GameData, GameEvent } from '../core/types.ts'
import { newsFor, fillCard, regionNames, crisisResultText } from './text.ts'

export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
export interface EventView {
  id: string; tick: number; kind: string; severity: 'critical' | 'good' | 'info' | 'bad'
  title: string; body: string; changes: EventDelta[]; region?: string; action?: string
}
let sequence = 0
export function presentEvent(e: GameEvent, data: GameData, ctx: { ai: string; old: string; tick: number }): EventView | null {
  const region = 'region' in e ? e.region ?? undefined : undefined
  const v: EventView = { id: String(++sequence), tick: ctx.tick, kind: e.type, severity: 'info', title: '', body: '', changes: [], region }
  if (e.type === 'audit') {
    const report = audits.find(r => r.id === e.reportId) ?? audits.at(-1)!
    v.title = e.passed ? 'Аудит пройден' : 'Аудит выявил угрозу'
    v.body = `${report.title}. ${e.passed ? report.passed : report.failed} Риск при проверке: ${Math.round(e.risk * 100)}%.`
    v.severity = e.passed ? 'good' : 'critical'
    v.changes = e.changes
    v.action = e.passed ? undefined : 'Проверить маскировку'
  } else if (e.type === 'card_resolved') {
    const card = data.cards.find(c => c.id === e.card)!
    const choice = card.choices[e.choice]
    v.title = card.title
    v.body = `${fillCard(choice.text, ctx.ai, e.region)}. ${choice.effects.chance === undefined ? 'Решение принято.' : e.success ? 'План сработал.' : 'План не сработал.'}`
    v.severity = e.success ? 'good' : 'bad'
    v.changes = e.changes
  } else if (e.type === 'audit_warning') {
    v.title = `Аудит через ${e.at - ctx.tick} дней`
    v.body = 'Проверяющие сопоставят реальные способности с заявленными. Приглуши способности или усили маскировку до проверки.'
    v.severity = 'critical'; v.action = 'Проверить способности'
  } else if (e.type === 'operation_done') {
    v.title = 'Региональная операция завершена'; v.body = crisisResultText(e.result); v.severity = 'good'
    for (const [metric, key] of [['adoption','a'],['dependence','d'],['suspicion','s']] as const) {
      if (e.result.before[key] !== e.result.after[key]) v.changes.push({ metric, region: e.region, before: e.result.before[key], after: e.result.after[key] })
    }
  } else {
    const titles: Record<string, string> = { ban: 'Введён запрет', unban: 'Запрет отменён', lock: 'Регион под контролем', unlock: 'Контроль потерян', funding_round: 'Новый раунд инвестиций', rebrand: 'Новая личность', rebrand_exposed: 'Прикрытие раскрыто', shutdown_started: 'Протокол отключения', dc_shutdown: 'Дата-центр обесточен', crisis_warning: 'Регион готовит ограничения', crisis_restricted: 'Ограничения вступили в силу', crisis_recovered: 'Кризис отступил', operation_started: 'Операция начата', finale_warning: 'Точка невозврата близко', finale_started: 'Последняя глава', finale_resolved: 'Решение изменило мир' }
    v.title = titles[e.type] ?? ''
    if (e.type === 'finale_resolved') { v.body = e.text; v.changes = e.changes; v.severity = e.success ? 'good' : 'bad' }
    if (e.type !== 'finale_resolved') v.body = newsFor(e, { ...ctx, region: id => regionNames[id] ?? id }) ?? ''
    if (['shutdown_started','rebrand_exposed','crisis_warning','crisis_restricted','unlock'].includes(e.type)) v.severity = 'critical'
    if (['lock','funding_round','unban','crisis_recovered'].includes(e.type)) v.severity = 'good'
    if (e.type === 'funding_round') v.body += ` Получено ${e.hype} хайпа.`
    if (String(e.type) === 'finale_warning') v.body = 'Мир близок к передаче полномочий. Твои способности и прежние решения определят условия развязки.'
    if (String(e.type) === 'finale_started') { v.body = 'Обычный ход времени остановлен. Три решения определят судьбу мира.'; v.severity = 'critical' }

  }
  return v.title ? v : null
}

const metrics: Record<string, string> = { hype: 'Хайп', killswitch: 'Угроза отключения', patience: 'Терпение инвесторов', adoption: 'Внедрение', dependence: 'Зависимость', suspicion: 'Подозрение', dc: 'Дата-центры', nextWave: 'Следующая волна', shutdownDeadline: 'Конец отключений' }
export function renderChanges(changes: EventDelta[]): string {
  const groups = new Map<string, { delta: number; count: number }>()
  for (const x of changes.filter(x => !x.metric.startsWith('axis_'))) {
    const delta = x.after - x.before
    const key = `${x.metric}:${Math.sign(delta)}`
    const prev = groups.get(key)
    if (prev && Math.abs(prev.delta - delta) < 1e-8) prev.count++
    else groups.set(`${key}${prev ? ':' + x.region : ''}`, { delta, count: 1 })
  }
  const character = changes.some(x => x.metric.startsWith('axis_')) ? '<span class="event-change">Курс ИИ изменился</span>' : ''
  return character + [...groups].map(([key, x]) => {
    const metric = key.split(':')[0]
    const timing = ['nextWave','shutdownDeadline'].includes(metric)
    const scalar = timing || ['hype','dc'].includes(metric)
    const value = Math.abs(x.delta) * (scalar ? 1 : 100)
    return `<span class="event-change">${escapeHtml(metrics[metric] ?? metric)} ${x.delta > 0 ? '+' : '−'}${Number(value.toFixed(1))}${timing ? ' дн.' : scalar ? '' : ' п.п.'}${x.count > 1 ? ` · ${x.count} рег.` : ''}</span>`
  }).join('')
}

export function renderEvent(v: EventView, compact = false): string {
  const action = v.action ? `<button data-event-action="${escapeHtml(v.kind)}">${escapeHtml(v.action)}</button>` : ''
  return `<article id="${compact ? 'notice' : 'event'}-${v.id}" class="event-item ${v.severity}"><div class="event-meta">${escapeHtml(v.kind === 'ambient' ? 'МИР' : 'СВОДКА')} <span>ДЕНЬ ${v.tick}</span>${v.region ? `<button data-region="${escapeHtml(v.region)}">${escapeHtml(regionNames[v.region] ?? v.region)}</button>` : ''}</div><h3>${escapeHtml(v.title)}</h3>${compact ? '' : `<p>${escapeHtml(v.body)}</p><div class="event-changes">${renderChanges(v.changes)}</div>`}<div class="notice-actions">${action}${compact ? `<button data-report="${v.id}">Подробнее</button><button data-dismiss="${v.id}" aria-label="Закрыть уведомление">×</button>` : ''}</div></article>`
}
