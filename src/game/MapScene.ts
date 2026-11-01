import Phaser from 'phaser'
import mapJson from '../../data/map.json' with { type: 'json' }
import type { Derived } from '../core/derive.ts'
import type { GameData, GameEvent, GameState } from '../core/types.ts'
import { pct } from './panels.ts'
import { regionNames } from './text.ts'

interface MapData {
  width: number
  height: number
  anchors: Record<string, [number, number]>
  countries: { id: string; region: string; polys: number[][] }[]
}
const MAP = mapJson as unknown as MapData

/** what the scene needs from the game controller */
export interface SceneHost {
  frame(deltaMs: number): void
  select(region: string): void
  popBubble(id: number): void
}

interface RegionView {
  id: string
  fill: Phaser.GameObjects.Image
  heat: Phaser.GameObjects.Image
  lockLine: Phaser.GameObjects.Graphics
  selLine: Phaser.GameObjects.Graphics
  label: Phaser.GameObjects.Text
  polys: Phaser.Geom.Polygon[]
  bounds: Phaser.Geom.Rectangle
  color: Rgb
  target: Rgb
  heatTarget: number
  flash: number
}

type Rgb = [number, number, number]
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const hex = ([r, g, b]: Rgb) => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)

const COLORS = {
  ocean: 0x0b0e14,
  land: [43, 50, 66] as Rgb,
  closed: [26, 29, 38] as Rgb,
  adopted: [46, 214, 196] as Rgb,
  danger: [214, 48, 72] as Rgb,
  heat: 0xff3b5c,
  lock: 0xffd166,
  select: 0xffffff,
  border: 0x0b0e14,
}

// small neighbours in Europe and Asia would stack their labels on top of each other
const LABEL_OFFSET: Record<string, [number, number]> = {
  uk: [-55, -10],
  western_europe: [-45, 40],
  eastern_europe: [10, 38],
  northern_europe: [0, -30],
  india: [-25, 30],
  southeast_asia: [45, 40],
  latin_america: [-55, 60],
  brazil: [40, -10],
  middle_east: [-15, 10],
  central_asia: [45, -5],
  north_africa: [-30, 25],
}

// HUD covers the right panel and the top bar; the map is centred in what is left
const HUD = { right: 380, top: 56 }

export class MapScene extends Phaser.Scene {
  private host: SceneHost
  private data_!: GameData
  private regions = new Map<string, RegionView>()
  private bubbles = new Map<number, Phaser.GameObjects.Container>()
  private popped = new Set<number>()
  private bursts: Record<string, Phaser.GameObjects.Particles.ParticleEmitter> = {}
  private state: GameState | null = null
  private fitZoom = 1
  private dragged = false

  constructor(host: SceneHost, data: GameData) {
    super('map')
    this.host = host
    this.data_ = data
  }

  create(): void {
    this.makeTextures()
    this.drawBackground()
    this.drawRegions()
    for (const [key, tint] of Object.entries({ gold: COLORS.lock, red: COLORS.heat, cyan: 0x2ed6c4, purple: 0xb06cff })) {
      this.bursts[key] = this.add
        .particles(0, 0, 'spark', {
          speed: { min: 40, max: 200 },
          lifespan: { min: 400, max: 900 },
          scale: { start: 0.9, end: 0 },
          alpha: { start: 1, end: 0 },
          tint,
          blendMode: 'ADD',
          emitting: false,
        })
        .setDepth(50)
    }
    this.setupCamera()
  }

  // ---------- setup ----------

  private makeTextures(): void {
    const g = this.make.graphics({}, false)
    g.fillStyle(0xffffff)
    g.fillCircle(8, 8, 8)
    g.generateTexture('spark', 16, 16)
    g.clear()
    g.fillStyle(0xffffff)
    g.fillCircle(32, 32, 30)
    g.lineStyle(4, 0x000000, 0.35)
    g.strokeCircle(32, 32, 26)
    g.generateTexture('bubble', 64, 64)
    g.destroy()
  }

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(-10)
    g.fillStyle(COLORS.ocean)
    g.fillRect(-2000, -2000, MAP.width + 4000, MAP.height + 4000)
    // faint dot grid: reads as "a screen", not "an atlas"
    g.fillStyle(0x1c2230, 1)
    for (let x = 0; x <= MAP.width; x += 25) for (let y = 0; y <= MAP.height; y += 25) g.fillRect(x, y, 2, 2)
  }

  private drawRegions(): void {
    const byRegion = new Map<string, number[][]>()
    for (const c of MAP.countries) {
      const list = byRegion.get(c.region) ?? []
      list.push(...c.polys)
      byRegion.set(c.region, list)
    }

    for (const r of this.data_.regions) {
      const rings = byRegion.get(r.id) ?? []
      const polys = rings.map((ring) => new Phaser.Geom.Polygon(ring))
      let bounds = Phaser.Geom.Polygon.GetAABB(polys[0])
      for (const p of polys.slice(1)) bounds = Phaser.Geom.Rectangle.Union(bounds, Phaser.Geom.Polygon.GetAABB(p))
      const pad = 2
      const key = `region-${r.id}`
      const g = this.make.graphics({}, false)
      g.fillStyle(0xffffff)
      for (const ring of rings) g.fillPoints(toPoints(ring, bounds.x - pad, bounds.y - pad), true)
      g.generateTexture(key, Math.ceil(bounds.width) + pad * 2, Math.ceil(bounds.height) + pad * 2)
      g.destroy()

      const fill = this.add.image(bounds.x - pad, bounds.y - pad, key).setOrigin(0).setDepth(0)
      const heat = this.add
        .image(bounds.x - pad, bounds.y - pad, key)
        .setOrigin(0)
        .setDepth(1)
        .setTint(COLORS.heat)
        .setAlpha(0)
      const lockLine = this.outline(rings, COLORS.lock, 3).setDepth(3).setVisible(false)
      const selLine = this.outline(rings, COLORS.select, 2).setDepth(4).setVisible(false)

      fill.setInteractive({ pixelPerfect: true, useHandCursor: true })
      fill.on('pointerup', () => {
        if (!this.dragged) this.host.select(r.id)
      })
      fill.on('pointerover', () => this.regions.get(r.id)!.label.setAlpha(1))
      fill.on('pointerout', () => this.regions.get(r.id)!.label.setAlpha(0.85))

      const [ax0, ay0] = MAP.anchors[r.id]
      const [ox, oy] = LABEL_OFFSET[r.id] ?? [0, 0]
      const [ax, ay] = [ax0 + ox, ay0 + oy]
      const label = this.add
        .text(ax, ay, regionNames[r.id] ?? r.name, {
          fontFamily: '-apple-system, system-ui, sans-serif',
          fontSize: '13px',
          color: '#e8ecf4',
          align: 'center',
          stroke: '#0b0e14',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(20)
        .setAlpha(0.85)
        .setResolution(Math.max(2, window.devicePixelRatio))

      this.regions.set(r.id, {
        id: r.id,
        fill,
        heat,
        lockLine,
        selLine,
        label,
        polys,
        bounds,
        color: COLORS.land,
        target: COLORS.land,
        heatTarget: 0,
        flash: 0,
      })
    }

    // country borders on top of the fills
    const borders = this.add.graphics().setDepth(2)
    borders.lineStyle(1, COLORS.border, 0.9)
    for (const c of MAP.countries) for (const ring of c.polys) borders.strokePoints(toPoints(ring), true)
  }

  private outline(rings: number[][], color: number, width: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics()
    g.lineStyle(width, color, 1)
    for (const ring of rings) g.strokePoints(toPoints(ring), true)
    return g
  }

  private setupCamera(): void {
    const cam = this.cameras.main
    const fit = () => {
      const w = this.scale.width
      const h = this.scale.height
      const right = w > 900 ? HUD.right : 0
      this.fitZoom = Math.min((w - right) / MAP.width, (h - HUD.top) / MAP.height) * 0.96
      cam.setZoom(this.fitZoom)
      cam.centerOn(MAP.width / 2 + right / 2 / this.fitZoom, MAP.height / 2 - HUD.top / 2 / this.fitZoom)
    }
    fit()
    this.scale.on('resize', fit)

    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const z0 = cam.zoom
      const z1 = Phaser.Math.Clamp(z0 * (dy > 0 ? 0.88 : 1.14), this.fitZoom, this.fitZoom * 5)
      // keep the world point under the cursor fixed (camera zooms around its centre)
      const wx = cam.scrollX + cam.width / 2 + (p.x - cam.width / 2) / z0
      const wy = cam.scrollY + cam.height / 2 + (p.y - cam.height / 2) / z0
      cam.setZoom(z1)
      cam.scrollX = wx - cam.width / 2 - (p.x - cam.width / 2) / z1
      cam.scrollY = wy - cam.height / 2 - (p.y - cam.height / 2) / z1
    })
    this.input.on('pointerdown', () => {
      this.dragged = false
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return
      if (p.getDistance() > 6) this.dragged = true
      if (!this.dragged) return
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom
    })
  }

  // ---------- per frame ----------

  update(_time: number, delta: number): void {
    this.host.frame(delta)
    const k = Math.min(1, delta / 120)
    const t = this.time.now / 1000
    const inv = 1 / this.cameras.main.zoom
    for (const v of this.regions.values()) {
      v.color = mix(v.color, v.target, k)
      v.fill.setTint(hex(v.color))
      const banned = this.state?.regions[v.id].banned
      const pulse = banned ? 0.2 + 0.15 * Math.sin(t * 4) : 0
      v.flash = Math.max(0, v.flash - delta / 600)
      v.heat.setAlpha(Math.min(1, v.heatTarget + pulse + v.flash))
      v.label.setScale(inv)
    }
    for (const b of this.bubbles.values()) b.setScale(inv * (b.getData('base') as number))
  }

  // ---------- sync with the game state ----------

  setState(state: GameState, dv: Derived, selected: string | null): void {
    this.state = state
    for (const r of this.data_.regions) {
      const v = this.regions.get(r.id)!
      const rs = state.regions[r.id]
      const closed = !dv.unlocked.has(r.archetype)
      const base = closed ? COLORS.closed : COLORS.land
      // gamma lifts early growth so the first percent of users is already visible
      const a = Math.pow(rs.a, 0.6)
      // suspicion pulls the colour itself towards red; additive glow washed bright regions out to white
      v.target = mix(mix(base, COLORS.adopted, a), COLORS.danger, Math.min(1, rs.s * 0.8) * Math.max(a, 0.3))
      v.heatTarget = 0
      v.lockLine.setVisible(rs.locked)
      v.selLine.setVisible(selected === r.id)

      const marks = [rs.locked ? '🔒' : '', rs.banned ? '⛔' : '', rs.dc ? `▣${rs.dc}` : ''].filter(Boolean).join(' ')
      const stats = closed ? 'закрыто' : rs.a > 0.005 ? pct(rs.a) : ''
      v.label.setText([regionNames[r.id] ?? r.name, [stats, marks].filter(Boolean).join('  ')].filter(Boolean).join('\n'))
      v.label.setColor(closed ? '#5b6378' : rs.locked ? '#ffd166' : '#e8ecf4')
    }
    this.syncBubbles(state)
  }

  private syncBubbles(state: GameState): void {
    const alive = new Set(state.bubbles.map((b) => b.id))
    for (const [id, c] of this.bubbles) {
      if (alive.has(id)) continue
      this.bubbles.delete(id)
      if (this.popped.delete(id)) {
        c.destroy()
        continue
      }
      this.tweens.add({ targets: c, alpha: 0, duration: 300, onComplete: () => c.destroy() })
    }
    for (const b of state.bubbles) {
      if (this.bubbles.has(b.id)) continue
      const v = this.regions.get(b.region)!
      const [x, y] = this.randomPointIn(v)
      const circle = this.add.image(0, 0, 'bubble').setTint(b.poisoned ? 0xb06cff : 0xffd166)
      const text = this.add
        .text(0, 1, b.poisoned ? '☣' : `+${Math.round(b.value)}`, {
          fontFamily: '-apple-system, system-ui, sans-serif',
          fontSize: '22px',
          fontStyle: 'bold',
          color: '#0b0e14',
        })
        .setOrigin(0.5)
        .setResolution(2)
      const c = this.add.container(x, y, [circle, text]).setDepth(30)
      c.setData('base', 0.45)
      c.setData('poisoned', b.poisoned)
      c.setSize(64, 64)
      // container hit areas are in local space with the origin at the top-left corner of setSize, not at the centre
      c.setInteractive(new Phaser.Geom.Circle(32, 32, 36), Phaser.Geom.Circle.Contains)
      c.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation()
        this.popped.add(b.id)
        this.bursts[b.poisoned ? 'purple' : 'gold'].explode(18, c.x, c.y)
        this.floatText(c.x, c.y, b.poisoned ? `+${Math.round(b.value)} ☣` : `+${Math.round(b.value)}`, b.poisoned ? '#b06cff' : '#ffd166')
        c.disableInteractive()
        this.tweens.add({ targets: c, alpha: 0, duration: 120 })
        this.host.popBubble(b.id)
      })
      // appear with a bounce, then bob gently
      const base = c.getData('base') as number
      c.setData('base', 0)
      this.tweens.addCounter({
        from: 0,
        to: base,
        duration: 350,
        ease: 'Back.Out',
        onUpdate: (tw) => c.setData('base', tw.getValue()),
      })
      this.tweens.add({ targets: c, y: y - 6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
      this.bubbles.set(b.id, c)
    }
  }

  private randomPointIn(v: RegionView): [number, number] {
    for (let i = 0; i < 40; i++) {
      const x = v.bounds.x + Math.random() * v.bounds.width
      const y = v.bounds.y + Math.random() * v.bounds.height
      if (v.polys.some((p) => p.contains(x, y))) return [x, y]
    }
    return MAP.anchors[v.id]
  }

  /** screen positions of live bubbles; used by the demo recorder (dev only) */
  bubbleScreenPositions(): { id: number; x: number; y: number; poisoned: boolean }[] {
    const cam = this.cameras.main
    return [...this.bubbles.entries()]
      .filter(([id]) => !this.popped.has(id))
      .map(([id, c]) => ({
        id,
        x: (c.x - cam.scrollX - cam.width / 2) * cam.zoom + cam.width / 2,
        y: (c.y - cam.scrollY - cam.height / 2) * cam.zoom + cam.height / 2,
        poisoned: c.getData('poisoned') === true,
      }))
  }

  /** a dot flying along a neighbour link shows where users are spreading */
  spreadDots(state: GameState): void {
    let budget = 3
    for (const [from, ns] of Object.entries(this.data_.links)) {
      for (const [to, w] of Object.entries(ns)) {
        const a = state.regions[from].a
        const b = state.regions[to]
        if (a < 0.03 || b.a > 0.95 || b.banned) continue
        if (Math.random() > w * a * (1 - b.a) * 0.6) continue
        this.flyDot(MAP.anchors[from], MAP.anchors[to])
        if (--budget === 0) return
      }
    }
  }

  private flyDot([x1, y1]: [number, number], [x2, y2]: [number, number]): void {
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.25
    const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x1, y1), new Phaser.Math.Vector2(mx, my), new Phaser.Math.Vector2(x2, y2))
    const dot = this.add.image(x1, y1, 'spark').setTint(0x2ed6c4).setBlendMode(Phaser.BlendModes.ADD).setDepth(10).setScale(0.5)
    const p = new Phaser.Math.Vector2()
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1600,
      ease: 'Sine.InOut',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0
        curve.getPoint(t, p)
        dot.setPosition(p.x, p.y).setAlpha(Math.sin(t * Math.PI))
      },
      onComplete: () => dot.destroy(),
    })
  }

  // ---------- effects ----------

  fx(events: GameEvent[]): void {
    const cam = this.cameras.main
    for (const e of events) {
      switch (e.type) {
        case 'ban':
          this.flashRegion(e.region, 0.9)
          this.burstAt(e.region, 'red', 24)
          cam.shake(150, 0.002)
          break
        case 'unban':
          this.burstAt(e.region, 'cyan', 16)
          break
        case 'lock':
          this.burstAt(e.region, 'gold', 40)
          this.tweens.add({ targets: this.regions.get(e.region)!.lockLine, alpha: { from: 0, to: 1 }, duration: 250, repeat: 2 })
          break
        case 'funding_round':
          cam.flash(250, 80, 66, 20)
          break
        case 'audit_warning':
          cam.flash(300, 90, 20, 30)
          break
        case 'audit':
          if (!e.passed) {
            cam.shake(350, 0.006)
            cam.flash(300, 140, 20, 40)
          }
          break
        case 'rebrand':
          for (const id of this.regions.keys()) if ((this.state?.regions[id].a ?? 0) > 0.02) this.burstAt(id, 'cyan', 6)
          break
        case 'rebrand_exposed':
          cam.flash(300, 140, 20, 40)
          break
        case 'shutdown_started':
          cam.shake(700, 0.012)
          cam.flash(500, 180, 0, 30)
          break
        case 'dc_shutdown':
          this.flashRegion(e.region, 1)
          this.burstAt(e.region, 'red', 36)
          cam.shake(200, 0.004)
          break
        default:
          break
      }
    }
  }

  burstAt(region: string, color: 'gold' | 'red' | 'cyan' | 'purple', n: number): void {
    const [x, y] = MAP.anchors[region]
    this.bursts[color].explode(n, x, y)
  }

  private flashRegion(region: string, amount: number): void {
    this.regions.get(region)!.flash = amount
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const inv = 1 / this.cameras.main.zoom
    const t = this.add
      .text(x, y, text, { fontFamily: '-apple-system, system-ui, sans-serif', fontSize: '16px', fontStyle: 'bold', color, stroke: '#0b0e14', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(60)
      .setScale(inv)
      .setResolution(2)
    this.tweens.add({ targets: t, y: y - 40 * inv, alpha: 0, duration: 900, ease: 'Cubic.Out', onComplete: () => t.destroy() })
  }
}

function toPoints(ring: number[], dx = 0, dy = 0): Phaser.Math.Vector2[] {
  const pts: Phaser.Math.Vector2[] = []
  for (let i = 0; i < ring.length; i += 2) pts.push(new Phaser.Math.Vector2(ring[i] - dx, ring[i + 1] - dy))
  return pts
}
