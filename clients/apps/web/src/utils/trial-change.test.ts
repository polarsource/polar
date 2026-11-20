import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useTrialChangeOutcome } from './trial-change'

const subscription = {
  status: 'trialing' as const,
  trial_start: new Date().toISOString(),
  product: { id: 'product-1' },
}

const productWithTrial = {
  id: 'product-2',
  trial_interval: 'year' as const,
  trial_interval_count: 1,
}

const productWithoutTrial = {
  id: 'product-3',
  trial_interval: null,
  trial_interval_count: null,
}

describe('useTrialChangeOutcome', () => {
  it('continues the trial with the new product trial', () => {
    const { result } = renderHook(() =>
      useTrialChangeOutcome(subscription, productWithTrial, 'invoice'),
    )
    expect(result.current?.kind).toBe('continues')
  })

  it('ends the trial when the new product has none', () => {
    const { result } = renderHook(() =>
      useTrialChangeOutcome(subscription, productWithoutTrial, 'auto'),
    )
    expect(result.current).toEqual({ kind: 'ends' })
  })

  it('leaves the trial untouched when the change is deferred', () => {
    for (const product of [productWithTrial, productWithoutTrial]) {
      const { result } = renderHook(() =>
        useTrialChangeOutcome(subscription, product, 'next_period'),
      )
      expect(result.current).toBeNull()
    }
  })
})
