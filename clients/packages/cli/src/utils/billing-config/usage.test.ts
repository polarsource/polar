import { describe, expect, test } from 'vitest'
import type {
  AppliedEntry,
  ConfigIssue,
  LoadedConfig,
} from '@/schemas/BillingConfig'
import {
  draftUsage,
  initUsage,
  validateUsage,
} from '@/utils/billing-config/usage'

const config: LoadedConfig = {
  file: 'billing/polar.config.ts',
  source: '',
  input: { meters: [{}], benefits: [], products: [{}, {}] },
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

describe('validateUsage', () => {
  test('describes the file, the changes, the issues and the draft', () => {
    expect(
      validateUsage({
        config,
        result: {
          entries: [entry('pro', 'updated'), entry('team', 'created')],
          issues: [
            issue('unknown_event', 'warning'),
            issue('missing', 'error'),
            issue('missing', 'error'),
          ],
        },
        catalogs: {
          live: { id: 'live', name: 'v1' },
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
      config_meters: 1,
      config_benefits: 0,
      config_products: 2,
      config_created: 1,
      config_updated: 1,
      config_removed: 0,
      config_errors: 2,
      config_warnings: 1,
      config_issue_codes: ['missing', 'unknown_event'],
      config_status: 'invalid',
      config_draft: 'conflict',
      config_conflicts: 1,
      config_has_live: true,
    })
  })

  test.each([
    [undefined, 'unknown'],
    [{ live: null, draft: null }, 'none'],
    [{ live: null, draft: { drift: null } }, 'uncompared'],
    [{ live: null, draft: { drift: [entry('pro', 'updated')] } }, 'behind'],
    [{ live: null, draft: { drift: [] } }, 'in_sync'],
  ] as const)('names the state of the draft %#', (catalogs, state) => {
    const usage = validateUsage({
      config,
      result: { entries: [], issues: [] },
      catalogs:
        catalogs === undefined || catalogs.draft === null
          ? catalogs
          : {
              live: null,
              draft: {
                id: 'draft',
                name: null,
                conflicts: [],
                ...catalogs.draft,
              },
            },
    })
    expect(usage['config_draft']).toBe(state)
    expect(usage['config_status']).toBe('valid')
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

test('initUsage counts what still needs an external ID', () => {
  expect(
    initUsage({
      status: 'external_ids_required',
      organization: {
        id: 'org',
        name: 'Acme',
        slug: 'acme',
        environment: 'sandbox',
      },
      external_ids: [
        { resource: 'product', id: 'p', name: 'Pro', external_id: 'pro' },
      ],
      next: [],
    }),
  ).toEqual({
    config_status: 'external_ids_required',
    config_missing_external_ids: 1,
  })
})
