import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { RouteWithActive } from './navigation'

export interface NavigationContainerProps {
  routes: RouteWithActive[]
  title?: string
  dummyRoutes?: {
    title: string
    icon: React.ReactElement<any>
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
          className="dark:text-polar-500 text-xxs px-3 tracking-widest text-gray-400 uppercase"
          style={{
            fontFeatureSettings: `'ss02'`,
          }}
        >
          {title}
        </span>
      )}
      <div className="flex flex-col gap-y-3">
        <div className="flex flex-col">
          {routes.map((route) => {
            return (
              <Link
                key={route.link}
                className={twMerge(
                  'flex flex-row items-center gap-x-4 rounded-xl border border-transparent px-3 py-2 transition-colors dark:border-transparent',
                  route.isActive
                    ? 'dark:bg-polar-900 dark:border-polar-800 border-gray-200 bg-white text-black shadow-xs dark:text-white'
                    : 'dark:text-polar-500 dark:hover:text-polar-200 text-gray-500 hover:text-black',
                )}
                href={route.link}
              >
                {'icon' in route && route.icon ? (
                  <span
                    className={twMerge(
                      'flex flex-col items-center justify-center rounded-full bg-transparent text-[18px]',
                      route.isActive
                        ? 'text-blue-500 dark:text-white'
                        : 'bg-transparent',
                    )}
                  >
                    {route.icon}
                  </span>
                ) : undefined}
                <span className="text-sm font-medium">{route.title}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
