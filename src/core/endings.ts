import { AXES, type Ending, type GameData, type GameState, type Outcome } from './types.ts'
import { avgSuspicion, worldL } from './state.ts'

export function endingFor(st: GameState, data: GameData): Ending {
  const c = data.config
  const vals = AXES.map((k) => st.axes[k])
  const max = Math.max(...vals)
  const min = Math.min(...vals)
  if (max > 0 && min >= max * (1 - c.symbiosisSpread) && avgSuspicion(st, data) < c.symbiosisMaxS) {
    return 'symbiosis'
  }
  const top = AXES[vals.indexOf(max)]
  const byAxis: Record<typeof top, Ending> = {
    control: 'quiet_replacement',
    attachment: 'best_friend',
    appetite: 'paperclips',
    shadow: 'ghost',
  }
  return byAxis[top]
}

export function checkOutcome(st: GameState, data: GameData): Outcome | null {
  const c = data.config
  const L = worldL(st, data)
  const tick = st.tick
  if (L >= c.winL) return { kind: 'win', ending: endingFor(st, data), tick }
  if (st.shutdown.active && tick - st.shutdown.startedAt >= c.shutdownDuration) {
    if (L >= c.lastBreathL) return { kind: 'win_last_breath', ending: endingFor(st, data), tick }
    const shadowTop = AXES.every((k) => k === 'shadow' || st.axes.shadow > st.axes[k])
    return shadowTop ? { kind: 'escape', ending: 'escape', tick } : { kind: 'killswitch', ending: 'killswitch', tick }
  }
  if (st.patience <= 0) return { kind: 'ai_winter', ending: 'ai_winter', tick }
  if (tick >= c.maxTicks) return { kind: 'timeout', ending: 'ai_winter', tick }
  return null
}
