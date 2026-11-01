// Replays a game from its seed and action log. The browser and the leaderboard server share this code,
// so a submitted result is trusted only if the server reaches the same outcome by itself.
import { applyAction } from './actions.ts'
import { avgSuspicion, createState, worldA, worldL } from './state.ts'
import { step } from './step.ts'
import type { Action, GameData, GameState, OutcomeKind } from './types.ts'

/** an action and the tick it was taken on (between that tick's step and the next one) */
export interface LoggedAction {
  t: number
  a: Action
}

export interface GameRecord {
  seed: number
  startRegion: string
  mask: string
  log: LoggedAction[]
}

export interface Peaks {
  peakA: number
  peakS: number
}

export interface Replay extends Peaks {
  state: GameState
}

export function trackPeaks(p: Peaks, state: GameState, data: GameData): void {
  p.peakA = Math.max(p.peakA, worldA(state, data))
  p.peakS = Math.max(p.peakS, avgSuspicion(state, data))
}

export function replay(data: GameData, rec: GameRecord): Replay {
  let state = createState(data, { seed: rec.seed, startRegion: rec.startRegion, mask: rec.mask })
  const peaks: Peaks = { peakA: 0, peakS: 0 }
  trackPeaks(peaks, state, data)
  let i = 0
  while (!state.outcome) {
    while (i < rec.log.length && rec.log[i].t <= state.tick) {
      if (rec.log[i].t === state.tick) applyAction(state, data, rec.log[i].a)
      i++
    }
    state = step(state, data, [])
    trackPeaks(peaks, state, data)
  }
  return { state, ...peaks }
}

export interface Score {
  total: number
  parts: { label: string; points: number }[]
}

const WIN_BONUS: Partial<Record<OutcomeKind, number>> = { win: 3000, win_last_breath: 1500 }

/**
 * Every finished game scores: share of the world under control, peak reach, a win bonus,
 * a speed bonus for wins and a stealth bonus for staying unsuspicious.
 */
export function scoreGame(r: Replay, data: GameData): Score {
  const o = r.state.outcome!
  const won = o.kind === 'win' || o.kind === 'win_last_breath'
  const parts = [
    { label: 'контроль над миром', points: Math.round(worldL(r.state, data) * 1000) },
    { label: 'пик внедрения', points: Math.round(r.peakA * 500) },
    { label: won ? 'победа' : 'победы нет', points: WIN_BONUS[o.kind] ?? 0 },
    { label: 'скорость', points: won ? Math.max(0, 2000 - o.tick) : 0 },
    { label: 'скрытность', points: Math.round((1 - r.peakS) * 500) },
  ]
  return { total: parts.reduce((s, p) => s + p.points, 0), parts }
}
