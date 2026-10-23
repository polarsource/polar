import { HiveOutlined } from '@polar-sh/orbit/icons'
export const getQuickActions = (organizationSlug: string) => [
  {
    id: 'create-product',
    title: 'Create Product',
    url: `/dashboard/${organizationSlug}/products/new`,
    icon: <HiveOutlined fontSize="inherit" />,
  },
]
