import { db } from '@/db'
import { agents } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const GET = async (
  _request: Request,
  ctx: RouteContext<'/api/agents/[agentId]'>,
) => {
  const { agentId } = await ctx.params
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId))
  if (!agent) return Response.json({ error: 'not found' }, { status: 404 })
  return Response.json(agent)
}
