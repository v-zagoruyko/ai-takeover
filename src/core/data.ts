import finale from '../../data/finale.json' with { type: 'json' }
import { validateFinale } from './finale.ts'
import type { FinaleRules } from './finale-types.ts'
import cards from '../../data/cards.json' with { type: 'json' }
import crises from '../../data/crises.json' with { type: 'json' }
import config from '../../data/config.json' with { type: 'json' }
import masks from '../../data/masks.json' with { type: 'json' }
import modifiers from '../../data/modifiers.json' with { type: 'json' }
import regions from '../../data/regions.json' with { type: 'json' }
import upgrades from '../../data/upgrades.json' with { type: 'json' }
import { ARCHETYPES, type Card, type Config, type CrisisRules, type GameData, type Mask, type Region, type Upgrade, type WorldModifier } from './types.ts'

export interface RawData {
  finale?: FinaleRules
  crises?: CrisisRules
  config: Config
  regions: Region[]
  upgrades: Upgrade[]
  masks: Mask[]
  cards: Card[]
  modifiers: WorldModifier[]
}

/** normalizes populations, symmetrizes links and validates references */
export function buildData(raw: RawData): GameData {
  validate(raw)
  const ids = new Set(raw.regions.map((r) => r.id))
  const popSum = raw.regions.reduce((s, r) => s + r.pop, 0)
  const regs = raw.regions.map((r) => ({ ...r, pop: r.pop / popSum }))

  const links: GameData['links'] = Object.fromEntries(regs.map((r) => [r.id, {}]))
  for (const r of regs) {
    for (const [to, w] of Object.entries(r.links)) {
      if (!ids.has(to)) throw new Error(`region ${r.id}: unknown link ${to}`)
      links[r.id][to] = Math.max(links[r.id][to] ?? 0, w)
      links[to][r.id] = Math.max(links[to][r.id] ?? 0, w)
    }
  }

  const ups = Object.fromEntries(raw.upgrades.map((u) => [u.id, u]))
  for (const u of raw.upgrades) {
    for (const req of u.requires ?? []) if (!ups[req]) throw new Error(`upgrade ${u.id}: unknown requirement ${req}`)
  }
  for (const m of raw.modifiers) {
    for (const r of m.regions ?? []) if (!ids.has(r)) throw new Error(`modifier ${m.id}: unknown region ${r}`)
  }
  for (const card of raw.cards) {
    for (const n of card.when.needs ?? []) if (!ups[n]) throw new Error(`card ${card.id}: unknown upgrade ${n}`)
    if (card.choices.length < 2) throw new Error(`card ${card.id}: needs at least two choices`)
    for (const choice of card.choices) {
      if (!Number.isFinite(choice.cost ?? 0) || (choice.cost ?? 0) < 0) throw new Error(`card ${card.id}: invalid cost`)
    }
    if (!card.choices.some((x) => !x.cost)) throw new Error(`card ${card.id}: needs a free choice`)
  }
  const crisisRules = raw.crises ?? crises as CrisisRules
  for (const rule of Object.values(crisisRules.responses)) {
    if (rule.capability && ups[rule.capability]?.branch !== 'capabilities') throw new Error(`operation: unknown capability ${rule.capability}`)
    if (!Number.isFinite(rule.cost) || rule.cost < 0 || !Number.isFinite(rule.days) || rule.days < 0) throw new Error('operation: invalid cost or days')
  }
  const finaleRules = raw.finale ?? finale as FinaleRules
  validateFinale(finaleRules, ups)
  return {
    finale: finaleRules,
    crises: crisisRules,
    config: raw.config,
    regions: regs,
    upgrades: ups,
    masks: Object.fromEntries(raw.masks.map((m) => [m.id, m])),
    cards: raw.cards,
    modifiers: raw.modifiers,
    links,
  }
}

function validate(raw: RawData): void {
  const c = raw.config
  const fail = (msg: string) => {
    throw new Error(`invalid data: ${msg}`)
  }
  if (c.growthWindow < 1) fail('growthWindow must be >= 1')
  if (c.gHorizon <= 0) fail('gHorizon must be > 0')
  if (c.milestones.length !== c.milestoneHype.length) fail('milestones and milestoneHype differ in length')
  if (c.auditMin > c.auditMax || c.exposureMin > c.exposureMax || c.bubbleMin > c.bubbleMax) fail('min > max')
  for (const [k, v] of Object.entries(c)) {
    const nums = Array.isArray(v) ? v : [v]
    if (nums.some((n) => typeof n !== 'number' || !Number.isFinite(n))) fail(`config.${k} is not a finite number`)
  }
  for (const r of raw.regions) {
    if (!(r.energy > 0) || !(r.pop > 0)) fail(`region ${r.id}: energy and pop must be > 0`)
  }
  for (const m of raw.masks) {
    for (const a of ARCHETYPES) if (typeof m.fit[a] !== 'number') fail(`mask ${m.id}: fit.${a} missing`)
  }
}

export function loadData(): GameData {
  return buildData({
    config: config as Config,
    regions: regions as Region[],
    upgrades: upgrades as Upgrade[],
    masks: masks as Mask[],
    cards: cards as Card[],
    modifiers: modifiers as WorldModifier[],
  })
}
