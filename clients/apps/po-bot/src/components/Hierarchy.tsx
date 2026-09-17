'use client'

import { n, shortModel } from '@/format'
import type { Standing } from '@/void'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Card } from './Card'
import { useLive, type Pulse } from './Live'
import { Meter } from './Meter'

/**
 * The identity tree: the organization on top, its members below, their
 * agents at the bottom. Each node shows what it has spent against what limits
 * it. When a completion lands, a dot leaves the agent and climbs to the member
 * and on to the org, lighting each node up as the credits fold into it.
 */

const NODE = { w: 156, h: 54 }
const ROW = { org: 8, member: 80, agent: 152 }
const HEIGHT = ROW.agent + NODE.h + 8
/** Seconds one leg of the climb takes; the flash on arrival lasts as long. */
const LEG_S = 0.5

interface Placed {
  readonly id: string
  readonly x: number
  readonly y: number
}

/** Cubic from the top of a child to the bottom of its parent. */
const edge = (child: Placed, parent: Placed) => {
  const x1 = child.x
  const y1 = child.y
  const x2 = parent.x
  const y2 = parent.y + NODE.h
  const mid = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`
}

export const Hierarchy = () => {
  const { tree, memberId, pulses } = useLive()
  const scroller = useRef<HTMLElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Every member gets a band as wide as its agents need; agents spread across it.
  const slots = tree.members.reduce(
    (sum, member) => sum + Math.max(1, member.agents.length),
    0,
  )
  const canvas = Math.max(width, slots * (NODE.w + 12))
  const bands: { member: Placed; agents: Placed[] }[] = []
  let x0 = 0
  for (const member of tree.members) {
    const band = (canvas * Math.max(1, member.agents.length)) / slots
    bands.push({
      member: { id: member.id, x: x0 + band / 2, y: ROW.member },
      agents: member.agents.map((agent, i) => ({
        id: agent.id,
        x: x0 + (band * (i + 0.5)) / member.agents.length,
        y: ROW.agent,
      })),
    })
    x0 += band
  }
  const org: Placed = { id: tree.org.id, x: canvas / 2, y: ROW.org }
  const at = new Map<string, Placed>([
    [org.id, org],
    ...bands.flatMap(({ member, agents }) => [
      [member.id, member] as const,
      ...agents.map((agent) => [agent.id, agent] as const),
    ]),
  ])

  /** A pulse touches an identity at leg 0 (its agent), 1 (member) or 2 (org). */
  const arrivals = (id: string) =>
    pulses.flatMap((pulse) => {
      const leg =
        id === pulse.agentId
          ? 0
          : id === pulse.memberId
            ? 1
            : id === org.id
              ? 2
              : null
      return leg === null ? [] : [{ pulse, delay: pulse.delay + leg * LEG_S }]
    })

  return (
    <Box ref={scroller} height="100%" width="100%" overflow="auto">
      {width > 0 && (
        <Box
          position="relative"
          flexShrink={0}
          margin="auto"
          width={canvas}
          height={HEIGHT}
        >
          <svg
            width={canvas}
            height={HEIGHT}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            {bands.map(({ member, agents }) => (
              <g key={member.id} stroke="var(--border)" fill="none">
                <path d={edge(member, org)} strokeWidth={1.5} />
                {agents.map((agent) => (
                  <path
                    key={agent.id}
                    d={edge(agent, member)}
                    strokeWidth={1.5}
                  />
                ))}
              </g>
            ))}
          </svg>

          {pulses.map((pulse) => {
            const agent = at.get(pulse.agentId)
            const member = at.get(pulse.memberId)
            if (!agent || !member) return null
            return (
              <Box key={pulse.id} display="contents">
                <Dot path={edge(agent, member)} delay={pulse.delay} />
                <Dot path={edge(member, org)} delay={pulse.delay + LEG_S} />
              </Box>
            )
          })}

          <Node
            placed={org}
            title={tree.org.name}
            subtitle="organization"
            standing={tree.org.standing}
            limit={tree.org.standing.credits}
            arrivals={arrivals(org.id)}
            wide
          />
          {tree.members.map((member, m) => (
            <Node
              key={member.id}
              placed={bands[m]!.member}
              href={`/members/${member.id}`}
              title={member.name}
              subtitle={`cap ${n(member.cap)}`}
              standing={member.standing}
              limit={member.cap}
              current={member.id === memberId}
              arrivals={arrivals(member.id)}
            />
          ))}
          {tree.members.flatMap((member, m) =>
            member.agents.map((agent, a) => (
              <Node
                key={agent.id}
                placed={bands[m]!.agents[a]!}
                href={`/members/${member.id}/agents/${agent.id}`}
                title={agent.name}
                subtitle={shortModel(agent.model)}
                standing={agent.standing}
                limit={member.cap}
                current={member.id === memberId}
                arrivals={arrivals(agent.id)}
              />
            )),
          )}
        </Box>
      )}
    </Box>
  )
}

/** One credit's worth of completion on its way up an edge. */
const Dot = ({ path, delay }: { path: string; delay: number }) => (
  <Box
    as="span"
    className="pulse-dot"
    position="absolute"
    top={0}
    left={0}
    width={10}
    height={10}
    borderRadius="full"
    style={
      {
        offsetPath: `path('${path}')`,
        animationDelay: `${delay}s`,
        animationDuration: `${LEG_S}s`,
      } as React.CSSProperties
    }
  />
)

const Node = ({
  placed,
  href,
  title,
  subtitle,
  standing,
  limit,
  current = false,
  wide = false,
  arrivals,
}: {
  placed: Placed
  href?: string
  title: string
  subtitle: string
  standing: Standing
  limit: number
  current?: boolean
  wide?: boolean
  arrivals: readonly { pulse: Pulse; delay: number }[]
}) => {
  const width = wide ? NODE.w + 40 : NODE.w
  const spent = standing.remaining === 0
  const share = limit > 0 ? Math.min(100, (standing.usage / limit) * 100) : 0
  const body = (
    <Card
      position="absolute"
      flexDirection="column"
      rowGap="xs"
      left={placed.x - width / 2}
      top={placed.y}
      width={width}
      height={NODE.h}
      paddingHorizontal="s"
      paddingVertical="xs"
      backgroundColor={{
        base: current ? 'background-card' : 'background-primary',
        hover: href ? 'background-card' : undefined,
      }}
      transitionProperty="colors"
      transitionDuration="fast"
      cursor={href ? 'pointer' : 'default'}
    >
      <Box justifyContent="between" alignItems="baseline" columnGap="s">
        <Text
          variant="caption"
          as="span"
          truncate
          style={{ flex: 1, minWidth: 0 }}
        >
          {title}
        </Text>
        <Text
          variant="caption"
          color="muted"
          as="span"
          monospace
          truncate
          style={{ maxWidth: '55%' }}
        >
          {subtitle}
        </Text>
      </Box>
      <Box justifyContent="between" columnGap="s">
        <Text
          variant="caption"
          as="span"
          color={spent ? 'danger' : 'default'}
          tabularNums
        >
          {spent ? 'Cap reached' : `${n(standing.usage)} used`}
        </Text>
        {standing.remaining !== null && (
          <Text variant="caption" as="span" color="muted" tabularNums>
            {n(standing.remaining)} left
          </Text>
        )}
      </Box>
      <Meter share={share} spent={spent} height={4} />
      {arrivals.map(({ pulse, delay }) => (
        <Box as="span" key={pulse.id} display="contents">
          <Box
            as="span"
            className="node-flash"
            position="absolute"
            inset={0}
            borderRadius="l"
            pointerEvents="none"
            style={{ animationDelay: `${delay}s` }}
          />
          <Box
            as="span"
            className="node-delta"
            display="inline-flex"
            position="absolute"
            top={-8}
            right={8}
            borderRadius="full"
            backgroundColor="background-inverse"
            paddingHorizontal="xs"
            pointerEvents="none"
            style={{ animationDelay: `${delay}s` }}
          >
            <Text variant="caption" as="span" color="inverse" tabularNums>
              +{n(pulse.credits)}
            </Text>
          </Box>
        </Box>
      ))}
    </Card>
  )
  return href ? (
    <Link href={href} style={{ display: 'contents' }}>
      {body}
    </Link>
  ) : (
    body
  )
}
