import { db } from '@/db'
import { members } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const GET = async (
  _request: Request,
  ctx: RouteContext<'/api/members/[id]'>,
) => {
  const { id } = await ctx.params
  const [member] = await db.select().from(members).where(eq(members.id, id))
  if (!member) return Response.json({ error: 'not found' }, { status: 404 })
  return Response.json(member)
}
