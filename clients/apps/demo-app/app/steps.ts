// Code shown in the side panel, one step per part of the demo. Lines ending in
// `// !` are emphasized, and the marker is stripped before highlighting.

export type Step = 'config' | 'balance' | 'builtin' | 'custom'

export type StepFile = { name: string; code: string }

export type StepDefinition = {
  id: Step
  label: string
  title: string
  description: string
  files: StepFile[]
}

export const STEPS: StepDefinition[] = [
  {
    id: 'config',
    label: 'Config',
    title: 'Pricing as code',
    description:
      'Events, meters, benefits and products live in one typed config. The runtime SDK reads it, so every name below is type-checked.',
    files: [
      {
        name: 'polar.config.ts',
        code: `export default defineConfig({
  events: {
    tool_call: z.object({
      tool: z.string(),
      server: z.enum(['builtin', 'custom']),
      success: z.boolean(),
      duration_ms: z.int(),
    }),
  },
  meters: ({ meter, events }) => ({
    tool_call: meter('Tool calls').on(events.tool_call).count(),
  }),
  benefits: ({ flag, credits }) => ({
    custom_servers: flag('Custom servers'),
    tool_calls: credits('Included tool calls')
      .meter('tool_call')
      .units(1000),
    free_tool_calls: credits('Free tool calls')
      .meter('tool_call')
      .units(5),
  }),
  products: ({ product, free, fixed, meter }) => ({
    free: product('Free')
      .prices(free())
      .recurring('monthly')
      .grants(['free_tool_calls']),
    pro: product('Pro')
      .prices(
        fixed().amount(usd(99.99), eur(99.99)),
        meter('tool_call')
          .flat()
          .amount(perThousand(usd(1)), perThousand(eur(0.9))),
      )
      .recurring('monthly')
      .grants(['custom_servers', 'tool_calls']),
  }),
})`,
      },
      {
        name: 'polar.ts',
        code: `import { RuntimeSDK } from '@polar-sh/polar'
import config from './polar.config'

export const polar = RuntimeSDK(config, {
  accessToken: process.env.POLAR_ACCESS_TOKEN,
})`,
      },
    ],
  },
  {
    id: 'balance',
    label: 'Balance',
    title: 'Read the credit balance',
    description:
      'An actor scopes every call to one customer. Pristine means every event tracked through this SDK has been metered into the balance.',
    files: [
      {
        name: 'actions.ts',
        code: `export async function getBalance() {
  const userId = await getUserId()

  const customer = polar.actor({ externalCustomerId: userId }) // !

  return customer.balance('tool_call') // !
  // → { balance: number, pristine: boolean }
}`,
      },
    ],
  },
  {
    id: 'builtin',
    label: 'Built-in',
    title: 'Gate on balance, then track usage',
    description:
      'Check the meter balance before doing the work, then track one event per call. Metadata is validated against the event schema.',
    files: [
      {
        name: 'polar.ts',
        code: `const customer = polar.actor({ externalCustomerId: userId }) // !

const { balance } = await customer.balance('tool_call') // !
if (balance < count) { // !
  return { paywall: true }
}

// … run the tool …

await customer.track('tool_call', { // !
  tool: 'search',
  server: 'builtin', // !
  success: true,
  duration_ms: 420,
})`,
      },
    ],
  },
  {
    id: 'custom',
    label: 'Custom',
    title: 'Gate on a feature flag',
    description:
      'Custom servers are a flag benefit that only Pro grants. One call answers whether this customer has it right now.',
    files: [
      {
        name: 'polar.ts',
        code: `const customer = polar.actor({ externalCustomerId: userId }) // !

const { granted } = await customer.access('custom_servers') // !
if (!granted) { // !
  return { paywall: true }
}

// … run the tool on the customer's server …

await customer.track('tool_call', { // !
  tool: 'search',
  server: 'custom', // !
  success: true,
  duration_ms: 420,
})`,
      },
    ],
  },
]
