'use client'

import LogoIcon from '@/components/Brand/logos/LogoIcon'
import LogoType from '@/components/Brand/logos/LogoType'
import { StaticImage } from '@/components/Image/StaticImage'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  ArrowUp,
  Check,
  ChevronDown,
  LoaderCircle,
  PanelRight,
  Plus,
  SquarePen,
  Terminal,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { Shimmer } from '../Shimmer'
import { UsageBillingCharge } from './UsageBillingCharge'
import {
  chargeFor,
  count,
  CREDITS_GRANTED,
  creditsFor,
  dollars,
  TERMINAL_STEPS,
  useUsageConversation,
  VISIBLE_EVENTS,
  type UsageEvent,
} from './useUsageConversation'

const EventRow = ({
  event,
  pending = false,
  age = 0,
}: {
  event: UsageEvent
  pending?: boolean
  age?: number
}) => (
  <Box
    alignItems="center"
    justifyContent="between"
    columnGap="l"
    opacity={pending ? 1 : Math.max(0.2, 1 - age * 0.12)}
    transitionProperty="opacity"
    transitionDuration="slow"
  >
    <Box alignItems="center" columnGap="s" color="text-secondary">
      {pending ? (
        <LoaderCircle size={12} className="animate-spin" />
      ) : (
        <Check size={12} />
      )}
      <Text variant="caption" monospace color={pending ? 'default' : 'muted'}>
        <Shimmer active={pending}>{event.name}</Shimmer>
      </Text>
    </Box>
    <Box alignItems="baseline" columnGap="l">
      <Text variant="caption" color="muted" tabularNums>
        {count(event.quantity)}
      </Text>
      <Box minWidth={64} justifyContent="end">
        <Text
          variant="caption"
          tabularNums
          color={pending ? 'muted' : 'default'}
        >
          {pending ? (
            <Shimmer active>Metering</Shimmer>
          ) : event.name === 'tool.call' ? (
            `${count(creditsFor(event))} credits`
          ) : (
            dollars(chargeFor(event), 4)
          )}
        </Text>
      </Box>
    </Box>
  </Box>
)

/** What Polar sets up while Claude builds the app, in the order the terminal does it. */
const SETUP_STEPS = [
  'Organization created',
  'Pro plan at $49 per month',
  'Meters for tokens and tool calls',
  'Customer signed in',
  'Subscribed to Pro',
]

/** A skeleton bar, for what Polar does not have yet. */
const Bone = ({ w, h = 10 }: { w: number; h?: number }) => (
  <Box
    width={w}
    height={h}
    backgroundColor="background-card"
    borderRadius="s"
  />
)

/** The chrome of the site's modals: a dark frame with a hairline and a 4px inset. The header sits on the frame. */
const Panel = ({
  children,
  elevated = false,
}: {
  children: ReactNode
  elevated?: boolean
}) => (
  <div
    className={twMerge(
      'dark:bg-polar-950 dark:border-polar-800 flex h-full w-full flex-col rounded-3xl border border-gray-200 bg-gray-100 p-1 shadow-sm',
      elevated && 'shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)]',
    )}
  >
    {children}
  </div>
)

/** The lighter panel inside the frame, holding the content. */
const Inner = ({ children }: { children: ReactNode }) => (
  <div className="dark:bg-polar-900 flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[20px] bg-white">
    {children}
  </div>
)

export const UsageBillingMock = () => {
  const {
    ref,
    scenario,
    phase,
    stage,
    setupLevel,
    commandSent,
    signedIn,
    upgraded,
    typedEmail,
    terminalCommand,
    terminalDone,
    terminalSteps,
    firstPrompt,
    composerText,
    typed,
    streamed,
    settled,
    totalTokens,
    creditsLeft,
    inputCharge,
    outputCharge,
    billed,
  } = useUsageConversation()
  const sent = phase !== 'typing'

  return (
    <div
      ref={ref}
      className="dark:border-polar-800 relative w-full overflow-hidden rounded-md border border-gray-200 bg-[url(/assets/landing/company/Polar_Flow_03_No_Logo.jpg)] bg-cover bg-center p-4 md:p-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-black/40" />
      <Box
        position="relative"
        width="100%"
        flexDirection={{ base: 'column', md: 'row' }}
        alignItems="stretch"
        gap="2xl"
        height={{ md: '33rem' }}
        transform="scale(.9)"
      >
        <Box flex={1} minWidth={0}>
          <Panel>
            {/* The app opens as a terminal: Claude builds it and wires up Polar, then it fades into the chat. */}
            <div className="grid h-full *:[grid-area:1/1]">
              <div
                className={
                  stage !== 'terminal'
                    ? 'pointer-events-none flex h-full min-h-0 [animation:fade_400ms_ease-out_both] flex-col'
                    : 'flex h-full min-h-0 flex-col'
                }
                aria-hidden={stage !== 'terminal'}
              >
                <Box
                  alignItems="center"
                  columnGap="s"
                  paddingHorizontal="xl"
                  paddingVertical="m"
                  color="text-secondary"
                >
                  <Terminal size={14} />
                  <Text variant="caption" monospace color="muted">
                    ~/your-app
                  </Text>
                </Box>
                <Inner>
                  <Box flexDirection="column" rowGap="m" padding="xl">
                    <Text variant="caption" monospace color="muted">
                      $ claude
                    </Text>
                    <Text variant="caption" monospace>
                      {'> '}
                      {terminalCommand}
                      {terminalDone ? null : (
                        <span className="ml-px inline-block h-[1em] w-px translate-y-[0.15em] animate-pulse bg-current" />
                      )}
                    </Text>
                    {terminalSteps.map((step) => (
                      <div
                        key={step}
                        className="[animation:rise_400ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
                      >
                        <Box
                          alignItems="start"
                          columnGap="s"
                          color="text-secondary"
                        >
                          <Box flexShrink={0} paddingTop="xs">
                            <Check size={12} />
                          </Box>
                          <Text variant="caption" monospace color="muted">
                            {step}
                          </Text>
                        </Box>
                      </div>
                    ))}
                    {terminalDone &&
                    terminalSteps.length < TERMINAL_STEPS.length ? (
                      <Box
                        alignItems="center"
                        columnGap="s"
                        color="text-secondary"
                      >
                        <LoaderCircle size={12} className="animate-spin" />
                        <Text variant="caption" monospace color="muted">
                          <Shimmer active>Working</Shimmer>
                        </Text>
                      </Box>
                    ) : null}
                  </Box>
                </Inner>
              </div>
              {stage === 'signin' ? (
                <div className="flex h-full min-h-0 [animation:rise_500ms_cubic-bezier(0.2,0.8,0.2,1)_200ms_both] flex-col">
                  <Box
                    alignItems="center"
                    columnGap="s"
                    paddingHorizontal="xl"
                    paddingVertical="m"
                  >
                    <StaticImage
                      src="/assets/acme.jpg"
                      alt="Your App"
                      width={20}
                      height={20}
                      className="size-5 rounded-md object-cover"
                    />
                    <Text variant="body" color="muted">
                      Your App
                    </Text>
                  </Box>
                  <Inner>
                    <Box
                      flex={1}
                      flexDirection="column"
                      alignItems="center"
                      justifyContent="center"
                      rowGap="xl"
                      padding="xl"
                    >
                      <Box
                        flexDirection="column"
                        alignItems="center"
                        rowGap="xs"
                      >
                        <Text variant="heading-xxs">Sign in</Text>
                        <Text variant="caption" color="muted">
                          Continue to Your App
                        </Text>
                      </Box>
                      <Box
                        width="100%"
                        maxWidth={280}
                        flexDirection="column"
                        rowGap="s"
                      >
                        <Box
                          alignItems="center"
                          paddingHorizontal="m"
                          height={36}
                          borderWidth={1}
                          borderStyle="solid"
                          borderColor="border-primary"
                          borderRadius="m"
                        >
                          {typedEmail ? (
                            <Text variant="default">
                              {typedEmail}
                              {signedIn ? null : (
                                <span className="ml-px inline-block h-[1em] w-px translate-y-[0.15em] animate-pulse bg-current" />
                              )}
                            </Text>
                          ) : (
                            <Text variant="default" color="muted">
                              Email
                            </Text>
                          )}
                        </Box>
                        <Box
                          alignItems="center"
                          justifyContent="center"
                          height={36}
                          backgroundColor={
                            signedIn ? 'background-card' : 'background-inverse'
                          }
                          borderRadius="m"
                          transitionProperty="colors"
                          transitionDuration="fast"
                        >
                          {signedIn ? (
                            <Box
                              alignItems="center"
                              columnGap="s"
                              color="text-secondary"
                            >
                              <LoaderCircle
                                size={12}
                                className="animate-spin"
                              />
                              <Text variant="default" color="muted">
                                <Shimmer active>Signing in</Shimmer>
                              </Text>
                            </Box>
                          ) : (
                            <span className="text-black">
                              <Text variant="default" color="inherit">
                                Continue
                              </Text>
                            </span>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </Inner>
                </div>
              ) : null}
              {stage === 'upgrade' ? (
                <div className="flex h-full min-h-0 [animation:rise_500ms_cubic-bezier(0.2,0.8,0.2,1)_200ms_both] flex-col">
                  <Box
                    alignItems="center"
                    columnGap="s"
                    paddingHorizontal="xl"
                    paddingVertical="m"
                  >
                    <StaticImage
                      src="/assets/acme.jpg"
                      alt="Your App"
                      width={20}
                      height={20}
                      className="size-5 rounded-md object-cover"
                    />
                    <Text variant="body" color="muted">
                      Your App
                    </Text>
                  </Box>
                  <Inner>
                    <Box
                      flex={1}
                      flexDirection="column"
                      alignItems="center"
                      justifyContent="center"
                      rowGap="xl"
                      padding="xl"
                    >
                      <Box
                        flexDirection="column"
                        alignItems="center"
                        rowGap="xs"
                      >
                        <Text variant="heading-xxs">Upgrade to Pro</Text>
                        <Text variant="caption" color="muted">
                          Unlimited chats, tools and usage billing
                        </Text>
                      </Box>
                      <Box
                        width="100%"
                        maxWidth={280}
                        flexDirection="column"
                        rowGap="m"
                        padding="l"
                        borderWidth={1}
                        borderStyle="solid"
                        borderColor="border-primary"
                        borderRadius="l"
                      >
                        <Box justifyContent="between" alignItems="baseline">
                          <Text variant="body">Pro</Text>
                          <Text variant="body" tabularNums>
                            $49
                            <Text as="span" variant="caption" color="muted">
                              {' '}
                              / month
                            </Text>
                          </Text>
                        </Box>
                        <Box flexDirection="column" rowGap="xs">
                          {[
                            'Tokens billed as you go',
                            '5,000 tool credits',
                          ].map((line) => (
                            <Box
                              key={line}
                              alignItems="center"
                              columnGap="s"
                              color="text-secondary"
                            >
                              <Check size={12} />
                              <Text variant="caption" color="muted">
                                {line}
                              </Text>
                            </Box>
                          ))}
                        </Box>
                        <Box
                          alignItems="center"
                          justifyContent="center"
                          height={36}
                          backgroundColor={
                            upgraded ? 'background-card' : 'background-inverse'
                          }
                          borderRadius="m"
                          transitionProperty="colors"
                          transitionDuration="fast"
                        >
                          {upgraded ? (
                            <Box
                              alignItems="center"
                              columnGap="s"
                              color="text-secondary"
                            >
                              <LoaderCircle
                                size={12}
                                className="animate-spin"
                              />
                              <Text variant="default" color="muted">
                                <Shimmer active>Subscribing</Shimmer>
                              </Text>
                            </Box>
                          ) : (
                            <span className="text-black">
                              <Text variant="default" color="inherit">
                                Upgrade
                              </Text>
                            </span>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </Inner>
                </div>
              ) : null}
              {stage === 'app' ? (
                <div className="flex h-full min-h-0 [animation:rise_500ms_cubic-bezier(0.2,0.8,0.2,1)_200ms_both] flex-col">
                  <Box
                    alignItems="center"
                    columnGap="s"
                    paddingHorizontal="xl"
                    paddingVertical="m"
                  >
                    <StaticImage
                      src="/assets/acme.jpg"
                      alt="Your App"
                      width={20}
                      height={20}
                      className="size-5 rounded-md object-cover"
                    />
                    <Text variant="body" color="muted">
                      Your App
                    </Text>
                    <Box
                      marginLeft="auto"
                      alignItems="center"
                      columnGap="m"
                      color="text-tertiary"
                    >
                      <SquarePen size={14} />
                      <PanelRight size={14} />
                    </Box>
                  </Box>
                  <Inner>
                    <Box
                      flexDirection="column"
                      rowGap="l"
                      paddingHorizontal="xl"
                      paddingVertical="xl"
                      minHeight={{ base: '13rem', md: 'auto' }}
                    >
                      {sent ? (
                        <>
                          <div className="[animation:rise_500ms_cubic-bezier(0.2,0.8,0.2,1)_both]">
                            <Box
                              alignSelf="start"
                              paddingHorizontal="l"
                              paddingVertical="m"
                              backgroundColor="background-card"
                              borderRadius="l"
                            >
                              <Text variant="body">{scenario.prompt}</Text>
                            </Box>
                          </div>
                          {/* The status and the answer share one cell, so the status fades out under the answer rising in. */}
                          <div className="grid *:[grid-area:1/1]">
                            <div
                              className={
                                phase === 'working'
                                  ? '[animation:rise_500ms_cubic-bezier(0.2,0.8,0.2,1)_200ms_both]'
                                  : 'pointer-events-none [animation:fade_300ms_ease-out_both]'
                              }
                              aria-hidden={phase !== 'working'}
                            >
                              <Box
                                alignItems="center"
                                columnGap="s"
                                color="text-secondary"
                              >
                                <LoaderCircle
                                  size={14}
                                  className="animate-spin"
                                />
                                <Text variant="body" color="muted">
                                  <Shimmer active={phase === 'working'}>
                                    {scenario.working}
                                  </Shimmer>
                                </Text>
                              </Box>
                            </div>
                            {phase === 'working' ? null : (
                              <div className="[animation:rise_500ms_cubic-bezier(0.2,0.8,0.2,1)_150ms_both]">
                                <Text variant="body" color="muted">
                                  {scenario.answer.slice(0, typed)}
                                  <Box as="span" visibility="hidden">
                                    {scenario.answer.slice(typed)}
                                  </Box>
                                </Text>
                              </div>
                            )}
                          </div>
                        </>
                      ) : null}
                    </Box>
                    <Box
                      paddingHorizontal="xl"
                      paddingBottom="xl"
                      marginTop="auto"
                    >
                      <Box
                        width="100%"
                        flexDirection="column"
                        rowGap="l"
                        padding="l"
                        borderRadius="l"
                        backgroundColor="background-card"
                      >
                        {composerText ? (
                          <Text variant="body">
                            {composerText}
                            <span className="ml-px inline-block h-[1em] w-px translate-y-[0.15em] animate-pulse bg-current" />
                          </Text>
                        ) : (
                          <Text variant="body" color="muted">
                            {firstPrompt ? 'Ask anything…' : 'Ask a follow-up'}
                          </Text>
                        )}
                        <Box
                          alignItems="center"
                          justifyContent="between"
                          columnGap="l"
                        >
                          <Box
                            alignItems="center"
                            columnGap="s"
                            color="text-secondary"
                          >
                            <Box
                              width={24}
                              height={24}
                              alignItems="center"
                              justifyContent="center"
                              borderWidth={1}
                              borderStyle="solid"
                              borderColor="border-primary"
                              borderRadius="full"
                            >
                              <Plus size={12} />
                            </Box>
                            <Box
                              alignItems="center"
                              columnGap="xs"
                              paddingHorizontal="s"
                              height={24}
                              borderWidth={1}
                              borderStyle="solid"
                              borderColor="border-primary"
                              borderRadius="full"
                            >
                              <Text variant="caption" color="muted">
                                gpt-5
                              </Text>
                              <ChevronDown size={10} />
                            </Box>
                          </Box>
                          <Box
                            width={24}
                            height={24}
                            alignItems="center"
                            justifyContent="center"
                            backgroundColor={
                              composerText
                                ? 'background-inverse'
                                : 'background-card'
                            }
                            borderRadius="full"
                            transitionProperty="colors"
                            transitionDuration="fast"
                          >
                            <span
                              className={
                                composerText ? 'text-black' : undefined
                              }
                            >
                              <ArrowUp size={12} />
                            </span>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </Inner>
                </div>
              ) : null}
            </div>
          </Panel>
        </Box>

        <div className="w-full min-w-0 md:flex-1">
          <Panel elevated>
            {/* Polar starts as a closed box with the mark, and opens into the dashboard once setup begins. */}
            <div className="grid h-full *:[grid-area:1/1]">
              <div
                className={
                  stage === 'app'
                    ? 'pointer-events-none flex h-full [animation:fade_400ms_ease-out_both] flex-col'
                    : 'flex h-full flex-col'
                }
                aria-hidden={stage === 'app'}
              >
                {commandSent ? (
                  <>
                    <Box
                      alignItems="center"
                      justifyContent="between"
                      paddingHorizontal="xl"
                      paddingVertical="m"
                    >
                      <Box alignItems="center" columnGap="xs">
                        <LogoType height={14} />
                      </Box>
                      <Text variant="caption" color="muted">
                        Setup
                      </Text>
                    </Box>
                    <Inner>
                      <Box flexDirection="column" rowGap="l" padding="xl">
                        {SETUP_STEPS.map((step, index) => {
                          const done = setupLevel > index
                          const active =
                            setupLevel === index &&
                            (stage === 'terminal' ? commandSent : true)
                          return (
                            <Box
                              key={step}
                              alignItems="center"
                              columnGap="m"
                              color={done ? 'text-primary' : 'text-secondary'}
                            >
                              {done ? (
                                <Check size={14} />
                              ) : active ? (
                                <LoaderCircle
                                  size={14}
                                  className="animate-spin"
                                />
                              ) : (
                                <Box
                                  width={14}
                                  height={14}
                                  borderWidth={1}
                                  borderStyle="solid"
                                  borderColor="border-primary"
                                  borderRadius="full"
                                />
                              )}
                              <Text
                                variant="default"
                                color={done ? 'default' : 'muted'}
                              >
                                {active ? (
                                  <Shimmer active>{step}</Shimmer>
                                ) : (
                                  step
                                )}
                              </Text>
                            </Box>
                          )
                        })}
                      </Box>
                    </Inner>
                  </>
                ) : (
                  <Inner>
                    <Box
                      flex={1}
                      alignItems="center"
                      justifyContent="center"
                      color="text-primary"
                    >
                      <LogoIcon size={48} />
                    </Box>
                  </Inner>
                )}
              </div>
              {stage === 'app' ? (
                <div className="flex h-full min-h-0 [animation:rise_500ms_cubic-bezier(0.2,0.8,0.2,1)_150ms_both] flex-col">
                  <Box
                    alignItems="center"
                    justifyContent="between"
                    paddingHorizontal="xl"
                    paddingVertical="m"
                  >
                    <Box alignItems="center" columnGap="xs">
                      <LogoType height={14} />
                    </Box>
                    <Text variant="caption" color="muted">
                      Current cycle
                    </Text>
                  </Box>
                  <Inner>
                    <Box
                      alignItems="center"
                      justifyContent="between"
                      columnGap="l"
                      marginHorizontal="xl"
                      paddingVertical="l"
                    >
                      {setupLevel >= 3 ? (
                        <div className="[animation:rise_500ms_cubic-bezier(0.2,0.8,0.2,1)_both]">
                          <Box alignItems="center" columnGap="m">
                            <StaticImage
                              src="/assets/acme.jpg"
                              alt="Acme Inc"
                              width={32}
                              height={32}
                              className="size-8 rounded-full object-cover"
                            />
                            <Box flexDirection="column">
                              <Text variant="body">Acme Inc</Text>
                              <Text variant="caption" color="muted">
                                billing@acme.com
                              </Text>
                            </Box>
                          </Box>
                        </div>
                      ) : (
                        <Box alignItems="center" columnGap="m">
                          <Box
                            width={32}
                            height={32}
                            backgroundColor="background-card"
                            borderRadius="full"
                          />
                          <Box flexDirection="column" rowGap="s">
                            <Bone w={72} />
                            <Bone w={112} h={8} />
                          </Box>
                        </Box>
                      )}
                    </Box>
                    <Grid
                      templateColumns="repeat(2, 1fr)"
                      marginHorizontal="xl"
                      paddingVertical="s"
                    >
                      <Box flexDirection="column" rowGap="xs">
                        {setupLevel >= 2 ? (
                          <div className="[animation:rise_500ms_cubic-bezier(0.2,0.8,0.2,1)_both]">
                            <Box flexDirection="column" rowGap="xs">
                              <Text variant="caption" color="muted">
                                Tokens metered
                              </Text>
                              <Text variant="heading-xs" tabularNums>
                                {count(totalTokens)}
                              </Text>
                            </Box>
                          </div>
                        ) : (
                          <Box
                            flexDirection="column"
                            rowGap="m"
                            paddingVertical="xs"
                          >
                            <Bone w={88} h={8} />
                            <Bone w={56} h={16} />
                          </Box>
                        )}
                      </Box>
                      <Box
                        flexDirection="column"
                        rowGap="xs"
                        paddingLeft="xl"
                        borderLeftWidth={1}
                        borderStyle="solid"
                        borderColor="border-primary"
                      >
                        {setupLevel >= 2 ? (
                          <div className="[animation:rise_500ms_cubic-bezier(0.2,0.8,0.2,1)_both]">
                            <Box flexDirection="column" rowGap="xs">
                              <Text variant="caption" color="muted">
                                Credits left
                              </Text>
                              <Text variant="heading-xs" tabularNums>
                                {count(creditsLeft)}
                                <Text
                                  as="span"
                                  variant="heading-xs"
                                  color="muted"
                                >
                                  {' '}
                                  / {count(CREDITS_GRANTED)}
                                </Text>
                              </Text>
                            </Box>
                          </div>
                        ) : (
                          <Box
                            flexDirection="column"
                            rowGap="m"
                            paddingVertical="xs"
                          >
                            <Bone w={64} h={8} />
                            <Bone w={96} h={16} />
                          </Box>
                        )}
                      </Box>
                    </Grid>
                    <Box flexDirection="column" rowGap="s" padding="xl">
                      {sent ? (
                        <EventRow
                          event={
                            phase === 'working'
                              ? { name: 'tool.call', quantity: scenario.tools }
                              : { name: 'tokens.out', quantity: streamed }
                          }
                          pending={phase !== 'metered'}
                        />
                      ) : null}
                      {settled
                        .slice(0, VISIBLE_EVENTS - (sent ? 1 : 0))
                        .map((event, position) => (
                          <EventRow
                            key={`${position}-${event.name}-${event.quantity}`}
                            event={event}
                            age={position + (sent ? 1 : 0)}
                          />
                        ))}
                      {Array.from(
                        {
                          length: Math.max(
                            0,
                            VISIBLE_EVENTS - (sent ? 1 : 0) - settled.length,
                          ),
                        },
                        (_, slot) => (
                          <Box
                            key={`empty-${slot}`}
                            alignItems="center"
                            justifyContent="between"
                            columnGap="l"
                            height={18}
                          >
                            <Box
                              width={96}
                              height={10}
                              backgroundColor="background-card"
                              borderRadius="s"
                            />
                            <Box alignItems="center" columnGap="l">
                              <Box
                                width={40}
                                height={10}
                                backgroundColor="background-card"
                                borderRadius="s"
                              />
                              <Box
                                width={56}
                                height={10}
                                backgroundColor="background-card"
                                borderRadius="s"
                              />
                            </Box>
                          </Box>
                        ),
                      )}
                    </Box>
                  </Inner>
                  <Box paddingTop="xs">
                    <UsageBillingCharge
                      setupLevel={setupLevel}
                      inputCharge={inputCharge}
                      outputCharge={outputCharge}
                      billed={billed}
                    />
                  </Box>
                </div>
              ) : null}
            </div>
          </Panel>
        </div>
      </Box>
    </div>
  )
}
