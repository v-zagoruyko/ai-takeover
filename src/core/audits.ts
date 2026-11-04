import reports from '../../data/audits.json' with { type: 'json' }
import type { Derived } from './derive.ts'

/** Reporting does not consume the simulation RNG. */
export function auditReport(dv: Derived): string {
  return reports.find(r => !r.capability || dv.activeCaps.includes(r.capability))!.id
}
