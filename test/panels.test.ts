import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadData } from '../src/core/data.ts'
import { derive } from '../src/core/derive.ts'
import { createState } from '../src/core/state.ts'
import { renderSideList, renderSideTop, type View } from '../src/game/panels.ts'

const data = loadData()
const fresh = (): View => {
  const state = createState(data, { seed: 1, startRegion: 'north_america', mask: 'assistant' })
  return { state, data, dv: derive(state, data), speed: 0, selected: 'north_america', aiName: 'Test', muted: true, tab: 'capabilities' }
}

test('panels: purchased upgrades retain tap-accessible descriptions and effects', () => {
  const v = fresh()
  v.state.upgrades.push('code')
  v.dv = derive(v.state, data)
  const html = renderSideList(v)
  assert.ok(html.includes('<details'))
  assert.ok(html.includes('роста, дохода и зависимости'))
  assert.ok(html.includes('Адаптировать'))
})

test('panels: warning displays deadline, forecast and free response alongside unavailable operations', () => {
  const v = fresh()
  v.state.regions.north_america.crisis = { phase: 'warning', until: 40, conceded: false, lastResult: null }
  v.state.hype = 0
  const html = renderSideTop(v)
  assert.ok(html.includes('40 дн.'))
  assert.ok(html.includes('data-response="concede"'))
  assert.ok(html.includes('Нужно 20 хайпа'))
  assert.ok(html.includes('ограничения'))
})

test('crises: paused operation can be abandoned through the free concession', async () => {
  const { applyAction } = await import('../src/core/actions.ts')
  const v = fresh()
  v.state.upgrades.push('code')
  v.state.hype = 100
  v.state.regions.north_america.crisis.phase = 'warning'
  assert.ok(applyAction(v.state, data, { type: 'respond', region: 'north_america', response: 'adapt' }))
  v.state.throttled.push('code')
  v.state.hype = 0
  assert.ok(applyAction(v.state, data, { type: 'respond', region: 'north_america', response: 'concede' }))
  assert.equal(v.state.operation, null)
})
