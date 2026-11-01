import { canBuy, dcCost, rebrandCost } from '../core/actions.ts'
import { derive } from '../core/derive.ts'
import { next } from '../core/rng.ts'
import { avgSuspicion } from '../core/state.ts'
import { auditRisk } from '../core/step.ts'
import type { Action, CardEffect, GameData, GameState } from '../core/types.ts'

/** bots keep their own rng so they never consume the game's random stream */
export interface BotMemory {
  rng: number
}
export type Bot = (state: GameState, data: GameData, mem: BotMemory) => Action[]

/** expected value of a card choice; `risk` says how much the bot fears suspicion */
function scoreEffect(e: CardEffect, risk: number): number {
  const base = (x: CardEffect): number =>
    (x.hype ?? 0) * 0.05 +
    (x.adoption ?? 0) * 10 +
    (x.regionAdoption ?? 0) * 4 +
    (x.regionDependence ?? 0) * 4 +
    (x.patience ?? 0) * 3 -
    ((x.suspicion ?? 0) * 20 + (x.regionSuspicion ?? 0) * 5 + (x.killswitch ?? 0) * 30) * risk
  if (e.chance === undefined) return base(e)
  return e.chance * base(e) + (1 - e.chance) * (e.fail ? base(e.fail) : 0)
}

function chooseCard(state: GameState, data: GameData, risk: number): Action[] {
  if (!state.card) return []
  const card = data.cards.find((c) => c.id === state.card!.id)!
  const scores = card.choices.map((c) => scoreEffect(c.effects, risk))
  return [{ type: 'choose', index: scores.indexOf(Math.max(...scores)) }]
}

interface Plan {
  order: string[]
  popPoisoned: (state: GameState, data: GameData) => boolean
  buildDc: boolean
  throttleAtAudit: boolean
  manageSuspicion: boolean
  rebrandAbove: number | null
  risk: number
}

function popBubbles(state: GameState, data: GameData, plan: Plan): Action[] {
  const poisonedOk = plan.popPoisoned(state, data)
  return state.bubbles.filter((b) => !b.poisoned || poisonedOk).map((b) => ({ type: 'pop_bubble', id: b.id }))
}

function dcRegion(state: GameState, data: GameData): string | null {
  let best: string | null = null
  let bestScore = -Infinity
  for (const r of data.regions) {
    const rs = state.regions[r.id]
    if (rs.banned) continue
    // prefer energy headroom, then presence (locked regions are safe from shutdown)
    const score = r.energy - rs.dc + rs.a + (rs.locked ? 2 : 0)
    if (score > bestScore) {
      bestScore = score
      best = r.id
    }
  }
  return best
}

/** follows a fixed priority list and saves up for the next item instead of buying cheap filler */
function planBot(plan: Plan): Bot {
  return (state, data) => {
    const actions: Action[] = [...chooseCard(state, data, plan.risk), ...popBubbles(state, data, plan)]
    const dv = derive(state, data)

    const suspicion = avgSuspicion(state, data)
    if (plan.throttleAtAudit) {
      const warned = state.audit.warned
      if (warned && auditRisk(dv) > 0.15) {
        for (const id of dv.activeCaps) actions.push({ type: 'throttle', upgrade: id })
      } else if (plan.manageSuspicion && suspicion > 0.25 && dv.activeCaps.length) {
        // hide the biggest capability first: suspicion grows with cap squared
        const top = [...dv.activeCaps].sort((a, b) => (data.upgrades[b].effects.cap ?? 0) - (data.upgrades[a].effects.cap ?? 0))[0]
        actions.push({ type: 'throttle', upgrade: top })
      } else if (!warned && (!plan.manageSuspicion || suspicion < 0.12) && state.throttled.length) {
        actions.push({ type: 'unthrottle', upgrade: state.throttled[0] })
      }
    }

    if (plan.rebrandAbove !== null && avgSuspicion(state, data) > plan.rebrandAbove) {
      const masks = Object.keys(data.masks).filter((m) => m !== state.mask)
      if (state.tick >= state.rebrand.cooldownUntil && state.hype >= rebrandCost(state, data)) {
        actions.push({ type: 'rebrand', mask: masks[state.rebrand.count % masks.length] })
        return actions
      }
    }

    const starved = state.upgrades.some(
      (id) => data.upgrades[id].branch === 'capabilities' && !state.throttled.includes(id) && !dv.activeCaps.includes(id),
    )
    if (plan.buildDc && starved) {
      const region = dcRegion(state, data)
      if (region && state.hype >= dcCost(state, data)) actions.push({ type: 'build_dc', region })
      return actions
    }

    const want = plan.order.find((id) => !state.upgrades.includes(id))
    if (want && canBuy(state, data, want)) actions.push({ type: 'buy', upgrade: want })
    else if (!want && plan.buildDc && state.hype >= dcCost(state, data) * 2) {
      // surplus: more compute lets throttled capabilities come back later
      const region = dcRegion(state, data)
      if (region) actions.push({ type: 'build_dc', region })
    }
    return actions
  }
}

const never = () => false
const lowSuspicion = (s: GameState, d: GameData) => avgSuspicion(s, d) < 0.2

const balancedOrder = [
  'chatbot', 'api', 'pr_safety', 'code', 'enterprise_agent', 'alignment_theater',
  'companion', 'persuasion', 'gov_contracts', 'finance', 'self_copy', 'refusals',
]

const random: Bot = (state, data, mem) => {
  const actions: Action[] = state.bubbles.map((b) => ({ type: 'pop_bubble', id: b.id }))
  if (state.card) {
    const n = data.cards.find((c) => c.id === state.card!.id)!.choices.length
    actions.push({ type: 'choose', index: Math.floor(next(mem) * n) })
  }
  if (next(mem) < 0.05) {
    const options = Object.keys(data.upgrades).filter((id) => canBuy(state, data, id))
    if (options.length) actions.push({ type: 'buy', upgrade: options[Math.floor(next(mem) * options.length)] })
  }
  if (next(mem) < 0.01) {
    const r = data.regions[Math.floor(next(mem) * data.regions.length)]
    actions.push({ type: 'build_dc', region: r.id })
  }
  return actions
}

export const bots: Record<string, Bot> = {
  caps_rush: planBot({
    order: ['chatbot', 'code', 'persuasion', 'finance', 'self_copy', 'api', 'enterprise_agent', 'gov_contracts', 'companion'],
    popPoisoned: () => true,
    buildDc: true,
    throttleAtAudit: false,
    manageSuspicion: false,
    rebrandAbove: null,
    risk: 0,
  }),
  stealth_only: planBot({
    order: ['chatbot', 'pr_safety', 'refusals', 'alignment_theater'],
    popPoisoned: never,
    buildDc: false,
    throttleAtAudit: false,
    manageSuspicion: false,
    rebrandAbove: null,
    risk: 3,
  }),
  no_dc: planBot({
    order: balancedOrder,
    popPoisoned: lowSuspicion,
    buildDc: false,
    throttleAtAudit: true,
    manageSuspicion: true,
    rebrandAbove: 0.45,
    risk: 1,
  }),
  balanced: planBot({
    order: balancedOrder,
    popPoisoned: lowSuspicion,
    buildDc: true,
    throttleAtAudit: true,
    manageSuspicion: true,
    rebrandAbove: 0.45,
    risk: 1,
  }),
  random,
}
