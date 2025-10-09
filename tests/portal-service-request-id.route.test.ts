import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock next-auth/next for App Router
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(async () => ({ 
    user: { 
      id: 'client1',
      name: 'Test Client',
      role: 'CLIENT',
      tenantId: 'test-tenant',
      tenantRole: 'CLIENT'
    } 
  })),
}))
vi.mock('next-auth', () => ({ 
  getServerSession: vi.fn(async () => ({ 
    user: { 
      id: 'client1',
      role: 'CLIENT',
      tenantId: 'test-tenant',
      tenantRole: 'CLIENT'
    } 
  })) 
}))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/rate-limit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rate-limit')>('@/lib/rate-limit')
  return {
    ...actual,
    getClientIp: vi.fn(() => '127.0.0.1'),
    rateLimit: vi.fn(() => true),
    rateLimitAsync: vi.fn(async () => true),
    applyRateLimit: vi.fn(async () => ({ allowed: true, backend: 'memory', count: 1, limit: 1, remaining: 0, resetAt: Date.now() + 1000 })),
  }
})

const db: any = {
  sr: { id: 'sr1', clientId: 'client1', status: 'SUBMITTED', description: 'Initial' },
}

const findUnique = vi.fn(async ({ where }: any) => (where.id === db.sr.id ? { clientId: db.sr.clientId, status: db.sr.status } : null))
const update = vi.fn(async ({ where, data }: any) => ({ id: where.id, ...db.sr, ...data }))

vi.mock('@/lib/prisma', () => ({ default: { serviceRequest: { findUnique, update } } }))

let GET: any
let PATCH: any

beforeAll(async () => {
  const mod = await import('@/app/api/portal/service-requests/[id]/route')
  GET = mod.GET
  PATCH = mod.PATCH
})

beforeEach(() => {
  db.sr = { id: 'sr1', clientId: 'client1', status: 'SUBMITTED', description: 'Initial' }
  findUnique.mockClear()
  update.mockClear()
})

describe('portal service-requests [id] route', () => {
  it('GET returns item for owner', async () => {
    // Mock prisma findUnique to include service/comments shape via GET path? We only validate 200
    const res: any = await GET(new Request('https://x') as any, { params: Promise.resolve({ id: 'sr1' }) })
    expect(res.status).toBe(200)
  })

  it('PATCH approve transitions to APPROVED', async () => {
    const req = new Request('https://x', { method: 'PATCH', body: JSON.stringify({ action: 'approve' }) })
    const res: any = await PATCH(req as any, { params: Promise.resolve({ id: 'sr1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.status).toBe('APPROVED')
  })

  it('PATCH cancel transitions to CANCELLED from SUBMITTED', async () => {
    const req = new Request('https://x', { method: 'PATCH', body: JSON.stringify({ action: 'cancel' }) })
    const res: any = await PATCH(req as any, { params: Promise.resolve({ id: 'sr1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.status).toBe('CANCELLED')
  })
})
