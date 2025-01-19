import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { RouteWithActive } from './navigation'

export interface NavigationContainerProps {
  routes: RouteWithActive[]
  title?: string
  dummyRoutes?: {
    title: string
    icon: React.ReactElement
  }[]
}

export const NavigationContainer = ({
  title,
  routes,
}: NavigationContainerProps) => {
  if (!routes.length) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-3">
      {title && (
        <span
          className="dark:text-polar-500 text-xxs px-3 uppercase tracking-widest text-gray-400"
          style={{
            fontFeatureSettings: `'ss02'`,
          }}
        >
          {title}
        </span>
      )}
      <div className="flex flex-col gap-y-3">
        <div className="flex flex-col gap-y-1">
          {routes.map((route) => {
            return (
              <Link
                key={route.link}
                className={twMerge(
                  'flex flex-row items-center gap-x-2 border border-transparent px-1 transition-colors dark:border-transparent',
                  route.isActive
                    ? 'dark:bg-polar-200 border-gray-200 bg-white text-black dark:text-black'
                    : 'dark:text-polar-500 dark:hover:text-polar-200 text-gray-500 hover:text-black',
                )}
                href={route.link}
              >
                {route.isActive && (
                  <span className="text-sm font-medium">{'>'}</span>
                )}
                <span className="text-sm font-medium">{route.title}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
