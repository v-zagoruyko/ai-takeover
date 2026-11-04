import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadData } from '../src/core/data.ts'
import { createState } from '../src/core/state.ts'
import { derive } from '../src/core/derive.ts'
import { step } from '../src/core/step.ts'

const data = loadData()
const fresh = () => createState(data, { seed: 1, startRegion: 'north_america', mask: 'assistant' })

test('audit emits the tested risk, an honest report and actual clamped deltas', () => {
  const s = fresh()
  s.audit.at = 1
  s.regions.north_america.s = 0.01
  const dv = derive(s, data)
  const result = step(s, data)
  const e = result.events.find(e => e.type === 'audit')!
  assert.equal(e.type, 'audit')
  if (e.type !== 'audit') return
  assert.equal(e.risk, Math.min(1, dv.cap * (1 - dv.st) * dv.auditMul / 10))
  assert.equal(e.passed, true)
  assert.equal(e.reportId, 'baseline')
  assert.ok(e.changes.some(x => x.metric === 'suspicion' && x.region === 'north_america' && x.before === 0.01 && x.after === 0))
})

test('a specialized audit only reports a capability that was actually active', () => {
  const s = fresh()
  s.upgrades = ['code', 'finance', 'self_copy']
  s.audit.at = 1
  s.regions.north_america.dc = 10
  const result = step(s, data)
  const e = result.events.find(e => e.type === 'audit')!
  assert.equal(e.type === 'audit' && e.reportId, 'replication')
})
