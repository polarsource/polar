import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useImpressionEvent } from './useImpressionEvent'

const captureMock = vi.fn()

vi.mock('@/hooks/posthog', () => ({
  usePostHog: () => ({ capture: captureMock }),
}))

beforeEach(() => {
  captureMock.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useImpressionEvent', () => {
  it('fires once when `enabled` is omitted (defaults to true)', () => {
    renderHook(() =>
      useImpressionEvent({
        event: 'dashboard:subscriptions:plan_upsell:view',
        build: () => ({ ok: true }),
      }),
    )
    expect(captureMock).toHaveBeenCalledTimes(1)
    expect(captureMock).toHaveBeenCalledWith(
      'dashboard:subscriptions:plan_upsell:view',
      { ok: true },
    )
  })

  it('fires the event once when enabled is true on mount', () => {
    const build = vi.fn(() => ({ org_id: 'org_1', value: 1 }))
    renderHook(() =>
      useImpressionEvent({
        event: 'dashboard:subscriptions:plan_upsell:view',
        enabled: true,
        build,
      }),
    )
    expect(captureMock).toHaveBeenCalledTimes(1)
    expect(captureMock).toHaveBeenCalledWith(
      'dashboard:subscriptions:plan_upsell:view',
      { org_id: 'org_1', value: 1 },
    )
    expect(build).toHaveBeenCalledTimes(1)
  })

  it('does not fire when enabled is false', () => {
    renderHook(() =>
      useImpressionEvent({
        event: 'dashboard:subscriptions:plan_upsell:view',
        enabled: false,
        build: () => ({}),
      }),
    )
    expect(captureMock).not.toHaveBeenCalled()
  })

  it('fires exactly once even after multiple re-renders with enabled true', () => {
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useImpressionEvent({
          event: 'dashboard:subscriptions:plan_upsell:view',
          enabled,
          build: () => ({ tick: Math.random() }),
        }),
      { initialProps: { enabled: true } },
    )
    rerender({ enabled: true })
    rerender({ enabled: true })
    expect(captureMock).toHaveBeenCalledTimes(1)
  })

  it('fires on the false→true transition, then stays silent', () => {
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useImpressionEvent({
          event: 'dashboard:subscriptions:plan_upsell:view',
          enabled,
          build: () => ({ ok: true }),
        }),
      { initialProps: { enabled: false } },
    )
    expect(captureMock).not.toHaveBeenCalled()

    rerender({ enabled: true })
    expect(captureMock).toHaveBeenCalledTimes(1)

    // Toggling enabled back doesn't re-fire when it becomes true again.
    rerender({ enabled: false })
    rerender({ enabled: true })
    expect(captureMock).toHaveBeenCalledTimes(1)
  })

  it('does not fire on remount until enabled becomes true', () => {
    const { unmount } = renderHook(() =>
      useImpressionEvent({
        event: 'dashboard:subscriptions:plan_upsell:view',
        enabled: false,
        build: () => ({}),
      }),
    )
    expect(captureMock).not.toHaveBeenCalled()
    act(() => unmount())

    renderHook(() =>
      useImpressionEvent({
        event: 'dashboard:subscriptions:plan_upsell:view',
        enabled: true,
        build: () => ({ ok: true }),
      }),
    )
    expect(captureMock).toHaveBeenCalledTimes(1)
  })
})
