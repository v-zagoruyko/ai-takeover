// Builds data/map.json from Natural Earth 110m countries (public domain):
//   curl -sSfL -o countries.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson
//   node scripts/build-map.mjs countries.geojson
// Countries are grouped into game regions and projected with Natural Earth I.
import fs from 'node:fs'

const [input] = process.argv.slice(2)
if (!input) throw new Error('usage: node scripts/build-map.mjs <countries.geojson>')

const WIDTH = 2000
const LAT_MIN = -58 // drop Antarctica and the empty southern ocean
const LAT_MAX = 84

const byCode = {
  USA: 'north_america',
  CAN: 'canada',
  GBR: 'uk',
  RUS: 'russia',
  CHN: 'china',
  PRK: 'china',
  KOR: 'japan_korea',
  JPN: 'japan_korea',
  TWN: 'japan_korea',
  BRA: 'brazil',
  MEX: 'latin_america',
  IRN: 'middle_east',
  AFG: 'central_asia',
  MNG: 'central_asia',
  GRL: 'northern_europe',
  IRL: 'western_europe',
  EST: 'northern_europe',
  LVA: 'northern_europe',
  LTU: 'northern_europe',
}
const anchorCountry = { northern_europe: 'SWE', latin_america: 'BOL' }
const westernSouth = new Set(['ESP', 'PRT', 'ITA', 'GRC', 'MLT', 'SVN', 'HRV'])
const bySubregion = {
  'Northern America': 'north_america',
  'Western Europe': 'western_europe',
  'Northern Europe': 'northern_europe',
  'Eastern Europe': 'eastern_europe',
  'Southern Europe': 'eastern_europe', // the Balkans; western members are listed above
  'Central Asia': 'central_asia',
  'Eastern Asia': 'china',
  'Southern Asia': 'india',
  'South-Eastern Asia': 'southeast_asia',
  'Western Asia': 'middle_east',
  'Northern Africa': 'north_africa',
  'Eastern Africa': 'subsaharan_africa',
  'Middle Africa': 'subsaharan_africa',
  'Southern Africa': 'subsaharan_africa',
  'Western Africa': 'subsaharan_africa',
  'Central America': 'latin_america',
  Caribbean: 'latin_america',
  'South America': 'latin_america',
  'Australia and New Zealand': 'oceania',
  Melanesia: 'oceania',
}

function regionOf(p) {
  const code = p.ADM0_A3
  if (byCode[code]) return byCode[code]
  if (p.SUBREGION === 'Southern Europe' && westernSouth.has(code)) return 'western_europe'
  return bySubregion[p.SUBREGION] ?? null
}

// d3-geo naturalEarth1Raw
function project(lon, lat) {
  const l = (lon * Math.PI) / 180
  const p = (lat * Math.PI) / 180
  const p2 = p * p
  const p4 = p2 * p2
  return [
    l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))),
    p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4))),
  ]
}

const [xMax] = project(180, 0)
const [, yTop] = project(0, LAT_MAX)
const [, yBottom] = project(0, LAT_MIN)
const scale = WIDTH / (2 * xMax)
const HEIGHT = Math.round((yTop - yBottom) * scale)
const toPx = (lon, lat) => {
  const [x, y] = project(lon, Math.max(LAT_MIN, Math.min(LAT_MAX, lat)))
  return [Math.round((x + xMax) * scale * 10) / 10, Math.round((yTop - y) * scale * 10) / 10]
}

function area(flat) {
  let a = 0
  for (let i = 0; i < flat.length; i += 2) {
    const j = (i + 2) % flat.length
    a += flat[i] * flat[j + 1] - flat[j] * flat[i + 1]
  }
  return a / 2
}

function centroid(flat) {
  let cx = 0
  let cy = 0
  let a = 0
  for (let i = 0; i < flat.length; i += 2) {
    const j = (i + 2) % flat.length
    const f = flat[i] * flat[j + 1] - flat[j] * flat[i + 1]
    cx += (flat[i] + flat[j]) * f
    cy += (flat[i + 1] + flat[j + 1]) * f
    a += f
  }
  return [Math.round(cx / (3 * a)), Math.round(cy / (3 * a))]
}

const geo = JSON.parse(fs.readFileSync(input, 'utf8'))
const countries = []
const largest = {}
const skipped = []
for (const f of geo.features) {
  const region = regionOf(f.properties)
  if (!region) {
    skipped.push(`${f.properties.ADM0_A3} (${f.properties.SUBREGION})`)
    continue
  }
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
  const rings = []
  for (const poly of polys) {
    const outer = poly[0].flatMap(([lon, lat]) => toPx(lon, lat))
    if (Math.abs(area(outer)) < 4) continue // specks
    rings.push(outer)
    // labels go to the largest landmass, unless a country is pinned as the region's visual centre
    const a = Math.abs(area(outer)) * (anchorCountry[region] === f.properties.ADM0_A3 ? 1e6 : 1)
    if (!largest[region] || a > largest[region].a) largest[region] = { a, ring: outer }
  }
  if (rings.length) countries.push({ id: f.properties.ADM0_A3, region, polys: rings })
}

const anchors = Object.fromEntries(Object.entries(largest).map(([r, { ring }]) => [r, centroid(ring)]))
const out = { width: WIDTH, height: HEIGHT, anchors, countries }
fs.writeFileSync('data/map.json', JSON.stringify(out))
console.log(`regions: ${Object.keys(anchors).length}, countries: ${countries.length}, size ${WIDTH}x${HEIGHT}`)
if (skipped.length) console.log(`skipped: ${skipped.join(', ')}`)
