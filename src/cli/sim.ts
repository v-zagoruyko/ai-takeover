import { parseArgs } from 'node:util'
import { bots, type Bot } from '../bots/bots.ts'
import { loadData } from '../core/data.ts'
import { derive } from '../core/derive.ts'
import { avgSuspicion, createState, worldA, worldL } from '../core/state.ts'
import { step } from '../core/step.ts'
import type { GameData, GameState } from '../core/types.ts'

interface RunResult {
  final: GameState
  aTo10: number | null
  aTo40: number | null
  firstLock: number | null
}

function runGame(data: GameData, bot: Bot, seed: number, startRegion: string, mask: string, trace: boolean): RunResult {
  let state = createState(data, { seed, startRegion, mask })
  const mem = { rng: (seed * 7919) >>> 0 }
  const res: RunResult = { final: state, aTo10: null, aTo40: null, firstLock: null }
  while (!state.outcome) {
    state = step(state, data, bot(state, data, mem))
    const A = worldA(state, data)
    if (res.aTo10 === null && A >= 0.1) res.aTo10 = state.tick
    if (res.aTo40 === null && A >= 0.4) res.aTo40 = state.tick
    if (res.firstLock === null && state.events.some((e) => e.type === 'lock')) res.firstLock = state.tick
    if (trace && (state.tick % 100 === 0 || state.outcome)) printTrace(state, data)
    if (trace) for (const e of state.events) console.log(`  t=${state.tick} ${JSON.stringify(e)}`)
  }
  res.final = state
  return res
}

function printTrace(s: GameState, data: GameData): void {
  const dv = derive(s, data)
  const f = (x: number, d = 2) => x.toFixed(d)
  console.log(
    `t=${s.tick} A=${f(worldA(s, data))} L=${f(worldL(s, data))} H=${f(s.hype, 0)} pat=${f(s.patience)} ` +
      `K=${f(s.killswitch)} s=${f(avgSuspicion(s, data))} cap=${dv.cap} st=${f(dv.st)} infra=${f(dv.infra)} ` +
      `dc=${dv.capacity - data.config.baseCapacity} ups=${s.upgrades.length}`,
  )
}

const median = (xs: (number | null)[]): string => {
  const v = xs.filter((x): x is number => x !== null).sort((a, b) => a - b)
  if (v.length === 0) return '—'
  return `${v[Math.floor(v.length / 2)]} (${Math.round((v.length / xs.length) * 100)}%)`
}

const pct = (n: number, total: number) => `${Math.round((n / total) * 100)}%`

function summarize(name: string, results: RunResult[]): void {
  const n = results.length
  const kinds: Record<string, number> = {}
  const endings: Record<string, number> = {}
  for (const r of results) {
    const o = r.final.outcome!
    kinds[o.kind] = (kinds[o.kind] ?? 0) + 1
    if (o.kind === 'win' || o.kind === 'win_last_breath') endings[o.ending] = (endings[o.ending] ?? 0) + 1
  }
  const wins = (kinds.win ?? 0) + (kinds.win_last_breath ?? 0)
  console.log(`\n== ${name} (${n} games)`)
  console.log(`  win ${pct(wins, n)}  | ${Object.entries(kinds).map(([k, v]) => `${k} ${pct(v, n)}`).join('  ')}`)
  if (wins) console.log(`  endings: ${Object.entries(endings).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  console.log(`  game length: ${median(results.map((r) => r.final.tick))}`)
  console.log(`  A≥0.1 at ${median(results.map((r) => r.aTo10))}  A≥0.4 at ${median(results.map((r) => r.aTo40))}  first lock ${median(results.map((r) => r.firstLock))}`)
}

const { values } = parseArgs({
  options: {
    bot: { type: 'string', default: 'all' },
    seeds: { type: 'string', default: '200' },
    seed: { type: 'string', default: '1' },
    start: { type: 'string', default: 'north_america' },
    mask: { type: 'string', default: 'assistant' },
    trace: { type: 'boolean', default: false },
  },
})

const data = loadData()
const names = values.bot === 'all' ? Object.keys(bots) : [values.bot]
for (const name of names) {
  const bot = bots[name]
  if (!bot) throw new Error(`unknown bot: ${name}; available: ${Object.keys(bots).join(', ')}`)
  if (values.trace) {
    runGame(data, bot, Number(values.seed), values.start, values.mask, true)
    continue
  }
  const results: RunResult[] = []
  for (let seed = 1; seed <= Number(values.seeds); seed++) {
    results.push(runGame(data, bot, seed, values.start, values.mask, false))
  }
  summarize(name, results)
}
