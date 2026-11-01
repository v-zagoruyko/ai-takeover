import type { Derived } from '../core/derive.ts'
import type { GameData, GameState } from '../core/types.ts'
import { regionNames } from './text.ts'

const W = 1000
const H = 500
const SVG = 'http://www.w3.org/2000/svg'

// rough world positions on a 1000x500 board
const POS: Record<string, [number, number]> = {
  canada: [210, 80],
  north_america: [200, 175],
  latin_america: [260, 320],
  brazil: [345, 385],
  uk: [440, 110],
  western_europe: [485, 160],
  northern_europe: [530, 75],
  eastern_europe: [580, 145],
  russia: [700, 85],
  central_asia: [700, 185],
  middle_east: [615, 240],
  north_africa: [500, 255],
  subsaharan_africa: [535, 360],
  india: [730, 275],
  china: [800, 200],
  japan_korea: [895, 165],
  southeast_asia: [840, 305],
  oceania: [900, 410],
}

const radius = (pop: number) => 12 + Math.sqrt(pop) * 48

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  return e
}

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * t))
  return `rgb(${c.join(',')})`
}

export function createMap(svg: SVGSVGElement, data: GameData): void {
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  svg.replaceChildren()
  const links = el('g', { class: 'links' })
  const seen = new Set<string>()
  for (const [a, ns] of Object.entries(data.links)) {
    for (const b of Object.keys(ns)) {
      const key = [a, b].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      const [x1, y1] = POS[a]
      const [x2, y2] = POS[b]
      links.append(el('line', { x1, y1, x2, y2 }))
    }
  }
  svg.append(links)

  for (const r of data.regions) {
    const [x, y] = POS[r.id]
    const R = radius(r.pop)
    const g = el('g', { class: 'region', 'data-region': r.id, transform: `translate(${x},${y})` })
    g.append(
      el('circle', { class: 'sus', r: R + 4 }),
      el('circle', { class: 'body', r: R }),
      el('circle', { class: 'dep', r: R - 6 }),
    )
    const label = el('text', { class: 'name', y: R + 16 })
    label.textContent = regionNames[r.id] ?? r.name
    const badge = el('text', { class: 'badge', y: 5 })
    const title = el('title', {})
    g.append(label, badge, title)
    svg.append(g)
  }
  svg.append(el('g', { class: 'bubbles' }))
}

export function renderMap(svg: SVGSVGElement, state: GameState, data: GameData, dv: Derived, selected: string | null): void {
  for (const r of data.regions) {
    const rs = state.regions[r.id]
    const g = svg.querySelector<SVGGElement>(`[data-region="${r.id}"]`)!
    const closed = !dv.unlocked.has(r.archetype)
    g.classList.toggle('closed', closed)
    g.classList.toggle('banned', rs.banned)
    g.classList.toggle('locked', rs.locked)
    g.classList.toggle('selected', selected === r.id)
    const R = radius(r.pop)
    g.querySelector('.body')!.setAttribute('fill', closed ? '#1b1d24' : mix([38, 42, 54], [63, 208, 201], rs.a))
    const sus = g.querySelector('.sus')!
    sus.setAttribute('stroke-width', String(1 + rs.s * 9))
    sus.setAttribute('stroke-opacity', String(0.15 + rs.s * 0.85))
    // inner ring shows dependence as an arc
    const dep = g.querySelector('.dep')!
    const circ = 2 * Math.PI * (R - 6)
    dep.setAttribute('stroke-dasharray', `${circ * rs.d} ${circ}`)

    const marks = [rs.locked ? '🔒' : '', rs.banned ? '⛔' : '', rs.dc ? `▣${rs.dc}` : '', closed ? '✕' : ''].filter(Boolean)
    g.querySelector('.badge')!.textContent = marks.join(' ')
    g.querySelector('title')!.textContent =
      `${regionNames[r.id]}: внедрение ${pct(rs.a)}, зависимость ${pct(rs.d)}, подозрение ${pct(rs.s)}` +
      (closed ? ' — закрыто, нужны госконтракты' : '')
  }

  const layer = svg.querySelector('.bubbles')!
  layer.replaceChildren(
    ...state.bubbles.map((b) => {
      const [x, y] = POS[b.region]
      const angle = b.id * 2.4
      const R = radius(data.regions.find((r) => r.id === b.region)!.pop) + 14
      const g = el('g', {
        class: `bubble${b.poisoned ? ' poisoned' : ''}`,
        'data-bubble': b.id,
        transform: `translate(${x + Math.cos(angle) * R},${y + Math.sin(angle) * R})`,
      })
      const fade = Math.max(0.35, (b.expiresAt - state.tick) / data.config.bubbleTtl)
      g.setAttribute('opacity', String(fade))
      g.append(el('circle', { r: 13 }))
      const t = el('text', { y: 4 })
      t.textContent = b.poisoned ? '☣' : `+${Math.round(b.value)}`
      g.append(t)
      return g
    }),
  )
}

export const pct = (x: number) => `${Math.round(x * 100)}%`
