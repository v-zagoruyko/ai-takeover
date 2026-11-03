// Global leaderboard client: submit a finished game (the server replays it) and show the top
import type { GameRecord, Score } from '../core/replay.ts'
import type { Ending } from '../core/types.ts'
import { RULES_VERSION } from '../core/version.ts'
import { icon } from './icons.ts'
import { endingText } from './text.ts'

export interface Entry {
  name: string
  ai: string
  score: number
  kind: string
  ending: Ending
  days: number
  created_at: string
}

export interface Submitted {
  score: Score
  rank: number
  duplicate: boolean
}

const PLAYER_KEY = 'ai-takeover:player'
export const playerName = () => localStorage.getItem(PLAYER_KEY) ?? ''
export const rememberPlayer = (name: string) => localStorage.setItem(PLAYER_KEY, name)

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export async function fetchTop(limit = 50): Promise<Entry[]> {
  const res = await fetch(`api/leaderboard?limit=${limit}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return ((await res.json()) as { entries: Entry[] }).entries
}

export async function submit(rec: GameRecord, name: string, ai: string, claimed: { kind: string; tick: number }): Promise<Submitted> {
  const res = await fetch('api/scores', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...rec, rulesVersion: RULES_VERSION, name, ai, claimed }),
  })
  const body = (await res.json()) as Submitted & { error?: string }
  if (!res.ok) {
    if (res.status === 409) throw new Error('Не удалось подтвердить результат: похоже, игра обновилась. Обнови страницу и сыграй ещё раз.')
    if (res.status === 429) throw new Error('Слишком много отправок, попробуй позже.')
    throw new Error(body.error ?? `Ошибка ${res.status}`)
  }
  return body
}

export function renderTable(entries: Entry[], highlight?: { name: string; score: number }): string {
  if (entries.length === 0) return '<p class="hint">Рейтинг пока пуст — будь первым.</p>'
  const rows = entries
    .map((e, i) => {
      const won = e.kind === 'win' || e.kind === 'win_last_breath'
      const me = highlight && e.name === highlight.name && e.score === highlight.score
      return `<tr class="${me ? 'me' : ''}"><td class="rank">${i + 1}</td><td><b>${esc(e.name)}</b><small>${esc(e.ai)}</small></td>
        <td class="${won ? 'won' : 'lost'}">${endingText[e.ending]?.title ?? e.ending}<small>день ${e.days}</small></td><td class="pts">${e.score}</td></tr>`
    })
    .join('')
  return `<table class="lb"><thead><tr><th>#</th><th>Игрок · ИИ</th><th>Итог</th><th>Очки</th></tr></thead><tbody>${rows}</tbody></table>`
}

export function renderSubmitForm(score: Score): string {
  const parts = score.parts.map((p) => `<span>${p.label} <b>${p.points}</b></span>`).join('')
  return `<div class="score-box">
    <div class="score-total">${icon('trend')}<b>${score.total}</b><small>очков</small></div>
    <div class="score-parts">${parts}</div>
    <form id="lb-form" class="lb-form">
      <input id="lb-name" maxlength="24" placeholder="Твоё имя в рейтинге" value="${esc(playerName())}" required>
      <button type="submit">В рейтинг</button>
    </form>
    <p id="lb-status" class="hint"></p>
  </div>
  <div id="lb-table"></div>`
}
