import { useCurrentOrgAndRepoFromURL } from '@/hooks/org'
import {
  Cog8ToothIcon,
  CubeIcon,
  CurrencyDollarIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { LogoIcon } from 'polarkit/components/brand'
import { classNames } from 'polarkit/utils'

const SidebarNavigation = () => {
  const router = useRouter()
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  const navs = [
    {
      title: 'Issues',
      icon: <ExclamationCircleIcon className="h-6 w-6" />,
      link: `/issues/${org?.name}`,
    },
    {
      title: 'Dependencies',
      icon: <CubeIcon className="h-6 w-6" />,
      link: `/dependencies/${org?.name}`,
    },
    {
      title: 'Finance',
      icon: <CurrencyDollarIcon className="h-6 w-6" />,
      link: `/finance/${org?.name}`,
    },
    {
      title: 'Settings',
      icon: <Cog8ToothIcon className="h-6 w-6" />,
      link: `/settings/${org?.name}`,
    },
  ].map((n) => {
    return { ...n, isActive: router.asPath.startsWith(n.link) }
  })

  const marketingNavs = [
    {
      title: 'Public site',
      icon: <LogoIcon className="h-6 w-6" />,
      link: `/${org?.name}`,
    },
    {
      title: 'Github',
      icon: <Cog8ToothIcon className="h-6 w-6" />,
      link: `https://github.com/${org?.name}`, // TODO: link to our own promo pages, not to github
    },
  ].map((n) => {
    return { ...n, isActive: n.link === router.asPath }
  })

  return (
    <div className="flex flex-col gap-6 py-8 pl-8 pr-2 ">
      {navs.map((n) => (
        <Link
          className={classNames(
            'flex items-center gap-2',
            n.isActive ? 'text-blue-600' : 'text-gray-900',
          )}
          key={n.title}
          href={n.link}
        >
          {n.icon}
          <span className="font-medium ">{n.title}</span>
        </Link>
      ))}

      <span className="mt-2 text-gray-500">Marketing</span>

      {marketingNavs.map((n) => (
        <Link
          className={classNames(
            'flex items-center gap-2',
            n.isActive ? 'text-blue-600' : 'text-gray-900',
          )}
          key={n.title}
          href={n.link}
        >
          {n.icon}
          <span className="font-medium ">{n.title}</span>
        </Link>
      ))}
    </div>
  )
}

export default SidebarNavigation
