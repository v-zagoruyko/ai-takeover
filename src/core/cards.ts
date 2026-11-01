import { totalDc } from './derive.ts'
import { int, next } from './rng.ts'
import { avgSuspicion, worldA, worldL } from './state.ts'
import { AXES, type Card, type CardEffect, type GameData, type GameState } from './types.ts'

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

function regionsFor(st: GameState, data: GameData, card: Card): string[] {
  const w = card.when
  return data.regions
    .filter(
      (r) =>
        st.regions[r.id].a >= (w.regionMinA ?? 0) &&
        (!w.regionArchetypes || w.regionArchetypes.includes(r.archetype)) &&
        (!w.regionHasDc || st.regions[r.id].dc > 0),
    )
    .map((r) => r.id)
}

/** late game: long enough, big enough or scary enough */
export function isLate(st: GameState, data: GameData): boolean {
  const c = data.config
  return st.tick >= c.lateTick || worldL(st, data) >= c.lateL || st.killswitch >= c.lateK
}

function eligible(st: GameState, data: GameData, card: Card): boolean {
  const w = card.when
  // during shutdowns only shutdown cards are dealt, and they never come otherwise
  if (!!w.shutdown !== st.shutdown.active) return false
  if (w.late && !isLate(st, data)) return false
  if (st.tick < (w.minTick ?? 0)) return false
  if (worldA(st, data) < (w.minA ?? 0)) return false
  if (avgSuspicion(st, data) < (w.minS ?? 0)) return false
  if (totalDc(st) < (w.minDc ?? 0)) return false
  if (!(w.needs ?? []).every((u) => st.upgrades.includes(u))) return false
  if (w.regionMinA !== undefined && regionsFor(st, data, card).length === 0) return false
  return true
}

/** deals a new card when it is due; the card stays pending until the player chooses */
export function updateCards(st: GameState, data: GameData): void {
  if (st.card || st.tick < st.nextCardAt) return
  let pool = data.cards.filter((c) => !st.cardsSeen.includes(c.id) && eligible(st, data, c))
  if (pool.length === 0) pool = data.cards.filter((c) => c.id !== st.cardsSeen.at(-1) && eligible(st, data, c))
  if (pool.length === 0) {
    st.nextCardAt = st.tick + 30
    return
  }
  const card = pool[Math.floor(next(st) * pool.length)]
  let region: string | null = null
  if (card.when.regionMinA !== undefined) {
    // weight by presence, but strongly prefer regions that have not had a card yet
    const rs = regionsFor(st, data, card)
    const weights = rs.map((id) => Math.sqrt(st.regions[id].a + 0.01) / (1 + 2 * (st.cardRegions[id] ?? 0)))
    let pick = next(st) * weights.reduce((a, b) => a + b, 0)
    region = rs[rs.length - 1]
    for (let i = 0; i < rs.length; i++) {
      pick -= weights[i]
      if (pick <= 0) {
        region = rs[i]
        break
      }
    }
    st.cardRegions[region] = (st.cardRegions[region] ?? 0) + 1
  }
  st.card = { id: card.id, region }
  st.cardsSeen.push(card.id)
  st.events.push({ type: 'card', card: card.id, region })
}

function applyEffect(st: GameState, e: CardEffect, region: string | null): boolean {
  if (e.chance !== undefined && next(st) >= e.chance) {
    if (e.fail) applyEffect(st, e.fail, region)
    return false
  }
  st.hype = Math.max(0, st.hype + (e.hype ?? 0))
  for (const rs of Object.values(st.regions)) {
    if (e.suspicion && rs.a > 0.02) rs.s = clamp01(rs.s + e.suspicion)
    if (e.adoption && rs.a > 0) rs.a = clamp01(rs.a * (1 + e.adoption))
  }
  for (const rs of Object.values(st.regions)) {
    if (e.dependence && rs.a > 0.02) rs.d = clamp01(rs.d + e.dependence)
  }
  if (region) {
    const rs = st.regions[region]
    rs.s = clamp01(rs.s + (e.regionSuspicion ?? 0))
    rs.a = clamp01(rs.a + (e.regionAdoption ?? 0))
    rs.d = clamp01(rs.d + (e.regionDependence ?? 0))
    rs.dc = Math.max(0, rs.dc + (e.regionDc ?? 0))
  }
  if (st.shutdown.active) {
    st.shutdown.nextAt += e.delayWave ?? 0
    st.shutdown.startedAt -= e.shortenShutdown ?? 0
  }
  if (e.killswitch && !st.shutdown.active) st.killswitch = clamp01(st.killswitch + e.killswitch)
  if (e.patience && !st.investorsDone) st.patience = clamp01(st.patience + e.patience)
  for (const k of AXES) st.axes[k] += e.axes?.[k] ?? 0
  return true
}

/** mutates state; returns false when there is no pending card or the index is invalid */
export function resolveCard(st: GameState, data: GameData, index: number): boolean {
  if (!st.card) return false
  const card = data.cards.find((c) => c.id === st.card!.id)
  const choice = card?.choices[index]
  if (!card || !choice) return false
  const success = applyEffect(st, choice.effects, st.card.region)
  st.events.push({ type: 'card_resolved', card: card.id, choice: index, success })
  st.card = null
  const c = data.config
  st.nextCardAt = st.shutdown.active
    ? st.tick + int(st, c.shutdownCardMin, c.shutdownCardMax)
    : st.tick + Math.round(int(st, c.cardMin, c.cardMax) * (isLate(st, data) ? c.lateCardMul : 1))
  return true
}
