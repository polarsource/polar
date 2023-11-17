import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
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
            className={twMerge(
              'flex items-center gap-x-4 rounded-xl border border-transparent px-5 py-3 transition-colors',
              n.isActive
                ? 'dark:bg-polar-800 dark:border-polar-700 bg-blue-50 text-blue-500 dark:text-blue-400'
                : 'dark:text-polar-500 dark:hover:text-polar-200 text-gray-900 hover:text-blue-700',
            )}
            href={n.link}
          >
            {'icon' in n && n.icon ? <span>{n.icon}</span> : undefined}
            <span className="text-sm font-medium">{n.title}</span>
            {'postIcon' in n && n.postIcon ? (
              <span>{n.postIcon}</span>
            ) : undefined}
          </Link>
        </div>
      ))}
    </div>
  )
}

export default BackerNavigation
