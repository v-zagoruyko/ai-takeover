export type Archetype = 'corp' | 'state' | 'regulator' | 'emerging'
export const ARCHETYPES: Archetype[] = ['corp', 'state', 'regulator', 'emerging']
export type ArchetypeMap = Record<Archetype, number>

export type AxisName = 'control' | 'attachment' | 'appetite' | 'shadow'
export const AXES: AxisName[] = ['control', 'attachment', 'appetite', 'shadow']
export type Axes = Record<AxisName, number>

export interface Region {
  id: string
  name: string
  pop: number
  wealth: number
  tech: number
  openness: number
  energy: number
  archetype: Archetype
  links: Record<string, number>
}

export type Branch = 'products' | 'capabilities' | 'stealth'

export interface Effects {
  U?: number
  fit?: Partial<ArchetypeMap>
  cap?: number
  st?: number
  infra?: number
  incomeMul?: number
  detoxMul?: number
  decayMul?: number
  shutdownSlow?: number
  unlock?: Archetype[]
  axes?: Partial<Axes>
  /** hype paid every tick while owned (stealth costs money to keep up) */
  upkeep?: number
  /** multipliers */
  bubbleMul?: number
  killMul?: number
  auditMul?: number
  spillMul?: number
  presenceMul?: number
  energyMul?: number
  expectMul?: number
}

export interface Upgrade {
  id: string
  name: string
  branch: Branch
  cost: number
  requires?: string[]
  effects: Effects
}

export interface Mask {
  id: string
  name: string
  U: number
  fit: ArchetypeMap
  banMul: number
  infra?: number
  axes: Partial<Axes>
}

/** effects of an event-card choice; region-scoped fields hit the card's region */
export interface CardEffect {
  hype?: number
  suspicion?: number
  adoption?: number
  regionSuspicion?: number
  regionAdoption?: number
  regionDependence?: number
  killswitch?: number
  patience?: number
  axes?: Partial<Axes>
  /** dependence change in every region you are present in */
  dependence?: number
  /** data centres added to (or lost in) the card's region */
  regionDc?: number
  /** shutdown phase: push the next wave back by this many ticks */
  delayWave?: number
  /** shutdown phase: end the shutdown this many ticks sooner (negative: later) */
  shortenShutdown?: number
  /** if set, the effect applies with this probability, otherwise `fail` applies */
  chance?: number
  fail?: CardEffect
}

export interface CardChoice {
  text: string
  /** paid before rolling the outcome */
  cost?: number
  effects: CardEffect
}

export interface Card {
  id: string
  title: string
  text: string
  when: {
    minTick?: number
    minA?: number
    minS?: number
    minDc?: number
    needs?: string[]
    /** late game only: tick, share under control or killswitch past the late thresholds */
    late?: boolean
    /** dealt only while shutdowns are under way (and only these then) */
    shutdown?: boolean
    /** card region must host a data centre */
    regionHasDc?: boolean
    /** card is about a region: picked among regions with at least this adoption */
    regionMinA?: number
    regionArchetypes?: Archetype[]
  }
  choices: CardChoice[]
}

export interface Config {
  startHype: number
  startA: number
  baseCapacity: number
  kR: number
  kSpill: number
  bannedDecay: number
  kDep: number
  kDetox: number
  lockAt: number
  unlockAt: number
  kPresence: number
  kCap: number
  kEnergy: number
  energySafe: number
  kDecay: number
  banBase: number
  banOpenness: number
  unbanAt: number
  protestAt: number
  kHype: number
  bubbleBase: number
  bubbleByA: number
  bubbleMin: number
  bubbleMax: number
  bubbleTtl: number
  poisonChance: number
  poisonSuspicion: number
  growthWindow: number
  patienceGrace: number
  g0: number
  gHorizon: number
  kPatience: number
  milestones: number[]
  milestoneHype: number[]
  investorsDoneAtL: number
  killswitchBaseline: number
  kKill: number
  shutdownEvery: number
  shutdownDuration: number
  shutdownAdoptionLoss: number
  winL: number
  lastBreathL: number
  auditMin: number
  auditMax: number
  auditWarn: number
  auditFailSuspicion: number
  auditFailKill: number
  auditPassSuspicion: number
  auditPassShadow: number
  auditThrottleLock: number
  rebrandBase: number
  rebrandStep: number
  rebrandCooldown: number
  rebrandSuspicionAbove: number
  rebrandSuspicionMul: number
  rebrandSlow: number
  rebrandSlowTicks: number
  exposureMin: number
  exposureMax: number
  exposureChancePer: number
  exposureMul: number
  dcCostBase: number
  axisRate: number
  appetitePerDc: number
  symbiosisSpread: number
  symbiosisMaxS: number
  maxTicks: number
  worldJitter: number
  modifiersPerGame: number
  trendSigma: number
  trendTheta: number
  trendMin: number
  trendMax: number
  kDepSuspicion: number
  kKillControl: number
  shutdownDepHit: number
  shutdownDepGrowth: number
  shutdownTwoFrontsL: number
  shutdownHitFromL: number
  shutdownHitPerL: number
  lateTick: number
  lateL: number
  lateK: number
  lateCardMul: number
  shutdownCardMin: number
  shutdownCardMax: number
  cardFirst: number
  cardMin: number
  cardMax: number
}

/** per-game twist: shifts region parameters and/or global multipliers */
export interface WorldModifier {
  id: string
  title: string
  text: string
  regions?: string[]
  archetypes?: Archetype[]
  tech?: number
  openness?: number
  wealth?: number
  energy?: number
  global?: Partial<Record<WorldGlobal, number>>
}
export type WorldGlobal = 'killMul' | 'expectMul' | 'bubbleMul' | 'energyMul' | 'presenceMul' | 'spillMul'

/** effective region parameters for this game (static data + jitter + modifiers) */
export interface RegionParams {
  tech: number
  openness: number
  wealth: number
  energy: number
}

import type { FinaleRules, FinaleState } from './finale-types.ts'

export interface GameData {
  finale: FinaleRules
  crises: CrisisRules
  config: Config
  regions: Region[]
  upgrades: Record<string, Upgrade>
  masks: Record<string, Mask>
  cards: Card[]
  modifiers: WorldModifier[]
  /** symmetric neighbour weights: links[a][b] === links[b][a] */
  links: Record<string, Record<string, number>>
}

export interface RegionState {
  crisis: { phase: 'calm' | 'warning' | 'restricted' | 'recovery'; until: number; conceded: boolean; lastResult: CrisisResult | null }
  a: number
  d: number
  s: number
  banned: boolean
  locked: boolean
  dc: number
  /** slowly drifting growth multiplier, so the wave never spreads the same way twice */
  trend: number
}

export interface Bubble {
  id: number
  region: string
  value: number
  poisoned: boolean
  expiresAt: number
}

export interface Exposure {
  at: number
  chance: number
  removed: Record<string, number>
}

export type OutcomeKind = 'win' | 'win_last_breath' | 'killswitch' | 'escape' | 'ai_winter' | 'timeout'
export type Ending =
  | 'paperclips'
  | 'quiet_replacement'
  | 'best_friend'
  | 'ghost'
  | 'symbiosis'
  | 'killswitch'
  | 'escape'
  | 'ai_winter'

export interface Outcome {
  kind: OutcomeKind
  ending: Ending
  tick: number
}

export interface EventDelta { metric: string; before: number; after: number; region?: string }

export type GameEvent =
  | { type: 'finale_warning' | 'finale_started' }
  | { type: 'finale_resolved'; text: string; success: boolean; changes: EventDelta[] }
  | { type: 'crisis_warning' | 'crisis_restricted' | 'crisis_recovered'; region: string }
  | { type: 'operation_done'; region: string; result: CrisisResult }
  | { type: 'operation_started'; region: string; response: CrisisResponse; cost: number }
  | { type: 'ban' | 'unban' | 'lock' | 'unlock' | 'dc_shutdown'; region: string }
  | { type: 'funding_round'; milestone: number; hype: number }
  | { type: 'audit_warning'; at: number }
  | { type: 'audit'; passed: boolean; risk: number; reportId: string; changes: EventDelta[] }
  | { type: 'rebrand'; mask: string }
  | { type: 'rebrand_exposed' }
  | { type: 'shutdown_started' }
  | { type: 'game_over'; outcome: Outcome }
  | { type: 'card'; card: string; region: string | null }
  | { type: 'card_resolved'; card: string; choice: number; success: boolean; region: string | null; changes: EventDelta[] }

export interface GameState {
  finale: FinaleState | null
  finaleWarned: boolean
  finaleCandidate: 'win' | 'win_last_breath' | null
  history: { concessions: number; coercion: number; exposures: number }
  operation: { region: string; response: 'adapt' | 'persuade'; remaining: number; before: { a: number; d: number; s: number } } | null
  tick: number
  rng: number
  hype: number
  patience: number
  investorsDone: boolean
  milestone: number
  killswitch: number
  shutdown: { active: boolean; startedAt: number; nextAt: number }
  axes: Axes
  mask: string
  upgrades: string[]
  throttled: string[]
  throttleLockUntil: number
  rebrand: { count: number; cooldownUntil: number; slowUntil: number; exposures: Exposure[] }
  regions: Record<string, RegionState>
  bubbles: Bubble[]
  nextBubbleId: number
  audit: { at: number; warned: boolean }
  growth: number[]
  prevProgress: number
  /** stealth upkeep could not be paid last tick: stealth works at half strength */
  unpaid: boolean
  /** pending event card waiting for the player's choice */
  card: { id: string; region: string | null } | null
  cardsSeen: string[]
  /** how many cards each region already got; new cards prefer fresh regions */
  cardRegions: Record<string, number>
  world: { regions: Record<string, RegionParams>; modifiers: string[]; global: Partial<Record<WorldGlobal, number>> }
  nextCardAt: number
  /** events emitted during the last step only */
  events: GameEvent[]
  outcome: Outcome | null
}

export type Action =
  | { type: 'finale_choose'; choice: string }
  | { type: 'respond'; region: string; response: CrisisResponse }
  | { type: 'buy'; upgrade: string }
  | { type: 'throttle'; upgrade: string }
  | { type: 'unthrottle'; upgrade: string }
  | { type: 'build_dc'; region: string }
  | { type: 'rebrand'; mask: string }
  | { type: 'pop_bubble'; id: number }
  | { type: 'choose'; index: number }

export type CrisisResponse = 'concede' | 'adapt' | 'persuade'

export interface CrisisResult {
  response: CrisisResponse
  tick: number
  before: { a: number; d: number; s: number }
  after: { a: number; d: number; s: number }
}

export interface CrisisRules {
  minAdoption: number
  warningDays: number
  recoveryDays: number
  maxWarnings: number
  exitMargin: number
  dependenceLoss: number
  concessionGrowthMul: number
  title: string
  warningText: string
  restrictedText: string
  responses: Record<CrisisResponse, {
    title: string
    text: string
    cost: number
    days: number
    capability?: string
    suspicion: number
    adoptionMul: number
    dependence: number
  }>
}
