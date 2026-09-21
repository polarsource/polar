import { db } from '@/db'
import { agents } from '@/db/schema'
import { refresh } from '@/live'
import { addAgent } from '@/void'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const GET = async (
  _request: Request,
  ctx: RouteContext<'/api/members/[id]/agents'>,
) => {
  const { id } = await ctx.params
  return Response.json(
    await db.select().from(agents).where(eq(agents.memberId, id)),
  )
}

export const POST = async (
  request: Request,
  ctx: RouteContext<'/api/members/[id]/agents'>,
) => {
  const { id: memberId } = await ctx.params
  const { name, model, systemPrompt } = (await request.json()) as {
    name?: string
    model?: string
    systemPrompt?: string
  }
  const clean = name?.trim()
  if (!clean || !model)
    return Response.json(
      { error: 'name and model are required' },
      { status: 400 },
    )

  const [agent] = await db
    .insert(agents)
    .values({
      memberId,
      name: clean,
      model,
      systemPrompt: systemPrompt?.trim() ?? '',
    })
    .returning()
  await addAgent(memberId, agent.id)
  refresh('tree')
  return Response.json(agent, { status: 201 })
}
