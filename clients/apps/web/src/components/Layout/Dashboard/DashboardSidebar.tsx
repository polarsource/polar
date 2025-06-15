import LogoIcon from '@/components/Brand/LogoIcon'
import { NotificationsPopover } from '@/components/Notifications/NotificationsPopover'
import { CONFIG } from '@/utils/config'
import { ArrowOutwardOutlined } from '@mui/icons-material'
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
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { BrandingMenu } from '../Public/BrandingMenu'
import {
  AccountNavigation,
  OrganizationNavigation,
} from './DashboardNavigation'

export const DashboardSidebar = ({
  type = 'organization',
  organization,
  organizations,
}: {
  type?: 'organization' | 'account'
  organization: schemas['Organization']
  organizations: schemas['Organization'][]
}) => {
  const router = useRouter()
  const { state } = useSidebar()

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
          className="flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          {type === 'account' && <AccountNavigation />}
          {type === 'organization' && (
            <OrganizationNavigation organization={organization} />
          )}
        </motion.div>
      </SidebarContent>
      <SidebarFooter>
        {!isCollapsed && (
          <AnimatePresence>
            <motion.div
              key={isCollapsed ? 'nav-collapsed' : 'nav-expanded'}
              className={`flex ${isCollapsed ? 'flex-col' : 'flex-row'} items-center gap-2`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
            >
              <SidebarContent>
                <div className="dark:bg-polar-900 dark:border-polar-800 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
                  <LogoIcon size={24} />
                  <span>Polar for iOS is now available on TestFlight!</span>
                  <Link
                    href="https://testflight.apple.com/join/CwVdc1Jt"
                    target="_blank"
                    className="dark:bg-polar-800 dark:hover:bg-polar-700 self-start rounded-sm bg-gray-100 p-1 text-xs transition-colors hover:bg-gray-200"
                  >
                    <span>Join Beta</span>
                    <ArrowOutwardOutlined className="ml-2" fontSize="inherit" />
                  </Link>
                </div>
              </SidebarContent>
            </motion.div>
          </AnimatePresence>
        )}
        {type === 'organization' && (
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
                  <DropdownMenuItem
                    onClick={() => router.push('/dashboard/account')}
                  >
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
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
