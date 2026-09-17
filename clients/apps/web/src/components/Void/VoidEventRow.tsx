'use client'

import KeyboardArrowDownOutlined from '@mui/icons-material/KeyboardArrowDownOutlined'
import KeyboardArrowRightOutlined from '@mui/icons-material/KeyboardArrowRightOutlined'
import {
  Avatar,
  Status,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { identityHref } from './identities'
import { identityLabel, VoidCatalogEvent } from './events'

const sourceColor = (source: VoidCatalogEvent['source']) =>
  source === 'system' ? 'blue' : 'green'

const publicMetadata = (metadata: Record<string, unknown>) => {
  const visible = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !key.startsWith('_')),
  )
  return Object.keys(visible).length > 0 ? visible : null
}

export const VoidEventRow = ({
  event,
  base,
  identityNames,
}: {
  event: VoidCatalogEvent
  base: string
  identityNames: Map<string, string>
}) => {
  const [expanded, setExpanded] = useState(false)
  const metadata = useMemo(
    () => publicMetadata(event.metadata),
    [event.metadata],
  )
  const identityId = event.external_identity_id
  const identityName = identityLabel(identityId, identityNames)
  const timestamp = new Date(event.timestamp).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    ...(expanded
      ? { hour: 'numeric', minute: 'numeric', second: 'numeric' }
      : {}),
  })

  return (
    <Box
      flexDirection="column"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      borderRadius="l"
      backgroundColor="background-primary"
      overflow="hidden"
      cursor="pointer"
      onClick={() => setExpanded((current) => !current)}
    >
      <Box
        alignItems="center"
        justifyContent="between"
        columnGap="l"
        padding="m"
      >
        <Box alignItems="center" columnGap="m" minWidth={0}>
          <Box
            alignItems="center"
            justifyContent="center"
            padding="xs"
            borderRadius="s"
            backgroundColor="background-secondary"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            {expanded ? (
              <KeyboardArrowDownOutlined fontSize="inherit" />
            ) : (
              <KeyboardArrowRightOutlined fontSize="inherit" />
            )}
          </Box>
          <Box flexDirection="column" minWidth={0} rowGap="xs">
            <Box alignItems="center" columnGap="m" minWidth={0}>
              <Text as="code" truncate>
                {event.name}
              </Text>
              <Status
                status={event.source}
                color={sourceColor(event.source)}
                size="small"
              />
            </Box>
            <Text color="muted" variant="caption">
              {timestamp}
            </Text>
          </Box>
        </Box>
        {identityId ? (
          <Tooltip>
            <TooltipTrigger>
              <Link
                href={identityHref(base, identityId)}
                onClick={(click) => click.stopPropagation()}
              >
                <Avatar
                  className="size-6 text-xs"
                  name={identityName}
                  avatar_url={null}
                />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top" align="end">
              <Box flexDirection="column" rowGap="xs">
                <Text>{identityName}</Text>
                <Text as="code" color="muted" variant="caption">
                  {identityId}
                </Text>
              </Box>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </Box>
      {expanded ? (
        <Box
          flexDirection="column"
          rowGap="m"
          paddingHorizontal="m"
          paddingBottom="m"
          onClick={(click) => click.stopPropagation()}
        >
          {metadata ? (
            <Box
              backgroundColor="background-secondary"
              borderRadius="m"
              padding="m"
              overflowX="auto"
            >
              <pre>
                <Text as="code" variant="caption">
                  {JSON.stringify(metadata, null, 2)}
                </Text>
              </pre>
            </Box>
          ) : null}
          <Box alignItems="center" justifyContent="between" columnGap="l">
            {identityId ? (
              <Link
                href={identityHref(base, identityId)}
                onClick={(click) => click.stopPropagation()}
              >
                <Box alignItems="center" columnGap="m">
                  <Avatar
                    className="size-6 text-xs"
                    name={identityName}
                    avatar_url={null}
                  />
                  <Box flexDirection="column" minWidth={0}>
                    <Text truncate>{identityName}</Text>
                    <Text as="code" color="muted" variant="caption">
                      {identityId}
                    </Text>
                  </Box>
                </Box>
              </Link>
            ) : (
              <Text color="muted" variant="caption">
                Unattributed
              </Text>
            )}
            <Text as="code" color="muted" variant="caption">
              {event.external_id}
            </Text>
          </Box>
        </Box>
      ) : null}
    </Box>
  )
}
