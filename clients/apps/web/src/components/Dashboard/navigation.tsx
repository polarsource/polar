import { Organization } from 'polarkit/api/client'

import { ArrowUpRightIcon } from '@heroicons/react/20/solid'
import { CubeIcon } from '@heroicons/react/24/outline'
import {
  AttachMoneyOutlined,
  CardGiftcardOutlined,
  FavoriteBorderOutlined,
  HowToVoteOutlined,
  TuneOutlined,
  WifiTethering,
} from '@mui/icons-material'

export const maintainerRoutes = (org?: Organization, isLoaded?: boolean) =>
  [
    {
      id: 'org-issues',
      title: 'Issues',
      icon: <HowToVoteOutlined className="h-6 w-6" />,
      link: `/maintainer/${org?.name}/issues`,
      if: org && isLoaded,
    },
    {
      id: 'org-finance',
      title: 'Finance',
      icon: <AttachMoneyOutlined className="h-6 w-6" />,
      link: `/maintainer/${org?.name}/finance`,
      if: org && isLoaded,
    },
    {
      id: 'org-promote',
      title: 'Promote',
      icon: <WifiTethering className="h-6 w-6" />,
      link: `/maintainer/${org?.name}/promote`,
      if: org && isLoaded,
      subs: [
        {
          title: 'Issues',
          link: `/maintainer/${org?.name}/promote/issues`,
        },
        {
          title: 'Embeds',
          link: `/maintainer/${org?.name}/promote/embeds`,
        },
      ],
    },
    {
      id: 'public-site',
      title: 'Public site',
      link: `/${org?.name}`,
      postIcon: <ArrowUpRightIcon className="h-4 w-4" />,
      if: org && isLoaded,
    },

    // Non org navigation
    {
      id: 'personal-dependencies',
      title: 'Dependencies',
      icon: <CubeIcon className="h-6 w-6" />,
      link: `/feed`,
      if: !org && isLoaded,
    },
  ] as const

export const backerRoutes = [
  {
    id: 'funding',
    title: 'Funding',
    link: `/feed`,
    icon: <FavoriteBorderOutlined className="h-6 w-6" />,
  },
  {
    id: 'rewards',
    title: 'Rewards',
    link: `/rewards`,
    icon: <CardGiftcardOutlined className="h-6 w-6" />,
  },
  {
    id: 'settings',
    title: 'Settings',
    link: `/settings`,
    icon: <TuneOutlined className="h-6 w-6" />,
  },
] as const

export type Route = {
  title: string
  link: string
}
