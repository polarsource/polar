import { describe, expect, test } from 'vitest'
import { removeFromJson } from '@/services/billing-config/languages/json/remove'

describe('removeFromJson', () => {
  const input = {
    meters: [{ external_id: 'apples' }, { external_id: 'pears' }],
    benefits: [{ external_id: 'beta' }],
  }
  const json = `${JSON.stringify(input, null, 2)}\n`

  test('removes entries by external ID', () => {
    const { source, missing } = removeFromJson(json, input, [
      { section: 'meters', id: 'apples' },
      { section: 'benefits', id: 'beta' },
    ])
    expect(missing).toEqual([])
    expect(JSON.parse(source)).toEqual({
      meters: [{ external_id: 'pears' }],
      benefits: [],
    })
  })

  test('keeps the formatting when the last entry of a section is removed', () => {
    const { source } = removeFromJson(json, input, [
      { section: 'meters', id: 'pears' },
    ])

    expect(source).toBe(
      `${JSON.stringify({ ...input, meters: [{ external_id: 'apples' }] }, null, 2)}\n`,
    )
  })

  test('changes nothing when an entry cannot be found', () => {
    expect(
      removeFromJson(json, input, [{ section: 'products', id: 'legacy' }]),
    ).toEqual({
      source: json,
      missing: [{ section: 'products', id: 'legacy' }],
    })
  })
})
