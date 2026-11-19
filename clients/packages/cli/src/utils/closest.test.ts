import { describe, expect, test } from 'vitest'
import { closest } from '@/utils/closest'

describe('closest', () => {
  test('finds the candidate a typo was meant to be', () => {
    expect(closest('api_cal', ['storage', 'api_call'])).toBe('api_call')
    expect(closest('Priorty_Support', ['priority_support'])).toBe(
      'priority_support',
    )
  })

  test('suggests nothing when no candidate is close', () => {
    expect(closest('pro', ['free', 'team'])).toBeUndefined()
    expect(closest('api_call', ['api_call'])).toBeUndefined()
    expect(closest('api_call', [])).toBeUndefined()
  })
})
