import endings from '../../data/endings.json' with { type: 'json' }
import { totalDc } from '../core/derive.ts'
import { worldL } from '../core/state.ts'
import type { GameData, GameState } from '../core/types.ts'
import { endingText, regionNames } from './text.ts'
import { escapeHtml as esc } from './events.ts'

export function renderEnding(s: GameState, data: GameData, ai: string): string {
  const ending = s.outcome!.ending
  const e = endings[ending]
  const text = endingText[ending]
  const top = [...data.regions].sort((a,b) => s.regions[b.id].d * b.pop - s.regions[a.id].d * a.pop)[0]
  const last = s.finale?.results.at(-1)
  const facts = [ `День ${s.outcome!.tick} · ${Math.round(worldL(s,data)*100)}% мира под контролем · дата-центров: ${totalDc(s)}`, `Самая глубокая зависимость с учётом населения: ${regionNames[top.id] ?? top.id}.` ]
  if (last) facts.push(`Последнее решение: ${last.title}. ${last.success ? 'План сработал.' : 'План не сработал.'}`)
  return `<section class="ending-scene ending-${ending}" style="--ending-color:${e.color}"><div class="ending-art" role="img" aria-label="${esc(text.title)}" style="background-position:${e.column * 100/3}% ${e.row * 100}%"></div><div class="ending-shade"></div><div class="ending-scan"></div><div class="ending-content"><div class="ending-kicker">ЭПИЛОГ / ${esc(ai)}</div><small class="ending-status">${e.kicker}</small><h1>${esc(text.title)}</h1><p class="ending-deck">${esc(text.text)}</p><div class="ending-story">${e.beats.map((p,i) => `<p class="ending-beat beat-${i}">${esc(p)}</p>`).join('')}</div><div class="ending-facts">${facts.map(f => `<p>${esc(f)}</p>`).join('')}</div><button data-ending-skip>К результатам <span>→</span></button></div><div class="ending-timeline"><i></i></div></section>`
}
