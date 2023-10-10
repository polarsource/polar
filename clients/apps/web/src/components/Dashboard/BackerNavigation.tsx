import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { classNames } from 'polarkit/utils'
import { backerRoutes } from './navigation'

const BackerNavigation = (props: { classNames?: string }) => {
  const path = usePathname()

  // All routes and conditions
  const navs = backerRoutes

  // Filter routes, set isActive, and if subs should be expanded
  const filteredNavs = navs.map((n) => {
    const isActive = path && path.startsWith(n.link)
    return {
      ...n,
      isActive,
    }
  })

  return (
    <div className="flex flex-col gap-2 px-4 py-6">
      {filteredNavs.map((n) => (
        <div key={n.link} className="flex flex-col gap-4">
          <Link
            className={classNames(
              'flex items-center gap-2 rounded-xl px-5 py-3 hover:text-blue-700 dark:hover:text-gray-200',
              n.isActive
                ? 'bg-blue-50 text-blue-600 dark:bg-gray-900'
                : 'text-gray-900 dark:text-gray-500',
            )}
            href={n.link}
          >
            {n.icon}
            <span className="ml-3 text-sm font-medium">{n.title}</span>
          </Link>
        </div>
      ))}
    </div>
  )
}

export default BackerNavigation
