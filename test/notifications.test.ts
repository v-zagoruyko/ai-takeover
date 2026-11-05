import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NoticeQueue } from '../src/game/notifications.ts'

test('critical notices persist, overflow waits, dismiss advances and reset clears', () => {
  const q = new NoticeQueue()
  for (let i = 0; i < 4; i++) q.enqueue({ id: String(i), severity: 'critical' }, 0)
  assert.deepEqual(q.visible.map(x => x.id), ['0','1','2'])
  q.advance(7000)
  assert.equal(q.visible.length, 3)
  q.dismiss('0', 7000)
  assert.deepEqual(q.visible.map(x => x.id), ['1','2','3'])
  q.reset()
  assert.equal(q.visible.length, 0)
})

test('ordinary notice gets six full seconds after it becomes visible', () => {
  const q = new NoticeQueue()
  for (let i = 0; i < 3; i++) q.enqueue({ id: String(i), severity: 'critical' }, 0)
  q.enqueue({ id: 'ordinary', severity: 'info' }, 0)
  q.dismiss('0', 9000)
  q.advance(14999)
  assert.ok(q.visible.some(x => x.id === 'ordinary'))
  q.advance(15000)
  assert.ok(!q.visible.some(x => x.id === 'ordinary'))
})

test('critical notices leave the map without manual dismissal', () => {
  const q = new NoticeQueue()
  q.enqueue({ id: 'audit', severity: 'critical' }, 0)
  q.advance(11999)
  assert.equal(q.visible.length, 1)
  q.advance(12000)
  assert.equal(q.visible.length, 0)
})
