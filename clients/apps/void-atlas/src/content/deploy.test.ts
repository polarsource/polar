import { checksum, compile, parseIr } from '@void/sdk/config'
import { describe, expect, it } from 'vitest'
import { deployLesson, hashes, stages } from './deploy'

describe('deploy chapter', () => {
  it('moves the hash for deployed edits and not for runtime ones', () => {
    expect(hashes.base).toMatch(/^[0-9a-f]{64}$/)
    expect(hashes.export).not.toBe(hashes.base)
    expect(hashes.runtime).toBe(hashes.export)
    expect(hashes.signal).not.toBe(hashes.export)
    expect(hashes.signalEdited).not.toBe(hashes.signal)
    expect(hashes.filter).not.toBe(hashes.export)
    expect(hashes.slug).not.toBe(hashes.export)
    expect(new Set(Object.values(hashes)).size).toBe(6)
  })

  it('keeps the changed reducer under its old slug so the server can refuse it', () => {
    const before = compile(stages.export).reducers.find(
      (r) => r.slug === 'indexed',
    )!
    const after = compile(stages.filter).reducers.find(
      (r) => r.slug === 'indexed',
    )!
    expect(before.filter).not.toEqual(after.filter)
    expect(compile(stages.slug).reducers.map((r) => r.slug)).toEqual([
      'bandwidth',
      'indexed-errors',
    ])
  })

  it('round-trips through void.json without changing the version', () => {
    const ir = compile(stages.export)
    const pulled = parseIr(JSON.parse(JSON.stringify(ir)))
    expect(checksum(pulled)).toBe(hashes.export)
    expect(ir.version).toBe(4)
  })

  it('shows the real hashes in the terminal output', () => {
    const shown = deployLesson.steps.map((step) => step.code ?? '').join('\n')
    expect(shown).toContain(hashes.base)
    expect(shown).toContain(hashes.export)
    expect(shown).toContain(hashes.slug)
  })
})
