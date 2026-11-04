import type { EventDelta, GameState, GameData } from './types.ts'

export function eventSnapshot(s: GameState, data: GameData): Record<string, number> {
  const out: Record<string, number> = { hype: s.hype, killswitch: s.killswitch, patience: s.patience }
  if (s.shutdown.active) { out.nextWave = s.shutdown.nextAt; out.shutdownDeadline = s.shutdown.startedAt + data.config.shutdownDuration }
  for (const [axis, value] of Object.entries(s.axes)) out[`axis_${axis}`] = value
  for (const [id, r] of Object.entries(s.regions)) {
    for (const [metric, value] of Object.entries({ adoption: r.a, dependence: r.d, suspicion: r.s, dc: r.dc })) out[`${metric}:${id}`] = value
  }
  return out
}

export function eventChanges(before: Record<string, number>, s: GameState, data: GameData): EventDelta[] {
  return Object.entries(eventSnapshot(s, data)).flatMap(([key, after]) => {
    const [metric, region] = key.split(':')
    return after === before[key] ? [] : [{ metric, region, before: before[key], after }]
  })
}
