'use client'

import { AgentList } from '@/components/AgentList'
import { Divider, Surface } from '@/components/Card'
import { CreditBar } from '@/components/CreditBar'
import { EventLog } from '@/components/EventLog'
import { Hierarchy } from '@/components/Hierarchy'
import { MemberSwitcher } from '@/components/MemberSwitcher'
import { NewAgentForm } from '@/components/NewAgentForm'
import { PoBotLogo } from '@/components/PoBotLogo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Workspace } from '@/components/Workspace'
import { LiveStream, useMemberNode, useTreeLoaded } from '@/hooks/live'
import { Box } from '@polar-sh/orbit/Box'
import { notFound, useParams } from 'next/navigation'
import type { ReactNode } from 'react'

export default function MemberLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>()
  const member = useMemberNode(id)
  const loaded = useTreeLoaded()
  if (loaded && !member.name) notFound()

  return (
    <>
      <LiveStream />
      <Workspace
        sidebar={
          <>
            <Box
              alignItems="center"
              justifyContent="between"
              paddingHorizontal="s"
              paddingTop="xs"
            >
              <PoBotLogo />
              <ThemeToggle />
            </Box>
            <Surface flexDirection="column" rowGap="s" padding="s">
              <MemberSwitcher current={id} />
              <CreditBar limit={member.cap} />
            </Surface>
            <Divider />
            <AgentList />
            <NewAgentForm memberId={id} />
          </>
        }
        main={children}
        panel={<EventLog />}
        bottom={<Hierarchy />}
      />
    </>
  )
}
