import { db } from '@/db'
import { members } from '@/db/schema'
import { refresh } from '@/live'
import { addMember } from '@/void'

export const dynamic = 'force-dynamic'

export const GET = async () => Response.json(await db.select().from(members))

export const POST = async (request: Request) => {
  const { name, cap } = (await request.json()) as {
    name?: string
    cap?: number
  }
  const clean = name?.trim()
  if (!clean || !(Number(cap) > 0))
    return Response.json(
      { error: 'name and a positive cap are required' },
      { status: 400 },
    )

  const [member] = await db
    .insert(members)
    .values({ name: clean, cap: Number(cap) })
    .returning()
  await addMember(member.id, Number(cap))
  refresh('tree')
  return Response.json(member, { status: 201 })
}
