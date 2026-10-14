import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Sheet, Window } from './Frame'

type Tone = 'plain' | 'muted' | 'del' | 'add'
type Line = { text: string; tone?: Tone }

/** Acme's plan as code. The price line flips between the old and the new value, shown as a diff. */
const config = (changed: boolean): Line[] => [
  { text: 'export default defineConfig({', tone: 'muted' },
  { text: '  meters: {', tone: 'muted' },
  { text: "    tokensIn: meter('tokens.in').sum('tokens'),", tone: 'plain' },
  { text: "    tokensOut: meter('tokens.out').sum('tokens'),", tone: 'plain' },
  { text: "    toolCalls: meter('tool.call').count(),", tone: 'plain' },
  { text: '  },', tone: 'muted' },
  { text: '  products: {', tone: 'muted' },
  { text: "    pro: product('Pro')", tone: 'plain' },
  { text: '      .recurring(usd(2_499), "month")', tone: 'plain' },
  { text: '      .credits(40_000)', tone: 'plain' },
  ...(changed
    ? [
        {
          text: "      .usage('tokensOut', perMillion(2.00))",
          tone: 'del' as Tone,
        },
        {
          text: "      .usage('tokensOut', perMillion(1.80))",
          tone: 'add' as Tone,
        },
      ]
    : [
        {
          text: "      .usage('tokensOut', perMillion(2.00))",
          tone: 'plain' as Tone,
        },
      ]),
  { text: "      .usage('toolCalls', usd(0.005)),", tone: 'plain' },
  { text: '  },', tone: 'muted' },
  { text: '})', tone: 'muted' },
]

const TONE: Record<Tone, string> = {
  plain: 'text-white',
  muted: 'text-polar-500',
  del: 'bg-red-500/10 text-red-400',
  add: 'bg-emerald-500/10 text-emerald-400',
}

const Row = ({
  label,
  value,
  emphasis = false,
}: {
  label: string
  value: string
  emphasis?: boolean
}) => (
  <Box justifyContent="between" alignItems="baseline" columnGap="l">
    <Text variant="default" color="muted">
      {label}
    </Text>
    <Text variant="default" color={emphasis ? 'default' : 'muted'} tabularNums>
      {value}
    </Text>
  </Box>
)

/** Fig. 01: polar.config.ts on the left, the plan Polar builds from it on the right. */
export const DefineFigure = () => {
  const changed = true

  return (
    <Window aside="Acme Inc · Pro">
      <Grid templateColumns={{ base: '1fr', lg: '3fr 2fr' }} gap="xs">
        <Sheet
          title="polar.config.ts"
          aside={
            <Text variant="caption" color="muted">
              {changed ? '1 change' : 'main'}
            </Text>
          }
        >
          <pre className="m-0 overflow-x-auto font-mono text-[13px] leading-6">
            {config(changed).map((line, i) => (
              <div
                key={`${i}-${line.text}`}
                className={TONE[line.tone ?? 'plain']}
              >
                {line.text}
              </div>
            ))}
          </pre>
        </Sheet>
        <Sheet
          title="Pro plan"
          aside={
            <Text variant="caption" color="muted">
              {changed ? 'Preview' : 'Live'}
            </Text>
          }
        >
          <Box flexDirection="column" rowGap="s">
            <Row label="Base" value="$2,499 / month" emphasis />
            <Row label="Credits" value="40,000 / month" />
            <Row
              label="Output tokens"
              value={changed ? '$1.80 / 1M' : '$2.00 / 1M'}
              emphasis={changed}
            />
            <Row label="Tool calls" value="$0.005 / call" />
          </Box>
          <Box
            marginTop="auto"
            paddingTop="l"
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            flexDirection="column"
            rowGap="xs"
          >
            <Text variant="caption" color="muted">
              {changed
                ? "Acme's bill on last month's usage"
                : "Acme's bill this month"}
            </Text>
            <Text variant="heading-xs" tabularNums>
              {changed ? '$3,654.87' : '$3,783.30'}
            </Text>
          </Box>
        </Sheet>
      </Grid>
    </Window>
  )
}
