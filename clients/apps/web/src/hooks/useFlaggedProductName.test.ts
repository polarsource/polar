import { describe, expect, it } from 'vitest'
import { getFlaggedNamesToReport } from './useFlaggedProductName'

const flagged = (name: string) => ({
  name,
  category: 'gambling',
  phrase: null,
  flagged_at: '2026-11-02T14:51:02.000Z',
})

describe('getFlaggedNamesToReport', () => {
  it('reports a flagged name that was kept', () => {
    const casino = flagged('Casino Night')
    expect(getFlaggedNamesToReport('Casino Night', [casino])).toEqual([casino])
  })

  it('reports a kept name submitted in different casing', () => {
    const casino = flagged('Casino Night')
    expect(getFlaggedNamesToReport('casino night', [casino])).toEqual([casino])
  })

  it('reports every flagged name that was tried before a clean one', () => {
    const coaching = flagged('Coaching Package')
    const shipping = flagged('T-Shirt Shipping')
    expect(
      getFlaggedNamesToReport('Design Templates', [coaching, shipping]),
    ).toEqual([coaching, shipping])
  })

  it('reports both names when the submitted name is flagged too', () => {
    const casino = flagged('Casino Night')
    const poker = flagged('Poker Night')
    expect(getFlaggedNamesToReport('Poker Night', [casino, poker])).toEqual([
      casino,
      poker,
    ])
  })

  it('ignores a flagged name the user was still typing past', () => {
    expect(getFlaggedNamesToReport('Callback API', [flagged('Call')])).toEqual(
      [],
    )
  })

  it('reports nothing when no name was flagged', () => {
    expect(getFlaggedNamesToReport('Pro Plan', [])).toEqual([])
  })
})
