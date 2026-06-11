import { schemas } from '@polar-sh/client'
import { describe, expect, it } from 'vitest'
import {
  BenefitUpdate,
  prepareBenefitUpdatePayload,
} from './updateBenefitPayload'

describe('prepareBenefitUpdatePayload', () => {
  it('removes visibility for non-configurable benefit types', () => {
    const payload = prepareBenefitUpdatePayload(
      { visibility_configurable: false } as schemas['Benefit'],
      {
        type: 'slack_shared_channel',
        description: 'Slack',
        visibility: 'public',
        properties: {
          slack_integration_id: 'integration-id',
          channel_name_template: 'support-{customer_name}',
          private: true,
          team_invitees: [],
          welcome_message: '',
          archive_on_revoke: true,
        },
      } as BenefitUpdate,
    )

    expect('visibility' in payload).toBe(false)
  })

  it('keeps visibility for configurable benefit types', () => {
    const payload = prepareBenefitUpdatePayload(
      { visibility_configurable: true } as schemas['Benefit'],
      {
        type: 'feature_flag',
        description: 'Flag',
        visibility: 'private',
        properties: {},
      } as BenefitUpdate,
    )

    expect(payload.visibility).toBe('private')
  })
})
