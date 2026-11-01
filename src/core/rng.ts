// mulberry32: the seed lives in state so that the whole game stays serializable and replayable
export function next(holder: { rng: number }): number {
  let t = (holder.rng = (holder.rng + 0x6d2b79f5) | 0)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function range(holder: { rng: number }, min: number, max: number): number {
  return min + next(holder) * (max - min)
}

export function int(holder: { rng: number }, min: number, max: number): number {
  return Math.floor(range(holder, min, max + 1))
}
