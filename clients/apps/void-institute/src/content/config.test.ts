import { checksumOf, compile } from '@void/sdk/config'
import { describe, expect, it } from 'vitest'
import { configLesson, stages } from './config'

describe('config chapter', () => {
  it('shows a reducer and a meter from one meter export', () => {
    const ir = compile(stages.meter)
    expect(ir.events.map((e) => e.name)).toEqual(['crawl.page'])
    expect(ir.reducers.map((r) => r.slug)).toEqual(['bandwidth'])
    expect(ir.meters).toEqual([
      {
        slug: 'bandwidth',
        reducer: 'bandwidth',
        unit_amount: 0.00000008,
        currency: 'usd',
      },
    ])
  })

  it('changes the checksum when an export is added', () => {
    expect(checksumOf(stages.config)).not.toBe(checksumOf(stages.more))
    expect(compile(stages.more).reducers.map((r) => r.slug)).toEqual([
      'bandwidth',
      'indexed',
    ])
  })

  it('names the code it shows after the exports it compiles', () => {
    const shown = configLesson.steps
      .map((step) => step.code)
      .filter((code): code is string => code !== undefined)
    expect(shown.at(-1)).toContain(
      "count('indexed', on(page, { status: 'ok' }))",
    )
    expect(shown.at(-1)).toContain('schema: { page, bandwidth, indexed }')
  })
})
