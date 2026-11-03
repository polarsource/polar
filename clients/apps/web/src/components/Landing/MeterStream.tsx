'use client'

import LogoType from '@/components/Brand/logos/LogoType'
import { StaticImage } from '@/components/Image/StaticImage'
import { useInView } from '@/hooks/useInView'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, LoaderCircle } from '@polar-sh/orbit/icons'
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
    charge: '$0.0024',
  },
  {
    customer: 'Northwind',
    environment: 'production',
    event: "events.ingest({ name: 'gpu.seconds', value: 38 })",
    usage: '38 GPU seconds',
    charge: '$0.0456',
  },
  {
    customer: 'Atlas',
    environment: 'production',
    event: "events.ingest({ name: 'agent.runs', value: 3 })",
    usage: '3 agent runs',
    charge: '$0.30',
  },
]

type Phase = 'enter' | 'typing' | 'metering' | 'metered' | 'exit'

const DURATIONS: Record<Exclude<Phase, 'typing'>, number> = {
  enter: 1000,
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
            ? [() => setTyped((count) => count + 1), 22]
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
    <div
      ref={ref}
      className="dark:border-polar-800 relative flex min-h-[20rem] w-full items-center justify-center overflow-hidden rounded-md border border-gray-200 px-4 py-10 md:min-h-[28rem] md:px-12"
    >
      <StaticImage
        src="/assets/landing/company/Polar_Flow_03_No_Logo.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-black/40" />
      <div className="dark:bg-polar-950 dark:border-polar-800 relative flex w-full max-w-[38rem] flex-col rounded-2xl border border-gray-200 bg-gray-100 p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)]">
        <Box
          alignItems="center"
          justifyContent="between"
          columnGap="l"
          paddingHorizontal="xl"
          paddingVertical="m"
        >
          <LogoType height={14} />
          <Text variant="caption" color="muted">
            {scenario.customer} in {scenario.environment}
          </Text>
        </Box>
        <div className="dark:bg-polar-900 flex w-full flex-col overflow-hidden rounded-xl bg-white">
          <Box
            width="100%"
            flexDirection="column"
            rowGap="l"
            padding="xl"
            opacity={phase === 'exit' ? 0 : 1}
            transitionProperty="opacity"
            transitionDuration="slower"
          >
            <Box minHeight={18}>
              <Text variant="caption" monospace>
                {scenario.event.slice(0, typed)}
                {phase === 'enter' ? (
                  <span className="[animation:blink_1s_steps(1)_infinite]">
                    ▍
                  </span>
                ) : phase === 'typing' ? (
                  '▍'
                ) : null}
              </Text>
            </Box>
            <Box
              justifyContent="between"
              alignItems="center"
              columnGap="l"
              paddingTop="l"
              borderTopWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
              opacity={settled ? 1 : 0}
              transitionProperty="opacity"
              transitionDuration="slow"
            >
              <Box alignItems="center" columnGap="s" color="text-secondary">
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
              </Box>
              <Box
                alignItems="baseline"
                columnGap="s"
                opacity={phase === 'metered' ? 1 : 0}
                transitionProperty="opacity"
                transitionDuration="slow"
              >
                <Text variant="caption" color="muted" wrap="nowrap">
                  Added to invoice
                </Text>
                <Text variant="caption" tabularNums>
                  {scenario.charge}
                </Text>
              </Box>
            </Box>
          </Box>
        </div>
      </div>
    </div>
  )
}
