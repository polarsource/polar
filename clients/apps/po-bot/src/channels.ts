import type { Wire } from '@void/sdk'
import { ORG } from './constants'
import type { AgentJudgment, Standing } from './void'

/**
 * The shape of the organization's live state, shared by the server that
 * builds it and the browser that reads it. No runtime imports beyond
 * constants, so the client bundle stays free of sqlite and the Void client.
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

export interface Channels {
  readonly tree: Tree
  readonly events: readonly LogEvent[]
  readonly judgments: readonly AgentJudgment[]
  readonly activities: Wire.ActivityReport
}
export type Channel = keyof Channels

/** What this process saw happen, pushed as it happens. */
export type Live =
  | {
      readonly type: 'call'
      readonly agentId: string
      readonly memberId: string
    }
  | {
      readonly type: 'completion'
      readonly id: string
      readonly agentId: string
      readonly memberId: string
      readonly credits: number
    }
  | { readonly type: 'settled'; readonly agentId: string }

const nothing: Standing = { usage: 0, credits: 0, remaining: null }

export const emptyChannels: Channels = {
  tree: { org: { id: ORG, name: 'Acme', standing: nothing }, members: [] },
  events: [],
  judgments: [],
  activities: {
    window: {},
    totals: { cost: 0, labeled_cost: 0, unlabeled_cost: 0, pending_cost: 0 },
    by_activity: [],
  },
}
