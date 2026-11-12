import { describe, expect, test } from 'vitest'
import { removeFromPython } from '@/services/billing-config/languages/python/remove'

const source = [
  'from polar.config import BenefitSet, Config, Flag, Meter, MeterSet, Sum',
  '',
  '',
  'class Meters(MeterSet):',
  '    apples = Meter("Apples", on="apple")',
  '    pears = Meter(',
  '        "Pears",',
  '        on="pear",',
  '        aggregate=Sum("weight"),',
  '        deprecated=True,',
  '    )',
  '',
  '    plums = Meter("Plums", on="plum", deprecated=True)',
  '',
  '',
  'class Benefits(BenefitSet):',
  '    beta = Flag("Beta", deprecated=True)',
  '',
  '',
  'config = Config(meters=Meters, benefits=Benefits)',
  '',
].join('\n')

describe('removeFromPython', () => {
  test('removes whole entries and leaves the rest untouched', () => {
    expect(
      removeFromPython(source, [
        { section: 'meters', id: 'pears' },
        { section: 'meters', id: 'plums' },
      ]),
    ).toEqual({
      source: [
        'from polar.config import BenefitSet, Config, Flag, Meter, MeterSet, Sum',
        '',
        '',
        'class Meters(MeterSet):',
        '    apples = Meter("Apples", on="apple")',
        '',
        '',
        '',
        'class Benefits(BenefitSet):',
        '    beta = Flag("Beta", deprecated=True)',
        '',
        '',
        'config = Config(meters=Meters, benefits=Benefits)',
        '',
      ].join('\n'),
      missing: [],
    })
  })

  test('leaves a pass in a class that loses its last entry', () => {
    const { source: edited } = removeFromPython(source, [
      { section: 'benefits', id: 'beta' },
    ])

    expect(edited).toContain('class Benefits(BenefitSet):\n    pass\n')
  })

  test('changes nothing when an entry cannot be found', () => {
    const removals = [
      { section: 'meters', id: 'pears' },
      { section: 'meters', id: 'kiwis' },
    ]

    expect(removeFromPython(source, removals)).toEqual({
      source,
      missing: [{ section: 'meters', id: 'kiwis' }],
    })
  })
})
