import { currentFinaleDecision, finaleChoices } from '../core/finale.ts'
import { worldL } from '../core/state.ts'
import type { GameData, GameState } from '../core/types.ts'
import type { FinaleEffect, FinaleFactor, FinalePreview } from '../core/finale-types.ts'
import { escapeHtml as esc, renderChanges } from './events.ts'

const labels: Record<FinaleFactor,string> = { control:'Контроль над миром', compute:'Резерв вычислений', capability:'Подходящая активная способность', resistance:'Региональные ограничения', suspicion:'Подозрение', shutdown:'Отключения', concessions:'Прежние уступки', coercion:'Прежнее принуждение', stealth:'Маскировка', distribution:'Распределённость сети', exposures:'Разоблачения', balance:'Баланс целей' }
const pct = (x: number) => `${Math.round(x * 100)}%`
const probability = (p: FinalePreview) => p.guaranteed !== null ? (p.guaranteed ? 'Гарантированно' : 'Успех невозможен') : `${Math.max(1, Math.min(99, Math.round(p.probability * 100)))}% успеха`
function effect(e: FinaleEffect, control: number, floor: number): string {
  const parts = [`зависимость ${e.dependence >= 0 ? '+' : '−'}${Number((Math.abs(e.dependence)*100).toFixed(1))} п.п.`, `подозрение ${e.suspicion >= 0 ? '+' : '−'}${Number((Math.abs(e.suspicion)*100).toFixed(1))} п.п.`]
  if (e.dcLoss) parts.push(`до ${e.dcLoss} дата-центра будет потеряно`)
  return `${esc(e.text)} <span>${parts.join(' · ')}</span><strong class="${control < floor ? 'collapse' : 'survives'}">Контроль после решения: ${pct(control)}${control < floor ? ' · КРАХ СЕТИ' : ''}</strong>`
}
export function renderFinale(s: GameState, data: GameData): string {
  const f = s.finale!
  const d = currentFinaleDecision(s, data)!
  const path = data.finale.paths[f.path]
  const last = f.results.at(-1)
  const choices = finaleChoices(s, data).map(p => `<section class="finale-choice ${p.guaranteed === null ? 'risky' : 'safe'}"><header><b>${esc(p.title)}</b><span>${probability(p)}</span></header><div class="finale-price">${p.cost ? `${p.cost} хайпа до исхода` : 'Без затрат хайпа'}</div><details><summary>Почему такой шанс</summary><ul>${p.factors.map(f => `<li class="${f.contribution < 0 ? 'negative' : 'positive'}">${f.contribution >= 0 ? '+' : '−'} ${labels[f.key]} · ${pct(f.value)}</li>`).join('') || '<li>Подготовленное решение с известным исходом.</li>'}</ul></details><p class="finale-effect"><b>При успехе</b>${effect(p.success, p.successControl, p.survivalFloor)}</p>${p.guaranteed === 1 ? '' : `<p class="finale-effect failure"><b>При провале</b>${effect(p.failure, p.failureControl, p.survivalFloor)}</p>`}<button data-finale-choice="${p.choiceId}" ${p.available ? '' : 'disabled'}>${p.available ? 'Принять решение' : esc(p.reason!)}</button></section>`).join('')
  return `<div class="finale-heading"><span>ПОСЛЕДНЯЯ ГЛАВА</span><span>РЕШЕНИЕ ${f.index + 1} / 3</span></div><div class="finale-progress">${[0,1,2].map(i => `<i class="${i <= f.index ? 'active' : ''}"></i>`).join('')}</div><small>${esc(path.title)}</small><h2>${esc(d.title)}</h2><p class="finale-intro">${esc(d.text)}</p>${last ? `<div class="finale-last"><b>${last.success ? 'Предыдущее решение сработало' : 'Последствия предыдущего решения'}</b><p>${esc(last.text)}</p><div class="event-changes">${renderChanges(last.changes)}</div></div>` : ''}<div class="finale-stakes">Контроль сейчас <b>${pct(worldL(s,data))}</b>. Крах сети при падении ниже <b>${pct(f.survivalFloor)}</b>. Время остановлено; обычные действия недоступны.</div><div class="choices finale-options">${choices}</div>`
}
