'use client'

import { useInView } from '@/hooks/useInView'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Shimmer } from '../Shimmer'
import { CodeLine } from './CodePanel'

interface Surface {
  name: string
  avatar: string
  header: string
  code: string
  prose?: boolean
  running: string
  done: string
  result: string
}

const SURFACES: Surface[] = [
  {
    name: 'MCP',
    avatar: 'M',
    header: 'Mia in Claude Code',
    code: 'Which customers ran out of credits this week?',
    prose: true,
    running: 'execute_tool list_customer_meters',
    done: 'Done',
    result: 'Atlas, Northwind and Lumen crossed zero',
  },
  {
    name: 'SDK',
    avatar: 'TS',
    header: 'index.ts',
    code: [
      'await polar.events.ingest({',
      '  events: [{',
      "    name: 'ai.tokens',",
      "    externalCustomerId: 'lumen',",
      '  }],',
      '})',
    ].join('\n'),
    running: 'Ingesting',
    done: 'Ingested',
    result: "1,204 tokens on Lumen's meter",
  },
  {
    name: 'CLI',
    avatar: '%',
    header: 'zsh',
    code: '% polar listen http://localhost:3000/webhooks',
    running: 'Connecting',
    done: 'Connected',
    result: 'Forwarding to localhost:3000',
  },
  {
    name: 'API',
    avatar: '>',
    header: 'curl',
    code: [
      'curl -X POST https://api.polar.sh/v1/checkouts \\',
      '  -H "Authorization: Bearer $POLAR_ACCESS_TOKEN" \\',
      '  -H "Polar-Version: 2026-04" \\',
      '  -d \'{ "products": ["prod_scale"] }\'',
    ].join('\n'),
    running: 'Requesting',
    done: '201 Created',
    result: 'polar.sh/checkout/…',
  },
]

type Phase = 'enter' | 'typing' | 'running' | 'done' | 'exit'

const DURATIONS = {
  enter: 600,
  typing: 22,
  running: 1400,
  done: 2800,
  exit: 500,
}

export const SurfaceCycle = () => {
  const { ref, inView } = useInView()
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState(0)
  const [phase, setPhase] = useState<Phase>('enter')
  const surface = SURFACES[index]

  const select = (i: number) => {
    setIndex(i)
    setTyped(0)
    setPhase('enter')
  }

  useEffect(() => {
    if (!inView) return

    const advance = (): [() => void, number] => {
      switch (phase) {
        case 'enter':
          return [() => setPhase('typing'), DURATIONS.enter]
        case 'typing':
          return typed < surface.code.length
            ? [() => setTyped((n) => n + 1), DURATIONS.typing]
            : [() => setPhase('running'), 300]
        case 'running':
          return [() => setPhase('done'), DURATIONS.running]
        case 'done':
          return [() => setPhase('exit'), DURATIONS.done]
        case 'exit':
          return [() => select((index + 1) % SURFACES.length), DURATIONS.exit]
      }
    }

    const [next, delay] = advance()
    const timer = setTimeout(next, delay)
    return () => clearTimeout(timer)
  }, [inView, phase, typed, index, surface])

  const settled = phase === 'running' || phase === 'done'
  const lines = surface.code.slice(0, typed).split('\n')

  return (
    <Box
      ref={ref}
      width="100%"
      height="100%"
      flexDirection="column"
      justifyContent="between"
      rowGap="xl"
      overflow="hidden"
    >
      <Box
        flexDirection="column"
        rowGap="m"
        opacity={phase === 'exit' ? 0 : 1}
        transitionProperty="opacity"
        transitionDuration="slower"
      >
        <Box
          flexDirection="column"
          rowGap="s"
          padding="l"
          backgroundColor="background-card"
          boxShadow="m"
        >
          <Box alignItems="center" columnGap="s">
            <Box
              minWidth={20}
              height={20}
              paddingHorizontal="xs"
              alignItems="center"
              justifyContent="center"
              backgroundColor="background-secondary"
            >
              <Text variant="caption" monospace>
                {surface.avatar}
              </Text>
            </Box>
            <Text variant="caption" color="muted">
              {surface.header}
            </Text>
          </Box>
          <Box
            flexDirection="column"
            minWidth={0}
            minHeight={20}
            overflowX="auto"
          >
            {lines.map((line, i) => (
              <Box key={i} alignItems="center">
                {surface.prose ? (
                  <Text variant="default">{line}</Text>
                ) : (
                  <CodeLine line={line} />
                )}
                {i === lines.length - 1 && phase === 'typing' ? (
                  <Text variant="default" monospace>
                    ▍
                  </Text>
                ) : null}
              </Box>
            ))}
          </Box>
        </Box>
        <Box
          alignItems="center"
          columnGap="s"
          paddingHorizontal="l"
          color="text-secondary"
          opacity={settled ? 1 : 0}
          transitionProperty="opacity"
          transitionDuration="slow"
        >
          {phase === 'done' ? (
            <Check size={12} />
          ) : (
            <LoaderCircle size={12} className="animate-spin" />
          )}
          <Text variant="caption" color="inherit" monospace wrap="nowrap">
            <Shimmer active={phase === 'running'}>
              {phase === 'done' ? surface.done : surface.running}
            </Shimmer>
          </Text>
          <Box
            minWidth={0}
            columnGap="s"
            opacity={phase === 'done' ? 1 : 0}
            transitionProperty="opacity"
            transitionDuration="slow"
          >
            <Text variant="caption" color="muted">
              ·
            </Text>
            <Text variant="caption" color="muted" truncate>
              {surface.result}
            </Text>
          </Box>
        </Box>
      </Box>
      <Box as="ul" columnGap="l">
        {SURFACES.map((s, i) => (
          <Box as="li" key={s.name}>
            <button
              type="button"
              className="cursor-pointer"
              onClick={() => select(i)}
            >
              <Box
                color={{
                  base: i === index ? 'text-primary' : 'text-secondary',
                  hover: 'text-primary',
                }}
                transitionProperty="colors"
                transitionDuration="fast"
              >
                <Text variant="default" color="inherit" monospace>
                  {s.name}
                </Text>
              </Box>
            </button>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
