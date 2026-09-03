import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { Redis as IORedis } from 'ioredis'
import fs from 'node:fs'

type RedisClientType = InstanceType<typeof IORedis>

function getRedisClient(): RedisClientType | null {
  let url = process.env.REDIS_URL
  if (!url && fs.existsSync('.env')) {
    const lines = fs.readFileSync('.env', 'utf8').split('\n')
    for (const l of lines) {
      if (l.trim().startsWith('REDIS_URL=')) {
        url = l.trim().substring('REDIS_URL='.length).trim()
        break
      }
    }
  }
  if (!url) return null
  try {
    return new IORedis(url, {
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    })
  } catch {
    return null
  }
}

function redisVitePlugin(): Plugin {
  let redis: RedisClientType | null = null

  return {
    name: 'vndms-redis-plugin',
    configureServer(server) {
      redis = getRedisClient()
      if (redis) {
        redis.connect().catch((err: any) => {
          console.warn('[VNDMS Vite] Không thể kết nối Redis trực tiếp:', err?.message || String(err))
        })
      }

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/redis')) {
          return next()
        }

        res.setHeader('Content-Type', 'application/json')

        // GET /api/redis/locations
        if (req.url === '/api/redis/locations' && req.method === 'GET') {
          if (!redis) {
            res.end(JSON.stringify({ success: true, data: [] }))
            return
          }
          try {
            const keys = await redis.keys('vndms:location:*')
            const pings = []
            for (const key of keys) {
              const val = await redis.get(key)
              if (val) {
                try {
                  pings.push(JSON.parse(val))
                } catch {
                  // ignore
                }
              }
            }
            res.end(JSON.stringify({ success: true, data: pings }))
          } catch (err: any) {
            res.end(JSON.stringify({ success: false, error: err.message, data: [] }))
          }
          return
        }

        // POST /api/redis/ping
        if (req.url === '/api/redis/ping' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => (body += chunk))
          req.on('end', async () => {
            try {
              const ping = JSON.parse(body)
              if (redis && ping && ping.id && ping.role) {
                const key = `vndms:location:${ping.role}:${ping.id}`
                const ttl = ping.isPanicSOS ? 1800 : 300
                await redis.set(key, JSON.stringify(ping), 'EX', ttl)
                if (ping.coordinates && ping.coordinates.length === 2) {
                  await redis.geoadd('vndms:geo:live_fleet', ping.coordinates[0], ping.coordinates[1], ping.id)
                }
              }
              res.end(JSON.stringify({ success: true }))
            } catch (err: any) {
              res.end(JSON.stringify({ success: false, error: err.message }))
            }
          })
          return
        }

        // POST /api/redis/remove
        if (req.url === '/api/redis/remove' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => (body += chunk))
          req.on('end', async () => {
            try {
              const { id, role } = JSON.parse(body)
              if (redis && id && role) {
                await redis.del(`vndms:location:${role}:${id}`)
                await redis.zrem('vndms:geo:live_fleet', id)
              }
              res.end(JSON.stringify({ success: true }))
            } catch (err: any) {
              res.end(JSON.stringify({ success: false, error: err.message }))
            }
          })
          return
        }

        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), redisVitePlugin()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: '0.0.0.0', allowedHosts: true },
  optimizeDeps: { exclude: ['maplibre-gl'] },
})

