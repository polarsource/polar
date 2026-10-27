'use client'

import LogoLoader from '@/components/Brand/logos/LogoLoader'
import { StaticImage } from '@/components/Image/StaticImage'
import { useInView } from '@/hooks/useInView'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, LoaderCircle, Lock } from '@polar-sh/orbit/icons'
import { useEffect, useState, type ReactNode } from 'react'
import { Shimmer } from '../Shimmer'
import { Sheet, Window } from './Frame'

/** Business's benefits, each a type Polar ships. The two flags gate features in Acme's product. */
const BENEFITS = [
  { name: 'Advanced models', type: 'Feature flag' },
  { name: 'Priority queue', type: 'Feature flag' },
  { name: '40,000 credits', type: 'Meter credits' },
  { name: 'Shared Slack channel', type: 'Slack channel' },
]

/**
 * The checkout's beats: step 0 is the open checkout, step 1 the payment, and step k from 2 on has k - 1
 * benefits granted. The last step holds before the loop restarts.
 */
const LAST = BENEFITS.length + 1
const useCheckout = () => {
  const { ref, inView } = useInView()
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (!inView) return
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const delay = reduced
      ? 0
      : step === 0
        ? 1800
        : step === 1
          ? 1200
          : step === LAST
            ? 4200
            : 600
    const timer = window.setTimeout(
      () => setStep((s) => (reduced ? LAST : s === LAST ? 0 : s + 1)),
      delay,
    )
    return () => clearTimeout(timer)
  }, [inView, step])
  return { ref, step, granted: Math.max(0, step - 1) }
}

/** A filled form field: label on the left, value on the right. */
const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <Box
    alignItems="center"
    justifyContent="between"
    columnGap="l"
    paddingHorizontal="m"
    height={40}
    borderRadius="m"
    backgroundColor="background-card"
  >
    <Text variant="caption" color="muted">
      {label}
    </Text>
    {children}
  </Box>
)

const Mark = ({ state }: { state: 'idle' | 'granting' | 'granted' }) => (
  <Box
    width={12}
    height={12}
    alignItems="center"
    justifyContent="center"
    flexShrink={0}
    color="text-secondary"
  >
    {state === 'granted' ? (
      <Check size={12} />
    ) : state === 'granting' ? (
      <LoaderCircle size={12} className="animate-spin" />
    ) : (
      <div className="bg-polar-700 size-1 rounded-full" />
    )}
  </Box>
)

/** The checkout's button: subscribe, then processing, then done. */
const PayButton = ({ step }: { step: number }) => (
  <div
    className={`flex h-10 w-full items-center justify-center gap-2 rounded-full transition-colors duration-300 ${step === 0 ? 'bg-white text-black' : 'dark:bg-polar-800 bg-gray-100'}`}
  >
    {step === 1 ? <LoaderCircle size={12} className="animate-spin" /> : null}
    {step > 1 ? <Check size={12} /> : null}
    <Text variant="caption" color="inherit">
      {step === 0 ? 'Subscribe' : step === 1 ? 'Processing' : 'Subscribed'}
    </Text>
  </div>
)

/** Room for every webhook in the loop, reserved up front so the card never grows as they arrive. */
const WEBHOOKS_HEIGHT = 300

/** Webhooks Polar sends to Acme's backend as the checkout completes and each benefit is granted. */
const Webhooks = ({ step, granted }: { step: number; granted: number }) => {
  const rows = [
    ...(step >= 2
      ? [{ event: 'subscription.created', detail: 'Business' }]
      : []),
    ...BENEFITS.slice(0, granted).map((b) => ({
      event: 'benefit_grant.created',
      detail: b.name,
    })),
    ...(step === LAST
      ? [{ event: 'customer.state_changed', detail: 'Acme Inc' }]
      : []),
  ]
  if (rows.length === 0) {
    return (
      <Box
        flex={1}
        minHeight={WEBHOOKS_HEIGHT}
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        rowGap="m"
      >
        <LogoLoader size={22} className="text-polar-500" />
        <Text variant="caption" color="muted">
          Listening for events
        </Text>
      </Box>
    )
  }
  return (
    <Box flexDirection="column" rowGap="m" minHeight={WEBHOOKS_HEIGHT}>
      {rows.map((row) => (
        <div
          key={row.event + row.detail}
          className="[animation:appear_360ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
        >
          <Box flexDirection="column">
            <Text variant="caption" monospace>
              {row.event}
            </Text>
            <Text variant="caption" color="muted">
              {row.detail}
            </Text>
          </Box>
        </div>
      ))}
    </Box>
  )
}

/** A label and its value, the value swapping in once it applies. */
const Line = ({ label, children }: { label: string; children: ReactNode }) => (
  <Box justifyContent="between" alignItems="center" columnGap="l">
    <Text variant="default" color="muted">
      {label}
    </Text>
    {children}
  </Box>
)

/** Fig. 02: Acme checks out on Business, Polar grants its benefits one by one, and Acme's customer record goes from no access to all of it. */
export const GrantFigure = () => {
  const { ref, step, granted } = useCheckout()
  const on = (name: string) =>
    BENEFITS.slice(0, granted).some((b) => b.name === name)

  return (
    <Window flow={3} innerRef={ref} aside="Acme Inc">
      <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr 1fr' }} gap="xs">
        <Sheet title="Checkout">
          <Box justifyContent="between" alignItems="baseline" columnGap="l">
            <Text variant="heading-xxs">Business</Text>
            <Text variant="heading-xxs" tabularNums>
              $2,499
              <Text as="span" variant="body" color="muted">
                {' '}
                / month
              </Text>
            </Text>
          </Box>
          <Box flexDirection="column" rowGap="xs">
            <Field label="Email">
              <Box alignItems="center" columnGap="s">
                <StaticImage
                  src="/assets/acme.jpg"
                  alt="Acme Inc"
                  width={16}
                  height={16}
                  className="size-4 rounded-full object-cover"
                />
                <Text variant="caption">joe@acme.com</Text>
              </Box>
            </Field>
            <Field label="Card">
              <Text variant="caption" tabularNums>
                Visa •••• 4242
              </Text>
            </Field>
          </Box>
          <Box flexDirection="column" rowGap="s">
            {BENEFITS.map((b, i) => {
              const state =
                i < granted
                  ? 'granted'
                  : step >= 2 && i === granted
                    ? 'granting'
                    : 'idle'
              return (
                <Box
                  key={b.name}
                  justifyContent="between"
                  alignItems="center"
                  columnGap="l"
                >
                  <Box alignItems="center" columnGap="s">
                    <Mark state={state} />
                    <Text
                      variant="default"
                      color={state === 'granted' ? 'default' : 'muted'}
                    >
                      {state === 'granting' ? (
                        <Shimmer active>{b.name}</Shimmer>
                      ) : (
                        b.name
                      )}
                    </Text>
                  </Box>
                </Box>
              )
            })}
          </Box>
          <Box marginTop="auto">
            <PayButton step={step} />
          </Box>
        </Sheet>
        <Sheet title="Webhooks">
          <Webhooks step={step} granted={granted} />
        </Sheet>
        <Sheet title="Customer">
          <Box alignItems="center" columnGap="m">
            <StaticImage
              src="/assets/acme.jpg"
              alt="Acme Inc"
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-full object-cover"
            />
            <Box flexDirection="column">
              <Text variant="default">Acme Inc</Text>
              <Text variant="caption" color="muted">
                joe@acme.com
              </Text>
            </Box>
          </Box>
          <Box
            flexDirection="column"
            rowGap="s"
            paddingTop="l"
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <Line label="Subscription">
              {step >= 2 ? (
                <Box alignItems="center" columnGap="s">
                  <div className="size-1.5 rounded-full bg-emerald-500" />
                  <Text variant="default">Business</Text>
                </Box>
              ) : (
                <Text variant="default" color="muted">
                  None
                </Text>
              )}
            </Line>
            <Line label="Credits">
              <Text
                variant="default"
                color={on('40,000 credits') ? 'default' : 'muted'}
                tabularNums
              >
                {on('40,000 credits') ? '40,000' : '0'}
              </Text>
            </Line>
          </Box>
          <Box flexDirection="column" rowGap="s">
            <Text variant="caption" color="muted">
              Access
            </Text>
            {BENEFITS.map((b) => (
              <Box
                key={b.name}
                alignItems="center"
                columnGap="s"
                color="text-secondary"
              >
                <Box width={12} flexShrink={0} justifyContent="center">
                  {on(b.name) ? <Check size={12} /> : <Lock size={11} />}
                </Box>
                <Text
                  variant="default"
                  color={on(b.name) ? 'default' : 'muted'}
                >
                  {b.name}
                </Text>
              </Box>
            ))}
          </Box>
        </Sheet>
      </Grid>
    </Window>
  )
}
