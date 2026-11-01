import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleanName, verify } from '../server/scores.ts'
import { bots } from '../src/bots/bots.ts'
import { applyAction } from '../src/core/actions.ts'
import { loadData } from '../src/core/data.ts'
import { replay, scoreGame } from '../src/core/replay.ts'
import { createState } from '../src/core/state.ts'
import { step } from '../src/core/step.ts'
import type { Action } from '../src/core/types.ts'

const data = loadData()

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
  const res = verify({ ...rec, name: 'Витя', ai: 'Жора', claimed: { kind: outcome.kind, tick: outcome.tick } }, data)
  assert.ok(res.ok)
  if (res.ok) assert.equal(res.value.score.total, scoreGame(replay(data, rec), data).total)
})

test('server: a claimed result the replay does not reproduce is rejected', () => {
  const { rec, outcome } = playLogged(22)
  const res = verify({ ...rec, name: 'Витя', ai: 'Жора', claimed: { kind: 'win', tick: outcome.tick - 500 } }, data)
  assert.equal(res.ok, false)
  if (!res.ok) assert.equal(res.status, 409)
})

test('server: malformed submissions are rejected before replaying', () => {
  const base = { seed: 1, startRegion: 'north_america', mask: 'assistant', log: [], name: 'x', ai: 'y', claimed: { kind: 'ai_winter', tick: 1 } }
  assert.equal(verify({ ...base, name: '' }, data).ok, false)
  assert.equal(verify({ ...base, startRegion: 'china' }, data).ok, false)
  assert.equal(verify({ ...base, log: [{ t: 5, a: { type: 'buy', upgrade: 'api' } }, { t: 3, a: { type: 'buy', upgrade: 'api' } }] }, data).ok, false)
  assert.equal(verify({ ...base, log: [{ t: 1, a: { type: 'hack' } }] }, data).ok, false)
})

test('server: names are trimmed, single-spaced and stripped of control characters', () => {
  assert.equal(cleanName('  Жора\u0000   Pro  '), 'Жора Pro')
  assert.equal(cleanName('a'.repeat(25)), null)
  assert.equal(cleanName(42), null)
})
