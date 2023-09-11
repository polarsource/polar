import clsx from 'clsx'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { classNames } from 'polarkit/utils'

const BackerNavigation = (props: { classNames: string }) => {
  const path = usePathname()

  // All routes and conditions
  const navs = [
    {
      id: 'active-issues',
      title: 'Active Issues',
      link: `/feed`,
    },
    {
      id: 'rewards',
      title: 'Rewards',
      link: `/rewards`,
    },
    {
      id: 'settings',
      title: 'Settings',
      link: `/settings`,
    },
  ]

  // Filter routes, set isActive, and if subs should be expanded
  const filteredNavs = navs.map((n) => {
    const isActive = path && path.startsWith(n.link)
    return {
      ...n,
      isActive,
    }
  })

  return (
    <div className={clsx('bg-gray-50 py-3 dark:bg-gray-800', props.classNames)}>
      <div className="flex flex-row items-center justify-center gap-8 text-sm">
        {filteredNavs.map((n) => (
          <>
            <Link
              className={classNames(
                'hover:text-blue-700 dark:hover:text-blue-800',
                n.isActive
                  ? 'text-blue-600'
                  : 'text-gray-600 dark:text-gray-400',
              )}
              key={n.title}
              href={n.link}
            >
              <span className="font-medium ">{n.title}</span>
            </Link>
          </>
        ))}
      </div>
    </div>
  )
}

export default BackerNavigation
