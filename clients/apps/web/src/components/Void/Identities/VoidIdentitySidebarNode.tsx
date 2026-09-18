'use client'

import KeyboardArrowDownOutlined from '@mui/icons-material/KeyboardArrowDownOutlined'
import KeyboardArrowRightOutlined from '@mui/icons-material/KeyboardArrowRightOutlined'
import { Avatar, Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { IdentityNode } from '../identities'
import { VoidLiveIdentity } from '../identityLive'

const nestedPadding = (depth: number) => {
  if (depth >= 3) return '4xl'
  if (depth >= 2) return '3xl'
  return 'l'
}

export const VoidIdentitySidebarNode = ({
  node,
  selectedId,
  hrefFor,
  expandedIds,
  onToggle,
}: {
  node: IdentityNode<VoidLiveIdentity>
  selectedId: string | null
  hrefFor: (id: string) => string
  expandedIds: ReadonlySet<string>
  onToggle: (id: string) => void
}) => {
  const identity = node.identity
  const hasChildren = node.children.length > 0
  const open = hasChildren && expandedIds.has(identity.id)
  const selected = selectedId === identity.id

  return (
    <Box flexDirection="column">
      <Box
        alignItems="center"
        minWidth={0}
        backgroundColor={
          selected
            ? { base: 'background-secondary', hover: 'background-secondary' }
            : { hover: 'background-secondary' }
        }
      >
        <Link href={hrefFor(identity.id)} className="min-w-0 flex-1">
          <Box
            alignItems="center"
            columnGap="m"
            paddingVertical="m"
            paddingLeft={nestedPadding(node.depth)}
            paddingRight="s"
            minWidth={0}
          >
            {identity.parent_id === null ? (
              <Avatar
                className="h-8 w-8"
                avatar_url={null}
                name={identity.name}
              />
            ) : null}
            <Box flexDirection="column" minWidth={0}>
              <Text truncate>{identity.name}</Text>
              <Text truncate color="muted" variant="caption">
                {identity.kind}
              </Text>
            </Box>
          </Box>
        </Link>
        {hasChildren ? (
          <Box paddingRight="l" flexShrink={0}>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              aria-expanded={open}
              aria-label={
                open ? `Collapse ${identity.name}` : `Expand ${identity.name}`
              }
              onClick={() => onToggle(identity.id)}
            >
              {open ? (
                <KeyboardArrowDownOutlined fontSize="small" />
              ) : (
                <KeyboardArrowRightOutlined fontSize="small" />
              )}
            </Button>
          </Box>
        ) : null}
      </Box>
      {open ? (
        <Box
          flexDirection="column"
          borderTopWidth={1}
          borderBottomWidth={node.depth === 0 ? undefined : 1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          {node.children.map((child) => (
            <VoidIdentitySidebarNode
              key={child.identity.id}
              node={child}
              selectedId={selectedId}
              hrefFor={hrefFor}
              expandedIds={expandedIds}
              onToggle={onToggle}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  )
}
