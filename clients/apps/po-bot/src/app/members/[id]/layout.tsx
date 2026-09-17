import { AgentList } from '@/components/AgentList'
import { Divider, Surface } from '@/components/Card'
import { CreditBar } from '@/components/CreditBar'
import { EventLog } from '@/components/EventLog'
import { Hierarchy } from '@/components/Hierarchy'
import { LiveProvider } from '@/components/Live'
import { MemberSwitcher } from '@/components/MemberSwitcher'
import { NewAgentForm } from '@/components/NewAgentForm'
import { PoBotLogo } from '@/components/PoBotLogo'
import { SectionLabel } from '@/components/SectionLabel'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Workspace } from '@/components/Workspace'
import { db } from '@/db'
import { agents, members } from '@/db/schema'
import { frame } from '@/live'
import { Box } from '@polar-sh/orbit/Box'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function MemberLayout({
  children,
  params,
}: LayoutProps<'/members/[id]'>) {
  const { id } = await params
  const [member] = await db.select().from(members).where(eq(members.id, id))
  if (!member) notFound()
  const [all, owned, initial] = await Promise.all([
    db.select().from(members),
    db.select().from(agents).where(eq(agents.memberId, id)),
    frame(),
  ])

  return (
    <LiveProvider memberId={id} initial={initial}>
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
            <Surface flexDirection="column" rowGap="s" padding="xs">
              <MemberSwitcher members={all} current={id} />
              <Box paddingHorizontal="xs" paddingBottom="xs" width="100%">
                <CreditBar limit={member.cap} />
              </Box>
            </Surface>
            <Divider />
            <Box flexDirection="column" rowGap="xs" minHeight={72} flex={1}>
              <SectionLabel>Agents</SectionLabel>
              <Box minHeight={0} flex={1} overflowY="auto">
                <AgentList agents={owned} />
              </Box>
            </Box>
            <NewAgentForm memberId={id} />
          </>
        }
        main={children}
        panel={<EventLog />}
        bottom={<Hierarchy />}
      />
    </LiveProvider>
  )
}
