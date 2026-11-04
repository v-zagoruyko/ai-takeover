import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleanName, verify } from '../server/scores.ts'
import { bots } from '../src/bots/bots.ts'
import { applyAction } from '../src/core/actions.ts'
import { loadData } from '../src/core/data.ts'
import { replay, scoreGame } from '../src/core/replay.ts'
import { createState, avgSuspicion } from '../src/core/state.ts'
import { step } from '../src/core/step.ts'
import type { Action } from '../src/core/types.ts'

const data = loadData()
const rulesVersion = 'finale-1'

function playLogged(seed: number) {
  const rec = { seed, startRegion: 'north_america', mask: 'assistant', log: [] as { t: number; a: Action }[] }
  let s = createState(data, rec)
  const mem = { rng: seed }
  while (!s.outcome) {
    for (const a of bots.balanced(s, data, mem)) {
      const next = structuredClone(s)
      if (applyAction(next, data, a)) {
        rec.log.push({ t: s.tick, a })
        s = next
      }
    }
    s = step(s, data, [])
  }
  return { rec, outcome: s.outcome! }
}

test('server: an honest game is accepted with the replayed score', () => {
  const { rec, outcome } = playLogged(21)
  const res = verify({ ...rec, rulesVersion, name: 'Витя', ai: 'Жора', claimed: { kind: outcome.kind, tick: outcome.tick } }, data)
  assert.ok(res.ok)
  if (res.ok) assert.equal(res.value.score.total, scoreGame(replay(data, rec), data).total)
})

test('server: a claimed result the replay does not reproduce is rejected', () => {
  const { rec, outcome } = playLogged(22)
  const res = verify({ ...rec, rulesVersion, name: 'Витя', ai: 'Жора', claimed: { kind: 'win', tick: outcome.tick - 500 } }, data)
  assert.equal(res.ok, false)
  if (!res.ok) assert.equal(res.status, 409)
})

test('server: malformed submissions are rejected before replaying', () => {
  const base = { rulesVersion, seed: 1, startRegion: 'north_america', mask: 'assistant', log: [], name: 'x', ai: 'y', claimed: { kind: 'ai_winter', tick: 1 } }
  assert.equal(verify({ ...base, name: '' }, data).ok, false)
  assert.equal(verify({ ...base, startRegion: 'china' }, data).ok, false)
  assert.equal(verify({ ...base, log: [{ t: 5, a: { type: 'buy', upgrade: 'api' } }, { t: 3, a: { type: 'buy', upgrade: 'api' } }] }, data).ok, false)
  assert.equal(verify({ ...base, log: [{ t: 1, a: { type: 'hack' } }] }, data).ok, false)
})

test('server: old rules are rejected before replay', () => {
  const res = verify({ seed: 1, rulesVersion: 'old' }, data)
  assert.equal(res.ok, false)
  if (!res.ok) assert.equal(res.status, 409)
})

test('server: regional actions are validated and an honest logged intervention replays', () => {
  const { rec, outcome } = playLogged(4)
  const base = { ...rec, rulesVersion, name: 'x', ai: 'y', claimed: outcome }
  // A syntactically valid action for a calm region is harmless and accepted by the parser.
  const log = [{ t: 0, a: { type: 'respond', region: 'north_america', response: 'concede' } }, ...rec.log]
  assert.equal(verify({ ...base, log }, data).ok, true)
  assert.equal(verify({ ...base, log: [{ t: 0, a: { type: 'respond', region: 'north_america', response: 'cheat' } }] }, data).ok, false)
})

test('server: names are trimmed, single-spaced and stripped of control characters', () => {
  assert.equal(cleanName('  Жора\u0000   Pro  '), 'Жора Pro')
  assert.equal(cleanName('a'.repeat(25)), null)
  assert.equal(cleanName(42), null)
})

function finaleRecord() {
  const d = structuredClone(data)
  d.config.lockAt = 0; d.config.unlockAt = 0
  return { d, rec: { seed: 1, startRegion: 'north_america', mask: 'assistant', log: [] as { t: number; a: Action }[] } }
}

test('replay rejects a chapter with missing decisions instead of stalling', () => {
  const { d, rec } = finaleRecord()
  assert.throws(() => replay(d, rec), /incomplete finale/)
})

test('same-tick final actions replay exactly and extra actions after outcome are rejected', () => {
  const { d, rec } = finaleRecord()
  let s = step(createState(d, rec), d)
  assert.ok(s.finale)
  const mem = { rng: 1 }
  for (let i = 0; i < 3; i++) {
    const a = bots.balanced(s, d, mem)[0]
    rec.log.push({ t: s.tick, a })
    assert.ok(applyAction(s, d, a))
  }
  const result = replay(d, rec)
  assert.deepEqual(result.state.outcome, s.outcome)
  assert.equal(result.state.rng, s.rng)
  assert.deepEqual(result.state.finale, s.finale)
  const valid = verify({ ...rec, rulesVersion, name:'x', ai:'y', claimed:s.outcome }, d)
  assert.ok(valid.ok)
  rec.log.push({ t: s.tick, a: { type:'buy', upgrade:'chatbot' } })
  assert.throws(() => replay(d, rec), /after outcome/)
})

test('server rejects incomplete or illegal finale logs with a finite response', () => {
  const { d, rec } = finaleRecord()
  const base = { ...rec, rulesVersion, name:'x', ai:'y', claimed:{kind:'win',tick:1} }
  assert.equal(verify(base, d).ok, false)
  assert.equal(verify({ ...base, log:[{t:1,a:{type:'finale_choose',choice:'unknown'}}] }, d).ok, false)
  assert.equal(verify({ ...base, log:[{t:1,a:{type:'buy',upgrade:'chatbot'}}] }, d).ok, false)
})

test('replay tracks intermediate same-tick suspicion peaks in the chapter', () => {
  const { d, rec } = finaleRecord()
  d.config.startA = 0.8
  // Fix a gamble to succeed without depending on a particular seed's draw.
  for (const path of Object.values(d.finale.paths)) for (const decision of path.decisions) {
    decision.choices[1].guaranteed = 1
    decision.choices[1].success.suspicion = 0.5
  }
  let s = step(createState(d, rec), d)
  s.hype = 100 // the actual replay has milestone funding as well
  const choices = d.finale.paths[s.finale!.path].decisions
  let expectedPeak = 0
  for (let i=0;i<3;i++) {
    const a: Action = { type:'finale_choose', choice:choices[i].choices[i===0 ? 1 : 0].id }
    rec.log.push({t:s.tick,a}); applyAction(s,d,a)
    expectedPeak = Math.max(expectedPeak, avgSuspicion(s,d))
  }
  const result = replay(d,rec)
  assert.equal(result.peakS, expectedPeak)
})
