import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useBillingPlanCompleteListener,
  useBillingPlanTelemetry,
} from './useBillingPlanTelemetry'

const captureMock = vi.fn()
const replaceMock = vi.fn()
let currentSearchParams = new URLSearchParams()

vi.mock('@/hooks/posthog', () => ({
  usePostHog: () => ({ capture: captureMock }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => currentSearchParams,
}))

beforeEach(() => {
  captureMock.mockClear()
  replaceMock.mockClear()
  currentSearchParams = new URLSearchParams()
  // The hooks read window.location.origin/pathname; jsdom provides both.
  // Pinning ensures URLs built in tests are predictable.
  Object.defineProperty(window, 'location', {
    value: {
      origin: 'https://app.example.com',
      pathname: '/dashboard/acme',
      href: 'https://app.example.com/dashboard/acme',
    },
    writable: true,
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useBillingPlanTelemetry', () => {
  it('buildUrls returns success/return URLs with source + attribution baked in', () => {
    const { result } = renderHook(() =>
      useBillingPlanTelemetry({
        source: 'plan_upsell',
        organizationId: 'org_1',
        successPath: '/dashboard/acme/settings/billing',
      }),
    )

    const urls = result.current.buildUrls({
      plan_name: 'Growth',
      plan_product_id: 'prod_growth',
      monthly_savings_cents: 30000,
    })

    const success = new URL(urls.success_url)
    expect(success.origin).toBe('https://app.example.com')
    expect(success.pathname).toBe('/dashboard/acme/settings/billing')
    expect(success.searchParams.get('checkout_success')).toBe('true')
    expect(success.searchParams.get('source')).toBe('plan_upsell')
    expect(success.searchParams.get('plan_name')).toBe('Growth')
    expect(success.searchParams.get('monthly_savings_cents')).toBe('30000')
    // utm_* is reserved for external marketing attribution.
    expect(success.searchParams.get('utm_source')).toBeNull()

    const cancel = new URL(urls.return_url)
    expect(cancel.pathname).toBe('/dashboard/acme')
    expect(cancel.searchParams.get('checkout_canceled')).toBe('true')
    expect(cancel.searchParams.get('source')).toBe('plan_upsell')
    expect(cancel.searchParams.get('utm_source')).toBeNull()
  })

  it('fires the cancel event and strips params when returning with canceled=true and matching source', () => {
    currentSearchParams = new URLSearchParams(
      '?checkout_canceled=true&source=plan_upsell&plan_name=Growth&plan_product_id=prod_growth',
    )
    renderHook(() =>
      useBillingPlanTelemetry({
        source: 'plan_upsell',
        organizationId: 'org_1',
        successPath: '/x',
      }),
    )
    expect(captureMock).toHaveBeenCalledTimes(1)
    expect(captureMock).toHaveBeenCalledWith(
      'dashboard:subscriptions:checkout:cancel',
      expect.objectContaining({
        organization_id: 'org_1',
        source: 'plan_upsell',
        plan_name: 'Growth',
        plan_product_id: 'prod_growth',
      }),
    )
    expect(replaceMock).toHaveBeenCalledWith('/dashboard/acme')
  })

  it('does not fire when the cancel return is for a different source', () => {
    currentSearchParams = new URLSearchParams(
      '?checkout_canceled=true&source=change_plan',
    )
    renderHook(() =>
      useBillingPlanTelemetry({
        source: 'plan_upsell',
        organizationId: 'org_1',
        successPath: '/x',
      }),
    )
    expect(captureMock).not.toHaveBeenCalled()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('does not fire on a clean URL with no cancel marker', () => {
    currentSearchParams = new URLSearchParams()
    renderHook(() =>
      useBillingPlanTelemetry({
        source: 'plan_upsell',
        organizationId: 'org_1',
        successPath: '/x',
      }),
    )
    expect(captureMock).not.toHaveBeenCalled()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('fires at most once per mount even if the cancel-URL effect runs twice (StrictMode / re-render before router.replace lands)', () => {
    currentSearchParams = new URLSearchParams(
      '?checkout_canceled=true&source=plan_upsell&plan_name=Growth&plan_product_id=prod_growth',
    )
    const { rerender } = renderHook(() =>
      useBillingPlanTelemetry({
        source: 'plan_upsell',
        organizationId: 'org_1',
        successPath: '/x',
      }),
    )
    // The router.replace is async; in dev StrictMode the effect re-runs
    // before the URL actually updates. The guard should still keep the
    // capture at exactly one.
    rerender()
    rerender()
    expect(captureMock).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalledTimes(1)
  })
})

describe('useBillingPlanCompleteListener', () => {
  it('fires complete and runs onComplete + replace when URL carries success + source', () => {
    currentSearchParams = new URLSearchParams(
      '?checkout_success=true&source=plan_upsell&plan_name=Growth&plan_product_id=prod_growth&monthly_savings_cents=30000',
    )
    const onComplete = vi.fn()
    renderHook(() =>
      useBillingPlanCompleteListener({
        organizationId: 'org_1',
        redirectPath: '/dashboard/acme/settings/billing',
        onComplete,
      }),
    )
    expect(captureMock).toHaveBeenCalledTimes(1)
    expect(captureMock).toHaveBeenCalledWith(
      'dashboard:subscriptions:checkout:complete',
      expect.objectContaining({
        organization_id: 'org_1',
        source: 'plan_upsell',
        plan_name: 'Growth',
        plan_product_id: 'prod_growth',
        monthly_savings_cents: 30000,
      }),
    )
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalledWith('/dashboard/acme/settings/billing')
  })

  it('runs onComplete and replace without firing when checkout_success is set but source is missing (internal nav)', () => {
    currentSearchParams = new URLSearchParams('?checkout_success=true')
    const onComplete = vi.fn()
    renderHook(() =>
      useBillingPlanCompleteListener({
        organizationId: 'org_1',
        redirectPath: '/dashboard/acme/settings/billing',
        onComplete,
      }),
    )
    expect(captureMock).not.toHaveBeenCalled()
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalled()
  })

  it('is a no-op when checkout_success is absent', () => {
    currentSearchParams = new URLSearchParams('?source=plan_upsell')
    const onComplete = vi.fn()
    renderHook(() =>
      useBillingPlanCompleteListener({
        organizationId: 'org_1',
        redirectPath: '/dashboard/acme/settings/billing',
        onComplete,
      }),
    )
    expect(captureMock).not.toHaveBeenCalled()
    expect(onComplete).not.toHaveBeenCalled()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('fires at most once per mount even if the complete-URL effect runs twice (StrictMode / re-render before router.replace lands)', () => {
    currentSearchParams = new URLSearchParams(
      '?checkout_success=true&source=plan_upsell&plan_name=Growth&plan_product_id=prod_growth&monthly_savings_cents=30000',
    )
    const onComplete = vi.fn()
    const { rerender } = renderHook(() =>
      useBillingPlanCompleteListener({
        organizationId: 'org_1',
        redirectPath: '/dashboard/acme/settings/billing',
        onComplete,
      }),
    )
    rerender()
    rerender()
    expect(captureMock).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalledTimes(1)
  })
})
