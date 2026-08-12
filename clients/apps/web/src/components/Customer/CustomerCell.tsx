import { Avatar, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

interface CustomerCellProps {
  name?: string | null
  email?: string | null
  avatarUrl?: string | null
}

export const CustomerCell = ({ name, email, avatarUrl }: CustomerCellProps) => {
  const display = name ?? email ?? '-'
  return (
    <Box alignItems="center" columnGap="m" minWidth={0}>
      <Avatar
        className="h-8 w-8"
        avatar_url={avatarUrl ?? null}
        name={display}
      />
      <Box flexDirection="column" minWidth={0}>
        <Text truncate>{display}</Text>
        {name && email ? (
          <Text truncate color="muted" variant="caption">
            {email}
          </Text>
        ) : null}
      </Box>
    </Box>
  )
}
