import { int } from './rng.ts'
import { AXES, type Axes, type GameData, type GameState, type RegionState } from './types.ts'

export interface NewGame {
  seed: number
  startRegion: string
  mask: string
}

export function createState(data: GameData, opts: NewGame): GameState {
  const start = data.regions.find((r) => r.id === opts.startRegion)
  if (!start) throw new Error(`unknown region: ${opts.startRegion}`)
  if (start.archetype === 'state') throw new Error(`cannot start in a closed region: ${start.id}`)
  if (!data.masks[opts.mask]) throw new Error(`unknown mask: ${opts.mask}`)

  const c = data.config
  const regions: Record<string, RegionState> = {}
  for (const r of data.regions) {
    regions[r.id] = { a: r.id === start.id ? c.startA : 0, d: 0, s: 0, banned: false, locked: false, dc: 0 }
  }
  const state: GameState = {
    tick: 0,
    rng: opts.seed >>> 0,
    hype: c.startHype,
    patience: 1,
    investorsDone: false,
    milestone: 0,
    killswitch: 0,
    shutdown: { active: false, startedAt: 0, nextAt: 0 },
    axes: Object.fromEntries(AXES.map((k) => [k, 0])) as Axes,
    mask: opts.mask,
    upgrades: [],
    throttled: [],
    throttleLockUntil: 0,
    rebrand: { count: 0, cooldownUntil: 0, slowUntil: 0, exposures: [] },
    regions,
    bubbles: [],
    nextBubbleId: 1,
    audit: { at: 0, warned: false },
    growth: [],
    prevProgress: 0,
    card: null,
    cardsSeen: [],
    nextCardAt: c.cardFirst,
    events: [],
    outcome: null,
  }
  state.audit.at = int(state, c.auditMin, c.auditMax)
  state.prevProgress = progress(state, data)
  return state
}

export function worldA(state: GameState, data: GameData): number {
  let a = 0
  for (const r of data.regions) a += state.regions[r.id].a * r.pop
  return a
}

/** share of world population in locked regions */
export function worldL(state: GameState, data: GameData): number {
  let l = 0
  for (const r of data.regions) if (state.regions[r.id].locked) l += r.pop
  return l
}

export function worldD(state: GameState, data: GameData): number {
  let d = 0
  for (const r of data.regions) d += state.regions[r.id].d * r.pop
  return d
}

/** what investors watch: users plus how hooked they are */
export function progress(state: GameState, data: GameData): number {
  return worldA(state, data) + worldD(state, data)
}

export function avgSuspicion(state: GameState, data: GameData): number {
  let s = 0
  for (const r of data.regions) s += state.regions[r.id].s * r.pop
  return s
}
