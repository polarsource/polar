import { db } from '@/db'
import { messages } from '@/db/schema'
import type { UIMessage } from 'ai'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/** One agent's thread, shaped as AI SDK messages the chat can hydrate from. */
export const GET = async (
  _request: Request,
  ctx: RouteContext<'/api/agents/[agentId]/messages'>,
) => {
  const { agentId } = await ctx.params
  const thread = await db
    .select()
    .from(messages)
    .where(eq(messages.agentId, agentId))
    .orderBy(messages.id)

  const uiMessages: UIMessage[] = thread.map((message) => ({
    id: String(message.id),
    role: message.role,
    parts: [{ type: 'text', text: message.content }],
  }))
  return Response.json(uiMessages)
}
