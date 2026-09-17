import type { Wire } from '@void/sdk'
import { db } from './db'
import { agents, members } from './db/schema'
import {
  ORG,
  activityReport,
  completions,
  spanKey,
  spansFor,
  standings,
  type Standing,
} from './void'

/**
 * One frame of the organization's live state: the identity tree with every
 * node's standing on the credits meter, and the latest completions that fold
 * into it. Each completion is stamped with the agent identity that ran it;
 * the chat UI scopes the activity mix to that identity. The layout renders
 * the first frame; `/api/live` streams the rest.
 */

export interface AgentNode {
  readonly id: string
  readonly memberId: string
  readonly name: string
  readonly model: string
  readonly standing: Standing
}
export interface MemberNode {
  readonly id: string
  readonly name: string
  /** The most credits this member may spend per period. */
  readonly cap: number
  readonly standing: Standing
  readonly agents: readonly AgentNode[]
}
export interface Tree {
  readonly org: {
    readonly id: string
    readonly name: string
    readonly standing: Standing
  }
  readonly members: readonly MemberNode[]
}

/** One completion as the log shows it: the raw event plus who made it. */
export interface LogEvent {
  readonly event: Wire.Event
  readonly agent: string
  readonly member: string
  /** Jev's label for this span, once the worker has classified it. */
  readonly span: Wire.ActivitySpan | null
}
export interface Frame {
  readonly events: readonly LogEvent[]
  readonly tree: Tree
  readonly activities: Wire.ActivityReport
}

const nothing: Standing = { usage: 0, credits: 0, remaining: null }

export const frame = async (): Promise<Frame> => {
  const [memberRows, agentRows, events, activities] = await Promise.all([
    db.select().from(members),
    db.select().from(agents),
    completions(),
    activityReport(),
  ])
  const ids = [
    ORG,
    ...memberRows.map((row) => row.id),
    ...agentRows.map((row) => row.id),
  ]
  const [at, spans] = await Promise.all([standings(ids), spansFor(events)])
  const standing = (id: string) => at.get(id) ?? nothing

  const tree: Tree = {
    org: { id: ORG, name: 'Acme', standing: standing(ORG) },
    members: memberRows.map((member) => ({
      id: member.id,
      name: member.name,
      cap: member.cap,
      standing: standing(member.id),
      agents: agentRows
        .filter((agent) => agent.memberId === member.id)
        .map((agent) => ({
          id: agent.id,
          memberId: agent.memberId,
          name: agent.name,
          model: agent.model,
          standing: standing(agent.id),
        })),
    })),
  }

  // A completion's identity is an agent id; the log shows the agent's and member's names.
  const label = new Map(
    tree.members.flatMap((member) =>
      member.agents.map((agent) => [
        agent.id,
        { agent: agent.name, member: member.name },
      ]),
    ),
  )
  return {
    tree,
    activities,
    events: events.map((event) => {
      const who = label.get(event.external_identity_id ?? '')
      return {
        event,
        agent: who?.agent ?? 'unknown agent',
        member: who?.member ?? '',
        span: spans.get(spanKey(event)) ?? null,
      }
    }),
  }
}
