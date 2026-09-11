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

const DUTY_LOG_REDIS_KEY = 'vndms:dutylog'
const DUTY_LOG_MAX = 200

function redisVitePlugin(): Plugin {
  let redis: RedisClientType | null = null
  // Bộ nhớ đệm trong tiến trình Vite — dùng khi chưa cấu hình REDIS_URL.
  // (Mất khi restart dev server; bản sao localStorage ở client vẫn còn.)
  let dutyLogMemory: any[] = []

  return {
    name: 'vndms-redis-plugin',
    configureServer(server) {
      redis = getRedisClient()
      if (redis) {
        redis.connect().catch((err: any) => {
          console.warn('[VNDMS Vite] Không thể kết nối Redis trực tiếp:', err?.message || String(err))
        })
      }

      // ── Sổ trực ban dùng chung: đọc/ghi qua Redis khi có, qua RAM khi không ──
      const readDutyLog = async (): Promise<any[]> => {
        if (redis) {
          try {
            const raw = await redis.lrange(DUTY_LOG_REDIS_KEY, 0, DUTY_LOG_MAX - 1)
            const parsed = []
            for (const item of raw) {
              try {
                parsed.push(JSON.parse(item))
              } catch {
                // ignore
              }
            }
            return parsed
          } catch {
            // rớt xuống bộ nhớ RAM
          }
        }
        return dutyLogMemory
      }
      const writeDutyLog = async (entries: any[]) => {
        const capped = entries.slice(0, DUTY_LOG_MAX)
        dutyLogMemory = capped
        if (redis) {
          try {
            const pipe = redis.pipeline()
            pipe.del(DUTY_LOG_REDIS_KEY)
            if (capped.length > 0) {
              pipe.rpush(DUTY_LOG_REDIS_KEY, ...capped.map((e) => JSON.stringify(e)))
            }
            await pipe.exec()
          } catch {
                // RAM đã cập nhật; Redis lỗi thì lần ghi sau thử lại
          }
        }
      }
      const readJsonBody = (req: any): Promise<any> =>
        new Promise((resolve) => {
          let body = ''
          req.on('data', (chunk: any) => (body += chunk))
          req.on('end', () => {
            try {
              resolve(JSON.parse(body))
            } catch {
              resolve(null)
            }
          })
        })

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/redis') && !req.url?.startsWith('/api/duty-log')) {
          return next()
        }

        res.setHeader('Content-Type', 'application/json')

        // GET /api/duty-log — toàn bộ sổ trực ban dùng chung (mới nhất trước)
        if (req.url === '/api/duty-log' && req.method === 'GET') {
          try {
            const entries = await readDutyLog()
            res.end(JSON.stringify({ success: true, data: entries }))
          } catch (err: any) {
            res.end(JSON.stringify({ success: false, error: err.message, data: [] }))
          }
          return
        }

        // POST /api/duty-log — thêm một bản ghi (client đã tạo id/at).
        // Upsert theo id: cùng id thì ghi đè (ký nhận bàn giao), trừ khi bản
        // cũ đã thu hồi mà bản mới chưa — thu hồi luôn thắng như phía client.
        if (req.url === '/api/duty-log' && req.method === 'POST') {
          const entry = await readJsonBody(req)
          if (!entry || typeof entry.id !== 'string' || typeof entry.text !== 'string') {
            res.end(JSON.stringify({ success: false, error: 'Bản ghi thiếu id/text' }))
            return
          }
          try {
            const entries = await readDutyLog()
            const at = entries.findIndex((e) => e && e.id === entry.id)
            const retracted = (text: any) => String(text || '').startsWith('[Đã thu hồi')
            if (at === -1) {
              entries.unshift(entry)
            } else if (!(retracted(entries[at].text) && !retracted(entry.text))) {
              entries[at] = entry
            }
            entries.sort(
              (a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime(),
            )
            await writeDutyLog(entries)
            res.end(JSON.stringify({ success: true }))
          } catch (err: any) {
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
          return
        }

        // POST /api/duty-log/retract — thu hồi (giữ dấu vết, giống client)
        if (req.url === '/api/duty-log/retract' && req.method === 'POST') {
          const payload = await readJsonBody(req)
          if (!payload || typeof payload.id !== 'string' || typeof payload.actor !== 'string') {
            res.end(JSON.stringify({ success: false, error: 'Thiếu id/actor' }))
            return
          }
          try {
            const entries = await readDutyLog()
            const next = entries.map((e) =>
              e && e.id === payload.id && !String(e.text || '').startsWith('[Đã thu hồi')
                ? { ...e, text: `[Đã thu hồi bởi ${payload.actor}] ${e.text}` }
                : e,
            )
            await writeDutyLog(next)
            res.end(JSON.stringify({ success: true }))
          } catch (err: any) {
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
          return
        }

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
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    // Chống browser dính bản cũ: index.html luôn hỏi lại server,
    // các asset băm hash thì cache dài hạn bình thường.
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
  },
  optimizeDeps: { exclude: ['maplibre-gl'] },
})

