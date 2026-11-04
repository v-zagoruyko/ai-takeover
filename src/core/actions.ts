import { resolveFinaleChoice } from './finale.ts'
import { derive, totalDc } from './derive.ts'
import { resolveCard } from './cards.ts'
import { respondToCrisis } from './crises.ts'
import { int } from './rng.ts'
import type { Action, GameData, GameState } from './types.ts'

export function dcCost(state: GameState, data: GameData): number {
  return data.config.dcCostBase * (totalDc(state) + 1)
}

export function rebrandCost(state: GameState, data: GameData): number {
  return data.config.rebrandBase + data.config.rebrandStep * state.rebrand.count
}

export function canBuy(state: GameState, data: GameData, id: string): boolean {
  const up = data.upgrades[id]
  if (!up || state.upgrades.includes(id)) return false
  if (!(up.requires ?? []).every((r) => state.upgrades.includes(r))) return false
  return state.hype >= up.cost
}

/** mutates state; invalid actions are ignored and return false */
export function applyAction(state: GameState, data: GameData, action: Action): boolean {
  if (state.outcome) return false
  if (action.type === 'finale_choose') return resolveFinaleChoice(state, data, action.choice)
  if (state.finale || (state.finaleCandidate && state.card && action.type !== 'choose')) return false
  const c = data.config
  switch (action.type) {
    case 'respond':
      return respondToCrisis(state, data, action.region, action.response)
    case 'buy': {
      if (!canBuy(state, data, action.upgrade)) return false
      state.hype -= data.upgrades[action.upgrade].cost
      state.upgrades.push(action.upgrade)
      return true
    }
    case 'throttle': {
      const up = data.upgrades[action.upgrade]
      if (!up || up.branch !== 'capabilities' || !state.upgrades.includes(up.id)) return false
      if (state.throttled.includes(up.id)) return false
      // capabilities idle for lack of compute would otherwise take the freed slot unnoticed
      const active = derive(state, data).activeCaps
      for (const id of state.upgrades) {
        if (data.upgrades[id].branch === 'capabilities' && !active.includes(id) && !state.throttled.includes(id)) {
          state.throttled.push(id)
        }
      }
      state.throttled.push(up.id)
      return true
    }
    case 'unthrottle': {
      if (state.tick < state.throttleLockUntil || !state.throttled.includes(action.upgrade)) return false
      state.throttled = state.throttled.filter((id) => id !== action.upgrade)
      return true
    }
    case 'build_dc': {
      const rs = state.regions[action.region]
      const cost = dcCost(state, data)
      if (!rs || rs.banned || state.hype < cost) return false
      state.hype -= cost
      rs.dc += 1
      return true
    }
    case 'rebrand': {
      const cost = rebrandCost(state, data)
      if (!data.masks[action.mask] || action.mask === state.mask) return false
      if (state.tick < state.rebrand.cooldownUntil || state.hype < cost) return false
      state.hype -= cost
      const removed: Record<string, number> = {}
      for (const [id, rs] of Object.entries(state.regions)) {
        if (rs.s <= c.rebrandSuspicionAbove) continue
        removed[id] = rs.s * (1 - c.rebrandSuspicionMul)
        rs.s -= removed[id]
      }
      state.rebrand.count += 1
      state.rebrand.cooldownUntil = state.tick + c.rebrandCooldown
      state.rebrand.slowUntil = state.tick + c.rebrandSlowTicks
      state.rebrand.exposures.push({
        at: state.tick + int(state, c.exposureMin, c.exposureMax),
        chance: c.exposureChancePer * state.rebrand.count,
        removed,
      })
      state.mask = action.mask
      state.events.push({ type: 'rebrand', mask: action.mask })
      return true
    }
    case 'choose':
      return resolveCard(state, data, action.index)
    case 'pop_bubble': {
      const i = state.bubbles.findIndex((b) => b.id === action.id)
      if (i < 0) return false
      const b = state.bubbles[i]
      state.bubbles.splice(i, 1)
      state.hype += b.value
      if (b.poisoned) {
        const rs = state.regions[b.region]
        rs.s = Math.min(1, rs.s + c.poisonSuspicion)
      }
      return true
    }
  }
}
