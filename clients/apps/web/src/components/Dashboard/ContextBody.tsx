import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import { SubNav } from '../Navigation/DashboardTopbar'
import { useRoute } from '../Navigation/useRoute'
import { SubRouteWithActive } from './navigation'

interface ContextBodyItem {
  id: string
  title: string
  description: string
  active: boolean
  onSelect: (id: string) => void
}

interface ContextBodyProps extends PropsWithChildren {
  className?: string
  title?: string
  items?: ContextBodyItem[]
  cta?: React.ReactElement
  contextView?: React.ReactElement
  contextViewClassName?: string
  header?: boolean
}

export const ContextBody = ({
  children,
  className,
  title,
  cta,
  items,
  contextView,
  contextViewClassName,
}: ContextBodyProps) => {
  const currentRoute = useRoute()

  const hasCurrent = (currentRoute?.subs as SubRouteWithActive[])?.some(
    (i) => i.isActive,
  )

  return (
    <div className={twMerge('flex h-full w-full flex-row gap-x-6')}>
      <div className="dark:md:bg-polar-900 dark:border-polar-700 dark:divide-polar-700 relative flex w-full flex-col divide-x rounded-2xl border-gray-200 md:flex-row md:overflow-y-auto md:border md:bg-gray-50 md:shadow-sm">
        <div className="flex w-full max-w-80 flex-col items-start gap-y-8 overflow-y-auto py-8">
          <div className="flex w-full flex-col gap-y-4 px-6 md:flex-row md:items-center md:justify-between">
            <h4 className="whitespace-nowrap text-xl font-medium dark:text-white">
              {title ?? currentRoute?.title}
            </h4>
            {cta}
          </div>
          <div className="flex w-full flex-col gap-y-1 px-4">
            {items?.map((item) => (
              <div
                key={item.id}
                className={twMerge(
                  'dark:hover:bg-polar-800 flex cursor-pointer flex-col rounded-xl border border-transparent px-3 py-2 hover:bg-white dark:border-transparent',
                  item.active
                    ? 'dark:bg-polar-800 dark:border-polar-700 bg-white shadow-sm'
                    : '',
                )}
                onClick={() => item.onSelect(item.id)}
              >
                <h5 className="text-black text-sm dark:text-white">{item.title}</h5>
                <p className="text-sm text-gray-500">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto flex h-full w-full flex-col items-center px-4 md:px-12">
          <div className="flex w-full max-w-screen-lg flex-col gap-y-8">
            <div className="flex w-full flex-col gap-y-4 py-6 md:flex-row md:items-center md:justify-between md:py-8">
              <h1 className="text-2xl font-medium">
                {items?.find((i) => i.active)?.title}
              </h1>
              {currentRoute &&
              'subs' in currentRoute &&
              hasCurrent &&
              (currentRoute.subs?.length ?? 0) > 0 ? (
                <div className="flex flex-row items-center gap-4 gap-y-24">
                  <SubNav items={currentRoute.subs ?? []} />
                </div>
              ) : null}
            </div>
            <div className={twMerge('flex w-full flex-col pb-8', className)}>
              {children}
            </div>
          </div>
        </div>
      </div>
      {contextView ? (
        <div
          className={twMerge(
            'dark:bg-polar-900 dark:border-polar-700 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 md:max-w-[320px] xl:max-w-[440px]',
            contextViewClassName,
          )}
        >
          {contextView}
        </div>
      ) : null}
    </div>
  )
}
