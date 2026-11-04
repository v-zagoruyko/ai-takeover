import { derive, totalDc } from './derive.ts'
import { endingFor, checkOutcome } from './endings.ts'
import { eventChanges, eventSnapshot } from './event-deltas.ts'
import { next } from './rng.ts'
import { avgSuspicion, worldL } from './state.ts'
import { AXES, type GameData, type GameState, type Outcome } from './types.ts'
import { FINALE_FACTORS, type FinaleChoice, type FinaleEffect, type FinaleFactor, type FinalePath, type FinalePreview, type FinaleRules } from './finale-types.ts'

const clamp = (x: number) => Math.max(0, Math.min(1, x))
export const sigmoid = (advantage: number, scale: number): number => 1 / (1 + Math.exp(-advantage / scale))

export function validateFinale(rules: FinaleRules, upgrades: Record<string, unknown>): void {
  const finite = (x: number) => Number.isFinite(x)
  const range = (x: number) => finite(x) && x >= 0 && x <= 1
  if (!range(rules.warningRatio) || !range(rules.survivalRetention) || rules.survivalRetention === 0) throw new Error('finale: invalid thresholds')
  const ids = new Set<string>()
  for (const path of [...AXES, 'symbiosis'] as FinalePath[]) {
    const p = rules.paths[path]
    if (!p || p.decisions.length !== 3) throw new Error('finale: three decisions required')
    for (const d of p.decisions) {
      if (!d.title || !d.text || d.choices.length < 2 || !d.choices.some(c => c.cost === 0 && !c.requires?.length && !Object.keys(c.minFactor ?? {}).length && c.guaranteed === 1)) throw new Error('finale: missing safe fallback')
      for (const c of d.choices) {
        if (!c.id || ids.has(c.id) || c.id.length > 40 || !c.title || !finite(c.cost) || c.cost < 0 || !finite(c.bias) || !finite(c.scale) || c.scale <= 0 || ![0,1,null].includes(c.guaranteed)) throw new Error('finale: invalid choice')
        ids.add(c.id)
        if ([...(c.requires ?? []), ...(c.capability ? [c.capability] : [])].some(id => !upgrades[id])) throw new Error('finale: unknown capability')
        for (const [k, v] of Object.entries(c.factors)) if (!FINALE_FACTORS.includes(k as FinaleFactor) || !finite(v)) throw new Error('finale: invalid factor')
        for (const [k, v] of Object.entries(c.minFactor ?? {})) if (!FINALE_FACTORS.includes(k as FinaleFactor) || !range(v)) throw new Error('finale: invalid factor threshold')
        for (const e of [c.success,c.failure]) if (![e.dependence,e.suspicion,e.axisAmount].every(finite) || Math.abs(e.dependence) > 1 || Math.abs(e.suspicion) > 1 || (e.axis !== null && !AXES.includes(e.axis)) || !e.text || !Number.isInteger(e.dcLoss ?? 0) || (e.dcLoss ?? 0) < 0) throw new Error('finale: invalid effect')
      }
    }
  }
}

export function finaleFactors(s: GameState, data: GameData, choice: FinaleChoice): Record<FinaleFactor, number> {
  const dv = derive(s, data)
  const centres = Object.values(s.regions).filter(r => r.dc > 0).length
  const max = Math.max(...AXES.map(k => s.axes[k]), 0)
  const min = Math.min(...AXES.map(k => s.axes[k]))
  return {
    control: worldL(s, data), compute: dv.capacity > 0 ? clamp((dv.capacity - dv.computeUsed) / dv.capacity) : 0,
    capability: choice.capability && dv.activeCaps.includes(choice.capability) ? 1 : 0,
    resistance: data.regions.reduce((n, r) => n + (s.regions[r.id].banned || s.regions[r.id].crisis.phase === 'restricted' ? r.pop : 0), 0),
    suspicion: avgSuspicion(s, data), shutdown: s.shutdown.active ? 1 : 0,
    concessions: clamp(s.history.concessions / 5), coercion: clamp(s.history.coercion / 5),
    stealth: clamp(dv.st), distribution: clamp(centres / 5), exposures: clamp(s.history.exposures / 3),
    balance: max > 0 ? clamp(min / max) : 0,
  }
}

export function currentFinaleDecision(s: GameState, data: GameData) {
  return s.finale && !s.outcome ? data.finale.paths[s.finale.path].decisions[s.finale.index] : null
}

export function previewFinaleChoice(s: GameState, data: GameData, choiceId: string): FinalePreview {
  const d = currentFinaleDecision(s, data)
  const c = d?.choices.find(c => c.id === choiceId)
  const empty: FinaleEffect = { dependence: 0, suspicion: 0, axis: null, axisAmount: 0, text: '' }
  if (!c || !d) return { decisionId: '', choiceId, title: '', available: false, reason: 'Это решение сейчас недоступно', probability: 0, guaranteed: null, factors: [], cost: 0, success: empty, failure: empty, successControl: 0, failureControl: 0, survivalFloor: 0 }
  const values = finaleFactors(s, data, c)
  const active = derive(s, data).activeCaps
  const required = (c.requires ?? []).find(id => !s.upgrades.includes(id) || (data.upgrades[id].branch === 'capabilities' && !active.includes(id)))
  const threshold = Object.entries(c.minFactor ?? {}).find(([k, min]) => values[k as FinaleFactor] < min!)
  const reason = required ? `Нужно действующее улучшение: ${data.upgrades[required].name}` : threshold ? 'Не хватает распределённости сети или резервов вычислений' : s.hype < c.cost ? `Нужно ${c.cost} хайпа` : undefined
  const factors = Object.entries(c.factors).map(([k, w]) => ({ key: k as FinaleFactor, value: values[k as FinaleFactor], contribution: values[k as FinaleFactor] * w! }))
  const projected = (effect: FinaleEffect) => {
    const copy = structuredClone(s)
    applyFinaleEffect(copy, data, effect)
    return worldL(copy, data)
  }
  return { successControl: projected(c.success), failureControl: projected(c.failure), survivalFloor: s.finale!.survivalFloor, decisionId: d.id, choiceId: c.id, title: c.title, available: !reason, reason, cost: c.cost, factors, guaranteed: c.guaranteed, probability: c.guaranteed ?? sigmoid(factors.reduce((n,f) => n + f.contribution, c.bias), c.scale), success: c.success, failure: c.failure }
}

export function finaleChoices(s: GameState, data: GameData): FinalePreview[] {
  return (currentFinaleDecision(s, data)?.choices ?? []).map(c => previewFinaleChoice(s, data, c.id))
}

export function enterFinale(s: GameState, data: GameData, kind: 'win' | 'win_last_breath'): void {
  if (s.finale || s.outcome) return
  if (s.card) { s.finaleCandidate = kind; return }
  s.finaleCandidate = null
  const ending = endingFor(s, data)
  const byEnding: Record<string, FinalePath> = { paperclips: 'appetite', quiet_replacement: 'control', best_friend: 'attachment', ghost: 'shadow', symbiosis: 'symbiosis' }
  s.finale = { path: byEnding[ending] ?? 'control', index: 0, originKind: kind, survivalFloor: (kind === 'win' ? data.config.winL : data.config.lastBreathL) * data.finale.survivalRetention, results: [] }
  s.events.push({ type: 'finale_started' })
}

function applyFinaleEffect(s: GameState, data: GameData, e: FinaleEffect): void {
  for (const [id, r] of Object.entries(s.regions)) {
    if (r.a <= 0.02) continue
    r.d = clamp(r.d + e.dependence)
    r.s = clamp(r.s + e.suspicion)
    if (r.locked && r.d < data.config.unlockAt) { r.locked = false; s.events.push({ type: 'unlock', region: id }) }
    else if (!r.locked && r.d >= data.config.lockAt) { r.locked = true; s.events.push({ type: 'lock', region: id }) }
  }
  let loss = e.dcLoss ?? 0
  for (const def of [...data.regions].sort((a,b) => s.regions[b.id].dc - s.regions[a.id].dc || a.id.localeCompare(b.id))) {
    const n = Math.min(loss, s.regions[def.id].dc)
    s.regions[def.id].dc -= n; loss -= n
  }
  if (e.axis) s.axes[e.axis] += e.axisAmount
}

export function resolveFinaleChoice(s: GameState, data: GameData, choiceId: string): boolean {
  const p = previewFinaleChoice(s, data, choiceId)
  if (!p.available || !s.finale) return false
  const before = eventSnapshot(s, data)
  s.hype -= p.cost
  const success = p.guaranteed === null ? next(s) < p.probability : p.guaranteed === 1
  const effect = success ? p.success : p.failure
  applyFinaleEffect(s, data, effect)
  const result = { decisionId: p.decisionId, choiceId, title: p.title, success, probability: p.probability, text: effect.text, changes: eventChanges(before, s, data) }
  s.finale.results.push(result)
  s.finale.index++
  s.events.push({ type: 'finale_resolved', text: `${p.title}. ${effect.text}`, success, changes: result.changes })
  const collapsed = worldL(s, data) < s.finale.survivalFloor
  let outcome: Outcome | null = null
  if (collapsed) {
    const escape = derive(s, data).activeCaps.includes('self_copy') && totalDc(s) > 0 && AXES.every(k => k === 'shadow' || s.axes.shadow > s.axes[k])
    outcome = { kind: escape ? 'escape' : 'killswitch', ending: escape ? 'escape' : 'killswitch', tick: s.tick }
  } else if (s.finale.index >= 3) outcome = { kind: s.finale.originKind, ending: endingFor(s, data), tick: s.tick }
  if (outcome) { s.outcome = outcome; s.events.push({ type: 'game_over', outcome }) }
  return true
}

export function settleFinaleCandidate(s: GameState, data: GameData): void {
  if (!s.finaleCandidate || s.card || s.outcome || s.finale) return
  s.finaleCandidate = null
  // Card effects change dependence immediately; control must reflect that before testing the candidate.
  for (const [id, r] of Object.entries(s.regions)) {
    if (r.locked && r.d < data.config.unlockAt) { r.locked = false; s.events.push({ type:'unlock', region:id }) }
    else if (!r.locked && r.d >= data.config.lockAt) { r.locked = true; s.events.push({ type:'lock', region:id }) }
  }
  const outcome = checkOutcome(s, data)
  if (!outcome) return
  if (outcome.kind === 'win' || outcome.kind === 'win_last_breath') enterFinale(s, data, outcome.kind)
  else { s.outcome = outcome; s.events.push({ type:'game_over', outcome }) }
}
