'use client'

import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useContext, type ReactNode } from 'react'
import { useVoidDataSource } from '../dataSource'
import { stageReviewHref, useStageQuery } from './queries'

export const VoidStageBanner = ({ children }: { children: ReactNode }) => {
  const live = useVoidDataSource() === 'live'
  return (
    <>
      {live ? <Banner /> : null}
      <Box flexDirection="column" flexGrow={1} minHeight={0}>
        {children}
      </Box>
    </>
  )
}

const Banner = () => {
  const { organization } = useContext(OrganizationContext)
  const pathname = usePathname()
  const stage = useStageQuery(organization.id)
  const href = stageReviewHref(organization.slug)
  if (!stage.data || pathname === href) return null
  return (
    <Box
      role="status"
      justifyContent="between"
      alignItems="center"
      columnGap="m"
      paddingHorizontal="l"
      paddingVertical="s"
      marginBottom={{ md: 's' }}
      borderRadius={{ md: 'm' }}
      backgroundColor="background-accent"
    >
      <Text>New changes staged</Text>
      <Link href={href}>
        <Button size="sm">Review</Button>
      </Link>
    </Box>
  )
}
