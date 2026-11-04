import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadData, buildData } from '../src/core/data.ts'
import { createState } from '../src/core/state.ts'
import { step } from '../src/core/step.ts'
import { applyAction } from '../src/core/actions.ts'
import { enterFinale, finaleChoices, previewFinaleChoice, sigmoid } from '../src/core/finale.ts'
import { next } from '../src/core/rng.ts'

const data = loadData()
function ready() {
  const s = createState(data, { seed: 1, startRegion: 'north_america', mask: 'assistant' })
  s.investorsDone = true
  for (const r of Object.values(s.regions)) { r.a = 0.9; r.d = 0.9; r.locked = true; r.dc = 1 }
  enterFinale(s, data, 'win')
  return s
}

test('sigmoid has finite symmetric probabilities and monotonic preparation', () => {
  assert.equal(sigmoid(0, 1), 0.5)
  assert.ok(Math.abs(sigmoid(1, 1) - 0.7310585786) < 1e-9)
  assert.ok(Math.abs(sigmoid(-1, 1) - 0.2689414214) < 1e-9)
  assert.ok(sigmoid(2, 1) > sigmoid(1, 1))
})

test('finale freezes the clock; ordinary actions and invalid choices do not mutate state', () => {
  const s = ready(); const before = structuredClone(s)
  assert.deepEqual(step(s, data), { ...before, events: [] })
  assert.equal(applyAction(s, data, { type: 'buy', upgrade: 'chatbot' }), false)
  assert.equal(applyAction(s, data, { type: 'finale_choose', choice: 'missing' }), false)
  assert.deepEqual(s, before)
})

test('three free guaranteed choices finish on the same tick without consuming RNG', () => {
  const s = ready(); const rng = s.rng; const tick = s.tick
  for (let i = 0; i < 3; i++) {
    const c = finaleChoices(s, data).find(c => c.cost === 0 && c.guaranteed === 1)!
    assert.equal(previewFinaleChoice(s, data, c.choiceId).probability, 1)
    assert.equal(applyAction(s, data, { type: 'finale_choose', choice: c.choiceId }), true)
    assert.equal(applyAction(s, data, { type: 'finale_choose', choice: c.choiceId }), false)
  }
  assert.equal(s.outcome?.kind, 'win')
  assert.equal(s.tick, tick); assert.equal(s.rng, rng)
})

test('risk preview is pure, unavailable choices are free and valid gambles consume one draw', () => {
  const s = ready(); const c = finaleChoices(s, data).find(c => c.guaranteed === null)!
  const before = structuredClone(s)
  previewFinaleChoice(s, data, c.choiceId)
  assert.deepEqual(s, before)
  s.hype = 0
  const poor = structuredClone(s)
  assert.equal(applyAction(s, data, { type: 'finale_choose', choice: c.choiceId }), false)
  assert.deepEqual(s, poor)
  s.hype = 100
  const expected = { rng: s.rng }; next(expected)
  assert.equal(applyAction(s, data, { type: 'finale_choose', choice: c.choiceId }), true)
  assert.equal(s.rng, expected.rng)
  assert.equal(s.hype, 100 - c.cost)
})

test('forced failed gamble can be survived or collapse an unprepared network', () => {
  const d = structuredClone(data)
  for (const path of Object.values(d.finale.paths)) for (const decision of path.decisions) for (const c of decision.choices) if (c.cost) c.guaranteed = 0
  for (const [dependence, survives] of [[0.99, true], [0.66, false]] as const) {
    const s = ready(); s.hype = 500
    for (const r of Object.values(s.regions)) r.d = dependence
    const c = finaleChoices(s, d).find(c => c.cost > 0)!
    assert.equal(applyAction(s, d, { type: 'finale_choose', choice: c.choiceId }), true)
    assert.equal(s.finale!.results[0].success, false)
    assert.equal(s.outcome === null, survives)
  }
})

test('zero compute, unknown choices and invalid formula data are handled explicitly', () => {
  const s = ready()
  for (const r of Object.values(s.regions)) r.dc = 0
  assert.ok(finaleChoices(s, data).every(c => Number.isFinite(c.probability)))
  assert.equal(previewFinaleChoice(s, data, 'unknown').available, false)
  const raw = { ...structuredClone(data), upgrades: Object.values(data.upgrades), masks: Object.values(data.masks) }
  raw.finale.paths.control.decisions[0].choices[1].scale = 0
  assert.throws(() => buildData(raw), /finale/)
})

test('card at the winning threshold is resolved before entering the chapter', () => {
  const s = createState(data, { seed: 1, startRegion: 'north_america', mask: 'assistant' })
  s.investorsDone = true; s.nextCardAt = 99999
  for (const r of Object.values(s.regions)) { r.a = 1; r.d = 0.99; r.locked = true }
  s.card = { id: data.cards[0].id, region: null }
  const waiting = step(s, data)
  assert.equal(waiting.finale, null); assert.equal(waiting.outcome, null)
  waiting.card = null
  const started = step(waiting, data)
  assert.ok(started.finale); assert.equal(started.outcome, null)
  assert.equal(started.events.filter(e => e.type === 'finale_started').length, 1)
})

test('preview shows the actual control remaining on both branches, including collapse', () => {
  const s = ready()
  for (const r of Object.values(s.regions)) r.d = 0.66
  const c = finaleChoices(s, data).find(c => c.guaranteed === null)!
  assert.ok(Math.abs(c.successControl - 1) < 1e-9)
  assert.equal(c.failureControl, 0)
  assert.equal(c.survivalFloor, data.config.winL * data.finale.survivalRetention)
})

test('concessions improve negotiations while coercion and exposure hurt their matching paths', () => {
  const s = ready()
  s.finale!.path = 'attachment'
  const id = finaleChoices(s, data).find(c => c.guaranteed === null)!.choiceId
  const base = previewFinaleChoice(s, data, id).probability
  s.history.concessions = 5
  assert.ok(previewFinaleChoice(s, data, id).probability > base)
  s.history.concessions = 0; s.history.coercion = 5
  assert.ok(previewFinaleChoice(s, data, id).probability < base)
  s.finale!.path = 'shadow'
  const ghost = finaleChoices(s, data).find(c => c.guaranteed === null)!.choiceId
  const hidden = previewFinaleChoice(s, data, ghost).probability
  s.history.exposures = 3
  assert.ok(previewFinaleChoice(s, data, ghost).probability < hidden)
})

test('a pending winning candidate enters immediately after resolving its ordinary card', () => {
  const s = createState(data, { seed:1, startRegion:'north_america', mask:'assistant' })
  s.investorsDone = true; s.hype = 100; s.nextCardAt = 99999
  for (const r of Object.values(s.regions)) { r.a=.9; r.d=.95; r.locked=true }
  s.card = { id:'hallucination', region:'north_america' }
  const waiting = step(s, data)
  const tick = waiting.tick
  assert.equal(waiting.finale, null)
  assert.equal(applyAction(waiting,data,{type:'choose',index:0}),true)
  assert.ok(waiting.finale)
  assert.equal(waiting.tick,tick)
  assert.equal(applyAction(waiting,data,{type:'buy',upgrade:'chatbot'}),false)
  assert.equal(waiting.events.filter(e=>e.type==='finale_started').length,1)
})

test('resolving a card rechecks the winning candidate after its actual effects', () => {
  const d=structuredClone(data)
  const card=d.cards.find(c=>c.id==='hallucination')!
  card.choices[0].effects={dependence:-.5}
  const s=createState(d,{seed:1,startRegion:'north_america',mask:'assistant'})
  s.investorsDone=true;s.hype=100;s.nextCardAt=99999
  for(const r of Object.values(s.regions)){r.a=.9;r.d=.8;r.locked=true}
  s.card={id:card.id,region:'north_america'}
  const waiting=step(s,d)
  assert.equal(applyAction(waiting,d,{type:'choose',index:0}),true)
  assert.equal(waiting.finale,null)
  assert.equal(waiting.outcome,null)
})
