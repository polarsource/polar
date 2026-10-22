import { describe, expect, it } from 'vitest'
import { findFlaggedProductPhrase } from './blocked-words'

describe('findFlaggedProductPhrase', () => {
  it('matches a phrase anywhere in the name, ignoring case', () => {
    expect(findFlaggedProductPhrase('Gold Sponsorship Tier')).toEqual({
      category: 'sponsorships and donations',
      phrase: 'Sponsorship',
    })
  })

  it('matches plurals and multi-word phrases', () => {
    expect(findFlaggedProductPhrase('Monthly donations')?.phrase).toBe(
      'donations',
    )
    expect(findFlaggedProductPhrase('buy me a coffee')?.phrase).toBe(
      'buy me a coffee',
    )
  })

  it('only matches whole words', () => {
    expect(findFlaggedProductPhrase('Customer Portal')).toBeNull()
    expect(findFlaggedProductPhrase('Pro Plan')).toBeNull()
  })
})
