import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyAction } from '../src/core/actions.ts'
import { buildData, loadData } from '../src/core/data.ts'
import { createState } from '../src/core/state.ts'
import { describeEffect, effectChips } from '../src/game/text.ts'

const data = loadData()
const fresh = () => createState(data, { seed: 1, startRegion: 'north_america', mask: 'assistant' })

test('events: paid choices require the full price and leave state untouched otherwise', () => {
  const s = fresh()
  s.card = { id: 'free_rival', region: null }
  s.hype = 3
  const before = structuredClone(s)
  assert.equal(applyAction(s, data, { type: 'choose', index: 2 }), false)
  assert.deepEqual(s, before)
})

test('events: guaranteed price is paid even when the gamble fails', () => {
  const d = structuredClone(data)
  const card = d.cards.find((c) => c.id === 'antitrust')!
  card.choices[1].effects.chance = 0
  const s = fresh()
  s.card = { id: card.id, region: null }
  s.hype = 50
  assert.equal(applyAction(s, d, { type: 'choose', index: 1 }), true)
  assert.equal(s.hype, 10)
  assert.equal(s.killswitch, 0.08)
})

test('events: every card offers a free way out', () => {
  for (const c of data.cards) assert.ok(c.choices.some((x) => !x.cost && (x.effects.hype ?? 0) >= 0), c.id)
})

test('event descriptions include dependence, data centres, shutdown timing and ending influence', () => {
  const text = describeEffect({ dependence: 0.05, regionDc: -1, delayWave: 25, shortenShutdown: 30, axes: { shadow: 1 } })
  for (const part of ['5 п.п.', 'дата-центр', '25', '30', 'концовк']) assert.ok(text.includes(part), text)
  assert.ok(describeEffect({ regionAdoption: 0.12 }).includes('12 п.п.'))
  assert.ok(describeEffect({ adoption: 0.12 }).includes('12%'))
  const chips = effectChips({ U: 0.3, infra: 0.25 }).map((x) => x.text).join(' ')
  assert.ok(!chips.includes('польза'))
  assert.ok(chips.includes('0.30') && chips.includes('0.25'))
})

test('data rejects negative event prices and unknown operation capabilities', () => {
  const raw = { ...structuredClone(data), upgrades: Object.values(data.upgrades), masks: Object.values(data.masks) }
  raw.cards[0].choices[0].cost = -10
  assert.throws(() => buildData(raw), /cost/)
  raw.cards[0].choices[0].cost = 10
  raw.crises.responses.adapt.capability = 'missing'
  assert.throws(() => buildData(raw), /capability/)
})
