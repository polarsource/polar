import { schemas } from '@polar-sh/client'
import { HiveOutlined } from '@polar-sh/orbit/icons'
export const getQuickActions = (organization: schemas['Organization']) =>
  organization.feature_settings?.config_as_code_enabled
    ? []
    : [
        {
          id: 'create-product',
          title: 'Create Product',
          url: `/dashboard/${organization.slug}/products/new`,
          icon: <HiveOutlined fontSize="inherit" />,
        },
      ]
