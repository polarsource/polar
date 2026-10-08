import { describe, expect, test } from 'vitest'
import { differences, externalIdOf } from '@/utils/billing-config/compare'

const meter = (external_id: string, name = external_id) => ({
  external_id,
  name,
  unit: 'scalar',
})

describe('externalIdOf', () => {
  test('reads a string external_id and nothing else', () => {
    expect(externalIdOf({ external_id: 'a' })).toBe('a')
    expect(externalIdOf({ external_id: 1 })).toBeUndefined()
    expect(externalIdOf('a')).toBeUndefined()
  })
})

describe('differences', () => {
  test('lists local entries that differ from or are missing on the organization', () => {
    expect(
      differences(
        { meters: [meter('a', 'mine'), meter('same'), meter('local_only')] },
        { meters: [meter('a', 'theirs'), meter('same'), meter('remote_only')] },
      ),
    ).toEqual([
      { section: 'meters', id: 'a' },
      { section: 'meters', id: 'local_only' },
    ])
  })

  test('ignores nulls and key order, and metadata the file does not set', () => {
    expect(
      differences(
        { meters: [{ unit: 'scalar', name: 'a', external_id: 'a' }] },
        {
          meters: [
            { ...meter('a'), custom_label: null, metadata: { team: 'x' } },
          ],
        },
      ),
    ).toEqual([])
  })

  test('compares metadata the file does set', () => {
    const remote = { meters: [{ ...meter('a'), metadata: { team: 'x' } }] }
    expect(
      differences(
        { meters: [{ ...meter('a'), metadata: { team: 'x' } }] },
        remote,
      ),
    ).toEqual([])
    expect(
      differences(
        { meters: [{ ...meter('a'), metadata: { team: 'y' } }] },
        remote,
      ),
    ).toEqual([{ section: 'meters', id: 'a' }])
    expect(
      differences({ meters: [{ ...meter('a'), metadata: {} }] }, remote),
    ).toEqual([{ section: 'meters', id: 'a' }])
  })

  test('a duplicated local id always differs, so pull cannot collapse it', () => {
    expect(
      differences(
        { meters: [meter('a', 'first'), meter('a')] },
        { meters: [meter('a')] },
      ),
    ).toEqual([{ section: 'meters', id: 'a' }])
  })

  test('an empty or missing section has nothing to differ', () => {
    expect(differences({}, { meters: [meter('a')] })).toEqual([])
    expect(differences({ meters: [] }, {})).toEqual([])
  })
})
