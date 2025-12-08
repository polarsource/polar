import HiveOutlined from '@mui/icons-material/HiveOutlined'

export const getQuickActions = (organizationSlug: string) => [
  {
    id: 'create-product',
    title: 'Create Product',
    url: `/dashboard/${organizationSlug}/products/new`,
    icon: <HiveOutlined fontSize="inherit" />,
  },
]
