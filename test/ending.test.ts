import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadData } from '../src/core/data.ts'
import { createState } from '../src/core/state.ts'
import { endingText } from '../src/game/text.ts'
import { renderEnding } from '../src/game/ending.ts'
import { renderFinale } from '../src/game/finale.ts'
import { enterFinale } from '../src/core/finale.ts'
import type { Ending } from '../src/core/types.ts'

const data = loadData()
test('every ending has its own art position, story and escaped personal facts', () => {
  const s = createState(data, { seed:1, startRegion:'north_america', mask:'assistant' })
  const pages = new Set<string>()
  for (const ending of Object.keys(endingText) as Ending[]) {
    s.outcome = { kind:'win', ending, tick:123 }
    const html = renderEnding(s, data, '<img src=x onerror=alert(1)>')
    assert.ok(html.includes(endingText[ending].title))
    assert.ok(html.includes('123'))
    assert.ok(!html.includes('<img src=x'))
    assert.ok(html.includes('ending-art'))
    assert.ok(html.includes('data-ending-skip'))
    pages.add(html)
  }
  assert.equal(pages.size, 8)
})

test('finale choices show price, both outcomes, survival floor and unavailable reason', () => {
  const s = createState(data, { seed:1, startRegion:'north_america', mask:'assistant' })
  enterFinale(s, data, 'win')
  s.hype = 0
  const html = renderFinale(s, data)
  for (const text of ['При успехе', 'При провале', '39%', 'хайпа', 'disabled']) assert.ok(html.includes(text), text)
})
