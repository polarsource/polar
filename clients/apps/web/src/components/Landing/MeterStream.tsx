'use client'

import { StaticImage } from '@/components/Image/StaticImage'
import { useInView } from '@/hooks/useInView'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, LoaderCircle } from 'lucide-react'
import { Shimmer } from './Shimmer'
import { useEffect, useState } from 'react'

interface Scenario {
  customer: string
  environment: string
  event: string
  usage: string
  charge: string
}

const SCENARIOS: Scenario[] = [
  {
    customer: 'Lumen',
    environment: 'production',
    event: "events.ingest({ name: 'ai.tokens', value: 1204 })",
    usage: '1,204 tokens',
    charge: "$0.0024 added to Lumen's invoice",
  },
  {
    customer: 'Northwind',
    environment: 'production',
    event: "events.ingest({ name: 'gpu.seconds', value: 38 })",
    usage: '38 GPU seconds',
    charge: "$0.0456 added to Northwind's invoice",
  },
  {
    customer: 'Atlas',
    environment: 'production',
    event: "events.ingest({ name: 'agent.runs', value: 3 })",
    usage: '3 agent runs',
    charge: "$0.30 added to Atlas's invoice",
  },
]

type Phase = 'enter' | 'typing' | 'metering' | 'metered' | 'exit'

const DURATIONS: Record<Exclude<Phase, 'typing'>, number> = {
  enter: 700,
  metering: 1600,
  metered: 2200,
  exit: 500,
}

export const MeterStream = () => {
  const { ref, inView } = useInView()
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState(0)
  const [phase, setPhase] = useState<Phase>('enter')
  const scenario = SCENARIOS[index]

  useEffect(() => {
    if (!inView) return
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    const advance = (): [() => void, number] => {
      switch (phase) {
        case 'enter':
          return reducedMotion
            ? [
                () => {
                  setTyped(scenario.event.length)
                  setPhase('metered')
                },
                0,
              ]
            : [() => setPhase('typing'), DURATIONS.enter]
        case 'typing':
          return typed < scenario.event.length
            ? [() => setTyped((count) => count + 1), 28]
            : [() => setPhase('metering'), 300]
        case 'metering':
          return [() => setPhase('metered'), DURATIONS.metering]
        case 'metered':
          return [() => setPhase('exit'), DURATIONS.metered]
        case 'exit':
          return [
            () => {
              setIndex((current) => (current + 1) % SCENARIOS.length)
              setTyped(0)
              setPhase('enter')
            },
            DURATIONS.exit,
          ]
      }
    }

    const [next, delay] = advance()
    const timer = setTimeout(next, delay)
    return () => clearTimeout(timer)
  }, [inView, phase, typed, scenario])

  const settled = phase === 'metering' || phase === 'metered'

  return (
    <Box
      ref={ref}
      position="relative"
      width="100%"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      paddingHorizontal={{ base: 'l', md: '3xl' }}
      minHeight={{ base: '20rem', md: '28rem' }}
      backgroundColor="background-secondary"
    >
      <StaticImage
        src="/assets/landing/company/polar.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
      />
      <Box
        position="relative"
        width="100%"
        maxWidth="38rem"
        padding={{ base: 'l', md: 'xl' }}
        backgroundColor="background-primary"
        boxShadow="l"
      >
        <Box
          width="100%"
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
                width={20}
                height={20}
                alignItems="center"
                justifyContent="center"
                backgroundColor="background-secondary"
              >
                <Text variant="caption">{scenario.customer[0]}</Text>
              </Box>
              <Text variant="caption" color="muted">
                {scenario.customer} in {scenario.environment}
              </Text>
            </Box>
            <Box minHeight={18}>
              <Text variant="caption" monospace>
                {scenario.event.slice(0, typed)}
                {phase === 'typing' ? '▍' : ''}
              </Text>
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
            {phase === 'metered' ? (
              <Check size={12} />
            ) : (
              <LoaderCircle size={12} className="animate-spin" />
            )}
            <Text variant="caption" color="inherit" wrap="nowrap">
              <Shimmer active={phase === 'metering'}>
                {phase === 'metered' ? 'Metered' : 'Metering'}
              </Shimmer>
            </Text>
            <Text variant="caption" color="muted" wrap="nowrap">
              {scenario.usage}
            </Text>
            <Box
              minWidth={0}
              columnGap="s"
              opacity={phase === 'metered' ? 1 : 0}
              transitionProperty="opacity"
              transitionDuration="slow"
            >
              <Text variant="caption" color="muted">
                ·
              </Text>
              <Text variant="caption" color="muted" truncate>
                {scenario.charge}
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
