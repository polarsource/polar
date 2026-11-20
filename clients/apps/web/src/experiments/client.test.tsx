import { renderWithProviders } from '@/test-utils/render'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useExperiment } from './client'

vi.mock('./experiments', () => ({
  experiments: {
    test_experiment: {
      description: 'Test experiment',
      variants: ['control', 'treatment'],
      defaultVariant: 'control',
    },
  },
}))

const Probe = () => {
  const { variant } = useExperiment('test_experiment' as never)
  return <span>{variant}</span>
}

const renderProbeAt = (pathname: string) => {
  window.history.replaceState({}, '', pathname)
  return renderWithProviders(<Probe />, {
    experiments: { test_experiment: 'treatment' } as never,
  })
}

describe('useExperiment exposure tracking', () => {
  beforeEach(() => {
    document.cookie = 'polar_distinct_id=; max-age=0; path=/'
  })

  afterEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('tracks exposure on checkout without the distinct id cookie', () => {
    const { posthog, getByText } = renderProbeAt('/checkout/polar_c_test')

    expect(getByText('treatment')).toBeInTheDocument()
    expect(posthog.events).toEqual([
      {
        event: '$feature_flag_called',
        properties: {
          $feature_flag: 'test_experiment',
          $feature_flag_response: 'treatment',
        },
      },
    ])
  })

  it('skips exposure elsewhere when the distinct id cookie is missing', () => {
    const { posthog } = renderProbeAt('/acme')

    expect(posthog.events).toEqual([])
  })

  it('tracks exposure elsewhere when the distinct id cookie is set', () => {
    document.cookie = 'polar_distinct_id=anon_visitor; path=/'

    const { posthog } = renderProbeAt('/acme')

    expect(posthog.events).toHaveLength(1)
  })
})
