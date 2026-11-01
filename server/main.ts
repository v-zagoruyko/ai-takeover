// Leaderboard API: POST /api/scores (verified by replaying the game), GET /api/leaderboard, GET /api/health.
import { createHash } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { loadData } from '../src/core/data.ts'
import { verify } from './scores.ts'

const PORT = Number(process.env.PORT ?? 8787)
const DB_PATH = process.env.DB_PATH ?? 'leaderboard.db'
const MAX_BODY = 512 * 1024
const RATE = { posts: 8, windowMs: 10 * 60 * 1000 }

const data = loadData()
const db = new DatabaseSync(DB_PATH)
db.exec(`create table if not exists scores (
  id integer primary key,
  hash text unique not null,
  name text not null,
  ai text not null,
  score integer not null,
  kind text not null,
  ending text not null,
  days integer not null,
  created_at text not null default (datetime('now'))
)`)
db.exec('create index if not exists scores_score on scores (score desc)')

const insert = db.prepare('insert into scores (hash, name, ai, score, kind, ending, days) values (?, ?, ?, ?, ?, ?, ?)')
const byHash = db.prepare('select score from scores where hash = ?')
const rankOf = db.prepare('select count(*) + 1 as rank from scores where score > ?')
const top = db.prepare('select name, ai, score, kind, ending, days, created_at from scores order by score desc, id asc limit ?')

const posts = new Map<string, number[]>()
function limited(ip: string): boolean {
  const now = Date.now()
  const recent = (posts.get(ip) ?? []).filter((t) => now - t < RATE.windowMs)
  recent.push(now)
  posts.set(ip, recent)
  return recent.length > RATE.posts
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const c of req) {
    size += (c as Buffer).length
    if (size > MAX_BODY) throw new Error('too large')
    chunks.push(c as Buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true })
    if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50))
      return send(res, 200, { entries: top.all(limit) })
    }
    if (req.method === 'POST' && url.pathname === '/api/scores') {
      // behind Traefik the client address is the first X-Forwarded-For entry
      const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim()
      if (limited(ip)) return send(res, 429, { error: 'too many submissions, try again later' })
      let body: unknown
      try {
        body = await readJson(req)
      } catch {
        return send(res, 400, { error: 'invalid JSON' })
      }
      const check = verify(body, data)
      if (!check.ok) return send(res, check.status, { error: check.error })
      const v = check.value
      const b = body as Record<string, unknown>
      const hash = createHash('sha256').update(JSON.stringify([b.seed, b.startRegion, b.mask, b.log])).digest('hex')
      const existing = byHash.get(hash) as { score: number } | undefined
      if (!existing) insert.run(hash, v.name, v.ai, v.score.total, v.kind, v.ending, v.days)
      const { rank } = rankOf.get(v.score.total) as { rank: number }
      return send(res, existing ? 200 : 201, { score: v.score, rank, duplicate: !!existing })
    }
    send(res, 404, { error: 'not found' })
  } catch (e) {
    console.error(e)
    send(res, 500, { error: 'internal error' })
  }
}).listen(PORT, () => console.log(`leaderboard on :${PORT}, db ${DB_PATH}`))
