import { eq } from 'drizzle-orm'
import { VoidError } from '@void/sdk'
import { stepCountIs, streamText, type UIMessage } from 'ai'
import { db } from '@/db'
import { agents, messages } from '@/db/schema'
import { tools } from '@/tools'
import { agentModel } from '@/void'

const textOf = (message: UIMessage) =>
  message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')

export const POST = async (request: Request) => {
  const { agentId, message } = (await request.json()) as {
    agentId: string
    message: UIMessage
  }
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId))
  if (!agent) return new Response('No such agent', { status: 404 })

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.agentId, agent.id))
    .orderBy(messages.id)
  const prompt = textOf(message)

  const result = streamText({
    model: agentModel(agent),
    system: agent.systemPrompt || undefined,
    tools,
    stopWhen: stepCountIs(8),
    messages: [
      ...history.map(({ role, content }) => ({ role, content })),
      { role: 'user', content: prompt },
    ],
    onFinish: async ({ text }) => {
      await db.insert(messages).values([
        { agentId: agent.id, role: 'user', content: prompt },
        { agentId: agent.id, role: 'assistant', content: text },
      ])
    },
  })

  return result.toUIMessageStreamResponse({
    onError: (error) =>
      error instanceof VoidError && error.reason === 'denied'
        ? `${agent.name} is out of credits. The member's cap or the organization's pool is spent for this period.`
        : 'Something went wrong on the way to the model.',
  })
}
