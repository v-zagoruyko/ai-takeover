// zero-dependency dev loop: tsc (optionally --watch) into web/dist + static server for web/
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const root = path.resolve('web')
const port = Number(process.env.PORT ?? 5173)
const watch = process.argv.includes('--watch')
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
}

const tsc = spawn(path.resolve('node_modules/.bin/tsc'), ['-p', 'tsconfig.web.json', ...(watch ? ['--watch', '--preserveWatchOutput'] : [])], {
  stdio: 'inherit',
})

http
  .createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    if (p.endsWith('/')) p += 'index.html'
    const file = path.join(root, p)
    if (!file.startsWith(root)) {
      res.writeHead(403)
      return res.end()
    }
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404)
        return res.end('not found')
      }
      res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
      res.end(buf)
    })
  })
  .listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}`))

const stop = () => {
  tsc.kill()
  process.exit()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
