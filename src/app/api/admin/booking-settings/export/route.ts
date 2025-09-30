import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PERMISSIONS, hasPermission } from '@/lib/permissions'
import { getTenantFromRequest } from '@/lib/tenant'
import service from '@/services/booking-settings.service'
import { logAudit } from '@/lib/audit'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import * as Sentry from '@sentry/nextjs'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role ?? ''
  if (!session?.user || !hasPermission(role, PERMISSIONS.BOOKING_SETTINGS_EXPORT)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tenantId = getTenantFromRequest(req as any)
  const ip = getClientIp(req as any)
  const key = `booking-settings:export:${tenantId}:${ip}`
  if (!rateLimit(key, 10, 60_000)) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  try {
    const data = await service.exportSettings(tenantId)
    try { await logAudit({ action: 'booking-settings:export', actorId: session.user.id, details: { tenantId, version: data.version } }) } catch {}
    return NextResponse.json(data)
  } catch (e: any) {
    try { Sentry.captureException(e) } catch {}
    return NextResponse.json({ error: e?.message || 'Failed to export settings' }, { status: 500 })
  }
}
