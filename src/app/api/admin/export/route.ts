import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { getTenantFromRequest, tenantFilter } from '@/lib/tenant'

import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const lines = [headers.join(',')]
  for (const r of rows) lines.push(headers.map(h => escape((r as Record<string, unknown>)[h])).join(','))
  return lines.join('\n')
}

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isFinite(d.getTime()) ? d : undefined
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role as string | undefined
    if (!session?.user || !hasPermission(role, PERMISSIONS.ANALYTICS_EXPORT)) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const entity = (searchParams.get('entity') || '').toLowerCase()
    const format = (searchParams.get('format') || 'csv').toLowerCase()
    const tenantId = getTenantFromRequest(request as unknown as Request)

    if (format !== 'csv') return new NextResponse('Only CSV is supported', { status: 400 })

    const hasDb = Boolean(process.env.NETLIFY_DATABASE_URL)
    if (!hasDb) return new NextResponse('Database not configured', { status: 501 })

    let rows: Record<string, unknown>[] = []

    if (entity === 'users') {
      const users = await prisma.user.findMany({ where: tenantFilter(tenantId), select: { id: true, name: true, email: true, role: true, createdAt: true } })
      rows = users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt.toISOString() }))
    } else if (entity === 'bookings') {
      const bookings = await prisma.booking.findMany({ where: tenantFilter(tenantId), include: { service: { select: { name: true } }, client: { select: { name: true, email: true } } } })
      rows = bookings.map(b => ({ id: b.id, clientName: b.client?.name, clientEmail: b.client?.email, service: b.service?.name, status: b.status, scheduledAt: b.scheduledAt.toISOString(), duration: b.duration }))
    } else if (entity === 'services') {
      const services = await prisma.service.findMany({ where: tenantFilter(tenantId), select: { id: true, name: true, slug: true, price: true, active: true, category: true } })
      rows = services.map(s => {
        const priceUnknown = s.price as unknown
        let priceStr = ''
        if (priceUnknown != null) {
          if (typeof priceUnknown === 'string' || typeof priceUnknown === 'number') {
            priceStr = String(priceUnknown)
          } else if (typeof (priceUnknown as { toString?: () => string }).toString === 'function') {
            priceStr = (priceUnknown as { toString: () => string }).toString()
          }
        }
        return { id: s.id, name: s.name, slug: s.slug, price: priceStr, active: s.active, category: s.category ?? '' }
      })
    } else if (entity === 'audits') {
      const logs = await prisma.healthLog.findMany({ where: { ...tenantFilter(tenantId), service: 'AUDIT' }, orderBy: { checkedAt: 'desc' }, take: 200 })
      rows = logs.map(l => ({ id: l.id, checkedAt: l.checkedAt.toISOString(), service: l.service, status: l.status, message: l.message ?? '' }))
    } else if (entity === 'newsletter') {
      const subs = await prisma.newsletter.findMany({ orderBy: { createdAt: 'desc' } })
      rows = subs.map(s => ({ id: s.id, email: s.email, name: s.name ?? '', subscribed: s.subscribed ? 'true' : 'false', createdAt: s.createdAt.toISOString() }))
    } else if (entity === 'posts') {
      const posts = await prisma.post.findMany({ orderBy: { updatedAt: 'desc' } })
      rows = posts.map(p => ({ id: p.id, title: p.title, slug: p.slug, status: p.status, category: p.category ?? '', published: p.published ? 'true' : 'false', featured: p.featured ? 'true' : 'false', views: p.views ?? 0, publishedAt: p.publishedAt ? p.publishedAt.toISOString() : '', updatedAt: p.updatedAt.toISOString() }))
    } else if (entity === 'payments') {
      const reqs = await prisma.serviceRequest.findMany({ where: { ...tenantFilter(tenantId), NOT: { paymentStatus: null } }, include: { client: { select: { name: true, email: true } }, service: { select: { name: true } } }, orderBy: { paymentUpdatedAt: 'desc' } })
      rows = reqs.map(r => ({ id: r.id, clientName: r.clientName || r.client?.name || '', clientEmail: r.clientEmail || r.client?.email || '', service: r.service?.name || '', paymentStatus: r.paymentStatus ?? '', paymentProvider: r.paymentProvider ?? '', paymentAmount: typeof r.paymentAmountCents === 'number' ? (r.paymentAmountCents / 100).toFixed(2) : '', paymentCurrency: r.paymentCurrency ?? '', paymentUpdatedAt: r.paymentUpdatedAt ? r.paymentUpdatedAt.toISOString() : '' }))
    } else if (entity === 'invoices') {
      const status = searchParams.get('status')
      const createdFrom = parseDate(searchParams.get('createdFrom'))
      const createdTo = parseDate(searchParams.get('createdTo'))
      const where: any = { ...tenantFilter(tenantId) }
      if (status && status !== 'all') where.status = status
      if (createdFrom || createdTo) {
        where.createdAt = {}
        if (createdFrom) where.createdAt.gte = createdFrom
        if (createdTo) where.createdAt.lte = createdTo
      }
      const invoices = await prisma.invoice.findMany({
        where,
        include: { client: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      })
      rows = invoices.map(inv => ({
        id: inv.id,
        number: inv.number ?? '',
        clientName: inv.client?.name || '',
        clientEmail: inv.client?.email || '',
        status: inv.status,
        currency: inv.currency,
        total: (inv.totalCents / 100).toFixed(2),
        createdAt: inv.createdAt.toISOString(),
        paidAt: inv.paidAt ? inv.paidAt.toISOString() : '',
      }))
    } else if (entity === 'expenses') {
      const status = searchParams.get('status')
      const category = searchParams.get('category')
      const dateFrom = parseDate(searchParams.get('dateFrom'))
      const dateTo = parseDate(searchParams.get('dateTo'))
      const where: any = { ...tenantFilter(tenantId) }
      if (status && status !== 'all') where.status = status
      if (category && category !== 'all') where.category = category
      if (dateFrom || dateTo) {
        where.date = {}
        if (dateFrom) where.date.gte = dateFrom
        if (dateTo) where.date.lte = dateTo
      }

      const expenses = await prisma.expense.findMany({ where, include: { attachment: { select: { url: true, avStatus: true } } }, orderBy: { date: 'desc' } })
      rows = expenses.map(e => ({ id: e.id, vendor: e.vendor, category: e.category, status: e.status, amount: (e.amountCents/100).toFixed(2), currency: e.currency, date: e.date.toISOString().slice(0,10), avStatus: e.attachment?.avStatus || '', attachmentUrl: e.attachment?.url || '' }))
    } else {
      return new NextResponse('Unknown entity', { status: 400 })
    }

    const csv = toCsv(rows)
    try { await logAudit({ action: `admin:export:${entity}`, actorId: (session?.user as any)?.id ?? null, targetId: tenantId ?? null, details: Object.fromEntries(searchParams.entries()) }) } catch {}
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${entity}.csv"`
      }
    })
  } catch (error) {
    try { const { captureError } = await import('@/lib/observability'); await captureError(error, { tags: { route: 'admin/export' } }) } catch {}
    console.error('Export error:', error)
    return new NextResponse('Failed to export', { status: 500 })
  }
}
