import { AgentList } from '@/components/AgentList'
import { Card } from '@/components/Card'
import { CreditBar } from '@/components/CreditBar'
import { EventLog } from '@/components/EventLog'
import { Hierarchy } from '@/components/Hierarchy'
import { LiveProvider } from '@/components/Live'
import { MemberSwitcher } from '@/components/MemberSwitcher'
import { NewAgentForm } from '@/components/NewAgentForm'
import { Workspace } from '@/components/Workspace'
import { db } from '@/db'
import { agents, members } from '@/db/schema'
import { frame } from '@/live'
import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
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
            <Box alignItems="center" columnGap="s">
              <Link href="/" style={{ display: 'contents' }}>
                <Button variant="ghost" size="icon" aria-label="Organization">
                  <ArrowLeft size={16} />
                </Button>
              </Link>
              <MemberSwitcher members={all} current={id} />
            </Box>
            <Card flexDirection="column" padding="s">
              <CreditBar limit={member.cap} />
            </Card>
            <Box minHeight={72} flex={1} overflowY="auto">
              <AgentList agents={owned} />
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
