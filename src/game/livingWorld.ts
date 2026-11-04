import Phaser from 'phaser'
import type { Derived } from '../core/derive.ts'
import type { GameData, GameState } from '../core/types.ts'

type Kind = 'chat' | 'companion' | 'office' | 'home' | 'school' | 'clinic' | 'taxi' | 'terminal' | 'factory' | 'lab' | 'replica' | 'media'
interface Site {
  id: string
  kind: Kind
  box: Phaser.GameObjects.Container
  base: Phaser.GameObjects.Image
  activity: Phaser.GameObjects.Graphics
  vehicle: Phaser.GameObjects.Image
  phase: number
  working: boolean
  size: number
}
interface RegionLife {
  id: string
  label: Phaser.GameObjects.Text
  sites: Site[]
  points: { x: number; y: number; size: number }[]
  blocked: boolean
}

const PRODUCT: Record<string, Kind> = {
  chatbot: 'chat', api: 'office', enterprise_agent: 'office', companion: 'companion', gov_contracts: 'office',
  voice_assistant: 'home', tutor: 'school', browser: 'media', smart_home: 'home', medical: 'clinic', robotaxi: 'taxi',
}
const CAPABILITY: Record<string, Kind> = {
  code: 'terminal', persuasion: 'media', finance: 'office', self_copy: 'replica', multimodal: 'media',
  memory: 'replica', deepfakes: 'media', robotics: 'factory', science: 'lab',
}
const C = { ground: '#17222e', edge: '#345065', front: '#273b50', side: '#1c2c3e', roof: '#466078', light: '#83dfda', cyan: '#2ed6c4', gold: '#ffd166', pink: '#ef93bb', dim: '#6c8ca2', dark: '#0b1522' }
const tint: Record<Kind, string> = { chat: C.cyan, companion: C.pink, office: '#8fb7ec', home: C.gold, school: '#9bc99f', clinic: '#89dfd3', taxi: C.gold, terminal: C.cyan, factory: '#e6b384', lab: '#a7b6fa', replica: '#b8a2ec', media: '#e8a5ce' }

/** Cosmetic districts: no per-product regional adoption is added to the simulation. */
export class LivingWorld {
  private scene: Phaser.Scene
  private regions: RegionLife[] = []
  private elapsed = 0
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.makeTextures()
  }

  addRegion(id: string, polygons: Phaser.Geom.Polygon[], anchor: [number, number], label: Phaser.GameObjects.Text): void {
    const points: { x: number; y: number; size: number }[] = []
    const bounds = polygons.map((p) => Phaser.Geom.Polygon.GetAABB(p))
    // Stable placement, independent of the simulation's random stream.
    let seed = [...id].reduce((v, c) => (Math.imul(v, 31) + c.charCodeAt(0)) >>> 0, 7)
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 }
    const score = (r: Phaser.Geom.Rectangle) => r.width * r.height / (1 + Math.hypot(r.centerX - anchor[0], r.centerY - anchor[1]) / 120) ** 2
    const largest = [...bounds].sort((a, b) => score(b) - score(a))[0]
    const land = polygons[bounds.indexOf(largest)]
    for (let i = 0; i < 2200 && points.length < 3; i++) {
      const x = largest.x + random() * largest.width
      const y = largest.y + random() * largest.height
      if (!land.contains(x, y)) continue
      const compact = i >= 500
      const size = i >= 1600 ? 0.2 : i >= 800 ? 0.3 : compact ? 0.55 : 1
      if (compact && points.length) break
      // Include the roof, activity and platform, not just the ground anchor.
      if (![-38, 0, 38].every((dx) => [-61, -25, 10].every((dy) => land.contains(x + dx * size, y + dy * size)))) continue
      if (!compact && Math.hypot(x - anchor[0], y - anchor[1]) < 43) continue
      if (points.some((p) => Phaser.Math.Distance.Between(x, y, p.x, p.y) < 62)) continue
      points.push({ x, y, size })
    }
    this.regions.push({ id, label, points, sites: [], blocked: false })
  }

  setState(state: GameState, dv: Derived, data: GameData): void {
    const purchases = state.upgrades.filter((id) => PRODUCT[id] || CAPABILITY[id])
    const products = purchases.filter((id) => PRODUCT[id])
    const caps = purchases.filter((id) => CAPABILITY[id])
    for (const [index, region] of this.regions.entries()) {
      const rs = state.regions[region.id]
      region.blocked = rs.banned || !dv.unlocked.has(data.regions.find((r) => r.id === region.id)!.archetype)
      const count = rs.a < 0.004 ? 0 : rs.a < 0.45 ? 2 : 3
      // Rotate the purchased repertoire across regions; keep room for the latest purchase.
      const choices = [products.length ? products[(products.length - 1 - index % products.length)] : undefined, caps.length ? caps[(caps.length - 1 - index % caps.length)] : undefined, purchases.at(-1)]
        .filter((id, i, ids): id is string => !!id && ids.indexOf(id) === i)
      if (region.points.length === 1 && purchases.length) choices[0] = purchases.at(-1)!
      for (let slot = 0; slot < region.points.length; slot++) {
        const id = slot < count ? choices[slot] : undefined
        let site = region.sites[slot]
        if (!id) { if (site) site.box.setVisible(false); continue }
        const kind = PRODUCT[id] ?? CAPABILITY[id]
        if (!site) {
          const p = region.points[slot]
          const base = this.scene.add.image(0, 0, `life-${kind}`).setOrigin(0.5, 0.78).setScale(0.5)
          const activity = this.scene.add.graphics()
          const vehicle = this.scene.add.image(0, 0, 'life-car').setScale(0.5).setVisible(false)
          const box = this.scene.add.container(p.x, p.y, [base, activity, vehicle]).setDepth(3.1)
          site = { id, kind, box, base, activity, vehicle, phase: index * 1.7 + slot * 2.3, working: true, size: p.size }
          region.sites[slot] = site
        }
        site.id = id
        site.kind = kind
        site.base.setTexture(`life-${kind}`)
        site.working = !CAPABILITY[id] || dv.activeCaps.includes(id)
        site.base.setTint(site.working ? 0xffffff : 0x657184)
        site.box.setVisible(!region.blocked)
      }
    }
  }

  update(delta: number, zoom: number): void {
    if (!this.reducedMotion) this.elapsed += Math.min(delta, 100) / 1000
    for (const region of this.regions) for (const site of region.sites) {
      const g = site.activity
      g.clear()
      if (!site.box.visible) continue
      // World overview stays quiet; zoom reveals the machinery instead of enlarging HUD icons.
      const scale = site.size * Phaser.Math.Clamp(0.7 / Math.sqrt(zoom), 0.45, 1)
      site.box.setScale(scale)
      const half = 38 * scale * zoom
      const label = region.label.getBounds()
      const labelX = label.centerX, labelY = label.centerY
      const overlap = Math.abs(site.box.x - labelX) * zoom < half + label.width * zoom / 2 + 5 && Math.abs(site.box.y - labelY) * zoom < 32 * scale * zoom + label.height * zoom / 2 + 10
      const hidden = region.blocked || zoom < 0.28
      site.box.setAlpha(hidden ? 0 : overlap ? 0.2 : site.working ? 0.9 : 0.4)
      if (hidden) continue
      const t = site.working ? this.elapsed + site.phase : site.phase
      const pulse = 0.65 + Math.sin(t * 2) * 0.25
      site.vehicle.setVisible(site.kind === 'taxi' && site.working)
      if (!site.working) continue
      const accent = Phaser.Display.Color.HexStringToColor(tint[site.kind]).color
      if (site.kind === 'taxi') {
        const a = t * 0.65
        site.vehicle.setPosition(Math.cos(a) * 26, Math.sin(a) * 9 - 2).setFlipX(Math.sin(a) > 0)
        g.lineStyle(1, accent, 0.3)
        g.strokeEllipse(0, -2, 54, 20)
      } else if (site.kind === 'factory') {
        const elbowX = 9 + Math.sin(t * 1.5) * 6, elbowY = -40 + Math.cos(t * 1.5) * 5
        g.lineStyle(4, 0xd29d70, 1)
        g.lineBetween(22, -20, elbowX, elbowY)
        g.lineBetween(elbowX, elbowY, -9 + Math.sin(t) * 7, -25)
        g.fillStyle(0xffdfac).fillCircle(elbowX, elbowY, 3)
        g.lineStyle(1, 0xffe8c5).strokeCircle(elbowX, elbowY, 3)
        const x = ((t * 10) % 28) - 19
        g.fillStyle(0x5c8095).fillRect(x, -6, 6, 4)
      } else if (site.kind === 'chat' || site.kind === 'companion') {
        const y = -47 - Math.sin(t * 1.5) * 3
        g.fillStyle(accent, 0.95).fillRoundedRect(3, y, 19, 12, 4)
        g.fillTriangle(7, y + 10, 7, y + 15, 12, y + 10)
        if (site.kind === 'companion') {
          g.fillStyle(0x38263d).fillCircle(10, y + 4, 2).fillCircle(14, y + 4, 2).fillTriangle(8, y + 4, 16, y + 4, 12, y + 9)
        } else {
          g.fillStyle(0x17372f)
          for (let i = 0; i < 3; i++) g.fillCircle(8 + i * 5, y + 6, 1 + 0.4 * Math.sin(t * 3 + i))
        }
      } else if (site.kind === 'terminal' || site.kind === 'media') {
        g.fillStyle(accent, pulse)
        for (let i = 0; i < 4; i++) {
          const w = 3 + ((i * 5 + Math.floor(t * 2)) % 10)
          g.fillRect(-13, -36 + i * 4, w, 1)
          g.fillRect(-9 + w, -36 + i * 4, 4, 1)
        }
        g.fillStyle(accent, 0.5).fillCircle(-5, -5, 2 + pulse)
      } else if (site.kind === 'lab') {
        const angle = Math.sin(t * 0.5) * 0.7
        g.lineStyle(1, accent, 0.35)
        g.lineBetween(9, -38, 9 + Math.sin(angle) * 17, -61)
        g.fillStyle(accent, pulse).fillCircle(-16, -28, 2)
        g.fillStyle(0xecdc9e, pulse).fillCircle(-8, -25, 1.5)
      } else if (site.kind === 'replica') {
        for (let i = 0; i < 3; i++) {
          g.fillStyle(accent, 0.25 + (Math.sin(t * 2 - i) + 1) * 0.3)
          g.fillRect(-20 + i * 15, -24 - (i % 2) * 10, 7, 1.5)
        }
        g.lineStyle(1, accent, 0.3)
        g.lineBetween(-18, -7, 0, -11).lineBetween(0, -11, 17, -5)
      } else {
        g.fillStyle(accent, pulse)
        g.fillRect(-12, -27, 3, 4).fillRect(-5, -27, 3, 4)
        if (site.kind === 'home') g.fillCircle(10, -34, 2)
      }
    }
  }

  private makeTextures(): void {
    const poly = (c: CanvasRenderingContext2D, points: number[], fill: string) => {
      c.fillStyle = fill; c.beginPath(); c.moveTo(points[0], points[1])
      for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1])
      c.closePath(); c.fill()
    }
    const rect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = color; c.fillRect(x, y, w, h) }
    const dot = (c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) => { c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill() }
    const building = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, roof = C.roof) => {
      poly(c, [x, y, x + w, y + 5, x + w, y + h, x, y + h - 5], C.front)
      poly(c, [x + w, y + 5, x + w + 9, y, x + w + 9, y + h - 5, x + w, y + h], C.side)
      poly(c, [x, y, x + 9, y - 5, x + w + 9, y, x + w, y + 5], roof)
      for (let row = 10; row < h - 4; row += 8) for (let col = 4; col < w - 2; col += 7) rect(c, x + col, y + row, 3, 4, (row + col) % 3 ? C.light : C.dim)
      rect(c, x + w - 7, y + h - 10, 4, 8, C.dark)
    }
    for (const kind of Object.keys(tint) as Kind[]) {
      const key = `life-${kind}`
      if (this.scene.textures.exists(key)) continue
      const texture = this.scene.textures.createCanvas(key, 160, 144)!
      const c = texture.getContext()
      c.scale(2, 2)
      const accent = tint[kind]
      c.fillStyle = '#050b14aa'; c.beginPath(); c.ellipse(40, 60, 36, 10, 0, 0, Math.PI * 2); c.fill()
      poly(c, [4, 52, 40, 37, 77, 52, 40, 69], C.edge)
      poly(c, [4, 49, 40, 34, 77, 49, 40, 65], C.ground)
      poly(c, [10, 50, 38, 39, 69, 51, 40, 61], '#263447')
      if (kind === 'terminal' || kind === 'media') {
        building(c, 20, 25, 32, 27)
        rect(c, 16, 13, 42, 30, C.dark); rect(c, 18, 15, 38, 24, '#193441')
        rect(c, 19, 16, 36, 2, accent); rect(c, 21, 21, 4, 2, accent)
        rect(c, 22, 26, 17, 1, C.dim); rect(c, 22, 31, 25, 1, C.dim)
        rect(c, 34, 43, 6, 6, C.roof); poly(c, [25, 50, 39, 46, 51, 50, 36, 55], '#7c98a8')
        dot(c, 59, 35, 2, accent)
      } else if (kind === 'factory') {
        building(c, 15, 32, 37, 20, '#6b737b')
        poly(c, [15, 30, 22, 23, 29, 30, 36, 23, 43, 30, 52, 27, 61, 33, 52, 37], '#8a989a')
        rect(c, 50, 11, 7, 21, '#596777'); rect(c, 49, 10, 9, 3, accent)
        poly(c, [10, 51, 42, 39, 59, 46, 28, 59], C.dark)
        for (let i = 0; i < 6; i++) rect(c, 17 + i * 5, 50 - i * 2, 3, 4, C.dim)
        dot(c, 61, 42, 6, '#334757'); dot(c, 61, 42, 3, accent)
      } else if (kind === 'lab') {
        building(c, 15, 29, 27, 24, '#5d718d')
        c.fillStyle = '#90abc0'; c.beginPath(); c.arc(31, 29, 13, Math.PI, 0); c.fill()
        rect(c, 20, 29, 23, 3, accent)
        building(c, 49, 32, 8, 18)
        c.strokeStyle = '#afcad7'; c.lineWidth = 3; c.beginPath(); c.arc(49, 14, 10, 0.2, 2.6); c.stroke()
        rect(c, 46, 21, 3, 10, C.dim); dot(c, 54, 11, 2, accent)
      } else if (kind === 'replica') {
        for (const [x, y] of [[14, 33], [31, 22], [49, 35]]) {
          building(c, x, y, 10, 22, '#70658e')
          for (let i = 0; i < 3; i++) { rect(c, x + 2, y + 7 + i * 5, 7, 2, C.dark); dot(c, x + 3, y + 8 + i * 5, 0.8, accent) }
        }
      } else if (kind === 'home' || kind === 'companion') {
        building(c, 16, 34, 19, 19, '#857275')
        poly(c, [12, 34, 27, 19, 45, 30, 36, 40], kind === 'companion' ? '#b47490' : '#ac8b60')
        building(c, 44, 39, 13, 15)
        poly(c, [41, 39, 51, 29, 67, 37, 57, 44], '#667e91')
        rect(c, 24, 45, 5, 9, accent)
        dot(c, 62, 50, 4, '#477365'); rect(c, 61, 52, 2, 6, '#49605a')
        if (kind === 'home') { c.strokeStyle = accent; c.lineWidth = 1.4; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(52, 27, 3 + i * 4, 3.5, 5.9); c.stroke() } }
      } else if (kind === 'taxi') {
        poly(c, [9, 48, 40, 34, 71, 46, 40, 61], '#414b58')
        c.strokeStyle = '#d1b56c'; c.lineWidth = 1; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(14, 48); c.lineTo(40, 38); c.lineTo(65, 47); c.lineTo(40, 57); c.closePath(); c.stroke(); c.setLineDash([])
        building(c, 32, 25, 13, 17, '#687a86')
        rect(c, 16, 29, 4, 14, C.dim); rect(c, 12, 24, 13, 8, accent); rect(c, 15, 26, 7, 3, C.dark)
        rect(c, 53, 37, 3, 12, accent); rect(c, 51, 35, 7, 8, C.dark); rect(c, 53, 37, 3, 3, C.light)
      } else {
        const h = kind === 'office' ? 37 : 22
        building(c, 20, 52 - h, 28, h, kind === 'school' ? '#657f79' : C.roof)
        rect(c, 19, 52 - h + 1, 31, 3, accent)
        if (kind === 'clinic') { rect(c, 31, 19, 6, 18, accent); rect(c, 25, 25, 18, 6, accent) }
        if (kind === 'school') { poly(c, [15, 31, 34, 18, 58, 28, 48, 36], '#6f9590'); rect(c, 35, 9, 1, 11, C.dim); poly(c, [36, 9, 47, 12, 36, 15], accent) }
        if (kind === 'chat') { rect(c, 28, 34, 15, 10, C.dark); rect(c, 30, 36, 11, 5, accent) }
        rect(c, 48, 49, 15, 3, '#536776')
        dot(c, 13, 48, 4, '#3e796a'); rect(c, 12, 50, 2, 7, '#466357')
      }
      texture.refresh()
    }
    if (!this.scene.textures.exists('life-car')) {
      const texture = this.scene.textures.createCanvas('life-car', 32, 20)!
      const c = texture.getContext(); c.scale(2, 2)
      rect(c, 2, 5, 12, 4, '#121d29'); rect(c, 1, 3, 14, 4, C.gold)
      poly(c, [4, 3, 6, 0, 10, 0, 12, 3], '#87b9cc')
      dot(c, 4, 8, 2, C.dark); dot(c, 12, 8, 2, C.dark)
      rect(c, 14, 4, 2, 2, '#fff0bf'); rect(c, 1, 4, 1, 2, '#e07878')
      texture.refresh()
    }
  }
}
