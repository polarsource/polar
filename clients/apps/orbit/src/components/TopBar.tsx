'use client'

import { Avatar, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Search } from 'lucide-react'
import { useSearch } from './SearchContext'
import { UserIcon } from './icons/UserIcon'

export const TopBar = () => {
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
        <Avatar
          name="New Fragment"
          className="size-8"
          avatar_url="https://img.logo.dev/bitspace.sh?size=64&retina=true&token=pk_E-KcYZmdT--jxwGY3dAs1Q&fallback=404"
        />
        <Text variant="body" color="default">
          New Fragment
        </Text>
      </Box>

      <Box display="flex" alignItems="center" columnGap="m">
        <IconButton
          ariaLabel={isOpen ? 'Close search' : 'Search'}
          active={isOpen}
          onClick={toggle}
        >
          <Search
            size={20}
            strokeWidth={2}
            style={{ color: isOpen ? 'white' : 'currentColor' }}
          />
        </IconButton>
        <IconButton ariaLabel="Account">
          <UserIcon size={20} />
        </IconButton>
      </Box>
    </Box>
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
