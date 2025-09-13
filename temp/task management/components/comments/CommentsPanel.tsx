'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

function formatDate(d: string) {
  try { return new Date(d).toLocaleString() } catch (e) { return d }
}

export default function CommentsPanel({ taskId }: { taskId: string }) {
  const [comments, setComments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState<any[]>([])

  const fetchComments = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/tasks/${encodeURIComponent(taskId)}/comments`)
      if (!r.ok) throw new Error('Failed')
      const data = await r.json()
      setComments(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchComments() }, [taskId])

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files)
    arr.forEach(async (f) => {
      try {
        const reader = new FileReader()
        reader.onload = () => {
          setAttachments(prev => [...prev, { name: f.name, size: f.size, type: f.type, dataUrl: reader.result }])
        }
        reader.readAsDataURL(f)
      } catch (e) { console.error(e) }
    })
  }

  const postComment = async (parentId?: string | null) => {
    if (!content.trim() && attachments.length === 0) return
    const payload = { content: content.trim(), parentId: parentId || null, attachments }
    // optimistic UI
    const temp = { id: 'tmp_' + Date.now(), authorName: 'You', content: payload.content, attachments: payload.attachments, createdAt: new Date().toISOString(), pending: true }
    setComments(prev => [...prev, temp])
    setContent('')
    setAttachments([])
    try {
      const r = await fetch(`/api/admin/tasks/${encodeURIComponent(taskId)}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!r.ok) throw new Error('Failed')
      const saved = await r.json()
      setComments(prev => prev.map(c => c.id === temp.id ? saved : c))
    } catch (e) {
      console.error(e)
      setComments(prev => prev.filter(c => c.id !== temp.id))
      alert('Failed to post comment')
    }
  }

  const renderThread = (parentId: string | null = null, level = 0) => {
    return comments.filter(c => (c.parentId || null) === parentId).map(c => (
      <div key={c.id} className={`mb-3 pl-${Math.min(level*4, 12)} border-l ${level===0? 'pl-0':''}`}>
        <div className="text-sm text-gray-700 font-medium">{c.authorName || 'Anonymous'} <span className="text-xs text-gray-500">{formatDate(c.createdAt)}</span></div>
        <div className="text-sm text-gray-800 mt-1">{c.content}</div>
        {c.attachments?.length > 0 && (
          <div className="mt-2 flex gap-2 flex-wrap">
            {c.attachments.map((a: any, idx: number) => (
              <a key={idx} href={a.dataUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">{a.name}</a>
            ))}
          </div>
        )}
        {/* Reply form (simple) */}
        <div className="mt-2 flex gap-2">
          <button onClick={async () => {
            const reply = prompt('Reply')
            if (!reply) return
            await postComment(c.id)
          }} className="text-xs text-blue-600">Reply</button>
        </div>
        <div className="mt-3">{renderThread(c.id, level + 1)}</div>
      </div>
    ))
  }

  return (
    <div className="bg-white border rounded p-4">
      <h4 className="text-sm font-semibold mb-3">Comments</h4>

      <div className="space-y-3 mb-3 max-h-[300px] overflow-auto">
        {loading ? <div className="text-sm text-gray-500">Loading...</div> : (comments.length === 0 ? <div className="text-sm text-gray-500">No comments</div> : renderThread(null, 0))}
      </div>

      <div className="space-y-2">
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write a comment..." />
        <div className="flex items-center gap-2">
          <Input type="file" onChange={(e) => handleFiles(e.target.files)} />
          <Button onClick={() => postComment(null)}>Post Comment</Button>
        </div>
      </div>
    </div>
  )
}
