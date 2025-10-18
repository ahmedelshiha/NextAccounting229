/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { useSystemHealth } from '@/hooks/admin/useSystemHealth'

// Mock SWR to control hook behavior and capture config
const swrState: { data: any; error: any; isLoading: boolean; mutate: () => void; key: string | null; config?: any } = {
  data: null,
  error: null,
  isLoading: false,
  mutate: vi.fn(),
  key: null,
}

vi.mock('swr', () => {
  return {
    default: (key: string | null, _fetcher: any, config: any) => {
      swrState.key = key
      swrState.config = config
      return {
        data: swrState.data,
        error: swrState.error,
        isLoading: swrState.isLoading,
        mutate: swrState.mutate,
      }
    },
  }
})

// Simple test component to render hook values
function HookProbe({ interval, enabled, onChange }: { interval?: number; enabled?: boolean; onChange?: (s: string) => void }) {
  const { health, error, isLoading, mutate, status, message, timestamp } = useSystemHealth({ interval, enabled, onStatusChange: (s) => onChange?.(s) })
  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="message">{message}</div>
      <div data-testid="has-error">{error ? 'yes' : 'no'}</div>
      <div data-testid="is-loading">{isLoading ? 'yes' : 'no'}</div>
      <div data-testid="timestamp">{timestamp || ''}</div>
      <div data-testid="health-status">{health?.status || ''}</div>
      <button onClick={() => mutate()} data-testid="mutate">mutate</button>
    </div>
  )
}

const healthy = {
  status: 'operational' as const,
  message: 'All systems operational',
  checks: {
    database: { status: 'operational', latency: 42, lastChecked: new Date().toISOString() },
    api: { status: 'operational', latency: 12, lastChecked: new Date().toISOString() },
  },
  timestamp: new Date().toISOString(),
}

const degraded = {
  status: 'degraded' as const,
  message: 'Service degraded: database experiencing high latency',
  checks: {
    database: { status: 'degraded', latency: 1200, lastChecked: new Date().toISOString() },
    api: { status: 'operational', latency: 20, lastChecked: new Date().toISOString() },
  },
  timestamp: new Date().toISOString(),
}

beforeEach(() => {
  swrState.data = null
  swrState.error = null
  swrState.isLoading = false
  swrState.mutate = vi.fn()
  swrState.key = null
  swrState.config = undefined
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useSystemHealth hook', () => {
  it('returns initial default state when no data', () => {
    render(<HookProbe />)
    expect(screen.getByTestId('status').textContent).toBe('unknown')
    expect(screen.getByTestId('message').textContent?.toLowerCase()).toContain('checking')
    expect(screen.getByTestId('has-error').textContent).toBe('no')
  })

  it('fetches from correct endpoint', () => {
    render(<HookProbe />)
    expect(swrState.key).toBe('/api/admin/system/health')
  })

  it('respects enabled=false by not subscribing to endpoint', () => {
    render(<HookProbe enabled={false} />)
    expect(swrState.key).toBeNull()
  })

  it('uses configured polling interval in SWR options', () => {
    render(<HookProbe interval={12345} />)
    expect(swrState.config?.revalidateInterval).toBe(12345)
  })

  it('exposes health data when available', () => {
    swrState.data = healthy
    render(<HookProbe />)
    expect(screen.getByTestId('status').textContent).toBe('operational')
    expect(screen.getByTestId('health-status').textContent).toBe('operational')
    expect(screen.getByTestId('message').textContent).toContain('All systems operational')
  })

  it('sets error state when SWR error provided', () => {
    swrState.error = new Error('boom')
    render(<HookProbe />)
    expect(screen.getByTestId('has-error').textContent).toBe('yes')
  })

  it('triggers onStatusChange when status changes', () => {
    const onChange = vi.fn()
    swrState.data = healthy
    const { rerender } = render(<HookProbe onChange={onChange} />)

    // First render sets previous status; simulate change
    swrState.data = degraded
    rerender(<HookProbe onChange={onChange} />)

    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls[0][0]).toBe('degraded')
  })

  it('provides mutate function passthrough', () => {
    const mutate = vi.fn()
    swrState.mutate = mutate
    render(<HookProbe />)
    act(() => {
      screen.getByTestId('mutate').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(mutate).toHaveBeenCalled()
  })
})
