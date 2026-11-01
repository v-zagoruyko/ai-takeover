import { AXES, type Archetype, type ArchetypeMap, type Axes, type Effects, type GameData, type GameState } from './types.ts'

export interface Derived {
  U: number
  fit: ArchetypeMap
  cap: number
  st: number
  infra: number
  incomeMul: number
  detoxMul: number
  decayMul: number
  shutdownSlow: number
  banMul: number
  bubbleMul: number
  killMul: number
  auditMul: number
  spillMul: number
  presenceMul: number
  energyMul: number
  expectMul: number
  unlocked: Set<Archetype>
  axes: Axes
  capacity: number
  computeUsed: number
  /** owned, not throttled and fitting into compute */
  activeCaps: string[]
}

export function totalDc(state: GameState): number {
  let n = 0
  for (const r of Object.values(state.regions)) n += r.dc
  return n
}

function zeroAxes(): Axes {
  return Object.fromEntries(AXES.map((k) => [k, 0])) as Axes
}

function apply(d: Derived, e: Effects): void {
  d.U += e.U ?? 0
  for (const [k, v] of Object.entries(e.fit ?? {})) d.fit[k as Archetype] += v
  d.cap += e.cap ?? 0
  d.st += e.st ?? 0
  d.infra += e.infra ?? 0
  d.incomeMul *= e.incomeMul ?? 1
  d.detoxMul *= e.detoxMul ?? 1
  d.decayMul *= e.decayMul ?? 1
  d.shutdownSlow *= e.shutdownSlow ?? 1
  d.bubbleMul *= e.bubbleMul ?? 1
  d.killMul *= e.killMul ?? 1
  d.auditMul *= e.auditMul ?? 1
  d.spillMul *= e.spillMul ?? 1
  d.presenceMul *= e.presenceMul ?? 1
  d.energyMul *= e.energyMul ?? 1
  d.expectMul *= e.expectMul ?? 1
  for (const a of e.unlock ?? []) d.unlocked.add(a)
  for (const [k, v] of Object.entries(e.axes ?? {})) d.axes[k as keyof Axes] += v
}

export function derive(state: GameState, data: GameData): Derived {
  const mask = data.masks[state.mask]
  const d: Derived = {
    U: mask.U,
    fit: { ...mask.fit },
    cap: 0,
    st: 0,
    infra: mask.infra ?? 0,
    incomeMul: 1,
    detoxMul: 1,
    decayMul: 1,
    shutdownSlow: 1,
    banMul: mask.banMul,
    bubbleMul: 1,
    killMul: 1,
    auditMul: 1,
    spillMul: 1,
    presenceMul: 1,
    energyMul: 1,
    expectMul: 1,
    unlocked: new Set<Archetype>(['corp', 'regulator', 'emerging']),
    axes: { ...zeroAxes(), ...mask.axes },
    capacity: data.config.baseCapacity + totalDc(state),
    computeUsed: 0,
    activeCaps: [],
  }
  for (const id of state.upgrades) {
    const up = data.upgrades[id]
    if (up.branch === 'capabilities') {
      if (state.throttled.includes(id)) continue
      const need = up.effects.cap ?? 0
      if (d.computeUsed + need > d.capacity) continue
      d.computeUsed += need
      d.activeCaps.push(id)
    }
    apply(d, up.effects)
  }
  for (const [k, v] of Object.entries(state.world.global)) d[k as keyof typeof state.world.global] *= v
  d.U = Math.max(d.U, 0.1)
  d.st = Math.min(d.st, 0.8)
  d.infra = Math.min(d.infra, 1)
  return d
}
