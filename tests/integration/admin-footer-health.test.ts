import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Utility to import GET fresh per test
async function loadRoute() {
  const mod = await import('@/app/api/admin/system/health/route')
  return mod
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Health API Endpoint', () => {
  it('returns 200 and expected structure when services are healthy', async () => {
    vi.mock('@prisma/client', () => {
      return {
        PrismaClient: class {
          async $queryRaw() { return 1 }
          async $disconnect() { return }
        }
      }
    })

    const { GET } = await loadRoute()
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json).toHaveProperty('status')
    expect(['operational', 'degraded', 'outage']).toContain(json.status)
    expect(json).toHaveProperty('message')
    expect(json).toHaveProperty('timestamp')
    expect(json).toHaveProperty('checks')
    expect(json.checks).toHaveProperty('database')
    expect(json.checks).toHaveProperty('api')
  })

  it('includes database check even when failures occur', async () => {
    vi.mock('@prisma/client', () => {
      return {
        PrismaClient: class {
          async $queryRaw() { throw new Error('db down') }
          async $disconnect() { return }
        }
      }
    })

    const { GET } = await loadRoute()
    const res = await GET()
    const json = await res.json()
    expect(json).toHaveProperty('checks.database')
    expect(['operational','degraded','outage','unknown']).toContain(json.checks.database.status)
    expect(json).toHaveProperty('timestamp')
  })
})
