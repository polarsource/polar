'use client'

import { useSidebar } from '@polar-sh/ui/components/atoms/Sidebar'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { SubRouteWithActive } from '../Dashboard/navigation'
import { useRoute } from '../Navigation/useRoute'

const SubNav = (props: { items: SubRouteWithActive[] }) => {
  const current = props.items.find((i) => i.isActive)

  return (
    <Tabs value={current?.title}>
      <TabsList className="flex flex-row bg-transparent ring-0 dark:bg-transparent dark:ring-0">
        {props.items.map((item) => {
          return (
            <Link key={item.title} href={item.link} prefetch={true}>
              <TabsTrigger
                className="flex flex-row items-center gap-x-2 px-4"
                value={item.title}
              >
                <h3>{item.title}</h3>
              </TabsTrigger>
            </Link>
          )
        })}
      </TabsList>
    </Tabs>
  )
}

export interface MasterDetailLayoutProps {
  children?: React.ReactNode
  className?: string
  wrapperClassName?: string
  listView?: React.ReactElement<any>
  listViewClassName?: string
  wide?: boolean
}

export const MasterDetailLayout = ({
  children,
  className,
  wrapperClassName,
  listView,
  listViewClassName,
  wide = false,
}: MasterDetailLayoutProps) => {
  return (
    <motion.div
      className="flex h-full w-full flex-row gap-x-2"
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {listView ? (
        <motion.div
          variants={{
            initial: { opacity: 0 },
            animate: { opacity: 1, transition: { duration: 0.3 } },
            exit: { opacity: 0, transition: { duration: 0.3 } },
          }}
          className={twMerge(
            'dark:bg-polar-900 dark:border-polar-800 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white md:max-w-[320px] md:shadow-xs xl:max-w-[440px]',
            listViewClassName,
          )}
        >
          {listView}
        </motion.div>
      ) : null}

      <div className="dark:md:bg-polar-900 dark:border-polar-800 relative flex w-full flex-col items-center rounded-2xl border-gray-200 px-4 md:overflow-y-auto md:border md:bg-white md:px-8 md:shadow-xs">
        <div
          className={twMerge(
            'flex h-full w-full flex-col',
            wrapperClassName,
            wide ? '' : 'max-w-(--breakpoint-xl)',
          )}
        >
          {children}
        </div>
      </div>
    </motion.div>
  )
}

export const MasterDetailLayoutContent = ({
  title,
  header,
  className,
  children,
}: {
  title?: React.ReactNode
  header?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) => {
  const { currentRoute, currentSubRoute } = useRoute()

  const { state } = useSidebar()

  const isCollapsed = state === 'collapsed'

  const current = currentSubRoute ?? currentRoute

  return (
    <>
      <div className="flex w-full flex-col gap-y-4 py-8 md:flex-row md:items-center md:justify-between md:py-8">
        {header ? (
          header
        ) : isCollapsed && currentRoute && 'subs' in currentRoute ? (
          <SubNav items={currentRoute.subs ?? []} />
        ) : null}
      </div>

      <div className={twMerge('flex w-full flex-col pb-8', className)}>
        {children}
      </div>
    </>
  )
}
