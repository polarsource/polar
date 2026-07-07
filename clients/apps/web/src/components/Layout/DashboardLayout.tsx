'use client'

import LogoIcon from '@/components/Brand/logos/LogoIcon'
import { CompassIntroModal } from '@/components/Compass/CompassIntroModal'
import { Modal } from '@polar-sh/orbit'
import { useModal } from '@/components/Modal/useModal'
import { useAuth } from '@/hooks/auth'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { CONFIG } from '@/utils/config'
import { setLastVisitedEnv, setLastVisitedOrg } from '@/utils/cookies'
import ViewSidebarOutlined from '@mui/icons-material/ViewSidebarOutlined'
import { Button } from '@polar-sh/orbit'
import { SidebarTrigger } from '@polar-sh/ui/components/atoms/Sidebar'
import { motion } from 'motion/react'
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
import { useRoute } from '../Navigation/useRoute'
import { DashboardSidebar } from './Dashboard/DashboardSidebar'
import TopbarRight from './Public/TopbarRight'
import { CompassBox } from '../Compass/CompassBox'

const DashboardLayout = (
  props: PropsWithChildren<{
    type?: 'organization' | 'account'
    className?: string
  }>,
) => {
  const { organization, organizations } = useContext(OrganizationContext)

  useEffect(() => {
    setLastVisitedEnv(CONFIG.IS_SANDBOX ? 'sandbox' : 'production')
    if (organization) {
      setLastVisitedOrg(organization.slug)
    }
  }, [organization])

  return (
    <DashboardProvider organization={organization}>
      {props.type !== 'account' && organization && (
        <CompassIntroModal organization={organization} />
      )}
      <div className="relative flex h-full w-full flex-col bg-white md:flex-row md:bg-gray-100 md:p-2 dark:bg-transparent">
        <MobileNav />
        <div className="hidden md:flex">
          <DashboardSidebar
            organization={organization}
            organizations={organizations ?? []}
            type={props.type}
          />
        </div>
        <div
          className={twMerge(
            'relative flex h-full w-full flex-col',
            props.className,
          )}
        >
          {/* On large devices, scroll here. On small devices the _document_ is the only element that should scroll. */}
          <main className="relative flex min-h-0 min-w-0 grow flex-col">
            {props.children}
          </main>
        </div>
      </div>
    </DashboardProvider>
  )
}

export default DashboardLayout

const MobileNav = () => {
  const { currentUser } = useAuth()

  const header = (
    <div className="dark:bg-polar-900 sticky top-0 right-0 left-0 flex w-full flex-row items-center justify-between bg-gray-50 p-4">
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        className="shrink-0 items-center font-semibold text-black dark:text-white"
      >
        <LogoIcon className="h-10 w-10" />
      </a>

      <div className="flex flex-row items-center gap-x-6">
        <TopbarRight authenticatedUser={currentUser} />
        <SidebarTrigger />
      </div>
    </div>
  )

  return (
    <div className="dark:bg-polar-900 relative z-20 flex w-screen flex-col items-center justify-between bg-gray-50 md:hidden">
      {header}
    </div>
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
      <div className="dark:bg-polar-900 dark:border-polar-800 relative flex min-w-0 flex-2 flex-col items-center rounded-2xl border-gray-200 bg-white px-4 md:overflow-y-auto md:border md:px-8 md:shadow-xs">
        <div
          className={twMerge(
            'flex h-full w-full flex-col gap-8 pt-8',
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

              {header}
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
