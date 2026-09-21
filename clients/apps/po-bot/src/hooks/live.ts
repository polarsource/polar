'use client'

import { mixFrom, ofIdentities } from '@/activity'
import { get } from '@/api'
import type { Channel, Channels, Live, MemberNode, Tree } from '@/channels'
import { emptyChannels } from '@/channels'
import type { Standing } from '@/void'
import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { useEffect, useMemo } from 'react'

/**
 * The live layer. One SSE stream (`/api/live`) writes each channel of the
 * organization's state into the TanStack Query cache under `['live', name]`;
 * components read their slice with a selector, so a beat on one channel does
 * not re-render readers of another.
 *
 * `live` events are what the server saw happen just now. A completion bumps
 * the standings on the spot and sends a pulse up the tree; the next `tree`
 * beat replaces the guess with Void's numbers.
 */

export interface Pulse {
  readonly id: string
  readonly agentId: string
  readonly memberId: string
  readonly credits: number
}

const key = (channel: Channel) => ['live', channel] as const
const PULSES_KEY = ['live', 'pulses'] as const
const BUSY_KEY = ['live', 'busy'] as const

/** Long enough for both legs of the climb and the flash on arrival. */
const PULSE_MS = 2_400

const nothing: Standing = { usage: 0, credits: 0, remaining: null }

const emptyMember = (id: string): MemberNode => ({
  id,
  name: '',
  cap: 0,
  standing: nothing,
  agents: [],
})

let pending: Promise<Channels> | undefined
/** One `/api/frame` read shared by every channel that mounts before the stream speaks. */
const frame = () =>
  (pending ??= get<Channels>('/api/frame').finally(() => {
    pending = undefined
  }))

const useChannel = <C extends Channel, T = Channels[C]>(
  channel: C,
  select?: (data: Channels[C]) => T,
) =>
  useQuery({
    queryKey: key(channel),
    queryFn: async () => (await frame())[channel],
    staleTime: Infinity,
    select,
  })

export const useTree = (): Tree => useChannel('tree').data ?? emptyChannels.tree

/** Whether the tree has arrived at all, for pages that 404 on an unknown id. */
export const useTreeLoaded = () => useChannel('tree').data !== undefined

export const useJudgments = () =>
  useChannel('judgments').data ?? emptyChannels.judgments

export const useMemberNode = (memberId: string): MemberNode =>
  useChannel('tree', (tree) =>
    tree.members.find((member) => member.id === memberId),
  ).data ?? emptyMember(memberId)

export const usePulses = (): readonly Pulse[] =>
  useQuery({
    queryKey: PULSES_KEY,
    queryFn: () => [] as readonly Pulse[],
    staleTime: Infinity,
  }).data ?? []

/** Agents with a model call in flight right now. */
export const useBusy = (): ReadonlySet<string> =>
  useQuery({
    queryKey: BUSY_KEY,
    queryFn: () => new Set<string>() as ReadonlySet<string>,
    staleTime: Infinity,
  }).data ?? new Set<string>()

/**
 * Completions and Jev labels for one agent — the identity that recorded them —
 * or, with no identity, every agent of the member on this page.
 */
export const useChatActivity = (identity?: string) => {
  const { id: memberId } = useParams<{ id?: string }>()
  const member = useMemberNode(memberId ?? '')
  const events = useChannel('events').data ?? emptyChannels.events
  return useMemo(() => {
    const ids = identity
      ? new Set([identity])
      : new Set(member.agents.map((agent) => agent.id))
    const scoped = ofIdentities(events, ids)
    return {
      events: scoped,
      mix: mixFrom(scoped),
      agent: identity
        ? member.agents.find((agent) => agent.id === identity)
        : undefined,
    }
  }, [identity, member, events])
}

const spend = (standing: Standing, credits: number): Standing => ({
  ...standing,
  usage: standing.usage + credits,
  remaining:
    standing.remaining === null
      ? null
      : Math.max(0, standing.remaining - credits),
})

/** The completion's credits folded into the agent, its member and the org, ahead of Void. */
const bump = (
  tree: Tree,
  event: Extract<Live, { type: 'completion' }>,
): Tree => ({
  org: { ...tree.org, standing: spend(tree.org.standing, event.credits) },
  members: tree.members.map((member) =>
    member.id !== event.memberId
      ? member
      : {
          ...member,
          standing: spend(member.standing, event.credits),
          agents: member.agents.map((agent) =>
            agent.id !== event.agentId
              ? agent
              : { ...agent, standing: spend(agent.standing, event.credits) },
          ),
        },
  ),
})

const setBusy = (client: QueryClient, agentId: string, busy: boolean) =>
  client.setQueryData<ReadonlySet<string>>(BUSY_KEY, (current = new Set()) => {
    if (current.has(agentId) === busy) return current
    const next = new Set(current)
    if (busy) next.add(agentId)
    else next.delete(agentId)
    return next
  })

const CHANNELS: readonly Channel[] = [
  'tree',
  'events',
  'judgments',
  'activities',
]

/**
 * Mount once where the live view lives. Opens the SSE stream, routes each
 * channel into the query cache, and turns what the server saw into busy
 * state, optimistic standings and pulses. Renders nothing.
 */
export const LiveStream = () => {
  const client = useQueryClient()

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const source = new EventSource('/api/live')

    for (const channel of CHANNELS) {
      source.addEventListener(channel, (message: MessageEvent<string>) => {
        client.setQueryData(key(channel), JSON.parse(message.data))
      })
    }

    source.addEventListener('live', (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as Live
      if (event.type === 'call') {
        setBusy(client, event.agentId, true)
        return
      }
      if (event.type === 'settled') {
        setBusy(client, event.agentId, false)
        return
      }
      client.setQueryData<Tree>(key('tree'), (tree) =>
        tree ? bump(tree, event) : tree,
      )
      const pulse: Pulse = {
        id: event.id,
        agentId: event.agentId,
        memberId: event.memberId,
        credits: event.credits,
      }
      client.setQueryData<readonly Pulse[]>(PULSES_KEY, (current = []) => [
        ...current,
        pulse,
      ])
      const timer = setTimeout(() => {
        timers.delete(timer)
        client.setQueryData<readonly Pulse[]>(PULSES_KEY, (current = []) =>
          current.filter((each) => each.id !== pulse.id),
        )
      }, PULSE_MS)
      timers.add(timer)
    })

    return () => {
      source.close()
      for (const timer of timers) clearTimeout(timer)
    }
  }, [client])

  return null
}
