import { describe, expect, it } from 'vitest'
import {
  isValidStripeMigrationId,
  STEP_COPY,
  stripeCopyStatusUrl,
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
  it('leaves empty values to required-field validation', () => {
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

describe('start copy', () => {
  it('requires the Stripe migration ID without payment method caveats', () => {
    expect(STEP_COPY.start_copy.inputs?.[0]).toMatchObject({
      name: 'stripe_migration_request_id',
      label: 'Stripe migration ID',
      required: true,
    })
    expect(STEP_COPY.start_copy.warning).toBe(
      'Only the account owner can start a copy.',
    )
  })

  it('builds the copy status URL from the source Stripe account', () => {
    expect(stripeCopyStatusUrl('acct_source')).toBe(
      'https://dashboard.stripe.com/acct_source/copy-status/shared',
    )
    expect(stripeCopyStatusUrl()).toBe(
      'https://dashboard.stripe.com/copy-status/shared',
    )
  })
})

describe('provider export', () => {
  it('keeps provider contact optional', () => {
    expect(STEP_COPY.request_provider_export.inputs?.[1]).toMatchObject({
      name: 'provider_contact',
      required: false,
    })
  })
})
