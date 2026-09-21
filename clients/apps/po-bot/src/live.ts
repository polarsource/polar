import {
  emptyChannels,
  type Channel,
  type Channels,
  type Live,
  type LogEvent,
  type Tree,
} from './channels'
import { db } from './db'
import { agents, members, type Agent, type Member } from './db/schema'
import {
  ORG,
  activityReport,
  completions,
  judgments,
  spanKey,
  spansFor,
  standings,
  type Standing,
} from './void'

export type {
  AgentNode,
  Channel,
  Channels,
  Live,
  LogEvent,
  MemberNode,
  Tree,
} from './channels'

/**
 * The organization's live state, split into channels that refresh on their
 * own cadence and fail on their own. One broadcaster loop per process feeds
 * every SSE subscriber; `/api/frame` hands a new tab the current state.
 *
 * Things that happen inside this process — a call starting, a completion
 * landing — do not wait for a poll: `publish` pushes them the moment they
 * happen and asks the affected channels to refresh right after.
 */

const nothing: Standing = { usage: 0, credits: 0, remaining: null }

const treeFrom = (
  memberRows: readonly Member[],
  agentRows: readonly Agent[],
  standing: (id: string) => Standing,
): Tree => ({
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
})

const rows = () =>
  Promise.all([db.select().from(members), db.select().from(agents)])

const loadTree = async (): Promise<Tree> => {
  const [memberRows, agentRows] = await rows()
  const ids = [
    ORG,
    ...memberRows.map((row) => row.id),
    ...agentRows.map((row) => row.id),
  ]
  const at = await standings(ids)
  return treeFrom(memberRows, agentRows, (id) => at.get(id) ?? nothing)
}

const loadEvents = async (): Promise<readonly LogEvent[]> => {
  const [[memberRows, agentRows], events] = await Promise.all([
    rows(),
    completions(),
  ])
  const spans = await spansFor(events)
  const memberName = new Map(memberRows.map((row) => [row.id, row.name]))
  const label = new Map(
    agentRows.map((row) => [
      row.id,
      { agent: row.name, member: memberName.get(row.memberId) ?? '' },
    ]),
  )
  return events.map((event) => {
    const who = label.get(event.external_identity_id ?? '')
    return {
      event,
      agent: who?.agent ?? 'unknown agent',
      member: who?.member ?? '',
      span: spans.get(spanKey(event)) ?? null,
    }
  })
}

const loadJudgments = async () => {
  const agentRows = await db.select().from(agents)
  return judgments(agentRows.map((row) => row.id))
}

const loaders: { readonly [C in Channel]: () => Promise<Channels[C]> } = {
  tree: loadTree,
  events: loadEvents,
  judgments: loadJudgments,
  activities: activityReport,
}

const CADENCE_MS: Readonly<Record<Channel, number>> = {
  tree: 2_000,
  events: 2_000,
  judgments: 30_000,
  activities: 10_000,
}
const CHANNELS = Object.keys(CADENCE_MS) as readonly Channel[]

type Listener = (name: string, json: string) => void

interface Broadcaster {
  state: Channels
  encoded: Partial<Record<Channel, string>>
  readonly listeners: Set<Listener>
  readonly timers: Map<Channel, ReturnType<typeof setTimeout>>
  readonly inflight: Map<Channel, Promise<void>>
  readonly dirty: Set<Channel>
}

const shared = globalThis as typeof globalThis & { poBotLive?: Broadcaster }
const live: Broadcaster = (shared.poBotLive ??= {
  state: emptyChannels,
  encoded: {},
  listeners: new Set(),
  timers: new Map(),
  inflight: new Map(),
  dirty: new Set(),
})

const emit = (name: string, json: string) => {
  for (const listener of live.listeners) listener(name, json)
}

const schedule = (channel: Channel, ms: number) => {
  clearTimeout(live.timers.get(channel))
  if (live.listeners.size === 0) return
  live.timers.set(
    channel,
    setTimeout(() => void tick(channel), ms),
  )
}

/** Load one channel; broadcast only when its content changed. */
const tick = (channel: Channel): Promise<void> => {
  const running = live.inflight.get(channel)
  if (running) {
    live.dirty.add(channel)
    return running
  }
  const work = (async () => {
    try {
      const next = await loaders[channel]()
      const json = JSON.stringify(next)
      if (json !== live.encoded[channel]) {
        live.state = { ...live.state, [channel]: next }
        live.encoded[channel] = json
        emit(channel, json)
      }
    } catch (error) {
      console.error(`live: ${channel} failed`, error)
    } finally {
      live.inflight.delete(channel)
      const again = live.dirty.delete(channel)
      schedule(channel, again ? 0 : CADENCE_MS[channel])
    }
  })()
  live.inflight.set(channel, work)
  return work
}

/** Reload a channel now instead of at its next beat. */
export const refresh = (...channels: readonly Channel[]) => {
  for (const channel of channels) void tick(channel)
}

/** The current state of every channel. Never hits Void. */
export const snapshot = (): Channels => live.state

/**
 * Push something this process saw. Completions change standings, so the
 * tree and the log reload right after; the local event outbox already
 * holds the completion, so the reload reflects it.
 */
export const publish = (event: Live) => {
  emit('live', JSON.stringify(event))
  if (event.type === 'completion') refresh('tree', 'events')
}

/**
 * Subscribe an SSE connection. The first subscriber starts the loops; the
 * last one leaving stops them. Every channel's current state is sent first.
 */
export const subscribe = (listener: Listener) => {
  const first = live.listeners.size === 0
  live.listeners.add(listener)
  for (const channel of CHANNELS) {
    listener(
      channel,
      (live.encoded[channel] ??= JSON.stringify(live.state[channel])),
    )
  }
  if (first) for (const channel of CHANNELS) void tick(channel)
  return () => {
    live.listeners.delete(listener)
    if (live.listeners.size > 0) return
    for (const timer of live.timers.values()) clearTimeout(timer)
    live.timers.clear()
  }
}
