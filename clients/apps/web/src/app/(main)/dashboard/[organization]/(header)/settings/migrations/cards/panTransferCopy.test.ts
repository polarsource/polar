import { describe, expect, it } from 'vitest'
import {
  isValidStripeMigrationId,
  stripeMigrationIdError,
} from './panTransferCopy'

describe('isValidStripeMigrationId', () => {
  it('accepts migreq_ plus alphanumerics and underscores', () => {
    expect(isValidStripeMigrationId('migreq_abc123')).toBe(true)
    expect(isValidStripeMigrationId('migreq_ABC_def_9')).toBe(true)
  })

  it('rejects missing prefix or empty suffix', () => {
    expect(isValidStripeMigrationId('migreq_')).toBe(false)
    expect(isValidStripeMigrationId('req_abc')).toBe(false)
    expect(isValidStripeMigrationId('migreq-abc')).toBe(false)
  })
})

describe('stripeMigrationIdError', () => {
  it('allows empty optional values', () => {
    expect(stripeMigrationIdError('')).toBeNull()
    expect(stripeMigrationIdError('   ')).toBeNull()
  })

  it('returns an error for malformed non-empty values', () => {
    expect(stripeMigrationIdError('bad')).toMatch(/migreq_/)
  })

  it('returns null for a valid id', () => {
    expect(stripeMigrationIdError('migreq_ok_1')).toBeNull()
  })
})
