'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from './db'
import { agents, members } from './db/schema'
import { addAgent, addMember } from './void'

export async function createMember(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const cap = Number(formData.get('cap'))
  if (!name || !(cap > 0)) return

  const [member] = await db.insert(members).values({ name, cap }).returning()
  await addMember(member.id, cap)

  revalidatePath('/')
}

export async function createAgent(formData: FormData) {
  const memberId = String(formData.get('memberId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const model = String(formData.get('model') ?? '')
  const systemPrompt = String(formData.get('systemPrompt') ?? '').trim()
  if (!memberId || !name || !model) return

  const [agent] = await db
    .insert(agents)
    .values({ memberId, name, model, systemPrompt })
    .returning()
  await addAgent(memberId, agent.id)

  revalidatePath(`/members/${memberId}`)
  redirect(`/members/${memberId}/agents/${agent.id}`)
}
