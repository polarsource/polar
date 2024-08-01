import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { RouteWithActive } from './navigation'

export interface NavigationContainerProps {
  title: string
  routes: RouteWithActive[]
}

export const NavigationContainer = ({
  title,
  routes,
}: NavigationContainerProps) => {
  return (
    <div className="dark:bg-polar-800 m-6 flex flex-col gap-y-4 rounded-3xl bg-gray-100 p-6">
      <span className="dark:text-polar-500 text-sm text-gray-500">{title}</span>
      <div className="flex flex-col gap-y-3">
        {routes.map((route) => {
          return (
            <Link
              key={route.link}
              className={twMerge(
                'flex flex-row items-center gap-x-2 rounded-lg transition-colors',
                route.isActive
                  ? 'text-blue-500 dark:text-blue-400'
                  : 'dark:text-polar-500 dark:hover:text-polar-200 text-gray-700 hover:text-blue-500',
              )}
              href={route.link}
            >
              {'icon' in route && route.icon ? (
                <span
                  className={twMerge(
                    'flex flex-col items-center justify-center rounded-full bg-transparent text-[18px]',
                    route.isActive ? 'dark:text-blue-400' : 'bg-transparent',
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
  )
}
