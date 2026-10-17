'use client'

import { useInView } from '@/hooks/useInView'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Sheet, Window } from '../story/Frame'

type Primitive = 'subscription' | 'credits' | 'usage'
type Mix = Record<Primitive, boolean>

const PRIMITIVES: {
  key: Primitive
  title: string
  desc: string
  href: string
}[] = [
  {
    key: 'subscription',
    title: 'Subscription',
    desc: 'A recurring base fee, with trials and proration',
    href: '/features/subscriptions',
  },
  {
    key: 'credits',
    title: 'Credits',
    desc: 'A prepaid balance that usage draws down first',
    href: '/features/credits',
  },
  {
    key: 'usage',
    title: 'Usage',
    desc: 'Metered events, priced per token, call or second',
    href: '/features/usage-billing',
  },
]

/** The mixes the figure plays through on its own, one every few seconds, until someone takes over. */
const SEQUENCE: Mix[] = [
  { subscription: true, credits: false, usage: false },
  { subscription: true, credits: false, usage: true },
  { subscription: true, credits: true, usage: true },
  { subscription: false, credits: true, usage: true },
  { subscription: false, credits: false, usage: true },
]
const STEP_MS = 3200

const modelName = ({ subscription, credits, usage }: Mix) => {
  if (subscription && credits && usage) return 'Commit and draw down'
  if (subscription && usage) return 'Base plus usage'
  if (subscription && credits) return 'Plan with credits'
  if (credits && usage) return 'Prepaid usage'
  if (subscription) return 'Flat subscription'
  if (credits) return 'Credit packs'
  return 'Pay as you go'
}

const money = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** The invoice the mix produces for one month of Acme's usage. */
const invoiceLines = ({ subscription, credits, usage }: Mix) => {
  const lines: { label: string; amount: number | null }[] = []
  if (subscription) lines.push({ label: 'Business plan', amount: 2_499 })
  if (credits)
    lines.push(
      subscription
        ? { label: '40,000 credits', amount: null }
        : { label: 'Credit pack', amount: 1_000 },
    )
  if (usage)
    lines.push(
      credits
        ? { label: 'Usage beyond credits', amount: 1_284.3 }
        : { label: '1.93B output tokens', amount: 3_862.4 },
    )
  return lines
}

const useMix = () => {
  const { ref, inView } = useInView()
  const [step, setStep] = useState(0)
  const [manual, setManual] = useState<Mix | null>(null)

  useEffect(() => {
    if (!inView || manual) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setTimeout(
      () => setStep((s) => (s + 1) % SEQUENCE.length),
      STEP_MS,
    )
    return () => clearTimeout(timer)
  }, [inView, manual, step])

  const mix = manual ?? SEQUENCE[step]
  const toggle = (key: Primitive) => {
    const next = { ...mix, [key]: !mix[key] }
    if (next.subscription || next.credits || next.usage) setManual(next)
  }
  return { ref, mix, toggle }
}

const Switch = ({ on }: { on: boolean }) => (
  <div
    className={`relative h-5 w-8 shrink-0 rounded-full transition-colors duration-300 ${on ? 'bg-white' : 'dark:bg-polar-700 bg-gray-300'}`}
  >
    <div
      className={`absolute top-0.5 h-4 w-4 rounded-full transition-all duration-300 ${on ? 'dark:bg-polar-900 left-3.5 bg-white' : 'left-0.5 bg-white'}`}
    />
  </div>
)

/** Three primitives switched on and off, and the plan and invoice they compose into. */
export const PrimitivesFigure = () => {
  const { ref, mix, toggle } = useMix()
  const lines = invoiceLines(mix)
  const total = lines.reduce((sum, line) => sum + (line.amount ?? 0), 0)

  return (
    <Window flow={1} narrow innerRef={ref} aside="Acme Inc on Business">
      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap="xs">
        <Sheet title="Primitives">
          <Box flexDirection="column" rowGap="xs">
            {PRIMITIVES.map((p) => (
              <Box key={p.key} alignItems="center" columnGap="s">
                <button
                  type="button"
                  aria-pressed={mix[p.key]}
                  onClick={() => toggle(p.key)}
                  className="dark:hover:bg-polar-800 flex flex-1 cursor-pointer items-center gap-4 rounded-lg p-2 text-left transition-colors hover:bg-gray-100"
                >
                  <Switch on={mix[p.key]} />
                  <Box flexDirection="column">
                    <Text variant="default">{p.title}</Text>
                    <Text variant="caption" color="muted">
                      {p.desc}
                    </Text>
                  </Box>
                </button>
                <Link href={p.href} aria-label={`Learn more about ${p.title}`}>
                  <Box
                    padding="s"
                    color={{ base: 'text-tertiary', hover: 'text-primary' }}
                    transitionProperty="colors"
                    transitionDuration="fast"
                  >
                    <ArrowUpRight size={14} />
                  </Box>
                </Link>
              </Box>
            ))}
          </Box>
        </Sheet>
        <Sheet
          title="November invoice"
          aside={
            <Text variant="caption" color="muted">
              {modelName(mix)}
            </Text>
          }
        >
          <Box flexDirection="column" rowGap="s">
            {lines.map((line) => (
              <div
                key={line.label}
                className="[animation:appear_360ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
              >
                <Box justifyContent="between" columnGap="l">
                  <Text variant="default" color="muted">
                    {line.label}
                  </Text>
                  <Text variant="default" color="muted" tabularNums>
                    {line.amount === null ? 'Included' : money(line.amount)}
                  </Text>
                </Box>
              </div>
            ))}
          </Box>
          <Box
            justifyContent="between"
            alignItems="baseline"
            paddingTop="m"
            marginTop="auto"
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <Text variant="default" color="muted">
              Total
            </Text>
            <Text variant="heading-xxs" tabularNums>
              {money(total)}
            </Text>
          </Box>
        </Sheet>
      </Grid>
    </Window>
  )
}
