'use client'

"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { apiFetch } from '@/lib/api'
import { useBooking } from '@/hooks/useBooking'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/api-error'
import { useTranslations } from '@/lib/i18n'

interface ServiceSummary { id: string; name: string; slug: string; category?: string | null }
interface Comment { id: string; content: string; createdAt: string; author?: { id: string; name?: string | null } | null }
interface ServiceRequest {
  id: string
  title: string
  description?: string | null
  status: string
  priority: string
  createdAt: string
  updatedAt: string
  service: ServiceSummary
  attachments?: any
  comments?: Comment[]
  // Optional booking-related fields when available (fallback/dev or post-migration)
  scheduledAt?: string | null
  confirmed?: boolean
  requirements?: any
}

const statusStyles: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  IN_REVIEW: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  ASSIGNED: 'bg-indigo-100 text-indigo-800',
  IN_PROGRESS: 'bg-sky-100 text-sky-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

export default function PortalServiceRequestDetailPage() {
  const { t } = useTranslations()
  const { data: session } = useSession()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { item: reqData, isLoading: loading, refresh } = useBooking(params?.id ? String(params.id) : undefined, 'portal')
  const [comment, setComment] = useState('')
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const [uploaded, setUploaded] = useState<Record<string, { url?: string; error?: string }>>({})
  const [uploadingKeys, setUploadingKeys] = useState<Record<string, boolean>>({})
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})

  // Appointment UI state
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [appointmentDate, setAppointmentDate] = useState('')
  const [slotDuration, setSlotDuration] = useState<number | ''>('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slots, setSlots] = useState<{ start: string; end: string; available: boolean }[]>([])
  const [selectedSlot, setSelectedSlot] = useState('')

  const id = params?.id


  useEffect(() => {
    if (!session) return

    let es: EventSource | null = null
    let retry = 0
    const connect = () => {
      es = new EventSource('/api/portal/realtime?events=service-request-updated,task-updated')
      es.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data)
          if (evt?.type === 'service-request-updated') {
            const sid = evt?.data?.serviceRequestId
            if (!sid || String(sid) === String(id)) refresh()
          }
          if (evt?.type === 'task-updated') {
            refresh()
          }
        } catch {}
      }
      es.onerror = () => {
        try { es?.close() } catch {}
        es = null
        const timeout = Math.min(30000, 1000 * Math.pow(2, retry++))
        setTimeout(connect, timeout)
      }
    }
    connect()
    return () => { try { es?.close() } catch {} }
     
  }, [session, id, refresh])

  const uploadFile = async (file: File, key: string): Promise<{ url?: string; error?: string }> => {
    return new Promise((resolve) => {
      try {
        const form = new FormData()
        form.append('file', file)
        form.append('folder', 'service-requests/comments')
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/uploads')
        xhr.upload.addEventListener('progress', (evt) => {
          if (evt.lengthComputable) {
            const pct = Math.min(100, Math.round((evt.loaded / evt.total) * 100))
            setUploadProgress((prev) => ({ ...prev, [key]: pct }))
          }
        })
        xhr.onreadystatechange = () => {
          if (xhr.readyState === XMLHttpRequest.DONE) {
            try {
              const ok = xhr.status >= 200 && xhr.status < 300
              const resp = (() => { try { return JSON.parse(xhr.responseText || '{}') } catch { return {} } })()
              if (ok) {
                setUploadProgress((prev) => ({ ...prev, [key]: 100 }))
                resolve({ url: (resp as any).url })
              } else {
                resolve({ error: (resp as any)?.error || t('portal.upload.failed') })
              }
            } catch {
              resolve({ error: t('portal.upload.failed') })
            }
          }
        }
        xhr.onerror = () => resolve({ error: t('portal.upload.failed') })
        xhr.send(form)
      } catch {
        resolve({ error: t('portal.upload.failed') })
      }
    })
  }

  const uploadSingle = async (file: File) => {
    const key = `${file.name}-${file.lastModified}`
    try {
      setUploadingKeys((prev) => ({ ...prev, [key]: true }))
      setUploadProgress((prev) => ({ ...prev, [key]: 0 }))
      const result = await uploadFile(file, key)
      setUploaded((prev) => ({ ...prev, [key]: result }))
      if (result.error) toast.error(`${file.name}: ${result.error}`)
    } finally {
      setUploadingKeys((prev) => ({ ...prev, [key]: false }))
    }
  }

  const hasPendingUploads = commentFiles.some((f) => {
    const key = `${f.name}-${f.lastModified}`
    const info = uploaded[key]
    return !info?.url && (uploadingKeys[key] || !info)
  })

  const submitComment = async () => {
    if (!comment.trim()) return
    try {
      const results = await Promise.all(
        commentFiles.map(async (f) => {
          const key = `${f.name}-${f.lastModified}`
          let info = uploaded[key]
          if (!info?.url && !uploadingKeys[key]) {
            info = await uploadFile(f, key)
            setUploaded((prev) => ({ ...prev, [key]: info! }))
          }
          return { file: f, info }
        })
      )
      const attachments = results.map(({ file, info }) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        url: info?.url,
        uploadError: info?.error,
      }))

      const res = await apiFetch(`/api/portal/service-requests/${encodeURIComponent(id!)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: comment, attachments })
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        toast.error(getApiErrorMessage(errBody, t('portal.toast.commentFailed')))
        return
      }
      setComment('')
      setCommentFiles([])
      setUploaded({})
      setUploadingKeys({})
      setUploadProgress({})
      await refresh()
    } catch (e) {
      toast.error(t('portal.toast.commentFailed'))
    }
  }

  const cancelRequest = async () => {
    if (!id) return
    if (!confirm(t('portal.serviceRequests.confirmCancel'))) return
    try {
      const res = await apiFetch(`/api/portal/service-requests/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' })
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        toast.error(getApiErrorMessage(errBody, t('portal.toast.cancelFailed')))
        return
      }
      toast.success(t('portal.toast.requestCancelled'))
      router.refresh()
      await refresh()
    } catch (e) {
      toast.error(t('portal.toast.cancelFailed'))
    }
  }

  const approveRequest = async () => {
    if (!id) return
    try {
      const res = await apiFetch(`/api/portal/service-requests/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' })
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        toast.error(getApiErrorMessage(errBody, t('portal.toast.approveFailed')))
        return
      }
      toast.success(t('portal.toast.requestApproved'))
      router.refresh()
      await refresh()
    } catch (e) {
      toast.error(t('portal.toast.approveFailed'))
    }
  }

  // Appointment helpers
  const scheduledAt: string | undefined = (reqData as any)?.scheduledAt || (reqData as any)?.requirements?.booking?.scheduledAt
  const isBooking = !!scheduledAt
  const isCompletedOrCancelled = !!reqData && ['COMPLETED','CANCELLED'].includes(reqData.status)
  const isConfirmed = Boolean((reqData as any)?.confirmed)

  const fetchAvailability = async () => {
    if (!reqData?.service?.id || !appointmentDate) return
    setLoadingSlots(true)
    setSelectedSlot('')
    setSlots([])
    try {
      const from = new Date(appointmentDate)
      const to = new Date(appointmentDate)
      to.setHours(23,59,59,999)
      const params = new URLSearchParams()
      params.set('serviceId', reqData.service.id)
      params.set('dateFrom', from.toISOString())
      params.set('dateTo', to.toISOString())
      if (typeof slotDuration === 'number') params.set('duration', String(slotDuration))
      const res = await apiFetch(`/api/portal/service-requests/availability?${params.toString()}`)
      const json = await res.json().catch(() => ({} as any))
      const list = Array.isArray(json?.data?.slots) ? json.data.slots : []
      setSlots(list)
    } catch {
      toast.error(t('portal.availability.loadFailed'))
    } finally {
      setLoadingSlots(false)
    }
  }

  const confirmAppointment = async () => {
    if (!id) return
    try {
      const res = await apiFetch(`/api/portal/service-requests/${encodeURIComponent(id)}/confirm`, { method: 'POST' })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok) {
        toast.error(getApiErrorMessage(json, t('portal.toast.confirmFailed')))
        return
      }
      toast.success(t('portal.toast.appointmentConfirmed'))
      await refresh()
    } catch {
      toast.error(t('portal.toast.confirmFailed'))
    }
  }

  const submitReschedule = async () => {
    if (!id || !selectedSlot) return
    try {
      const res = await apiFetch(`/api/portal/service-requests/${encodeURIComponent(id)}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: selectedSlot })
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok) {
        toast.error(getApiErrorMessage(json, t('portal.toast.rescheduleFailed')))
        return
      }
      toast.success(t('portal.toast.appointmentRescheduled'))
      setRescheduleOpen(false)
      setAppointmentDate('')
      setSelectedSlot('')
      setSlots([])
      await refresh()
    } catch {
      toast.error(t('portal.toast.rescheduleFailed'))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('portal.serviceRequests.title')}</h1>
            <p className="text-gray-600">{t('portal.serviceRequests.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild aria-label={t('common.back')}>
              <Link href="/portal/service-requests">{t('common.back')}</Link>
            </Button>
            {reqData && ['SUBMITTED','IN_REVIEW'].includes(reqData.status) && (
              <Button onClick={approveRequest} aria-label={t('portal.serviceRequests.approve')}>{t('portal.serviceRequests.approve')}</Button>
            )}
            {reqData && !isCompletedOrCancelled && isBooking && !isConfirmed && (
              <Button onClick={confirmAppointment} aria-label={t('portal.serviceRequests.confirmAppointment')}>{t('portal.serviceRequests.confirmAppointment')}</Button>
            )}
            {reqData && !isCompletedOrCancelled && isBooking && (
              <Button variant="outline" onClick={() => setRescheduleOpen(true)} aria-label={t('portal.serviceRequests.reschedule')}>{t('portal.serviceRequests.reschedule')}</Button>
            )}
            {reqData && !['COMPLETED','CANCELLED'].includes(reqData.status) && (
              <Button variant="destructive" onClick={cancelRequest} aria-label={t('portal.cancel')}>{t('portal.cancel')}</Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-gray-200 animate-pulse rounded-lg h-28" />
            <div className="bg-gray-200 animate-pulse rounded-lg h-40" />
          </div>
        ) : !reqData ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-700">{t('portal.serviceRequests.notFound')}</CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{reqData.title}</CardTitle>
                    <CardDescription className="mt-1">{reqData.service?.name}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusStyles[reqData.status] || 'bg-gray-100 text-gray-800'}>{reqData.status.replace('_', ' ')}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isBooking && (
                  <div className="mb-3 rounded-md border px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-900">
                        <span className="font-medium">{t('portal.serviceRequests.scheduledLabel')}</span>{' '}
                        <span>{new Date(scheduledAt as string).toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        {isConfirmed ? t('portal.serviceRequests.confirmed') : t('portal.serviceRequests.awaitingConfirmation')}
                      </div>
                    </div>
                  </div>
                )}
                {reqData.description && (
                  <p className="text-gray-800 whitespace-pre-line">{reqData.description}</p>
                )}
                {Array.isArray(reqData.attachments) && reqData.attachments.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-900">{t('portal.attachments.title')}</h4>
                    <ul className="mt-2 divide-y divide-gray-200 rounded-md border border-gray-200">
                      {reqData.attachments.map((a: any, i: number) => {
                        const avStatus: string | undefined = a?.avStatus ?? (typeof a?.avDetails?.clean === 'boolean' ? (a.avDetails.clean ? 'clean' : 'infected') : undefined)
                        return (
                          <li key={`${a.name || 'file'}-${i}`} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span className="truncate">
                              {(a.name || t('common.file'))} {a.size ? <span className="text-gray-500">({Math.round(a.size/1024)} KB)</span> : null}
                              {a.url ? (
                                <>
                                  {' '}
                                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{t('common.view')}</a>
                                </>
                              ) : null}
                              {a.uploadError ? (
                                <span className="ml-2 text-red-600">{a.uploadError}</span>
                              ) : null}
                            </span>
                            {avStatus && (
                              <span className={
                                avStatus === 'clean' ? 'text-green-600' : avStatus === 'infected' ? 'text-red-600' : 'text-yellow-600'
                              }>
                                {avStatus === 'clean' ? t('portal.attachments.clean') : avStatus === 'infected' ? t('portal.attachments.infected') : avStatus}
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                    {(() => {
                      const hasInfected = reqData.attachments.some((a: any) => {
                        const avStatus: string | undefined = a?.avStatus ?? (typeof a?.avDetails?.clean === 'boolean' ? (a.avDetails.clean ? 'clean' : 'infected') : undefined)
                        return avStatus === 'infected'
                      })
                      const role = (session as any)?.user?.role
                      if (!hasInfected) return null
                      return (
                        <div className="mt-2 flex items-center justify-between rounded-md bg-red-50 px-3 py-2">
                          <p className="text-sm text-red-700">{t('portal.attachments.quarantineWarning')}</p>
                          {role && role !== 'CLIENT' && (
                            <Button variant="destructive" asChild aria-label={t('portal.attachments.openQuarantine')}>
                              <Link href={`/admin/uploads/quarantine?serviceRequestId=${encodeURIComponent(String(id || ''))}`}>{t('portal.attachments.openQuarantine')}</Link>
                            </Button>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('portal.discussion.title')}</CardTitle>
                <CardDescription>{t('portal.discussion.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(reqData.comments || []).length === 0 ? (
                    <p className="text-sm text-gray-600">{t('portal.discussion.empty')}</p>
                  ) : (
                    <div className="space-y-3">
                      {(reqData.comments || []).map((c: any) => (
                        <div key={c.id} className="bg-gray-50 rounded-md p-3">
                          <div className="text-sm text-gray-700">{c.content}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {c.author?.name || t('portal.discussion.you')} • {new Date(c.createdAt).toLocaleString()}
                          </div>
                          {Array.isArray(c.attachments) && c.attachments.length > 0 && (
                            <div className="mt-2">
                              <h5 className="text-xs font-medium text-gray-900">{t('portal.attachments.title')}</h5>
                              <ul className="mt-1 divide-y divide-gray-200 rounded-md border border-gray-200">
                                {c.attachments.map((a: any, i: number) => {
                                  const avStatus: string | undefined = a?.avStatus ?? (typeof a?.avDetails?.clean === 'boolean' ? (a.avDetails.clean ? 'clean' : 'infected') : undefined)
                                  return (
                                    <li key={`${a.name || 'file'}-${i}`} className="flex items-center justify-between px-3 py-2 text-xs">
                                      <span className="truncate">
                                        {(a.name || t('common.file'))} {a.size ? <span className="text-gray-500">({Math.round(a.size/1024)} KB)</span> : null}
                                        {a.url ? (
                                          <>
                                            {' '}
                                            <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{t('common.view')}</a>
                                          </>
                                        ) : null}
                                        {a.uploadError ? (
                                          <span className="ml-2 text-red-600">{a.uploadError}</span>
                                        ) : null}
                                      </span>
                                      {avStatus && (
                                        <span className={
                                          avStatus === 'clean' ? 'text-green-600' : avStatus === 'infected' ? 'text-red-600' : 'text-yellow-600'
                                        }>
                                          {avStatus === 'clean' ? t('portal.attachments.clean') : avStatus === 'infected' ? t('portal.attachments.infected') : avStatus}
                                        </span>
                                      )}
                                    </li>
                                  )
                                })}
                              </ul>
                              {(() => {
                                const hasInfected = c.attachments.some((a: any) => {
                                  const s: string | undefined = a?.avStatus ?? (typeof a?.avDetails?.clean === 'boolean' ? (a.avDetails.clean ? 'clean' : 'infected') : undefined)
                                  return s === 'infected'
                                })
                                const role = (session as any)?.user?.role
                                if (!hasInfected) return null
                                return (
                                  <div className="mt-2 flex items-center justify-between rounded-md bg-red-50 px-3 py-2">
                                    <p className="text-xs text-red-700">{t('portal.attachments.commentQuarantineWarning')}</p>
                                    {role && role !== 'CLIENT' && (
                                      <Button variant="destructive" size="sm" asChild aria-label={t('portal.attachments.openQuarantine')}>
                                        <Link href={`/admin/uploads/quarantine?serviceRequestId=${encodeURIComponent(String(id || ''))}`}>{t('portal.attachments.openQuarantine')}</Link>
                                      </Button>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2">
                    <Label htmlFor="comment">{t('portal.discussion.addComment')}</Label>
                    <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} className="mt-1" rows={3} />
                    <div className="mt-2">
                      <Input
                        id="comment-files"
                        type="file"
                        multiple
                        className="mt-1"
                        onChange={(e) => {
                          const next = Array.from(e.target.files || [])
                          const existing = new Set(commentFiles.map((f) => `${f.name}-${f.lastModified}`))
                          const fresh = next.filter((f) => !existing.has(`${f.name}-${f.lastModified}`))
                          setCommentFiles((prev) => [...prev, ...fresh])
                          fresh.forEach((f) => uploadSingle(f))
                        }}
                        aria-label={t('portal.discussion.attachmentsAria')}
                      />
                      {commentFiles.length > 0 && (
                        <ul className="mt-2 divide-y divide-gray-200 rounded-md border border-gray-200">
                          {commentFiles.map((f, idx) => {
                            const key = `${f.name}-${f.lastModified}`
                            const info = uploaded[key]
                            const isUploading = !!uploadingKeys[key]
                            const pct = typeof uploadProgress[key] === 'number' ? uploadProgress[key] : (info?.url ? 100 : 0)
                            return (
                              <li key={`${f.name}-${idx}`} className="px-3 py-2 text-sm flex items-center justify-between">
                                <span className="truncate">
                                  {f.name} <span className="text-gray-500">({Math.round(f.size/1024)} KB)</span>
                                  {info?.url && (
                                    <>
                                      {' '}
                                      <a href={info.url} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">{t('common.view')}</a>
                                    </>
                                  )}
                                  {info?.error && (
                                    <span className="ml-2 text-red-600">{info.error}</span>
                                  )}
                                </span>
                                <div className="flex items-center gap-3">
                                  {(isUploading || info?.url) && (
                                    <>
                                      <progress value={pct} max={100} className="w-32 h-2" />
                                      <span className="text-xs text-gray-600">{pct}%</span>
                                    </>
                                  )}
                                  {!info?.url && !isUploading && (
                                    <Button variant="outline" size="sm" onClick={() => uploadSingle(f)} aria-label={t('portal.discussion.retryUpload')}>
                                      {info?.error ? t('portal.discussion.retryUpload') : t('portal.discussion.upload')}
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" onClick={() => setCommentFiles((prev) => prev.filter((_, i) => i !== idx))} aria-label={t('portal.discussion.remove')}>
                                    {t('portal.discussion.remove')}
                                  </Button>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                      {commentFiles.length > 0 && hasPendingUploads && (
                        <p className="mt-1 text-xs text-gray-600">{t('portal.discussion.waitUploads')}</p>
                      )}
                    </div>
                    <div className="flex justify-end mt-2">
                      <Button onClick={submitComment} disabled={!comment.trim() || hasPendingUploads} aria-label={t('portal.discussion.postComment')}>{t('portal.discussion.postComment')}</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Reschedule dialog */}
      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('portal.reschedule.title')}</DialogTitle>
            <DialogDescription>{t('portal.reschedule.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label htmlFor="apt-date">{t('portal.reschedule.date')}</Label>
                <Input id="apt-date" type="date" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} />
              </div>
              <div>
                <Label>{t('portal.reschedule.duration')}</Label>
                <Select value={String(slotDuration || '')} onValueChange={(v) => setSlotDuration(v ? Number(v) as number : '')}>
                  <SelectTrigger aria-label={t('portal.reschedule.durationPlaceholder')}>
                    <SelectValue placeholder={t('portal.reschedule.durationPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('portal.reschedule.default')}</SelectItem>
                    <SelectItem value="30">30</SelectItem>
                    <SelectItem value="45">45</SelectItem>
                    <SelectItem value="60">60</SelectItem>
                    <SelectItem value="90">90</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={fetchAvailability} disabled={!appointmentDate || loadingSlots || !reqData?.service?.id} aria-label={t('portal.reschedule.findSlots')}>
                  {loadingSlots ? t('common.loading') : t('portal.reschedule.findSlots')}
                </Button>
              </div>
            </div>

            {slots.length > 0 && (
              <div className="mt-1">
                <div className="text-xs text-gray-600 mb-1">{t('portal.reschedule.availableTimes')}</div>
                <div className="flex flex-wrap gap-2">
                  {slots.filter(s => s.available).map((s) => {
                    const dt = new Date(s.start)
                    const label = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    const isSel = selectedSlot === s.start
                    return (
                      <Button key={s.start} type="button" size="sm" variant={isSel ? 'default' : 'outline'} onClick={() => setSelectedSlot(s.start)} aria-label={label}>
                        {label}
                      </Button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleOpen(false)} aria-label={t('portal.reschedule.close')}>{t('portal.reschedule.close')}</Button>
            <Button onClick={submitReschedule} disabled={!selectedSlot} aria-label={t('portal.reschedule.confirm')}>{t('portal.reschedule.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
