import { NotificationsPopover } from '@/components/Notifications/NotificationsPopover'
import { OmniSearch } from '@/components/Search/OmniSearch'
import { useAuth } from '@/hooks'
import { CONFIG } from '@/utils/config'
import { isImpersonating } from '@/utils/impersonation'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import Search from '@mui/icons-material/Search'
import SupportIcon from '@mui/icons-material/Support'
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
import { Separator } from '@polar-sh/ui/components/ui/separator'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { PolarLogotype } from '../Public/PolarLogotype'
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
  organization?: schemas['Organization']
  organizations: schemas['Organization'][]
}) => {
  const router = useRouter()
  const { state } = useSidebar()

  const { currentUser } = useAuth()

  const isCollapsed = state === 'collapsed'
  const [searchOpen, setSearchOpen] = useState(false)

  const navigateToOrganization = (org: schemas['Organization']) => {
    router.push(`/dashboard/${org.slug}`)
  }

  // Annoying useEffect hack to allow access to client-side cookies from Server-Side component
  const [_isImpersonating, setIsImpersonating] = useState(false)
  useEffect(() => {
    setIsImpersonating(isImpersonating())
  }, [])
  const isTopBannerVisible = CONFIG.IS_SANDBOX || _isImpersonating

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader
        className={twMerge(
          'flex md:pt-3.5',
          isTopBannerVisible ? 'md:pt-10' : '',
          isCollapsed
            ? 'flex-row items-center justify-between gap-y-4 md:flex-col md:items-start md:justify-start'
            : 'flex-row items-center justify-between',
        )}
      >
        <PolarLogotype
          size={32}
          href={organization ? `/dashboard/${organization.slug}` : '/dashboard'}
        />
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
        {type === 'organization' && organization && (
          <>
            <button
              onClick={() => setSearchOpen(true)}
              className={twMerge(
                'flex cursor-pointer items-center gap-4 rounded-lg border px-2 py-2 text-sm transition-colors',
                'dark:bg-polar-950 dark:border-polar-800 dark:hover:bg-polar-900 border-gray-200 bg-white hover:bg-gray-50',
                isCollapsed && 'justify-center px-2',
              )}
            >
              <Search
                className="dark:text-polar-500 text-gray-500"
                fontSize="inherit"
              />
              {!isCollapsed && (
                <>
                  <span className="dark:text-polar-500 flex-1 text-left text-gray-500">
                    Search...
                  </span>
                  <kbd className="dark:border-polar-700 dark:bg-polar-800 dark:text-polar-400 pointer-events-none inline-flex h-5 items-center gap-1 rounded border border-gray-200 bg-gray-100 px-1.5 font-mono text-[11px] text-gray-600 select-none">
                    <span className="text-sm">⌘</span>K
                  </kbd>
                </>
              )}
            </button>
            <OmniSearch
              open={searchOpen}
              onOpenChange={setSearchOpen}
              organization={organization}
            />
          </>
        )}
        <motion.div
          key={isCollapsed ? 'nav-collapsed' : 'nav-expanded'}
          className="flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          {type === 'account' && <AccountNavigation />}
          {type === 'organization' && organization && (
            <OrganizationNavigation organization={organization} />
          )}
        </motion.div>
      </SidebarContent>
      <SidebarFooter>
        <Link
          href="mailto:support@polar.sh"
          className={twMerge(
            'mt-2 flex cursor-pointer flex-row items-center rounded-lg border border-transparent px-2 text-sm transition-colors dark:border-transparent',
            'dark:text-polar-500 dark:hover:text-polar-200 text-gray-500 hover:text-black',
            isCollapsed && '!dark:text-polar-600',
          )}
        >
          <SupportIcon fontSize="inherit" />
          {!isCollapsed && <span className="ml-4 font-medium">Support</span>}
        </Link>
        <Link
          className={twMerge(
            'flex flex-row items-center rounded-lg border border-transparent text-sm transition-colors dark:border-transparent',
            'dark:text-polar-500 dark:hover:text-polar-200 text-gray-500 hover:text-black',
            isCollapsed && '!dark:text-polar-600',
          )}
          href="https://polar.sh/docs"
          target="_blank"
        >
          <ArrowOutwardOutlined className="ml-2" fontSize="inherit" />
          {!isCollapsed && (
            <span className="ml-4 font-medium">Documentation</span>
          )}
        </Link>
        <Separator />
        {type === 'organization' && organization && (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton>
                    <Avatar
                      name={organization.name}
                      avatar_url={organization.avatar_url}
                      className="h-6 w-6"
                    />
                    {!isCollapsed && (
                      <>
                        <span className="min-w-0 truncate">
                          {organization.name}
                        </span>
                        <KeyboardArrowDown
                          className="ml-auto"
                          fontSize="small"
                        />
                      </>
                    )}
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align={isCollapsed ? 'start' : 'center'}
                  className="w-(--radix-popper-anchor-width) min-w-[200px]"
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
                    onClick={() =>
                      router.push('/dashboard/create?existing_org=true')
                    }
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
