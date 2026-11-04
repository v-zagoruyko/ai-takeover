import type { Axes, EventDelta, OutcomeKind } from './types.ts'

export const FINALE_FACTORS = ['control','compute','capability','resistance','suspicion','shutdown','concessions','coercion','stealth','distribution','exposures','balance'] as const
export type FinaleFactor = typeof FINALE_FACTORS[number]
export type FinalePath = keyof Axes | 'symbiosis'
export interface FinaleEffect { dependence: number; suspicion: number; dcLoss?: number; axis: keyof Axes | null; axisAmount: number; text: string }
export interface FinaleChoice {
  id: string; title: string; cost: number; guaranteed: 0 | 1 | null; bias: number; scale: number
  factors: Partial<Record<FinaleFactor, number>>; capability?: string; requires?: string[]
  minFactor?: Partial<Record<FinaleFactor, number>>; success: FinaleEffect; failure: FinaleEffect
}
export interface FinaleDecision { id: string; title: string; text: string; choices: FinaleChoice[] }
export interface FinaleRules { warningRatio: number; survivalRetention: number; paths: Record<FinalePath, { title: string; decisions: FinaleDecision[] }> }
export interface FinaleResult { decisionId: string; choiceId: string; title: string; success: boolean; probability: number; text: string; changes: EventDelta[] }
export interface FinaleState { path: FinalePath; index: number; originKind: Extract<OutcomeKind, 'win' | 'win_last_breath'>; survivalFloor: number; results: FinaleResult[] }
export interface FinalePreview {
  decisionId: string; choiceId: string; title: string; available: boolean; reason?: string; probability: number
  guaranteed: 0 | 1 | null; factors: { key: FinaleFactor; value: number; contribution: number }[]
  cost: number; success: FinaleEffect; failure: FinaleEffect; successControl: number; failureControl: number; survivalFloor: number
}
