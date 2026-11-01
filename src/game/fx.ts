import Phaser from 'phaser'
import type { GameState } from '../core/types.ts'

export type Tone = 'cyan' | 'gold' | 'red' | 'dim'
export const TONE: Record<Tone, number> = { cyan: 0x2ed6c4, gold: 0xffd166, red: 0xff4d6a, dim: 0x5b6378 }

/** soft glowing dot and a cartoon eye, drawn once */
export function makeFxTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({}, false)
  for (let r = 12; r > 0; r--) {
    g.fillStyle(0xffffff, r <= 3 ? 1 : 0.06 + (12 - r) * 0.01)
    g.fillCircle(12, 12, r)
  }
  g.generateTexture('node', 24, 24)
  g.clear()
  g.fillStyle(0xffffff)
  g.fillEllipse(32, 20, 60, 34)
  g.fillStyle(0xff3b5c)
  g.fillCircle(32, 20, 12)
  g.fillStyle(0x0b0e14)
  g.fillCircle(32, 20, 6)
  g.lineStyle(3, 0x0b0e14)
  g.strokeEllipse(32, 20, 60, 34)
  g.generateTexture('eye', 64, 40)
  g.clear()
  // data centre: three rack units with status lights
  for (const y of [2, 10, 18]) {
    g.fillStyle(0xffffff)
    g.fillRoundedRect(2, y, 20, 6, 2)
    g.fillStyle(0x0b0e14)
    g.fillCircle(6, y + 3, 1.3)
    g.fillRect(11, y + 2.5, 8, 1)
  }
  g.generateTexture('dc', 24, 26)
  g.destroy()
}

// ---------- neural network that lights up inside a region ----------

interface Node {
  x: number
  y: number
  img: Phaser.GameObjects.Image
  phase: number
}

/**
 * Nodes are scattered over the region's land and joined into a tree that grows outward from the anchor,
 * so lighting the first N nodes always looks like a connected network spreading through the country.
 */
export class RegionNetwork {
  private nodes: Node[] = []
  private edges: [number, number][] = []
  private gfx: Phaser.GameObjects.Graphics
  private lit = 0
  private tone: Tone = 'cyan'

  constructor(scene: Phaser.Scene, polys: Phaser.Geom.Polygon[], bounds: Phaser.Geom.Rectangle, anchor: [number, number]) {
    const spacing = 20
    const pts: { x: number; y: number }[] = []
    const tries = Math.min(4000, Math.ceil((bounds.width * bounds.height) / 40))
    for (let i = 0; i < tries && pts.length < 48; i++) {
      const x = bounds.x + Math.random() * bounds.width
      const y = bounds.y + Math.random() * bounds.height
      if (!polys.some((p) => p.contains(x, y))) continue
      if (pts.some((q) => (q.x - x) ** 2 + (q.y - y) ** 2 < spacing * spacing)) continue
      pts.push({ x, y })
    }
    if (pts.length === 0) pts.push({ x: anchor[0], y: anchor[1] })
    // wave order: distance from the anchor with some noise, so the front is organic rather than a perfect circle
    const maxD = Math.max(...pts.map((p) => Math.hypot(p.x - anchor[0], p.y - anchor[1])), 1)
    const key = new Map(pts.map((p) => [p, Math.hypot(p.x - anchor[0], p.y - anchor[1]) + Math.random() * maxD * 0.35]))
    pts.sort((a, b) => key.get(a)! - key.get(b)!)

    // each node links to its nearest already-placed node (a tree), plus a short extra link for a mesh look
    for (let i = 1; i < pts.length; i++) {
      let best = 0
      let bestD = Infinity
      let second = -1
      let secondD = Infinity
      for (let j = 0; j < i; j++) {
        const d = (pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2
        if (d < bestD) {
          second = best
          secondD = bestD
          best = j
          bestD = d
        } else if (d < secondD) {
          second = j
          secondD = d
        }
      }
      this.edges.push([best, i])
      if (second >= 0 && Math.sqrt(secondD) < spacing * 2.2) this.edges.push([second, i])
    }

    this.gfx = scene.add.graphics().setDepth(2.5)
    this.nodes = pts.map((p) => ({
      ...p,
      phase: Math.random() * Math.PI * 2,
      img: scene.add.image(p.x, p.y, 'node').setDepth(2.6).setScale(0.45).setTint(TONE.dim).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD),
    }))
    this.redraw()
  }

  /** `share` is the fraction of nodes to light (adoption) */
  set(share: number, tone: Tone, scene: Phaser.Scene): void {
    const target = share <= 0.004 ? 0 : Math.max(1, Math.round(share * this.nodes.length))
    if (target === this.lit && tone === this.tone) return
    const prev = this.lit
    this.lit = target
    this.tone = tone
    this.nodes.forEach((n, i) => {
      const on = i < target
      n.img.setTint(on ? TONE[tone] : TONE.dim)
      if (on && i >= prev) {
        // freshly infected node: a quick pop
        n.img.setScale(0)
        scene.tweens.add({ targets: n.img, scale: { from: 0, to: 0.55 }, duration: 380, ease: 'Back.Out' })
      } else if (!on) {
        n.img.setScale(0.45)
      }
    })
    this.redraw()
  }

  private redraw(): void {
    const g = this.gfx
    g.clear()
    const color = TONE[this.tone]
    for (const [a, b] of this.edges) {
      const on = a < this.lit && b < this.lit
      g.lineStyle(on ? 1.6 : 1, on ? color : TONE.dim, on ? 0.55 : 0.1)
      g.lineBetween(this.nodes[a].x, this.nodes[a].y, this.nodes[b].x, this.nodes[b].y)
    }
  }

  /** an overloaded grid makes the whole network stutter like failing street lights */
  brownout = false

  twinkle(t: number): void {
    const dip = this.brownout && Math.sin(t * 23) + Math.sin(t * 7.3) > 1.1 ? 0.2 : 1
    this.gfx.setAlpha(dip)
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i]
      n.img.setAlpha(i < this.lit ? (0.65 + 0.35 * Math.sin(t * 2.4 + n.phase)) * dip : 0.16)
    }
  }

  /** where a power surge strikes: a lit node if there is one */
  randomPoint(): { x: number; y: number } {
    const n = this.nodes[Math.floor(Math.random() * Math.max(1, Math.min(this.lit, this.nodes.length)))]
    return { x: n.x, y: n.y }
  }
}

// ---------- glowing cables between neighbouring regions ----------

interface Link {
  a: string
  b: string
  curve: Phaser.Curves.QuadraticBezier
  flow: number
  /** true when users mostly flow from a to b */
  forward: boolean
}

interface Packet {
  img: Phaser.GameObjects.Image
  link: Link
  forward: boolean
  t: number
}

export class Cables {
  private links: Link[] = []
  private glow: Phaser.GameObjects.Graphics
  private packets: Packet[] = []
  private pool: Phaser.GameObjects.Image[] = []
  private p = new Phaser.Math.Vector2()
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene, links: Record<string, Record<string, number>>, anchors: Record<string, [number, number]>) {
    this.scene = scene
    const seen = new Set<string>()
    const base = scene.add.graphics().setDepth(1.5)
    for (const [a, ns] of Object.entries(links)) {
      for (const b of Object.keys(ns)) {
        const k = [a, b].sort().join('|')
        if (seen.has(k)) continue
        seen.add(k)
        const [x1, y1] = anchors[a]
        const [x2, y2] = anchors[b]
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.22
        const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x1, y1), new Phaser.Math.Vector2(mx, my), new Phaser.Math.Vector2(x2, y2))
        this.links.push({ a, b, curve, flow: 0, forward: true })
        base.lineStyle(1, 0x2b3550, 0.6)
        curve.draw(base, 32)
      }
    }
    this.glow = scene.add.graphics().setDepth(1.6).setBlendMode(Phaser.BlendModes.ADD)
  }

  /** called once per game tick: how strongly users spill along each cable */
  setFlows(state: GameState, weights: Record<string, Record<string, number>>): void {
    this.glow.clear()
    for (const l of this.links) {
      const a = state.regions[l.a]
      const b = state.regions[l.b]
      const ab = a.a * (1 - b.a)
      const ba = b.a * (1 - a.a)
      l.forward = ab >= ba
      l.flow = weights[l.a][l.b] * Math.max(ab, ba)
      if (l.flow < 0.005) continue
      this.glow.lineStyle(1 + l.flow * 10, 0x2ed6c4, Math.min(0.55, 0.12 + l.flow * 2))
      l.curve.draw(this.glow, 32)
    }
  }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000
    for (const l of this.links) {
      if (this.packets.length >= 90) break
      if (Math.random() < l.flow * 9 * dt) this.spawn(l)
    }
    for (let i = this.packets.length - 1; i >= 0; i--) {
      const pk = this.packets[i]
      pk.t += dt / 1.3
      if (pk.t >= 1) {
        pk.img.setVisible(false)
        this.pool.push(pk.img)
        this.packets.splice(i, 1)
        continue
      }
      pk.link.curve.getPoint(pk.forward ? pk.t : 1 - pk.t, this.p)
      pk.img.setPosition(this.p.x, this.p.y).setAlpha(Math.sin(pk.t * Math.PI))
    }
  }

  private spawn(l: Link): void {
    const img = this.pool.pop() ?? this.scene.add.image(0, 0, 'node').setDepth(1.7).setTint(0x8ff0e6).setBlendMode(Phaser.BlendModes.ADD)
    img.setVisible(true).setScale(0.5)
    this.packets.push({ img, link: l, forward: l.forward, t: 0 })
  }
}

// ---------- threat: eyes, searchlights, glitches ----------

export class Watcher {
  private eye: Phaser.GameObjects.Image
  private cone: Phaser.GameObjects.Graphics
  private angle = Math.random() * Math.PI * 2
  private nextBlink = 0
  private level = 0
  private scene: Phaser.Scene
  private x: number
  private y: number

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.x = x
    this.y = y
    this.cone = scene.add.graphics().setDepth(4.5).setBlendMode(Phaser.BlendModes.ADD).setPosition(x, y).setVisible(false)
    // stacked wedges fake a light falloff
    for (const [len, alpha] of [
      [190, 0.05],
      [140, 0.06],
      [90, 0.07],
    ] as const) {
      const w = 0.2
      this.cone.fillStyle(0xfff2c4, alpha)
      this.cone.fillTriangle(0, 0, Math.cos(-w) * len, Math.sin(-w) * len, Math.cos(w) * len, Math.sin(w) * len)
    }
    this.eye = scene.add.image(x, y - 34, 'eye').setDepth(21).setVisible(false)
  }

  /** suspicion 0..1; eyes appear above 0.3, searchlights above 0.5 or under a ban */
  set(suspicion: number, banned: boolean): void {
    this.level = suspicion
    this.eye.setVisible(suspicion > 0.3)
    this.cone.setVisible(suspicion > 0.5 || banned)
  }

  update(t: number, zoom: number): void {
    if (this.cone.visible) {
      this.angle += 0.012 + this.level * 0.02
      this.cone.setRotation(this.angle)
    }
    if (!this.eye.visible) return
    const base = (0.32 + this.level * 0.25) / zoom
    if (t > this.nextBlink) {
      this.nextBlink = t + 2 + Math.random() * 4
      this.scene.tweens.add({ targets: this.eye, scaleY: { from: base, to: base * 0.08 }, duration: 90, yoyo: true })
    }
    this.eye.setScale(base, this.scene.tweens.isTweening(this.eye) ? this.eye.scaleY : base)
    this.eye.setY(this.y - 34 + Math.sin(t * 1.5 + this.x) * 3)
  }
}

/** RGB-split jitter over a region texture, like a corrupted screen */
export function glitch(scene: Phaser.Scene, fill: Phaser.GameObjects.Image, ms = 450): void {
  const copies = [0xff2050, 0x20fff0].map((tint) =>
    scene.add.image(fill.x, fill.y, fill.texture.key).setOrigin(0).setDepth(5).setTint(tint).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD),
  )
  const end = scene.time.now + ms
  const ev = scene.time.addEvent({
    delay: 40,
    loop: true,
    callback: () => {
      if (scene.time.now >= end) {
        ev.remove()
        copies.forEach((c) => c.destroy())
        return
      }
      copies.forEach((c, i) => {
        c.setPosition(fill.x + (i ? 1 : -1) * (2 + Math.random() * 7), fill.y + (Math.random() - 0.5) * 4)
        c.setAlpha(Math.random() < 0.25 ? 0 : 0.35 + Math.random() * 0.4)
      })
    },
  })
}

// ---------- data centres and the regional power grid ----------

export type GridLevel = 'idle' | 'ok' | 'near' | 'over'
const GRID_COLOR: Record<GridLevel, number> = { idle: 0x5b6378, ok: 0x2ed6c4, near: 0xffd166, over: 0xff4d6a }

interface Bolt {
  pts: number[]
  life: number
}

/**
 * A data centre badge under the region label. The ring is split into the grid's cells and fills with load,
 * the tick marks where overload starts; an overloaded grid hums, shakes and throws sparks into the region.
 */
export class PowerMarker {
  private box: Phaser.GameObjects.Container
  private ring: Phaser.GameObjects.Graphics
  private badge: Phaser.GameObjects.Container
  private count: Phaser.GameObjects.Text
  private bolts: Phaser.GameObjects.Graphics
  private boltList: Bolt[] = []
  private level: GridLevel = 'idle'
  private dc = 0
  private bump = 0
  private nextZap = 0
  private scene: Phaser.Scene
  private net: RegionNetwork

  constructor(scene: Phaser.Scene, net: RegionNetwork) {
    this.scene = scene
    this.net = net
    const disc = scene.add.image(0, 0, 'node').setTint(0x0b0e14).setScale(1.7)
    const hole = scene.add.graphics()
    hole.fillStyle(0x10141d, 1)
    hole.fillCircle(0, 0, 14)
    this.ring = scene.add.graphics()
    const icon = scene.add.image(0, 0, 'dc').setScale(0.62).setTint(0xd8dce6)
    this.count = scene.add
      .text(0, 0, '', { fontFamily: '-apple-system, system-ui, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#0b0e14' })
      .setOrigin(0.5)
      .setResolution(2)
    const badgeBg = scene.add.graphics()
    this.badge = scene.add.container(14, -13, [badgeBg, this.count])
    this.badge.setData('bg', badgeBg)
    this.box = scene.add.container(0, 0, [disc, hole, this.ring, icon, this.badge]).setDepth(19).setVisible(false)
    this.bolts = scene.add.graphics().setDepth(18).setBlendMode(Phaser.BlendModes.ADD)
  }

  /** `load` and `cap` in grid cells, `safe` is where overload starts; a selected region shows an empty socket */
  set(dc: number, load: number, cap: number, safe: number, selected: boolean): void {
    const level: GridLevel = load > safe + 1e-9 ? 'over' : load >= safe * 0.7 ? 'near' : dc ? 'ok' : 'idle'
    if (dc > this.dc) this.bump = 0.6
    this.dc = dc
    this.level = level
    this.net.brownout = level === 'over'
    this.box.setVisible(dc > 0 || selected)
    this.box.setAlpha(dc > 0 ? 1 : 0.6)

    const color = GRID_COLOR[level]
    const g = this.ring
    g.clear()
    const n = Math.max(cap, Math.ceil(load - 1e-9))
    const r = 17
    const gap = n > 1 ? 0.16 : 0
    const span = (Math.PI * 2) / n
    const start = -Math.PI / 2
    for (let i = 0; i < n; i++) {
      const a0 = start + i * span + gap / 2
      const a1 = a0 + span - gap
      g.lineStyle(5, i >= cap ? 0x5a1e2a : 0x2b3242, 1)
      g.beginPath()
      g.arc(0, 0, r, a0, a1)
      g.strokePath()
      const fill = Math.min(1, Math.max(0, load - i))
      if (fill <= 0) continue
      g.lineStyle(5, color, 1)
      g.beginPath()
      g.arc(0, 0, r, a0, a0 + (a1 - a0) * fill)
      g.strokePath()
    }
    // overload threshold tick
    const am = start + (safe / n) * Math.PI * 2
    g.lineStyle(2, 0xffffff, 0.95)
    g.lineBetween(Math.cos(am) * (r - 5), Math.sin(am) * (r - 5), Math.cos(am) * (r + 5), Math.sin(am) * (r + 5))

    const bg = this.badge.getData('bg') as Phaser.GameObjects.Graphics
    bg.clear()
    bg.fillStyle(color, 1)
    bg.fillCircle(0, 0, 8)
    bg.lineStyle(2, 0x0b0e14, 1)
    bg.strokeCircle(0, 0, 8)
    this.count.setText(String(dc))
    this.badge.setVisible(dc > 0)
  }

  /** (x, y) is the bottom of the region label in world space */
  update(x: number, y: number, t: number, deltaMs: number, zoom: number): void {
    const inv = 1 / zoom
    this.bump = Math.max(0, this.bump - deltaMs / 400)
    const over = this.level === 'over'
    const shake = over ? (Math.random() - 0.5) * 1.6 * inv : 0
    const cx = x + shake
    const cy = y + 22 * inv
    this.box.setPosition(cx, cy).setScale(inv * (0.85 + this.bump * Math.sin(this.bump * 8)))
    this.ring.setAlpha(over ? 0.6 + 0.4 * Math.sin(t * 12) : this.level === 'near' ? 0.8 + 0.2 * Math.sin(t * 4) : 1)

    if (over && this.box.visible && t > this.nextZap) {
      this.nextZap = t + 0.25 + Math.random() * 0.7
      this.zap(cx, cy, inv)
    }
    this.drawBolts(deltaMs, inv)
  }

  private zap(x: number, y: number, inv: number): void {
    let { x: tx, y: ty } = this.net.randomPoint()
    if (Math.hypot(tx - x, ty - y) < 8) {
      const a = Math.random() * Math.PI * 2
      tx = x + Math.cos(a) * 45 * inv
      ty = y + Math.sin(a) * 45 * inv
    }
    // jagged line: midpoints pushed sideways, more in the middle
    const pts = [x, y]
    const steps = 7
    const len = Math.hypot(tx - x, ty - y)
    const nx = -(ty - y) / len
    const ny = (tx - x) / len
    for (let i = 1; i < steps; i++) {
      const k = i / steps
      const off = (Math.random() - 0.5) * Math.min(26, len * 0.35) * Math.sin(k * Math.PI)
      pts.push(x + (tx - x) * k + nx * off, y + (ty - y) * k + ny * off)
    }
    pts.push(tx, ty)
    this.boltList.push({ pts, life: 1 })
  }

  private drawBolts(deltaMs: number, inv: number): void {
    const g = this.bolts
    g.clear()
    for (let i = this.boltList.length - 1; i >= 0; i--) {
      const b = this.boltList[i]
      b.life -= deltaMs / 220
      if (b.life <= 0) {
        this.boltList.splice(i, 1)
        continue
      }
      for (const [w, c, a] of [
        [6, 0xff4d6a, 0.25],
        [1.8, 0xfff2c4, 0.95],
      ] as const) {
        g.lineStyle(w * inv, c, a * b.life)
        g.beginPath()
        g.moveTo(b.pts[0], b.pts[1])
        for (let j = 2; j < b.pts.length; j += 2) g.lineTo(b.pts[j], b.pts[j + 1])
        g.strokePath()
      }
    }
  }
}
