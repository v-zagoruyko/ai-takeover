import { applyAction } from './actions.ts'
import { derive, gridLoad, totalDc, type Derived } from './derive.ts'
import { int, next, range } from './rng.ts'
import { avgSuspicion, progress, worldA, worldL } from './state.ts'
import { AXES, type Action, type Ending, type GameData, type GameState, type Outcome } from './types.ts'
import { updateCards } from './cards.ts'
import { updateCrises } from './crises.ts'

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** pure: returns a new state, `prev` is left untouched */
export function step(prev: GameState, data: GameData, actions: Action[] = []): GameState {
  if (prev.outcome) return { ...prev, events: [] }
  const st = structuredClone(prev)
  st.events = []
  st.tick += 1
  for (const a of actions) applyAction(st, data, a)

  const dv = derive(st, data)
  // audit and exposures first: their suspicion and killswitch effects must show up in this tick's bans and shutdown
  updateAudit(st, data, dv)
  updateExposures(st, data)
  updateTrends(st, data)
  updateRegions(st, data, dv)
  updateCrises(st, data, dv)
  st.hype += hypeIncome(st, data, dv)
  payUpkeep(st, data)
  updateInvestors(st, data, dv)
  updateKillswitch(st, data, dv)
  updateBubbles(st, data, dv)
  updateCards(st, data)
  updateAxes(st, data, dv)

  const outcome = checkOutcome(st, data)
  if (outcome) {
    st.outcome = outcome
    st.events.push({ type: 'game_over', outcome })
  }
  return st
}

/** mean-reverting random walk per region (Ornstein-Uhlenbeck): growth surges and slumps that differ every game */
function updateTrends(st: GameState, data: GameData): void {
  const c = data.config
  for (const r of data.regions) {
    const rs = st.regions[r.id]
    const t = rs.trend + (next(st) - 0.5) * 2 * c.trendSigma - (rs.trend - 1) * c.trendTheta
    rs.trend = Math.min(c.trendMax, Math.max(c.trendMin, t))
  }
}

function updateRegions(st: GameState, data: GameData, dv: Derived): void {
  const c = data.config
  const slow = st.tick < st.rebrand.slowUntil ? c.rebrandSlow : 1
  // once shutdowns start, people learn to live without you: dependence grows much slower,
  // and the closer you are to running the world, the harder they resist (no free finish during the shutdown)
  const depGrowth = st.shutdown.active
    ? c.shutdownDepGrowth * clamp01((c.winL - worldL(st, data)) / (c.winL - c.lastBreathL))
    : 1

  // compute all deltas from the same snapshot, then apply
  const deltas = data.regions.map((r) => {
    const rs = st.regions[r.id]
    const w = st.world.regions[r.id]
    const banMul = rs.banned ? dv.banMul : 1
    let da = 0
    if (dv.unlocked.has(r.archetype)) {
      const rate = c.kR * w.tech * rs.trend * dv.U * dv.fit[r.archetype] * banMul * slow
      let spill = 0
      for (const [j, w] of Object.entries(data.links[r.id])) spill += w * st.regions[j].a
      da = rate * rs.a * (1 - rs.a) + c.kSpill * dv.spillMul * spill * (1 - rs.a) * banMul * slow
      if (rs.banned) da -= c.bannedDecay * rs.a
    }
    if (rs.crisis.conceded && rs.crisis.phase === 'recovery' && da > 0) da *= data.crises.concessionGrowthMul
    const protest = Math.max(0, rs.s - c.protestAt)
    const dd = c.kDep * rs.a * dv.infra * dv.U * (1 - rs.d) * banMul * depGrowth - c.kDetox * dv.detoxMul * protest * rs.d
    const energyOver = Math.max(0, gridLoad(rs.dc, dv) / w.energy - c.energySafe)
    const pressure = (c.kPresence * dv.presenceMul + c.kCap * dv.cap ** 2) * rs.a + c.kEnergy * dv.energyMul * energyOver
    // dependence is visible no matter how good the PR is: that part of the pressure ignores stealth
    const depPressure = c.kDepSuspicion * rs.d * rs.a
    const ds = (pressure * (1 - dv.st) + depPressure) * (1 - 0.5 * w.openness) - c.kDecay * dv.decayMul * rs.s
    return { r, da, dd, ds }
  })

  for (const { r, da, dd, ds } of deltas) {
    const rs = st.regions[r.id]
    rs.a = clamp01(rs.a + da)
    rs.d = clamp01(rs.d + dd)
    rs.s = clamp01(rs.s + ds)

    if (!rs.locked && rs.d >= c.lockAt) {
      rs.locked = true
      st.events.push({ type: 'lock', region: r.id })
      if (rs.banned) {
        rs.banned = false
        st.events.push({ type: 'unban', region: r.id })
      }
    } else if (rs.locked && rs.d < c.unlockAt) {
      rs.locked = false
      st.events.push({ type: 'unlock', region: r.id })
    }
  }
}

export function hypeIncome(st: GameState, data: GameData, dv: Derived): number {
  let sum = 0
  for (const r of data.regions) sum += st.regions[r.id].a * r.pop * st.world.regions[r.id].wealth
  return data.config.kHype * dv.U * dv.incomeMul * sum
}

function updateInvestors(st: GameState, data: GameData, dv: Derived): void {
  const c = data.config
  const A = worldA(st, data)
  const p = progress(st, data)
  st.growth.push(p - st.prevProgress)
  if (st.growth.length > c.growthWindow) st.growth.shift()
  st.prevProgress = p

  while (st.milestone < c.milestones.length && A >= c.milestones[st.milestone]) {
    const hype = c.milestoneHype[st.milestone]
    st.hype += hype
    st.patience = 1
    st.events.push({ type: 'funding_round', milestone: st.milestone, hype })
    st.milestone += 1
  }
  if (!st.investorsDone && worldL(st, data) >= c.investorsDoneAtL) st.investorsDone = true
  // once the killswitch is pulled investors no longer matter: the game is decided by the shutdown
  if (st.investorsDone || st.shutdown.active || st.tick <= c.patienceGrace) return

  const growth = st.growth.reduce((s, g) => s + g, 0) / st.growth.length
  const expected = c.g0 * dv.expectMul * (1 + st.tick / c.gHorizon)
  st.patience = clamp01(st.patience + c.kPatience * (growth - expected))
}

function payUpkeep(st: GameState, data: GameData): void {
  let due = 0
  for (const id of st.upgrades) due += data.upgrades[id].effects.upkeep ?? 0
  st.unpaid = due > st.hype
  st.hype = Math.max(0, st.hype - due)
}

export function upkeepPerTick(st: GameState, data: GameData): number {
  let due = 0
  for (const id of st.upgrades) due += data.upgrades[id].effects.upkeep ?? 0
  return due
}

function updateKillswitch(st: GameState, data: GameData, dv: Derived): void {
  const c = data.config
  if (!st.shutdown.active) {
    let S = 0
    for (const r of data.regions) {
      const rs = st.regions[r.id]
      if (!rs.locked) S += rs.s * r.pop
    }
    // the more of the world you visibly run, the more alarmed everyone else gets
    // lobbying can buy silence about suspicion, but only half-hide that you run whole countries
    const grow = c.kKill * Math.max(0, S - c.killswitchBaseline) * dv.killMul + c.kKillControl * worldL(st, data) * (0.5 + 0.5 * dv.killMul)
    st.killswitch = clamp01(st.killswitch + grow)
    if (st.killswitch >= 1) {
      st.shutdown = { active: true, startedAt: st.tick, nextAt: st.tick + c.shutdownEvery * dv.shutdownSlow }
      st.events.push({ type: 'shutdown_started' })
    }
    return
  }
  if (st.tick < st.shutdown.nextAt) return
  st.shutdown.nextAt = st.tick + c.shutdownEvery * dv.shutdownSlow
  // humanity goes after what matters most to you, regions under your control included;
  // a big empire is attacked on two fronts at once
  const L = worldL(st, data)
  const fronts = L >= c.shutdownTwoFrontsL ? 2 : 1
  // a big empire is hit harder: each wave tears away more dependence
  const depHit = c.shutdownDepHit * (1 + c.shutdownHitPerL * Math.max(0, L - c.shutdownHitFromL))
  const targets = data.regions
    .filter((r) => st.regions[r.id].a > 0.01)
    .map((r) => ({ id: r.id, value: r.pop * st.regions[r.id].a * (st.regions[r.id].locked ? 2 : 1) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, fronts)
  for (const { id: target } of targets) {
    const rs = st.regions[target]
    // a data centre absorbs the hit; otherwise a controlled region loses its grip, others lose users
    if (rs.dc > 0) rs.dc -= 1
    else if (rs.locked || rs.d > 0.3) {
      rs.d = clamp01(rs.d - depHit)
      rs.a *= 0.92
      if (rs.locked && rs.d < c.unlockAt) {
        rs.locked = false
        st.events.push({ type: 'unlock', region: target })
      }
    } else rs.a *= 1 - c.shutdownAdoptionLoss
    st.events.push({ type: 'dc_shutdown', region: target })
  }
}

export function auditRisk(dv: Derived): number {
  return Math.min(1, (dv.cap * (1 - dv.st) * dv.auditMul) / 10)
}

function updateAudit(st: GameState, data: GameData, dv: Derived): void {
  const c = data.config
  if (!st.audit.warned && st.tick >= st.audit.at - c.auditWarn) {
    st.audit.warned = true
    st.events.push({ type: 'audit_warning', at: st.audit.at })
  }
  if (st.tick < st.audit.at) return

  const passed = next(st) >= auditRisk(dv)
  for (const rs of Object.values(st.regions)) {
    if (passed) rs.s = clamp01(rs.s - c.auditPassSuspicion)
    else if (rs.a > 0.05) rs.s = clamp01(rs.s + c.auditFailSuspicion)
  }
  if (passed) st.axes.shadow += c.auditPassShadow
  else if (!st.shutdown.active) st.killswitch = clamp01(st.killswitch + c.auditFailKill)
  st.throttleLockUntil = st.tick + c.auditThrottleLock
  st.audit = { at: st.tick + int(st, c.auditMin, c.auditMax), warned: false }
  st.events.push({ type: 'audit', passed })
}

function updateBubbles(st: GameState, data: GameData, dv: Derived): void {
  const c = data.config
  st.bubbles = st.bubbles.filter((b) => b.expiresAt > st.tick)
  const A = worldA(st, data)
  if (next(st) >= (c.bubbleBase + c.bubbleByA * A) * dv.bubbleMul) return

  let total = 0
  for (const rs of Object.values(st.regions)) total += rs.a
  if (total <= 0) return
  let pick = next(st) * total
  let region = data.regions[0].id
  for (const r of data.regions) {
    pick -= st.regions[r.id].a
    if (pick <= 0) {
      region = r.id
      break
    }
  }
  const poisoned = next(st) < c.poisonChance
  const value = range(st, c.bubbleMin, c.bubbleMax) * (poisoned ? 2 : 1)
  st.bubbles.push({ id: st.nextBubbleId++, region, value, poisoned, expiresAt: st.tick + c.bubbleTtl })
}

function updateExposures(st: GameState, data: GameData): void {
  const due = st.rebrand.exposures.filter((e) => e.at <= st.tick)
  if (due.length === 0) return
  st.rebrand.exposures = st.rebrand.exposures.filter((e) => e.at > st.tick)
  for (const e of due) {
    if (next(st) >= e.chance) continue
    for (const [id, v] of Object.entries(e.removed)) {
      st.regions[id].s = clamp01(st.regions[id].s + v * data.config.exposureMul)
    }
    st.events.push({ type: 'rebrand_exposed' })
  }
}

function updateAxes(st: GameState, data: GameData, dv: Derived): void {
  const c = data.config
  const rate = c.axisRate * worldA(st, data)
  const extra = { appetite: c.appetitePerDc * totalDc(st), shadow: dv.st * 0.5 }
  for (const k of AXES) {
    st.axes[k] += (dv.axes[k] + (extra[k as keyof typeof extra] ?? 0)) * rate
  }
}

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

function checkOutcome(st: GameState, data: GameData): Outcome | null {
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
