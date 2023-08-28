import { useCurrentOrgAndRepoFromURL } from '@/hooks/org'
import { ArrowUpRightIcon } from '@heroicons/react/20/solid'
import {
  CubeIcon,
  CurrencyDollarIcon,
  ExclamationCircleIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline'

import Link from 'next/link'
import { useRouter } from 'next/router'
import { classNames } from 'polarkit/utils'
import { useState } from 'react'

const MaintainerNavigation = () => {
  const router = useRouter()
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  // All routes and conditions
  const navs = [
    {
      id: 'org-issues',
      title: 'Issues',
      icon: <ExclamationCircleIcon className="h-6 w-6" />,
      link: `/maintainer/${org?.name}/issues`,
      if: org && isLoaded,
    },
    {
      id: 'org-finance',
      title: 'Finance',
      icon: <CurrencyDollarIcon className="h-6 w-6" />,
      link: `/maintainer/${org?.name}/finance`,
      if: org && isLoaded,
    },
    {
      id: 'org-promote',
      title: 'Promote',
      icon: <MegaphoneIcon className="h-6 w-6" />,
      link: '#', // Hacky. Navs with subs are not clickable.
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
        {
          title: 'Public site',
          link: `/${org?.name}`,
          postIcon: <ArrowUpRightIcon className="h-4 w-4" />,
        },
      ],
    },

    // Non org navigation
    {
      id: 'personal-dependencies',
      title: 'Dependencies',
      icon: <CubeIcon className="h-6 w-6" />,
      link: `/feed`,
      if: !org && isLoaded,
    },
  ]

  const [clickedFirstLevelLink, setClickedFirstLevelLink] = useState('')

  const onFirstLevelLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string,
  ) => {
    const nav = navs.find((n) => n.id === id)
    if (!nav) {
      return
    }

    // If have subs, prevent navigation and save as clicked
    if (nav && nav.subs) {
      e.preventDefault()
      e.stopPropagation()
      setClickedFirstLevelLink(id)
    }
  }

  // Filter routes, set isActive, and if subs should be expanded
  const filteredNavs = navs
    .filter((n) => !!n.if)
    .map((n) => {
      const isActive = router.asPath.startsWith(n.link)

      const subs =
        n.subs?.map((s) => {
          return {
            ...s,
            isActive: router.asPath.startsWith(s.link),
          }
        }) || []

      const anySubIsActive = subs.find((s) => s.isActive)

      return {
        ...n,
        isActive,
        expandSubs:
          isActive || clickedFirstLevelLink === n.id || anySubIsActive,
        subs,
      }
    })

  return (
    <div className="flex flex-col gap-6 py-8 pl-6 pr-2">
      {filteredNavs.map((n) => (
        <div key={n.link} className="flex flex-col gap-4">
          <Link
            className={classNames(
              'flex items-center gap-2 hover:text-blue-700 dark:hover:text-blue-800',
              n.isActive ? 'text-blue-600' : 'text-gray-900 dark:text-gray-400',
            )}
            href={n.link}
            onClick={(e) => {
              onFirstLevelLinkClick(e, n.id)
            }}
          >
            {n.icon}
            <span className="font-medium ">{n.title}</span>
          </Link>

          {n.subs &&
            n.expandSubs &&
            n.subs.map((s) => (
              <Link
                key={s.link}
                className={classNames(
                  'ml-8',
                  'flex items-center gap-1 hover:text-blue-700 dark:hover:text-blue-800',
                  s.isActive
                    ? 'text-blue-600'
                    : 'text-gray-900 dark:text-gray-400',
                )}
                href={s.link}
              >
                {s.title}
                {s.postIcon}
              </Link>
            ))}
        </div>
      ))}
    </div>
  )
}

export default MaintainerNavigation
