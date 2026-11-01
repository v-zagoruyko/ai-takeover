import { int, next, range } from './rng.ts'
import { AXES, type Axes, type GameData, type GameState, type RegionParams, type RegionState, type WorldGlobal } from './types.ts'

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
    regions[r.id] = { a: r.id === start.id ? c.startA : 0, d: 0, s: 0, banned: false, locked: false, dc: 0, trend: 1 }
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
    cardRegions: {},
    world: { regions: {}, modifiers: [], global: {} },
    nextCardAt: c.cardFirst,
    events: [],
    outcome: null,
  }
  state.audit.at = int(state, c.auditMin, c.auditMax)
  rollWorld(state, data)
  state.prevProgress = progress(state, data)
  return state
}

/** this game's world: jittered region parameters plus a few random modifiers */
function rollWorld(state: GameState, data: GameData): void {
  const c = data.config
  const j = () => range(state, 1 - c.worldJitter, 1 + c.worldJitter)
  const params: Record<string, RegionParams> = {}
  for (const r of data.regions) {
    params[r.id] = { tech: r.tech * j(), openness: r.openness * j(), wealth: r.wealth * j(), energy: Math.max(1, Math.round(r.energy * j())) }
  }
  const pool = [...data.modifiers]
  const picked: string[] = []
  const global: Partial<Record<WorldGlobal, number>> = {}
  for (let k = 0; k < c.modifiersPerGame && pool.length; k++) {
    const m = pool.splice(Math.floor(next(state) * pool.length), 1)[0]
    picked.push(m.id)
    for (const r of data.regions) {
      if (!(m.regions?.includes(r.id) || m.archetypes?.includes(r.archetype))) continue
      const p = params[r.id]
      p.tech *= m.tech ?? 1
      p.openness *= m.openness ?? 1
      p.wealth *= m.wealth ?? 1
      p.energy = Math.max(1, Math.round(p.energy * (m.energy ?? 1)))
    }
    for (const [k2, v] of Object.entries(m.global ?? {})) global[k2 as WorldGlobal] = (global[k2 as WorldGlobal] ?? 1) * v
  }
  for (const p of Object.values(params)) {
    p.tech = Math.min(1, p.tech)
    p.openness = Math.min(1, p.openness)
  }
  state.world = { regions: params, modifiers: picked, global }
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
