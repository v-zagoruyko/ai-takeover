import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyAction } from '../src/core/actions.ts'
import { loadData } from '../src/core/data.ts'
import { derive } from '../src/core/derive.ts'
import { updateCrises } from '../src/core/crises.ts'
import { createState } from '../src/core/state.ts'
import { step } from '../src/core/step.ts'

const data = loadData()
const fresh = () => createState(data, { seed: 1, startRegion: 'north_america', mask: 'assistant' })
const advance = (s: ReturnType<typeof fresh>, n: number) => {
  for (let i = 0; i < n; i++) {
    s.tick++
    updateCrises(s, data, derive(s, data))
  }
}
const warn = () => {
  const s = fresh()
  Object.assign(s.regions.north_america, { a: 0.7, s: 0.8 })
  updateCrises(s, data, derive(s, data))
  return s
}

test('crises: warning precedes restrictions by 40 days and at most two are active', () => {
  const s = fresh()
  for (const r of Object.values(s.regions)) Object.assign(r, { a: 0.7, s: 0.8 })
  updateCrises(s, data, derive(s, data))
  const warnings = Object.values(s.regions).filter((r) => r.crisis.phase === 'warning')
  assert.equal(warnings.length, 2)
  assert.ok(warnings.every((r) => !r.banned))
  advance(s, 39)
  assert.ok(warnings.every((r) => r.crisis.phase === 'warning'))
  advance(s, 1)
  assert.ok(warnings.every((r) => r.crisis.phase === 'restricted'))
})

test('crises: conceding is free, reduces adoption, gives a 60-day recovery and cannot be spammed', () => {
  const s = warn()
  s.hype = 0
  const a = s.regions.north_america.a
  assert.ok(applyAction(s, data, { type: 'respond', region: 'north_america', response: 'concede' }))
  const r = s.regions.north_america
  assert.ok(r.a < a)
  assert.equal(r.crisis.phase, 'recovery')
  assert.equal(s.hype, 0)
  assert.equal(applyAction(s, data, { type: 'respond', region: 'north_america', response: 'concede' }), false)
  advance(s, 59)
  assert.equal(r.crisis.phase, 'recovery')
  advance(s, 1)
  assert.equal(r.crisis.phase, 'calm')
})

test('crises: operations share one slot, pause without an active capability and charge once', () => {
  const s = warn()
  s.upgrades = ['code', 'persuasion']
  s.regions.north_america.dc = 1
  s.hype = 100
  const cost = data.crises.responses.adapt.cost
  assert.ok(applyAction(s, data, { type: 'respond', region: 'north_america', response: 'adapt' }))
  assert.equal(s.hype, 100 - cost)
  Object.assign(s.regions.western_europe, { a: 0.7, s: 0.8 })
  updateCrises(s, data, derive(s, data))
  assert.equal(applyAction(s, data, { type: 'respond', region: 'western_europe', response: 'persuade' }), false)
  const remaining = s.operation!.remaining
  s.throttled.push('code')
  advance(s, 3)
  assert.equal(s.operation!.remaining, remaining)
  s.throttled = []
  advance(s, remaining)
  assert.equal(s.operation, null)
  assert.equal(s.hype, 100 - cost)
  assert.equal(s.regions.north_america.crisis.phase, 'recovery')
  assert.ok(s.regions.north_america.crisis.lastResult)
})

test('crises: restrictions erode control and recovery permits taking a region back', () => {
  const s = warn()
  const r = s.regions.north_america
  Object.assign(r, { locked: true, d: 0.76 })
  advance(s, 40)
  advance(s, 35)
  assert.equal(r.locked, false)
  assert.equal(r.banned, true)
  assert.ok(s.events.some((e) => e.type === 'unlock'))
  r.s = 0.1
  advance(s, 1)
  assert.equal(r.banned, false)
  assert.equal(r.crisis.phase, 'recovery')
  r.d = 0.8
  const next = step(s, data)
  assert.equal(next.regions.north_america.locked, true)
})

test('crises: shutdown creates no new warnings, existing warnings still escalate', () => {
  const s = warn()
  s.shutdown.active = true
  Object.assign(s.regions.western_europe, { a: 0.7, s: 0.8 })
  advance(s, 40)
  assert.equal(s.regions.north_america.crisis.phase, 'restricted')
  assert.equal(s.regions.western_europe.crisis.phase, 'calm')
})

test('crises: falling pressure cancels a warning with hysteresis', () => {
  const s = warn()
  s.regions.north_america.s = 0.1
  advance(s, 1)
  assert.equal(s.regions.north_america.crisis.phase, 'recovery')
  advance(s, 60)
  assert.equal(s.regions.north_america.crisis.phase, 'calm')
})

test('crises: regaining control suspends the ban even while restrictions remain', () => {
  const s = fresh()
  const r = s.regions.north_america
  Object.assign(r, { a: 0.8, d: 0.8, s: 0.5, banned: true })
  r.crisis.phase = 'restricted'
  const next = step(s, data)
  assert.equal(next.regions.north_america.locked, true)
  assert.equal(next.regions.north_america.banned, false)
})
