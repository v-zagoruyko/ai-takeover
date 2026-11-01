import { defineConfig } from 'vite'

// in dev the leaderboard API (npm run api) runs separately; in production Traefik routes /api to it
export default defineConfig({
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:8787' } },
})
