'use client'

import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { setLastVisitedOrg } from '@/utils/cookies'
import ViewSidebarOutlined from '@mui/icons-material/ViewSidebarOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useSidebar } from '@polar-sh/ui/components/atoms/Sidebar'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  type JSX,
} from 'react'
import { twMerge } from 'tailwind-merge'
import { DashboardProvider } from '../Dashboard/DashboardProvider'
import { SubRouteWithActive } from '../Dashboard/navigation'
import { useRoute } from '../Navigation/useRoute'
import { AppShell } from './AppShell/AppShell'

const DashboardLayout = (
  props: PropsWithChildren<{
    type?: 'organization' | 'account'
    className?: string
  }>,
) => {
  const { organization, organizations } = useContext(OrganizationContext)

  useEffect(() => {
    if (organization) {
      setLastVisitedOrg(organization.slug)
    }
  }, [organization])

  return (
    <DashboardProvider organization={organization}>
      <AppShell
        type={props.type ?? 'organization'}
        organization={organization}
        organizations={organizations ?? []}
      >
        <div
          className={twMerge(
            'relative flex h-full w-full flex-col',
            props.className,
          )}
        >
          <main className="relative flex min-h-0 min-w-0 grow flex-col">
            {props.children}
          </main>
        </div>
      </AppShell>
    </DashboardProvider>
  )
}

export default DashboardLayout

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

export interface DashboardBodyProps {
  children?: React.ReactNode
  className?: string
  wrapperClassName?: string
  title?: JSX.Element | string | null
  contextView?: React.ReactNode
  contextViewClassName?: string
  contextViewPlacement?: 'left' | 'right'
  contextViewTitle?: string
  header?: JSX.Element
  titleActions?: React.ReactNode
  wide?: boolean
}

export const DashboardBody = ({
  children,
  className,
  wrapperClassName,
  title,
  contextView,
  contextViewClassName,
  contextViewPlacement = 'right',
  contextViewTitle = 'Details',
  header,
  titleActions,
  wide = false,
}: DashboardBodyProps) => {
  const { currentRoute, currentSubRoute } = useRoute()

  const { state } = useSidebar()

  const isCollapsed = state === 'collapsed'

  const current = currentSubRoute ?? currentRoute

  const parsedTitle = title ?? current?.title

  const pathname = usePathname()
  const {
    isShown: isContextShown,
    show: showContext,
    hide: hideContext,
  } = useModal()
  const lastPathnameRef = useRef(pathname)

  useEffect(() => {
    if (lastPathnameRef.current !== pathname) {
      lastPathnameRef.current = pathname
      hideContext()
    }
  }, [pathname, hideContext])

  return (
    <motion.div
      className={twMerge(
        'flex h-full w-full flex-row gap-x-2',
        contextViewPlacement === 'left' ? 'flex-row-reverse' : '',
      )}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="relative flex min-w-0 flex-2 flex-col items-center">
        <div
          className={twMerge(
            'flex h-full w-full flex-col gap-8',
            wrapperClassName,
            wide ? '' : 'max-w-(--breakpoint-xl)',
          )}
        >
          {(title !== null || !!header || contextView) && (
            <div className="flex flex-col gap-y-4 md:flex-row md:items-center md:justify-between md:gap-x-4">
              {(title !== null || contextView || titleActions) && (
                <div className="flex items-center gap-x-2 md:contents">
                  {title !== null &&
                    (!title || typeof parsedTitle === 'string' ? (
                      <h4 className="text-2xl font-medium whitespace-nowrap dark:text-white">
                        {title ?? current?.title}
                      </h4>
                    ) : (
                      parsedTitle
                    ))}
                  {titleActions && (
                    <div className="ml-auto flex items-center gap-x-2 md:hidden">
                      {titleActions}
                    </div>
                  )}
                  {contextView && (
                    <Button
                      size="icon"
                      variant="secondary"
                      className={twMerge(
                        'h-8 w-8 md:hidden',
                        titleActions ? '' : 'ml-auto',
                      )}
                      onClick={showContext}
                      aria-label={`Open ${contextViewTitle}`}
                    >
                      <ViewSidebarOutlined fontSize="small" />
                    </Button>
                  )}
                </div>
              )}

              {header ? (
                header
              ) : isCollapsed && currentRoute && 'subs' in currentRoute ? (
                <SubNav items={currentRoute.subs ?? []} />
              ) : null}
            </div>
          )}

          <motion.div
            className={twMerge('flex w-full flex-col pb-8', className)}
            variants={{
              initial: { opacity: 0 },
              animate: { opacity: 1, transition: { duration: 0.3 } },
              exit: { opacity: 0, transition: { duration: 0.3 } },
            }}
          >
            {children}
          </motion.div>
        </div>
      </div>
      {contextView ? (
        <motion.div
          variants={{
            initial: { opacity: 0 },
            animate: { opacity: 1, transition: { duration: 0.3 } },
            exit: { opacity: 0, transition: { duration: 0.3 } },
          }}
          className={twMerge(
            'dark:bg-polar-900 dark:border-polar-800 hidden w-full flex-1 overflow-y-auto rounded-2xl border border-gray-200 bg-white md:block md:max-w-[320px] md:shadow-xs xl:max-w-[440px]',
            contextViewClassName,
          )}
        >
          {contextView}
        </motion.div>
      ) : null}
      {contextView && (
        <Modal
          title={contextViewTitle}
          isShown={isContextShown}
          hide={hideContext}
          modalContent={<div>{contextView}</div>}
        />
      )}
    </motion.div>
  )
}
