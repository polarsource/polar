import { Chat } from '@/components/Chat'
import { db } from '@/db'
import { agents, messages } from '@/db/schema'
import type { UIMessage } from 'ai'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AgentPage({
  params,
}: PageProps<'/members/[id]/agents/[agentId]'>) {
  const { agentId } = await params
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId))
  if (!agent) notFound()
  const thread = await db
    .select()
    .from(messages)
    .where(eq(messages.agentId, agentId))
    .orderBy(messages.id)

  const initialMessages: UIMessage[] = thread.map((message) => ({
    id: String(message.id),
    role: message.role,
    parts: [{ type: 'text', text: message.content }],
  }))

  return <Chat agent={agent} initialMessages={initialMessages} />
}
