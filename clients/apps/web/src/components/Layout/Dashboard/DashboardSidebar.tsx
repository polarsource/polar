import { NotificationsPopover } from '@/components/Notifications/NotificationsPopover'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@polar-sh/ui/components/atoms/Sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import { BrandingMenu } from '../Public/BrandingMenu'
import MaintainerNavigation from './DashboardNavigation'

export const DashboardSidebar = () => {
  const router = useRouter()
  const { state } = useSidebar()

  const { organization, organizations } = useContext(
    MaintainerOrganizationContext,
  )

  const isCollapsed = state === 'collapsed'

  const navigateToOrganization = (org: schemas['Organization']) => {
    router.push(`/dashboard/${org.slug}`)
  }

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader
        className={twMerge(
          'flex md:pt-3.5',
          CONFIG.IS_SANDBOX ? 'md:pt-10' : '',
          isCollapsed
            ? 'flex-row items-center justify-between gap-y-4 md:flex-col md:items-start md:justify-start'
            : 'flex-row items-center justify-between',
        )}
      >
        <BrandingMenu size={32} />
        <motion.div
          key={isCollapsed ? 'header-collapsed' : 'header-expanded'}
          className={`flex ${isCollapsed ? 'flex-row md:flex-col-reverse' : 'flex-row'} items-center gap-2`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          <NotificationsPopover />
          <SidebarTrigger />
        </motion.div>
      </SidebarHeader>
      <SidebarContent className="gap-4 px-2 py-4">
        <motion.div
          key={isCollapsed ? 'nav-collapsed' : 'nav-expanded'}
          className={`flex ${isCollapsed ? 'flex-col' : 'flex-row'} items-center gap-2`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          <MaintainerNavigation />
        </motion.div>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton>
                  <Avatar
                    name={organization?.name}
                    avatar_url={organization?.avatar_url}
                    className="h-6 w-6"
                  />
                  {!isCollapsed && (
                    <>
                      <span className="min-w-0 truncate">
                        {organization?.name}
                      </span>
                      <ChevronDown className="ml-auto" />
                    </>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align={isCollapsed ? 'start' : 'center'}
                className="w-[--radix-popper-anchor-width] min-w-[200px]"
              >
                {organizations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    className="flex flex-row items-center gap-x-2"
                    onClick={() => navigateToOrganization(org)}
                  >
                    <Avatar
                      name={org.name}
                      avatar_url={org.avatar_url}
                      className="h-6 w-6"
                    />
                    <span className="min-w-0 truncate">{org.name}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push('/dashboard/create')}
                >
                  New Organization
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  Account Settings
                </DropdownMenuItem>
                {!CONFIG.IS_SANDBOX && (
                  <DropdownMenuItem
                    onClick={() =>
                      router.push('https://sandbox.polar.sh/start')
                    }
                  >
                    Go to Sandbox
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    router.push(`${CONFIG.BASE_URL}/v1/auth/logout`)
                  }
                >
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

/* const DashboardSidebar = () => {
  const [scrollTop, setScrollTop] = useState(0)
  const { currentUser } = useAuth()

  const handleScroll: UIEventHandler<HTMLDivElement> = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const shouldRenderUpperBorder = useMemo(() => scrollTop > 0, [scrollTop])

  const upperScrollClassName = shouldRenderUpperBorder
    ? 'border-b dark:border-b-polar-700 border-b-gray-200'
    : ''

  if (!currentUser) {
    return <></>
  }

  return (
    <aside
      className={twMerge(
        'flex h-full w-full flex-shrink-0 flex-col justify-between gap-y-4 overflow-y-auto md:w-[220px] md:overflow-y-visible',
      )}
    >
      <div className="flex h-full flex-col gap-y-6">
        <div className="hidden md:flex">
          <BrandingMenu />
        </div>

        <div className={upperScrollClassName}>
          <DashboardProfileDropdown />
        </div>

        <div
          className="flex w-full flex-grow flex-col gap-y-12 md:h-full md:justify-between md:overflow-y-auto"
          onScroll={handleScroll}
        >
          <div className="flex flex-col gap-y-12">
            <MaintainerNavigation />
          </div>
        </div>
      </div>
      <DashboardBottom authenticatedUser={currentUser} />
    </aside>
  )
}

const DashboardBottom = ({
  authenticatedUser,
}: {
  authenticatedUser: schemas['UserRead']
}) => {
  return (
    <div className="flex flex-row items-center justify-between gap-x-5">
      <div className="flex w-full min-w-0 flex-grow-0 flex-row items-center gap-x-2">
        <PublicProfileDropdown
          authenticatedUser={authenticatedUser}
          anchor="bottombar"
        />
        <div className="flex w-full min-w-0 flex-col">
          <span className="w-full truncate text-xs">
            {authenticatedUser.email}
          </span>
          <span className="dark:text-polar-500 text-xs text-gray-500">
            User Account
          </span>
        </div>
      </div>
      <NotificationsPopover />
    </div>
  )
} */
