'use client'

import { mixFrom, ofIdentities } from '@/activity'
import type { Frame, MemberNode } from '@/live'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

/**
 * One completion travelling up the tree: agent, then member, then org. Made
 * when an event first shows up in a frame; gone again two seconds later.
 */
export interface Pulse {
  readonly id: string
  readonly agentId: string
  readonly memberId: string
  readonly credits: number
  /** Seconds to hold before starting, so a burst of completions staggers. */
  readonly delay: number
}

interface Live extends Frame {
  readonly memberId: string
  /** The member this page is about, out of the tree. */
  readonly member: MemberNode
  readonly pulses: readonly Pulse[]
}

export const LiveContext = createContext<Live | null>(null)

const PULSE_MS = 2400
const STAGGER_S = 0.2

const empty = (id: string): MemberNode => ({
  id,
  name: '',
  cap: 0,
  standing: { usage: 0, credits: 0, remaining: null },
  agents: [],
})

/** Subscribes to the live stream once; everything on the page reads from it. */
export const LiveProvider = ({
  memberId,
  initial,
  children,
}: {
  memberId: string
  initial: Frame
  children: React.ReactNode
}) => {
  const [frame, setFrame] = useState<Frame>(initial)
  const [pulses, setPulses] = useState<readonly Pulse[]>([])
  const seen = useRef(new Set(initial.events.map(({ event }) => event.id)))

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const source = new EventSource('/api/live')
    source.onmessage = (message) => {
      const next = JSON.parse(message.data) as Frame
      const owner = new Map(
        next.tree.members.flatMap((member) =>
          member.agents.map((agent) => [agent.id, member.id]),
        ),
      )
      const fresh = next.events
        .filter(({ event }) => !seen.current.has(event.id))
        .reverse()
        .flatMap(({ event }, i) => {
          const agentId = event.external_identity_id ?? ''
          const memberId = owner.get(agentId)
          if (!memberId) return []
          const credits = event.metadata.credits
          return [
            {
              id: event.id,
              agentId,
              memberId,
              credits: typeof credits === 'number' ? credits : 0,
              delay: i * STAGGER_S,
            },
          ]
        })
      for (const { event } of next.events) seen.current.add(event.id)

      setFrame(next)
      if (fresh.length > 0) {
        setPulses((current) => [...current, ...fresh])
        const ids = new Set(fresh.map((pulse) => pulse.id))
        const timer = setTimeout(
          () => {
            timers.delete(timer)
            setPulses((current) =>
              current.filter((pulse) => !ids.has(pulse.id)),
            )
          },
          PULSE_MS + fresh.length * STAGGER_S * 1000,
        )
        timers.add(timer)
      }
    }
    return () => {
      source.close()
      for (const timer of timers) clearTimeout(timer)
    }
  }, [])

  const live = useMemo<Live>(
    () => ({
      ...frame,
      memberId,
      member:
        frame.tree.members.find((member) => member.id === memberId) ??
        empty(memberId),
      pulses,
    }),
    [frame, memberId, pulses],
  )

  return <LiveContext value={live}>{children}</LiveContext>
}

export const useLive = () => {
  const live = useContext(LiveContext)
  if (!live) throw new Error('useLive needs a LiveProvider above it')
  return live
}

/**
 * Completions and Jev labels for one agent — the identity that recorded
 * them — or, with no identity, every agent of the member on this page.
 * Each agent has one thread, so this is the chat.
 */
export const useChatActivity = (identity?: string) => {
  const live = useLive()
  return useMemo(() => {
    const ids = identity
      ? new Set([identity])
      : new Set(live.member.agents.map((agent) => agent.id))
    const events = ofIdentities(live.events, ids)
    return {
      events,
      mix: mixFrom(events),
      agent: identity
        ? live.member.agents.find((agent) => agent.id === identity)
        : undefined,
    }
  }, [identity, live.events, live.member])
}
