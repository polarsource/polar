import { SupportButton } from '@/components/Feedback/SupportButton'
import { useAuth } from '@/hooks/auth'
import { NotificationsPopover } from '@/components/Notifications/NotificationsPopover'
import { OmniSearch } from '@/components/Search/OmniSearch'
import { CONFIG } from '@/utils/config'
import { isImpersonating } from '@/utils/impersonation'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import Search from '@mui/icons-material/Search'
import { schemas } from '@polar-sh/client'
import { Avatar, Button } from '@polar-sh/orbit'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
import { motion } from 'motion/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { PolarLogotype } from '../Public/PolarLogotype'
import {
  AccountNavigation,
  OrganizationNavigation,
} from './DashboardNavigation'
import { useOrganizationSubscription } from '@/hooks/queries'

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

  const subscriptionPlan = useOrganizationSubscription(organization?.id ?? '')
  const isOnFreePlan = subscriptionPlan.data?.subscription_id === null

  const navigateToOrganization = (org: schemas['Organization']) => {
    router.push(`/dashboard/${org.slug}`)
  }

  const [_isImpersonating, setIsImpersonating] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only cookie read to avoid hydration mismatch
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
          className="flex flex-row items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          <NotificationsPopover />
          <Button
            className="relative size-8! p-0"
            variant="ghost"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
          >
            <Search fontSize="small" aria-hidden="true" />
          </Button>
        </motion.div>
      </SidebarHeader>

      <SidebarContent className="gap-4 px-2 py-2">
        {type === 'organization' && organization && (
          <OmniSearch
            open={searchOpen}
            onOpenChange={setSearchOpen}
            organization={organization}
          />
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
        {isOnFreePlan && !isCollapsed && (
          <div className="dark:bg-polar-900 dark:border-polar-700 flex flex-col gap-y-2 rounded-sm border border-gray-100 bg-white p-4">
            <h3 className="text-sm">Introducing Polar Plans</h3>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              Get a lower fee with our subscription plans
            </p>
            <Link
              className="text-sm text-indigo-500"
              href={`/dashboard/${organization?.slug}/settings/billing/change-plan`}
            >
              Upgrade
            </Link>
          </div>
        )}

        {type === 'organization' && organization && (
          <SupportButton organization={organization} />
        )}
        <a
          className={twMerge(
            'flex flex-row items-center rounded-lg border border-transparent text-sm transition-colors dark:border-transparent',
            'dark:text-polar-500 dark:hover:text-polar-200 text-gray-500 hover:text-black',
            isCollapsed && '!dark:text-polar-600',
          )}
          href="https://polar.sh/docs"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ArrowOutwardOutlined className="ml-2" fontSize="inherit" />
          {!isCollapsed && (
            <span className="ml-4 font-medium">Documentation</span>
          )}
        </a>
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
                  {!currentUser?.organization_scoped && (
                    <DropdownMenuItem
                      onClick={() =>
                        CONFIG.IS_SANDBOX
                          ? router.push('/onboarding/sandbox')
                          : router.push('/onboarding/business')
                      }
                    >
                      New Organization
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => router.push('/dashboard/account')}
                  >
                    User Settings
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
