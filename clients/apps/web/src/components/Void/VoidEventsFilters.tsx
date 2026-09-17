'use client'

import RefreshOutlined from '@mui/icons-material/RefreshOutlined'
import Search from '@mui/icons-material/Search'
import {
  Button,
  Input,
  List,
  ListItem,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ReactNode } from 'react'
import { VoidEventTypeStat } from './events'

const formatCount = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'decimal',
    compactDisplay: 'short',
    notation: 'compact',
  })

const TypeList = ({
  title,
  types,
  selectedName,
  onSelectName,
}: {
  title: string
  types: VoidEventTypeStat[]
  selectedName: string | null
  onSelectName: (name: string | null) => void
}) => {
  if (types.length === 0) return null
  return (
    <Box flexDirection="column" rowGap="s">
      <Text>{title}</Text>
      <List size="small" className="rounded-xl">
        {types.map((eventType) => (
          <ListItem
            key={eventType.name}
            size="small"
            className="justify-between px-3 font-mono text-xs"
            selected={selectedName === eventType.name}
            onSelect={() =>
              onSelectName(
                selectedName === eventType.name ? null : eventType.name,
              )
            }
          >
            <span className="w-full truncate">{eventType.name}</span>
            <span className="text-xxs font-mono">
              {formatCount(eventType.occurrences)}
            </span>
          </ListItem>
        ))}
      </List>
    </Box>
  )
}

const Field = ({ children }: { children: ReactNode }) => (
  <Box alignItems="center" flexShrink={0}>
    {children}
  </Box>
)

export const VoidEventsFilters = ({
  query,
  onQuery,
  identity,
  onIdentity,
  selectedName,
  onSelectName,
  types,
  onReset,
}: {
  query: string | null
  onQuery: (value: string | null) => void
  identity: string | null
  onIdentity: (value: string | null) => void
  selectedName: string | null
  onSelectName: (name: string | null) => void
  types: VoidEventTypeStat[]
  onReset: () => void
}) => {
  const needle = (query ?? '').trim().toLowerCase()
  const visible = needle
    ? types.filter((eventType) => eventType.name.toLowerCase().includes(needle))
    : types
  const userTypes = visible.filter((eventType) => eventType.source === 'user')
  const systemTypes = visible.filter(
    (eventType) => eventType.source === 'system',
  )

  return (
    <Box flexDirection="column" height="100%" minHeight={0}>
      <Box
        alignItems="center"
        justifyContent="between"
        columnGap="l"
        paddingHorizontal="l"
        paddingTop="l"
        flexShrink={0}
      >
        <Text>Events</Text>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              className="h-6 w-6 rounded-full"
              variant="ghost"
              onClick={onReset}
            >
              <RefreshOutlined fontSize="inherit" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span>Reset Filters</span>
          </TooltipContent>
        </Tooltip>
      </Box>
      <Box
        flexDirection="column"
        rowGap="xl"
        flexGrow={1}
        minHeight={0}
        overflowY="auto"
        padding="l"
      >
        <Field>
          <Input
            placeholder="Filter event types"
            value={query ?? ''}
            onChange={(event) => onQuery(event.target.value || null)}
            preSlot={<Search fontSize="small" />}
          />
        </Field>
        <Box flexDirection="column" rowGap="s">
          <Text>Identity</Text>
          <Field>
            <Input
              placeholder="External identity id"
              value={identity ?? ''}
              onChange={(event) => onIdentity(event.target.value || null)}
            />
          </Field>
        </Box>
        <TypeList
          title="User Events"
          types={userTypes}
          selectedName={selectedName}
          onSelectName={onSelectName}
        />
        <TypeList
          title="System Events"
          types={systemTypes}
          selectedName={selectedName}
          onSelectName={onSelectName}
        />
      </Box>
    </Box>
  )
}
