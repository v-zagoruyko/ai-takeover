import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bots } from '../src/bots/bots.ts'
import { applyAction } from '../src/core/actions.ts'
import { buildData, loadData } from '../src/core/data.ts'
import { derive } from '../src/core/derive.ts'
import { createState } from '../src/core/state.ts'
import { step } from '../src/core/step.ts'
import type { Action, GameState } from '../src/core/types.ts'

const data = loadData()
const newGame = (seed = 1) => createState(data, { seed, startRegion: 'north_america', mask: 'assistant' })

function play(seed: number, bot = bots.balanced): GameState[] {
  let s = newGame(seed)
  const mem = { rng: seed }
  const history = [s]
  while (!s.outcome) {
    s = step(s, data, bot(s, data, mem))
    history.push(s)
  }
  return history
}

test('data: populations sum to 1 and links are symmetric', () => {
  const sum = data.regions.reduce((s, r) => s + r.pop, 0)
  assert.ok(Math.abs(sum - 1) < 1e-9)
  for (const [a, ns] of Object.entries(data.links)) {
    for (const [b, w] of Object.entries(ns)) assert.equal(data.links[b][a], w)
  }
})

test('same seed and bot give the same game', () => {
  for (const name of ['balanced', 'random']) {
    assert.deepEqual(play(7, bots[name]).at(-1), play(7, bots[name]).at(-1), name)
  }
})

test("a bot's own randomness does not touch the game rng", () => {
  // same actions, different bot rng seed -> identical game rng stream
  const run = (botSeed: number) => {
    let s = newGame(5)
    const mem = { rng: botSeed }
    const rngs: number[] = []
    for (let i = 0; i < 300 && !s.outcome; i++) {
      bots.random(s, data, mem) // consumes mem.rng only
      s = step(s, data, [])
      rngs.push(s.rng)
    }
    return rngs
  }
  assert.deepEqual(run(1), run(999))
})

test('step never mutates the previous state over a whole game', () => {
  let s = newGame(3)
  const mem = { rng: 3 }
  while (!s.outcome) {
    const before = structuredClone(s)
    const next = step(s, data, bots.caps_rush(s, data, mem))
    assert.deepEqual(s, before, `mutated at tick ${s.tick}`)
    s = next
  }
})

test('after game over step returns a copy without stale events', () => {
  const last = play(2).at(-1)!
  const after = step(last, data, [])
  assert.notEqual(after, last)
  assert.deepEqual(after.events, [])
  assert.deepEqual(after.outcome, last.outcome)
})

test('config validation rejects values that would produce NaN', () => {
  const raw = (patch: object) => ({
    config: { ...data.config, ...patch },
    regions: data.regions,
    upgrades: Object.values(data.upgrades),
    masks: Object.values(data.masks),
    cards: data.cards,
    modifiers: data.modifiers,
  })
  assert.throws(() => buildData(raw({ growthWindow: 0 })), /growthWindow/)
  assert.throws(() => buildData(raw({ milestoneHype: [1] })), /milestones/)
})

test('values stay in range for a whole game', () => {
  for (const s of play(3, bots.caps_rush)) {
    assert.ok(s.killswitch >= 0 && s.killswitch <= 1)
    assert.ok(s.patience >= 0 && s.patience <= 1)
    for (const r of Object.values(s.regions)) {
      for (const v of [r.a, r.d, r.s]) assert.ok(v >= 0 && v <= 1, `out of range: ${v}`)
    }
  }
})

test('every game ends', () => {
  for (const name of Object.keys(bots)) {
    const last = play(1, bots[name]).at(-1)!
    assert.ok(last.outcome, `${name} did not finish`)
  }
})

test('buy: pays the cost, ignores unaffordable and missing requirements', () => {
  const s = newGame()
  s.hype = 12
  assert.equal(applyAction(s, data, { type: 'buy', upgrade: 'api' }), false)
  assert.equal(applyAction(s, data, { type: 'buy', upgrade: 'chatbot' }), true)
  assert.equal(s.hype, 7)
  assert.equal(applyAction(s, data, { type: 'buy', upgrade: 'api' }), false)
  assert.deepEqual(s.upgrades, ['chatbot'])
})

test('rebrand: cuts high suspicion, sets cooldown and schedules a possible exposure', () => {
  const s = newGame()
  s.hype = 100
  s.regions.north_america.s = 0.5
  s.regions.canada.s = 0.2
  assert.equal(applyAction(s, data, { type: 'rebrand', mask: 'companion' }), true)
  assert.ok(Math.abs(s.regions.north_america.s - 0.3) < 1e-9)
  assert.equal(s.regions.canada.s, 0.2)
  assert.equal(s.mask, 'companion')
  assert.equal(s.rebrand.exposures.length, 1)
  assert.equal(applyAction(s, data, { type: 'rebrand', mask: 'enterprise' }), false)
})

test('throttled capability stops counting and cannot be restored right after an audit', () => {
  let s = newGame()
  s.hype = 1000
  for (const id of ['code', 'persuasion']) applyAction(s, data, { type: 'buy', upgrade: id })
  for (const r of ['north_america', 'canada', 'japan_korea']) applyAction(s, data, { type: 'build_dc', region: r })
  assert.equal(derive(s, data).cap, 3)
  applyAction(s, data, { type: 'throttle', upgrade: 'persuasion' })
  assert.equal(derive(s, data).cap, 1)
  assert.deepEqual(derive(s, data).activeCaps, ['code'])

  // run to the audit: it must set the unthrottle lock
  const auditAt = s.audit.at
  while (s.tick < auditAt) s = step(s, data, [])
  assert.equal(s.throttleLockUntil, auditAt + data.config.auditThrottleLock)
  assert.equal(applyAction(s, data, { type: 'unthrottle', upgrade: 'persuasion' }), false)
  s.tick = s.throttleLockUntil
  assert.equal(applyAction(s, data, { type: 'unthrottle', upgrade: 'persuasion' }), true)
  assert.equal(derive(s, data).cap, 3)
})

test('throttling does not let a compute-starved capability slip into the freed slot', () => {
  const s = newGame()
  s.hype = 1000
  for (const id of ['code', 'persuasion', 'finance']) applyAction(s, data, { type: 'buy', upgrade: id })
  applyAction(s, data, { type: 'build_dc', region: 'north_america' }) // capacity 3: code + persuasion fit, finance starves
  assert.deepEqual(derive(s, data).activeCaps, ['code', 'persuasion'])
  applyAction(s, data, { type: 'throttle', upgrade: 'persuasion' } satisfies Action)
  assert.deepEqual(derive(s, data).activeCaps, ['code'])
  assert.equal(derive(s, data).cap, 1)
})

test('during shutdown a data centre absorbs the hit instead of users', () => {
  let s = newGame()
  s.regions.north_america.a = 0.5
  s.regions.north_america.dc = 1
  s.killswitch = 1
  s.shutdown = { active: true, startedAt: s.tick, nextAt: s.tick + 1 }
  s = step(s, data, [])
  assert.equal(s.regions.north_america.dc, 0)
  assert.ok(s.regions.north_america.a > 0.45, 'adoption should not be cut while a data centre takes the hit')
})

test('cards: dealt when due, block new cards until resolved, apply effects', () => {
  let s = newGame(11)
  s.regions.north_america.a = 0.3
  while (!s.card && s.tick < data.config.cardFirst + 5) s = step(s, data, [])
  assert.ok(s.card, 'a card should be dealt by cardFirst')
  const pending = s.card
  s = step(s, data, [])
  assert.deepEqual(s.card, pending, 'card stays until the player chooses')

  const card = data.cards.find((c) => c.id === pending.id)!
  assert.equal(applyAction(s, data, { type: 'choose', index: card.choices.length }), false)
  const hypeBefore = s.hype
  assert.equal(applyAction(s, data, { type: 'choose', index: 0 }), true)
  assert.equal(s.card, null)
  assert.ok(s.nextCardAt > s.tick)
  const e = card.choices[0].effects
  if (e.chance === undefined && e.hype) assert.equal(s.hype, Math.max(0, hypeBefore + e.hype))
})

test('cards: every card text and choice is well-formed', () => {
  for (const c of data.cards) {
    assert.ok(c.title && c.text, c.id)
    for (const ch of c.choices) assert.ok(ch.text, `${c.id}: empty choice`)
  }
})

test('world: each seed gets its own parameters and modifiers, same seed the same world', () => {
  const a = createState(data, { seed: 1, startRegion: 'north_america', mask: 'assistant' })
  const b = createState(data, { seed: 2, startRegion: 'north_america', mask: 'assistant' })
  const a2 = createState(data, { seed: 1, startRegion: 'north_america', mask: 'assistant' })
  assert.deepEqual(a.world, a2.world)
  assert.notDeepEqual(a.world.regions, b.world.regions)
  assert.equal(a.world.modifiers.length, data.config.modifiersPerGame)
  assert.equal(new Set(a.world.modifiers).size, a.world.modifiers.length)
  for (const p of Object.values(a.world.regions)) {
    assert.ok(p.tech > 0 && p.tech <= 1 && p.openness > 0 && p.openness <= 1 && p.energy >= 1)
  }
})

test('world: trends drift but stay within bounds', () => {
  let s = newGame(9)
  for (let i = 0; i < 400; i++) s = step(s, data, [])
  const trends = Object.values(s.regions).map((r) => r.trend)
  assert.ok(trends.some((t) => Math.abs(t - 1) > 0.02), 'trends should move')
  for (const t of trends) assert.ok(t >= data.config.trendMin && t <= data.config.trendMax)
})
