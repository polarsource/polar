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
              ' flex items-center gap-2 rounded-xl px-5 py-3',
              n.isActive
                ? 'dark:bg-polar-800 bg-blue-50 text-blue-600 dark:text-blue-600'
                : 'dark:text-polar-400 dark:hover:text-polar-200 text-gray-900 hover:text-blue-700',
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
