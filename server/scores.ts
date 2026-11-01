// Validation and verification of submitted games. Pure: no HTTP, no database, easy to test.
import { replay, scoreGame, type GameRecord, type LoggedAction, type Score } from '../src/core/replay.ts'
import type { Action, GameData } from '../src/core/types.ts'

export interface Submission extends GameRecord {
  name: string
  ai: string
  claimed: { kind: string; tick: number }
}

export interface Verified {
  name: string
  ai: string
  score: Score
  kind: string
  ending: string
  days: number
}

export type Check = { ok: true; value: Verified } | { ok: false; status: number; error: string }

const MAX_LOG = 20000
const NAME_MAX = 24

/** printable, single-spaced, 1..24 chars; null if nothing usable is left */
export function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e]/g, '').replace(/\s+/g, ' ').trim()
  return s.length >= 1 && s.length <= NAME_MAX ? s : null
}

const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max

function action(v: unknown): Action | null {
  if (!v || typeof v !== 'object') return null
  const a = v as Record<string, unknown>
  const str = (k: string) => typeof a[k] === 'string' && (a[k] as string).length <= 40
  switch (a.type) {
    case 'buy':
    case 'throttle':
    case 'unthrottle':
      return str('upgrade') ? ({ type: a.type, upgrade: a.upgrade } as Action) : null
    case 'build_dc':
      return str('region') ? { type: 'build_dc', region: a.region as string } : null
    case 'rebrand':
      return str('mask') ? { type: 'rebrand', mask: a.mask as string } : null
    case 'pop_bubble':
      return isInt(a.id, 0, 1e7) ? { type: 'pop_bubble', id: a.id } : null
    case 'choose':
      return isInt(a.index, 0, 10) ? { type: 'choose', index: a.index } : null
    default:
      return null
  }
}

export function verify(body: unknown, data: GameData): Check {
  const bad = (error: string): Check => ({ ok: false, status: 400, error })
  if (!body || typeof body !== 'object') return bad('body must be an object')
  const b = body as Record<string, unknown>
  const name = cleanName(b.name)
  const ai = cleanName(b.ai)
  if (!name) return bad('name: 1–24 characters')
  if (!ai) return bad('ai: 1–24 characters')
  if (!isInt(b.seed, 0, 2 ** 31)) return bad('seed')
  const start = data.regions.find((r) => r.id === b.startRegion)
  if (!start || start.archetype === 'state') return bad('startRegion')
  if (typeof b.mask !== 'string' || !data.masks[b.mask]) return bad('mask')
  if (!Array.isArray(b.log) || b.log.length > MAX_LOG) return bad('log')
  const log: LoggedAction[] = []
  let lastT = 0
  for (const e of b.log as unknown[]) {
    const r = e as Record<string, unknown> | null
    const a = action(r?.a)
    if (!r || !a || !isInt(r.t, lastT, data.config.maxTicks)) return bad('log entry')
    lastT = r.t as number
    log.push({ t: lastT, a })
  }
  const claimed = b.claimed as Record<string, unknown> | undefined
  if (!claimed || typeof claimed.kind !== 'string' || !isInt(claimed.tick, 0, data.config.maxTicks)) return bad('claimed')

  const r = replay(data, { seed: b.seed as number, startRegion: start.id, mask: b.mask, log })
  const o = r.state.outcome!
  // a mismatch means a forged log or a client running an older version of the game
  if (o.kind !== claimed.kind || o.tick !== claimed.tick) {
    return { ok: false, status: 409, error: 'replay mismatch: the result could not be reproduced (refresh the page to get the latest version)' }
  }
  return { ok: true, value: { name, ai, score: scoreGame(r, data), kind: o.kind, ending: o.ending, days: o.tick } }
}
