import { Route } from '@/components/Dashboard/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

const TopbarNavigation = ({
  routes,
  unauthenticated,
}: {
  routes: Route[]
  unauthenticated?: boolean
}) => {
  const path = usePathname()

  // Filter routes, set isActive, and if subs should be expanded
  const filteredRoutes = routes
    .filter((n) => ('if' in n ? n.if : true))
    .map((n) => {
      const isActive = path && n.link !== '/' && path.startsWith(n.link)
      return {
        ...n,
        isActive,
      }
    })

  const LinkElement = unauthenticated ? 'a' : Link

  return (
    <div className="flex flex-row items-center">
      {filteredRoutes.map((n) => (
        <div key={n.link} className="flex flex-col gap-4">
          <LinkElement
            className={twMerge(
              'flex flex-shrink-0 items-center gap-x-2 rounded-full border border-transparent px-4 py-2 transition-colors',
              n.isActive
                ? 'bg-blue-50 text-blue-500 dark:bg-blue-950 dark:text-blue-300'
                : 'dark:text-polar-500 dark:hover:text-polar-300 text-gray-500 hover:text-blue-500',
            )}
            href={n.link}
          >
            {'title' in n && n.title ? (
              <span
                className={twMerge(
                  'whitespace-nowrap text-xs',
                  n.isActive && 'font-medium',
                )}
              >
                {n.title}
              </span>
            ) : undefined}
          </LinkElement>
        </div>
      ))}
    </div>
  )
}

export default TopbarNavigation
