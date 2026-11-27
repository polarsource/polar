import { describe, expect, test } from 'vitest'
import type {
  AppliedEntry,
  ConfigIssue,
  LoadedConfig,
} from '@/schemas/BillingConfig'
import { draftUsage, validateUsage } from '@/utils/billing-config/usage'

const config: LoadedConfig = {
  file: 'billing/polar.config.ts',
  source: '',
  input: {},
  generated: true,
}

const entry = (id: string, action: AppliedEntry['action']): AppliedEntry => ({
  section: 'products',
  id,
  action,
  diff: [],
})

const issue = (
  code: string,
  severity: ConfigIssue['severity'],
): ConfigIssue => ({ severity, code, path: 'meters.0', message: 'Nope' })

test('validateUsage reports the format, the issue codes and the conflicts', () => {
  expect(
    validateUsage({
      config,
      result: {
        entries: [entry('pro', 'updated')],
        issues: [
          issue('unknown_event', 'warning'),
          issue('missing', 'error'),
          issue('missing', 'error'),
        ],
      },
      catalogs: {
        live: null,
        draft: {
          id: 'draft',
          name: null,
          drift: [entry('pro', 'updated')],
          conflicts: [entry('pro', 'updated')],
        },
      },
    }),
  ).toEqual({
    config_format: 'ts',
    config_status: 'invalid',
    config_issue_codes: ['missing', 'unknown_event'],
    config_conflicts: 1,
  })
})

describe('draftUsage', () => {
  const applied = (entries: AppliedEntry[]) =>
    ({ status: 'applied', entries }) as const

  test.each([
    [applied([entry('pro', 'updated')]), false, 'saved'],
    [applied([entry('pro', 'unchanged')]), false, 'unchanged'],
    [applied([entry('pro', 'unchanged')]), true, 'reverted'],
    [
      { status: 'conflict', conflicts: [entry('pro', 'updated')] },
      false,
      'conflict',
    ],
    [
      { status: 'rejected', issues: [issue('missing', 'error')] },
      false,
      'rejected',
    ],
  ] as const)('names the outcome %#', (result, revertedDraft, status) => {
    expect(
      draftUsage({ config, result, revertedDraft, conflicts: 0 })[
        'config_status'
      ],
    ).toBe(status)
  })

  test('counts the conflicts a forced save discarded', () => {
    expect(
      draftUsage({
        config,
        result: applied([entry('pro', 'updated')]),
        revertedDraft: false,
        conflicts: 2,
      }),
    ).toMatchObject({ config_status: 'saved', config_conflicts: 2 })
  })
})
