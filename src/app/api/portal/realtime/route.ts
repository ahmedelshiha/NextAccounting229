import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { realtimeService } from '@/lib/realtime-enhanced'
import { getTenantFromRequest } from '@/lib/tenant'
import { resolveTenantId } from '@/lib/default-tenant'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return new Response('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const eventTypes = (searchParams.get('events')?.split(',') ?? ['all']).filter(Boolean)
  const userId = String((session.user as any).id ?? 'anon')

  // Best-effort health log for observability
  try {
    const { default: prisma } = await import('@/lib/prisma')
    const tenantHint = getTenantFromRequest(request as any)
    const tenantId = await resolveTenantId(tenantHint)
    await prisma.healthLog.create({ data: { tenantId, service: 'portal:realtime', status: 'CONNECTED', message: `user:${userId} events:${eventTypes.join(',')}` } }).catch(() => null)
  } catch {}

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder()
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`))
      const connectionId = realtimeService.subscribe(controller as any, userId, eventTypes)
      const pingId = setInterval(() => {
        try { controller.enqueue(enc.encode(`: ping ${Date.now()}\n\n`)) } catch {}
      }, 25000)
      const onAbort = async () => {
        try { clearInterval(pingId) } catch {}
        realtimeService.cleanup(connectionId)
        try { controller.close() } catch {}
        // Log disconnect
        try {
          const { default: prisma } = await import('@/lib/prisma')
          const tenantHint = getTenantFromRequest(request as any)
          const tenantId = await resolveTenantId(tenantHint)
          await prisma.healthLog.create({ data: { tenantId, service: 'portal:realtime', status: 'DISCONNECTED', message: `user:${userId}` } }).catch(() => null)
        } catch {}
      }
      request.signal.addEventListener('abort', onAbort)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET,OPTIONS' } })
}
