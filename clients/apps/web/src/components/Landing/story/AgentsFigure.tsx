'use client'

import { useInView } from '@/hooks/useInView'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Shimmer } from '../Shimmer'
import { Sheet, Window } from './Frame'

/** A Claude Code session connected to the Polar MCP server. Tool names are the documented MCP operations. */
const TURNS = [
  {
    prompt: 'How much usage has Acme run up this cycle?',
    tool: 'Get customer state by external ID',
    answer:
      'Acme is on Pro with 9.2B tokens metered. They used all 40,000 credits and $1,284 of usage on top.',
  },
  {
    prompt: 'Give them 20% off next month.',
    tool: 'Create discount code',
    answer:
      'Done. ACME20 takes 20% off one month and applies to their next invoice.',
  },
]

/** Each turn: the prompt types, the tool call runs, the answer appears. Then the session clears and repeats. */
type Beat = 'typing' | 'calling' | 'answered'
const TYPE_PER_SECOND = 32

const useSession = () => {
  const { ref, inView } = useInView()
  const [turn, setTurn] = useState(0)
  const [beat, setBeat] = useState<Beat>('typing')
  const [typed, setTyped] = useState(0)

  useEffect(() => {
    if (!inView) return
    let frame = 0
    let timer = 0
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      timer = window.setTimeout(() => {
        setTurn(TURNS.length - 1)
        setTyped(TURNS[TURNS.length - 1].prompt.length)
        setBeat('answered')
      }, 0)
      return () => clearTimeout(timer)
    }
    const prompt = TURNS[turn].prompt
    if (beat === 'typing') {
      timer = window.setTimeout(() => {
        let started = 0
        const tick = (now: number) => {
          if (!started) started = now
          const shown = Math.min(
            prompt.length,
            Math.floor(((now - started) / 1000) * TYPE_PER_SECOND),
          )
          setTyped(shown)
          if (shown < prompt.length) frame = requestAnimationFrame(tick)
          else timer = window.setTimeout(() => setBeat('calling'), 400)
        }
        frame = requestAnimationFrame(tick)
      }, 600)
    } else if (beat === 'calling') {
      timer = window.setTimeout(() => setBeat('answered'), 1500)
    } else {
      timer = window.setTimeout(
        () => {
          setTurn((t) => (t + 1) % TURNS.length)
          setTyped(0)
          setBeat('typing')
        },
        turn === TURNS.length - 1 ? 3600 : 1400,
      )
    }
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [inView, turn, beat])

  return { ref, turn, beat, typed }
}

/** Fig. 06: connecting the MCP server, then a Claude Code session asking about Acme and acting on it. */
export const AgentsFigure = () => {
  const { ref, turn, beat, typed } = useSession()
  // Earlier turns in this loop stay on screen, finished.
  const done = TURNS.slice(0, turn)
  const current = TURNS[turn]

  return (
    <Window flow={3} narrow innerRef={ref} aside="Polar MCP server">
      <Grid templateColumns={{ base: '1fr', lg: '2fr 3fr' }} gap="xs">
        <Sheet
          title="Connect"
          aside={
            <Text variant="caption" color="muted">
              OAuth
            </Text>
          }
        >
          <pre className="m-0 font-mono text-[13px] leading-6 whitespace-pre-wrap text-white">
            claude mcp add --transport http polar
            https://mcp.polar.sh/mcp/polar-mcp
          </pre>
          <Box flexDirection="column" rowGap="s">
            {['Claude Code', 'Cursor', 'ChatGPT', 'Claude Desktop'].map(
              (client) => (
                <Box
                  key={client}
                  alignItems="center"
                  columnGap="s"
                  color="text-secondary"
                >
                  <Check size={12} />
                  <Text variant="default" color="muted">
                    {client}
                  </Text>
                </Box>
              ),
            )}
          </Box>
          <Box
            marginTop="auto"
            paddingTop="l"
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <Text variant="caption" color="muted">
              Your browser opens to sign in and authorize. No API key to copy
              into the agent.
            </Text>
          </Box>
        </Sheet>
        <div className="dark:bg-polar-900 flex min-h-[26rem] w-full flex-col rounded-xl bg-white p-6 font-mono text-[13px] leading-6">
          <div className="text-polar-500 mb-4 flex items-center justify-between">
            <span>~/acme · claude</span>
            <span>polar connected</span>
          </div>
          {done.map((t) => (
            <div key={t.prompt} className="mb-5 flex flex-col gap-1">
              <div className="text-white">
                <span className="text-polar-500">{'> '}</span>
                {t.prompt}
              </div>
              <div className="text-polar-500 flex items-center gap-2">
                <Check size={12} className="shrink-0" />
                polar · {t.tool}
              </div>
              <div className="text-polar-300 whitespace-pre-wrap">
                {t.answer}
              </div>
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <div className="text-white">
              <span className="text-polar-500">{'> '}</span>
              {current.prompt.slice(0, typed)}
              {beat === 'typing' ? (
                <span className="ml-px inline-block h-[1em] w-[0.55em] translate-y-[0.15em] animate-pulse bg-white/80" />
              ) : null}
            </div>
            {beat !== 'typing' ? (
              <div className="text-polar-500 flex [animation:appear_300ms_ease-out_both] items-center gap-2">
                {beat === 'calling' ? (
                  <LoaderCircle size={12} className="shrink-0 animate-spin" />
                ) : (
                  <Check size={12} className="shrink-0" />
                )}
                <Shimmer
                  active={beat === 'calling'}
                >{`polar · ${current.tool}`}</Shimmer>
              </div>
            ) : null}
            {beat === 'answered' ? (
              <div className="text-polar-300 [animation:appear_360ms_ease-out_both] whitespace-pre-wrap">
                {current.answer}
              </div>
            ) : null}
          </div>
        </div>
      </Grid>
    </Window>
  )
}
