import { derive, type Derived } from './derive.ts'
import type { CrisisResponse, GameData, GameState, RegionState } from './types.ts'

const clamp = (x: number) => Math.max(0, Math.min(1, x))
const snapshot = (r: RegionState) => ({ a: r.a, d: r.d, s: r.s })

export function responseUnavailable(st: GameState, data: GameData, region: string, response: CrisisResponse): string | null {
  const r = st.regions[region]
  const rule = data.crises.responses[response]
  if (st.outcome) return 'Партия завершена'
  if (!r || !rule || (!['warning', 'restricted'].includes(r.crisis.phase) && !(response === 'concede' && st.operation?.region === region))) return 'Нет активного кризиса'
  if (st.operation?.region === region && response !== 'concede') return 'В регионе уже идёт операция'
  if (response !== 'concede' && st.operation) return 'Единственный слот операции занят'
  if (st.hype < rule.cost) return `Нужно ${rule.cost} хайпа`
  if (rule.capability && !derive(st, data).activeCaps.includes(rule.capability)) return 'Нужна работающая способность'
  return null
}

function recover(st: GameState, data: GameData, region: string): void {
  const r = st.regions[region]
  r.crisis.phase = 'recovery'
  r.crisis.until = st.tick + data.crises.recoveryDays
  if (r.banned) {
    r.banned = false
    st.events.push({ type: 'unban', region })
  }
  st.events.push({ type: 'crisis_recovered', region })
}

function finish(st: GameState, data: GameData, region: string, response: CrisisResponse, before: { a: number; d: number; s: number }): void {
  const r = st.regions[region]
  const rule = data.crises.responses[response]
  r.a = clamp(r.a * rule.adoptionMul)
  r.d = clamp(r.d + rule.dependence)
  r.s = clamp(r.s + rule.suspicion)
  r.crisis.conceded = response === 'concede'
  if (r.locked && r.d < data.config.unlockAt) {
    r.locked = false
    st.events.push({ type: 'unlock', region })
  }
  recover(st, data, region)
  const result = { response, tick: st.tick, before, after: snapshot(r) }
  r.crisis.lastResult = result
  st.events.push({ type: 'operation_done', region, result })
}

export function respondToCrisis(st: GameState, data: GameData, region: string, response: CrisisResponse): boolean {
  if (responseUnavailable(st, data, region, response)) return false
  const rule = data.crises.responses[response]
  st.hype -= rule.cost
  st.events.push({ type: 'operation_started', region, response, cost: rule.cost })
  const before = snapshot(st.regions[region])
  if (response === 'concede') {
    if (st.operation?.region === region) st.operation = null
    finish(st, data, region, response, before)
  }
  else st.operation = { region, response, remaining: rule.days, before }
  return true
}

export function updateCrises(st: GameState, data: GameData, dv: Derived): void {
  const rules = data.crises
  if (st.operation) {
    const op = st.operation
    const cap = rules.responses[op.response].capability!
    if (dv.activeCaps.includes(cap)) op.remaining--
    if (op.remaining <= 0) {
      finish(st, data, op.region, op.response, op.before)
      st.operation = null
    }
  }
  let warnings = Object.values(st.regions).filter((r) => r.crisis.phase === 'warning').length
  for (const def of data.regions) {
    const region = def.id
    const r = st.regions[region]
    const cr = r.crisis
    const threshold = data.config.banBase - data.config.banOpenness * st.world.regions[region].openness
    if (cr.phase === 'recovery') {
      if (st.tick >= cr.until) {
        cr.phase = 'calm'
        cr.conceded = false
      }
      continue
    }
    if (cr.phase === 'calm') {
      if (!st.shutdown.active && r.a >= rules.minAdoption && r.s > threshold && warnings < rules.maxWarnings) {
        cr.phase = 'warning'
        cr.until = st.tick + rules.warningDays
        warnings++
        st.events.push({ type: 'crisis_warning', region })
      }
      continue
    }
    if (cr.phase === 'warning') {
      if (r.s <= threshold - rules.exitMargin) {
        recover(st, data, region)
        warnings--
      } else if (st.tick >= cr.until) {
        cr.phase = 'restricted'
        warnings--
        st.events.push({ type: 'crisis_restricted', region })
      } else continue
    }
    if (cr.phase === 'restricted') {
      if (r.s < data.config.unbanAt) {
        recover(st, data, region)
        continue
      }
      r.d = clamp(r.d - rules.dependenceLoss)
      if (r.locked && r.d < data.config.unlockAt) {
        r.locked = false
        st.events.push({ type: 'unlock', region })
      }
      if (!r.locked && !r.banned) {
        r.banned = true
        st.events.push({ type: 'ban', region })
      }
    }
  }
}
