'use client'

import { NotificationsPopover } from '@/components/Notifications/NotificationsPopover'
import { useAuth } from '@/hooks/auth'
import { CONFIG } from '@/utils/config'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { Search, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSearch } from './SearchContext'

type TopBarProps = {
  type: 'organization' | 'account'
  organization?: schemas['Organization']
  organizations: schemas['Organization'][]
}

export const TopBar = ({ type, organization, organizations }: TopBarProps) => {
  const { isOpen, toggle } = useSearch()

  return (
    <Box
      as="header"
      display="flex"
      alignItems="center"
      justifyContent="between"
      paddingHorizontal="xl"
      paddingVertical="xl"
    >
      <Box display="flex" alignItems="center" columnGap="m">
        {type === 'organization' && organization ? (
          <OrgSwitcher
            organization={organization}
            organizations={organizations}
          />
        ) : (
          <Text variant="body" color="default">
            Account
          </Text>
        )}
      </Box>

      <Box display="flex" alignItems="center" columnGap="m">
        <NotificationsPopover />
        <IconButton
          ariaLabel={isOpen ? 'Close search' : 'Search'}
          active={isOpen}
          onClick={toggle}
        >
          <Search
            size={16}
            strokeWidth={1.75}
            style={{ color: isOpen ? 'white' : 'currentColor' }}
          />
        </IconButton>
        <AccountMenu />
      </Box>
    </Box>
  )
}

const OrgSwitcher = ({
  organization,
  organizations,
}: {
  organization: schemas['Organization']
  organizations: schemas['Organization'][]
}) => {
  const router = useRouter()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Switch organization"
          style={{
            background: 'transparent',
            border: 0,
            padding: 0,
            cursor: 'pointer',
            color: 'inherit',
          }}
        >
          <Box display="flex" alignItems="center" columnGap="s">
            <Avatar
              name={organization.name}
              avatar_url={organization.avatar_url}
              className="h-7 w-7"
            />
            <Text variant="body" color="default">
              {organization.name}
            </Text>
          </Box>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            className="flex flex-row items-center gap-x-2"
            onClick={() => router.push(`/dashboard/${org.slug}`)}
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
            router.push(
              CONFIG.IS_SANDBOX
                ? '/onboarding/sandbox'
                : '/onboarding/business',
            )
          }
        >
          New Organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const AccountMenu = () => {
  const router = useRouter()
  const { currentUser } = useAuth()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton ariaLabel="Account">
          {currentUser ? (
            <Avatar
              name={currentUser.email}
              avatar_url={currentUser.avatar_url ?? null}
              className="h-7 w-7"
            />
          ) : (
            <User size={16} strokeWidth={1.75} />
          )}
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuItem onClick={() => router.push('/dashboard/account')}>
          User Settings
        </DropdownMenuItem>
        {!CONFIG.IS_SANDBOX && (
          <DropdownMenuItem
            onClick={() => router.push('https://sandbox.polar.sh/start')}
          >
            Go to Sandbox
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push(`${CONFIG.BASE_URL}/v1/auth/logout`)}
        >
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const IconButton = ({
  children,
  ariaLabel,
  active = false,
  onClick,
}: {
  children: React.ReactNode
  ariaLabel: string
  active?: boolean
  onClick?: () => void
}) => (
  <Box
    width={36}
    height={36}
    borderRadius="full"
    backgroundColor={active ? 'background-inverse' : 'background-card'}
    display="flex"
    alignItems="center"
    justifyContent="center"
    cursor="pointer"
    aria-label={ariaLabel}
    aria-pressed={active}
    role="button"
    onClick={onClick}
  >
    {children}
  </Box>
)
