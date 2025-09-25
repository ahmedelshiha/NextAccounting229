'use client'

import type { Column, RowAction } from '@/types/dashboard'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from '@/lib/i18n'

/**
 * Generic, lightweight table used across admin lists. Supports optional
 * selection, basic column sorting, and per-row actions. Visual style is
 * intentionally minimal and matches existing tokens.
 */
export default function DataTable<T extends { id?: string | number }>({ columns, rows, loading, sortBy, sortOrder = 'asc', onSort, actions = [], selectable = false, onSelectionChange }: { columns: Column<T>[]; rows: T[]; loading?: boolean; sortBy?: string; sortOrder?: 'asc' | 'desc'; onSort?: (key: string) => void; actions?: RowAction<T>[]; selectable?: boolean; onSelectionChange?: (ids: Array<string | number>) => void }) {
  const { t } = useTranslations()
  const [selected, setSelected] = useState<Set<string | number>>(new Set())
  const allSelected = useMemo(() => rows.length > 0 && selected.size === rows.length, [rows.length, selected])

  const toggleAll = () => {
    const next = allSelected ? new Set<string | number>() : new Set(rows.map((r) => r.id!).filter(Boolean))
    setSelected(next)
    onSelectionChange?.(Array.from(next))
  }

  const toggleOne = (id?: string | number) => {
    if (id == null) return
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelected(next)
    onSelectionChange?.(Array.from(next))
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-100 rounded-t-lg" />
          {[...Array(5)].map((_, i) => (<div key={i} className="h-16 bg-gray-50 border-t border-gray-100" />))}
        </div>
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-600">
        {t('dashboard.noData')}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {selectable && (
                <th className="px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
              )}
              {columns.map((c) => (
                <th key={String(c.key)} className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}`}>
                  {c.sortable && onSort ? (
                    <button onClick={() => onSort(String(c.key))} className="flex items-center gap-1 hover:text-gray-700">
                      <span>{c.label}</span>
                      {sortBy === c.key && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
              {actions.length > 0 && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('dashboard.actions')}</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((row, idx) => (
              <tr key={row.id ?? idx} className="hover:bg-gray-50">
                {selectable && (
                  <td className="px-4 py-4"><input type="checkbox" checked={row.id != null && selected.has(row.id)} onChange={() => toggleOne(row.id)} /></td>
                )}
                {columns.map((c) => (
                  <td key={String(c.key)} className={`px-6 py-4 whitespace-nowrap text-sm ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}`}>
                    {c.render ? c.render((row as any)[c.key as any], row) : (row as any)[c.key as any]}
                  </td>
                ))}
                {actions.length > 0 && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      {actions.map((a, i) => (
                        <button key={i} onClick={() => a.onClick(row)} className={`px-3 py-1 text-xs font-medium rounded-md ${a.variant === 'destructive' ? 'text-red-600 hover:bg-red-50' : 'text-gray-600 hover:bg-gray-100'}`}>{a.label}</button>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectable && selected.size > 0 && (
        <div className="px-4 py-3 border-t bg-gray-50 text-sm text-gray-700">{t('dashboard.selectedCount', { count: selected.size })}</div>
      )}
    </div>
  )
}
