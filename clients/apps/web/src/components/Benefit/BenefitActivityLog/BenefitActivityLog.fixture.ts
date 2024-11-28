import { LicenseKeyStatus, UserRead } from '@polar-sh/sdk'
import {
  ActivityEvent,
  ActivityEventContextType,
  BenefitActivityLogType,
} from './BenefitActivityLog.types'

export const benefitActivityLogEvents = (
  currentUser: UserRead,
): ActivityEvent[] => [
  {
    id: '-1',
    type: BenefitActivityLogType.LIFECYCLE,
    user: {
      name: currentUser.email ?? '',
      avatar: currentUser?.avatar_url ?? '',
    },
    createdAt: new Date().toISOString(),
    message: 'App Pro License Key was validated',
    context: {
      type: ActivityEventContextType.VALIDATED,
      licenseKey: {
        organization_id: '1',
        user_id: '1',
        id: '1',
        key: '123456789',
        user: {
          id: '1',
          public_name: 'John Doe',
          email: '',
          avatar_url: '',
        },
        display_key: '1234-5678-9',
        benefit_id: '1',
        status: LicenseKeyStatus.GRANTED,
        limit_activations: 10,
        usage: 0,
        limit_usage: 10,
        validations: 1,
        last_validated_at: null,
        expires_at: null,
      },
    },
  },
  {
    id: '0',
    type: BenefitActivityLogType.GRANTED,
    user: {
      name: currentUser.email ?? '',
      avatar: currentUser?.avatar_url ?? '',
    },
    createdAt: new Date().toISOString(),
    message: 'App Pro License was granted',
    context: {
      type: ActivityEventContextType.UPGRADE,

      fromProduct: 'App Basic Version',
      toProduct: 'App Pro Version',
    },
  },
  {
    id: '1',
    type: BenefitActivityLogType.REVOKED,
    user: {
      name: currentUser.email ?? '',
      avatar: currentUser?.avatar_url ?? '',
    },
    createdAt: new Date().toISOString(),
    message: 'App Basic License was revoked',
    context: {
      type: ActivityEventContextType.DOWNGRADE,
      fromProduct: 'App Pro Version',
      toProduct: 'App Basic Version',
    },
  },
  {
    id: '2',
    type: BenefitActivityLogType.GRANTED,
    user: {
      name: currentUser?.email ?? '',
      avatar: currentUser?.avatar_url ?? '',
    },
    createdAt: '2024-11-26T08:15:00Z',
    message: 'App Pro License was granted',
    context: {
      type: ActivityEventContextType.ORDER,
      product: 'App Pro Version',
    },
  },
  {
    id: '3',
    type: BenefitActivityLogType.LIFECYCLE,
    user: {
      name: currentUser?.email ?? '',
      avatar: currentUser?.avatar_url ?? '',
    },
    createdAt: '2024-01-15T08:15:00Z',
    message: 'App Pro License was enabled on product App Pro Version',
    context: {
      type: ActivityEventContextType.ENABLED,
      product: 'App Pro Version',
    },
  },
  {
    id: '4',
    type: BenefitActivityLogType.LIFECYCLE,
    user: {
      name: currentUser?.email ?? '',
      avatar: currentUser?.avatar_url ?? '',
    },
    createdAt: '2024-01-15T08:15:00Z',
    message: 'App Pro License was created',
    context: {
      type: ActivityEventContextType.CREATED,
    },
  },
]
