'use client'

import { useInView } from '@/hooks/useInView'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect, useState } from 'react'
import { Sheet, Window } from './Frame'

/** Acme's agents, each with a spend cap. The research agent climbs fastest and hits its cap. */
const AGENTS = [
  { name: 'support-agent', start: 212, perStep: 6, cap: 600 },
  { name: 'research-agent', start: 318, perStep: 22, cap: 500 },
  { name: 'triage-agent', start: 96, perStep: 3, cap: 300 },
]
const STEPS = 12
const STEP_MS = 650

const useStep = () => {
  const { ref, inView } = useInView()
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (!inView) return
    const timer = window.setTimeout(
      () => setStep((s) => (s + 1) % (STEPS + 4)),
      STEP_MS,
    )
    return () => clearTimeout(timer)
  }, [inView, step])
  return { ref, step: Math.min(step, STEPS) }
}

const dollars = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`

/** Fig. 06: Acme at the root with its agents beneath, usage rolling up and caps holding each agent back. */
export const AgentsFigure = () => {
  const { ref, step } = useStep()
  const spend = AGENTS.map((a) => Math.min(a.cap, a.start + step * a.perStep))
  const total = spend.reduce((a, b) => a + b, 0)

  return (
    <Window innerRef={ref} aside="Acme Inc · 3 agents">
      <Grid templateColumns={{ base: '1fr', lg: '2fr 3fr' }} gap="xs">
        <Sheet
          title="Acme Inc"
          aside={
            <Text variant="caption" color="muted">
              Customer
            </Text>
          }
        >
          <Box flexDirection="column" rowGap="xs">
            <Text variant="caption" color="muted">
              Agent spend this cycle
            </Text>
            <Text variant="heading-xs" tabularNums>
              {dollars(total)}
            </Text>
          </Box>
          <Text variant="caption" color="muted">
            Usage rolls up from every agent to the customer who pays. Credits
            and limits flow down.
          </Text>
          <Box
            marginTop="auto"
            paddingTop="l"
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            flexDirection="column"
            rowGap="xs"
          >
            <Text variant="caption" monospace>
              {"polar.identities.create({ parent: 'acme' })"}
            </Text>
          </Box>
        </Sheet>
        <Sheet
          title="Agents"
          aside={
            <Text variant="caption" color="muted">
              Spend · cap
            </Text>
          }
        >
          <Box flexDirection="column" rowGap="l">
            {AGENTS.map((agent, i) => {
              const capped = spend[i] >= agent.cap
              return (
                <Box key={agent.name} flexDirection="column" rowGap="s">
                  <Box
                    justifyContent="between"
                    alignItems="baseline"
                    columnGap="l"
                  >
                    <Text variant="default" monospace>
                      {agent.name}
                    </Text>
                    <Box alignItems="baseline" columnGap="m">
                      <Text variant="caption" color="muted" tabularNums>
                        {dollars(spend[i])} · {dollars(agent.cap)}
                      </Text>
                      <Box minWidth={64} justifyContent="end">
                        <Text
                          variant="caption"
                          color={capped ? 'default' : 'muted'}
                        >
                          {capped ? 'Paused at cap' : 'Running'}
                        </Text>
                      </Box>
                    </Box>
                  </Box>
                  <div className="dark:bg-polar-800 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-white transition-[width] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                      style={{ width: `${(spend[i] / agent.cap) * 100}%` }}
                    />
                  </div>
                </Box>
              )
            })}
          </Box>
        </Sheet>
      </Grid>
    </Window>
  )
}
