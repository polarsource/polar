import { eq } from 'drizzle-orm'
import { VoidError } from '@void/sdk'
import { stepCountIs, streamText, type UIMessage } from 'ai'
import { after } from 'next/server'
import { db } from '@/db'
import { agents, messages, type Agent } from '@/db/schema'
import { publish, snapshot } from '@/live'
import { tools } from '@/tools'
import { agentModel, getVoid, ORG } from '@/void'

const textOf = (message: UIMessage) =>
  message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')

/** What the broadcaster already knows about this agent, so the call needs no extra reads. */
const cached = (agent: Agent) => {
  const { tree, judgments } = snapshot()
  const member = tree.members.find((node) => node.id === agent.memberId)
  const own = member?.agents.find((node) => node.id === agent.id)
  const remaining = [tree.org, member, own]
    .map((node) => node?.standing.remaining)
    .filter((value): value is number => typeof value === 'number')
  const known = tree.org.id === ORG && tree.org.standing.credits > 0
  return {
    cheaper: judgments.some(
      (judgment) =>
        judgment.identityId === agent.id && judgment.status === 'active',
    ),
    headroom: known && remaining.length > 0 ? Math.min(...remaining) : null,
  }
}

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

  const who = { agentId: agent.id, memberId: agent.memberId }
  const result = streamText({
    model: await agentModel(agent, {
      ...cached(agent),
      onStart: () => publish({ type: 'call', ...who }),
      onEnd: (credits) =>
        publish({
          type: 'completion',
          id: crypto.randomUUID(),
          credits,
          ...who,
        }),
    }),
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

  // Once the response has streamed: tell the tree the agent is idle again and
  // drain the local event outbox to Void so completions reach Jev.
  after(async () => {
    publish({ type: 'settled', agentId: agent.id })
    const void_ = await getVoid()
    await void_.flush()
  })

  return result.toUIMessageStreamResponse({
    onError: (error) =>
      error instanceof VoidError && error.reason === 'denied'
        ? `${agent.name} is out of credits. The member's cap or the organization's pool is spent for this period.`
        : 'Something went wrong on the way to the model.',
  })
}
