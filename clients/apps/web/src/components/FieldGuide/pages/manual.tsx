import type { ReactNode } from 'react'
import { Sheet, Label, Code, MONO } from '../sheet'
import {
  NIGHT_INK,
  LINE,
  MID,
  DIM,
  BG,
  HAIR,
  DOTTED,
  Guide,
  TITLE,
  TEXT,
  term,
  type TermTok,
  IsoBox,
  Callout,
  Figure,
  Anchor,
} from '../kit'
import type { Piece } from './index'
import { LiveMeter } from '../live/meter'
import { EventFields } from '../event'
import { LiveLedger } from '../live/ledger'
import { LiveBalance } from '../live/money'

/**
 * The Polar manual: pages that explain the system the way a reference manual explains a screen or a hard drive.
 * The pages of makingsoftware.com, drawn in the hand of the rebrand film. Each is a head, one figure with callouts, a paragraph and a foot.
 */

const page = (
  id: string,
  title: string,
  note: string,
  w: number,
  h: number,
  cols: 1 | 2,
  render: () => ReactNode,
  text: Pick<Piece, 'sub' | 'notes'> = {},
): Piece => ({ id, title, kind: 'manual', note, w, h, cols, render, ...text })

const sheet = (w: number, h: number, title: string, children: ReactNode) => (
  <Sheet w={w} h={h} surface="night" unsigned title={title} pad={40}>
    {children}
  </Sheet>
)

export const manual: Piece[] = [
  // 01 How does a meter work? Many strands fold into one point; one line leaves it for the reading.
  page(
    'm-meter',
    'How does a meter work?',
    'The fold: every event is a strand, all of them bend to one point, and from that point one line leaves for the reading. Chapter 3.',
    960,
    540,
    2,
    () => {
      const x0 = 120,
        fy = 300,
        xm = 350
      // Where the strands look like one line: the curves run flat well before they end.
      const fold = x0 + (xm - x0) * 0.86
      const n = 14
      const gauge: [number, number] = [600, fy]
      return sheet(
        960,
        540,
        'How does a meter work?',
        <Figure x={40} y={156} w={620} h={300}>
          <g fill="none" stroke={MID} strokeWidth={HAIR}>
            {Array.from({ length: n }, (_, i) => {
              const y = 190 + ((fy - 190) * 2 * i) / (n - 1)
              return (
                <path
                  key={i}
                  d={`M ${x0} ${y} C ${x0 + (xm - x0) * 0.75} ${y}, ${x0 + (xm - x0) * 0.25} ${fy}, ${xm} ${fy}`}
                />
              )
            })}
          </g>
          {Array.from({ length: n }, (_, i) => {
            const y = 190 + ((fy - 190) * 2 * i) / (n - 1)
            return <Anchor key={i} at={[x0, y]} size={2.6} />
          })}
          <line
            x1={xm}
            x2={gauge[0] - 30}
            y1={fy}
            y2={fy}
            stroke={LINE}
            strokeWidth={HAIR}
          />
          <circle cx={fold} cy={fy} r={4.5} fill={LINE} />
          {/* the meter: a half dial of five ticks, a needle, a pivot */}
          <path
            d={`M${gauge[0] - 30} ${gauge[1]} A 30 30 0 0 1 ${gauge[0] + 30} ${gauge[1]}`}
            fill="none"
            stroke={MID}
            strokeWidth={HAIR}
          />
          {[0, 1, 2, 3, 4].map((i) => {
            const a = Math.PI + (Math.PI * i) / 4
            return (
              <line
                key={i}
                x1={gauge[0] + Math.cos(a) * 30}
                y1={gauge[1] + Math.sin(a) * 30}
                x2={gauge[0] + Math.cos(a) * 25}
                y2={gauge[1] + Math.sin(a) * 25}
                stroke={MID}
                strokeWidth={HAIR}
              />
            )
          })}
          <LiveMeter x0={x0} xm={xm} fy={fy} n={n} gauge={gauge} />
          <Callout at={[x0, 190]} to={[x0, 160]} route="v">
            EVENT STREAM
          </Callout>
          <Callout at={[fold, fy]} to={[fold, 400]} route="v">
            THE FOLD
          </Callout>
          <Callout
            at={[gauge[0], gauge[1] - 30]}
            to={[gauge[0], 190]}
            route="v"
          >
            READING
          </Callout>
        </Figure>,
      )
    },
    {
      sub: 'A meter turns events into one number.',
      notes: [
        [
          'What it counts',
          [
            'A meter picks the events it cares about, like llm.completion, and adds them up: a count, a sum of output tokens, a maximum.',
          ],
        ],
        [
          'Always current',
          [
            'Each new event updates the number straight away, so it is never waiting on a nightly job.',
          ],
        ],
        [
          'No drift',
          [
            'The number can always be rebuilt from the events behind it, so it always matches what happened.',
          ],
        ],
      ],
    },
  ),

  // 0a Billing as code: a product file on the left, the objects it produces on the right, one arrow between
  page(
    'm-code',
    'The config',
    'A product is a file. Its events, meters and prices are declared in code, checked in, reviewed, and applied, and the objects on the right are what the file produces. Chapter 1.',
    960,
    540,
    2,
    () => {
      const fx = 44,
        fy = 170,
        fw = 212,
        fh = 246,
        R = fx + fw
      const lines = [
        { t: 'export default defineConfig({' },
        { t: '  events: {' },
        { t: "    'llm.completion': z.object({" },
        { t: '      model: z.string(),' },
        { t: '      input_tokens: z.int(),' },
        { t: '      output_tokens: z.int(),' },
        { t: '    }),' },
        { t: '  },' },
        { t: '  meters: ({ meter, events }) => ({' },
        { t: "    tokens: meter('Output tokens')" },
        { t: "      .on(events['llm.completion'])" },
        { t: "      .unit('token')" },
        { t: "      .sum('output_tokens')," },
        { t: '  }),' },
        { t: '  products: ({ product, meter }) => ({' },
        { t: "    pro: product('Pro')" },
        { t: "      .recurring('monthly')" },
        { t: '      .prices(' },
        { t: "        meter('tokens')" },
        { t: '          .amount(perMillion(usd(3))),' },
        { t: '      ),' },
        { t: '  }),' },
        { t: '})' },
      ]
      const objects: [string, string][] = [
        ['EVENT', 'llm.completion'],
        ['METER', 'tokens · sum'],
        ['PRODUCT', 'Pro · $3 / M'],
      ]
      const oy0 = fy + 66
      return sheet(
        960,
        540,
        'The config',
        <Figure x={40} y={156} w={620} h={300}>
          <g transform="translate(96 0)">
            <rect
              x={fx}
              y={fy}
              width={fw}
              height={fh}
              fill={BG}
              stroke={MID}
              strokeWidth={HAIR}
            />
            <Code
              x={fx + 12}
              y={fy + 16}
              lines={lines}
              ink={NIGHT_INK}
              size={7.5}
              lh={1.35}
              highlight
            />
            <Guide a={[R, fy + 130]} b={[R + 44, fy + 130]} />
            <path
              d={`M${R + 40} ${fy + 127}l4 3l-4 3`}
              fill="none"
              stroke={DIM}
              strokeWidth={HAIR}
            />
            <Label
              x={R + 22}
              y={fy + 123}
              ink={NIGHT_INK}
              size={7.5}
              anchor="middle"
            >
              APPLY
            </Label>
            {objects.map(([kind, value], i) => {
              const y = oy0 + i * 56
              return (
                <g key={kind}>
                  {i === 0 ? (
                    <IsoBox
                      x={0}
                      y={0}
                      z={0}
                      w={1}
                      d={1}
                      h={1}
                      s={10}
                      ox={R + 86}
                      oy={y + 14}
                      tone="mid"
                    />
                  ) : i === 1 ? (
                    <g>
                      {[0, 1, 2].map((k) => (
                        <IsoBox
                          key={k}
                          x={k * 1.2}
                          y={0}
                          z={0}
                          w={1}
                          d={1}
                          h={1}
                          s={10}
                          ox={R + 72}
                          oy={y + 10}
                          tone="mid"
                        />
                      ))}
                    </g>
                  ) : (
                    <g>
                      <IsoBox
                        x={-0.4}
                        y={-0.4}
                        z={-0.5}
                        w={4.2}
                        d={1.8}
                        h={0.5}
                        s={10}
                        ox={R + 72}
                        oy={y + 12}
                        tone="mid"
                      />
                      {[0, 1, 2].map((k) => (
                        <IsoBox
                          key={k}
                          x={k * 1.2}
                          y={0}
                          z={0}
                          w={1}
                          d={1}
                          h={1}
                          s={10}
                          ox={R + 72}
                          oy={y + 12}
                          tone="mid"
                        />
                      ))}
                    </g>
                  )}
                  <Label x={R + 122} y={y + 4} ink={NIGHT_INK} size={8}>
                    {kind}
                  </Label>
                  <Label
                    x={R + 122}
                    y={y + 16}
                    ink={NIGHT_INK}
                    size={8}
                    dim={false}
                  >
                    {value}
                  </Label>
                </g>
              )
            })}
            <Callout
              at={[fx + 24, fy]}
              to={[fx + 24, fy - 26]}
              route="v"
              dot={false}
            >
              polar.config.ts
            </Callout>
          </g>
        </Figure>,
      )
    },
    {
      sub: 'A product is a file you review and apply.',
      notes: [
        [
          'The file',
          [
            'A product’s events, meters and prices live in one typed file, beside the code that emits the events, and the types flow from the event schema to the meter to the price.',
          ],
        ],
        [
          'The review',
          [
            'The file goes through the same pull request as everything else. A price change is a diff that a reviewer reads, and the build type-checks it against the schemas before anyone can apply it.',
          ],
        ],
        [
          'The apply',
          [
            'The CLI compares the file with what is deployed and applies the difference: new products and prices are created, changed ones updated, the rest left alone. The file stays the source of truth.',
          ],
        ],
      ],
    },
  ),

  // 0b The CLI: a `polar apply` session, set as typography. Gutter markers, bars beside blocks, inverted lines for changes.
  page(
    'm-cli',
    'Review and apply',
    'A transcript of `polar apply`: the plan, the diff, the confirmation, and the changes it made. The CLI takes a billing definition from a file to production. Chapter 1.',
    960,
    540,
    2,
    () => {
      const { line } = term(70, 150, 8, 11.6)
      const D = (t: string): TermTok => ({ t, tone: 'dim' })
      const rows: TermTok[][] = [
        [{ t: '$ ' }, { t: 'polar apply' }, D(' --env prod')],
        [],
        [D('Reading   '), { t: 'polar.config.ts' }],
        [D('Found     '), { t: '1 event, 1 meter, 2 products' }],
        [D('Planning  '), { t: 'against prod' }, D('  (deployed 3 days ago)')],
        [],
        [{ t: '  ' }, D('   event    llm.completion')],
        [{ t: '  ' }, D('   meter    tokens')],
        [
          { t: '  ' },
          { t: '-  price    pro.tokens    perMillion(usd(3))', tone: 'del' },
        ],
        [
          { t: '  ' },
          { t: '+  price    pro.tokens    perMillion(usd(2.5))', tone: 'add' },
        ],
        [
          { t: '  ' },
          {
            t: '+  product  team          seats · graduated · monthly',
            tone: 'add',
          },
        ],
        [],
        [D('Plan: '), { t: '1 to change, 1 to add, 2 unchanged' }],
        [],
        [
          { t: '? ' },
          { t: 'Apply 2 changes to prod? ' },
          D('(y/N) '),
          { t: 'y' },
        ],
        [],
        [D('Updated   '), { t: 'price     pro.tokens' }],
        [D('Created   '), { t: 'product   team' }],
        [],
        [{ t: '✓ ' }, { t: 'Applied 2 changes to prod' }, D('  in 0.41s')],
      ]
      return sheet(
        960,
        540,
        'Review and apply',
        <Figure x={40} y={156} w={620} h={300}>
          {rows.map((toks, i) =>
            toks.length ? line(i, 0, toks, `r${i}`) : null,
          )}
        </Figure>,
      )
    },
    {
      sub: 'The CLI reads the file, shows the plan, asks, and applies it.',
      notes: [
        [
          'The plan',
          [
            'The CLI reads the file, computes the diff against what is deployed, and shows it before anything changes. The dashboard still works too, and the next plan picks up whatever was changed there.',
          ],
        ],
        [
          'Applied',
          [
            'On yes, it applies the plan. What is deployed then matches the file, and the next plan starts from there.',
          ],
        ],
      ],
    },
  ),

  // 00 Core principles: the fold as the figure, the three principles beside it
  page(
    'm-principle',
    'Everything is an event',
    'State is a function of events: every event a strand, all of them folding into one value.',
    960,
    540,
    2,
    () => {
      const x0 = 56,
        x1 = 344,
        fy = 212,
        xm = 268
      const fold = x0 + (xm - x0) * 0.86
      const n = 9
      return sheet(
        960,
        540,
        'Everything is an event',
        <Figure x={40} y={156} w={620} h={300}>
          <g transform="translate(150 60)">
            <g fill="none" stroke={MID} strokeWidth={HAIR}>
              {Array.from({ length: n }, (_, i) => {
                const y = 164 + ((fy - 164) * 2 * i) / (n - 1)
                return (
                  <path
                    key={i}
                    d={`M ${x0} ${y} C ${x0 + (xm - x0) * 0.75} ${y}, ${x0 + (xm - x0) * 0.25} ${fy}, ${xm} ${fy}`}
                  />
                )
              })}
            </g>
            {Array.from({ length: n }, (_, i) => {
              const y = 164 + ((fy - 164) * 2 * i) / (n - 1)
              return <Anchor key={i} at={[x0, y]} size={2.6} />
            })}
            <line
              x1={xm}
              x2={x1}
              y1={fy}
              y2={fy}
              stroke={LINE}
              strokeWidth={HAIR}
            />
            <circle cx={fold} cy={fy} r={4.5} fill={LINE} />
            <Callout at={[x0, 164]} to={[x0, 128]} route="v">
              EVENTS
            </Callout>
            <Callout at={[x1, fy]} to={[x1, 284]} route="v" side="left">
              STATE · ONE VALUE
            </Callout>
            <Label x={x0} y={360} ink={NIGHT_INK} size={8.5}>
              state = fn(events)
            </Label>
          </g>
        </Figure>,
      )
    },
    {
      sub: 'Every number Polar shows is computed from the events you send.',
      notes: [
        [
          'One record',
          [
            'Usage is recorded as events and nothing else. Each one says who did what, when, and how much.',
          ],
        ],
        [
          'Everything derived',
          [
            'Meters, credit balances and invoice lines are all computed from the events, so there is no second count to drift out of sync.',
          ],
        ],
        [
          'Traceable',
          [
            'Any number can be rebuilt from the events behind it, so a line on an invoice leads back to what happened.',
          ],
        ],
      ],
    },
  ),

  // 02 What’s in an event: a frame diagram, as a protocol spec draws a packet. Fixed fields first, the open one last.
  page(
    'm-event',
    'What’s in an event',
    'An event drawn as a frame, the way a protocol specification draws a packet: a ruler, the fields in order, and the metadata at the end. Chapter 2.',
    960,
    540,
    2,
    () => {
      const x = 56,
        w = 236,
        top = 180,
        rh = 28
      const cols = 32
      const cw = w / cols
      return sheet(
        960,
        540,
        'What’s in an event',
        <Figure x={40} y={156} w={620} h={300}>
          <g transform="translate(150 0)">
            {/* the ruler */}
            {Array.from({ length: cols + 1 }, (_, i) => {
              const major = i % 8 === 0
              return (
                <line
                  key={i}
                  x1={x + i * cw}
                  x2={x + i * cw}
                  y1={top - (major ? 10 : 6)}
                  y2={top - 2}
                  stroke={MID}
                  strokeWidth={HAIR}
                />
              )
            })}
            {[0, 8, 16, 24, 32].map((i) => (
              <text
                key={i}
                x={x + i * cw}
                y={top - 14}
                fontSize={7}
                fill={DIM}
                textAnchor="middle"
                style={MONO}
              >
                {i}
              </text>
            ))}
            <EventFields x={x} top={top} rh={rh} cw={cw} />
            {/* the sentence the chapter opens with, field by field */}
            {(['WHEN', 'WHO', 'WHAT', 'HOW MUCH'] as const).map((word, i) => (
              <Callout
                key={word}
                at={[x + w, top + rh * (i + 1.5)]}
                to={[x + w + 24, top + rh * (i + 1.5)]}
              >
                {word}
              </Callout>
            ))}
          </g>
        </Figure>,
      )
    },
    {
      sub: 'Who did what, when, and how much.',
      notes: [
        [
          'When',
          [
            'The timestamp is when it happened, so a late event still lands in the right period.',
          ],
        ],
        [
          'Who',
          [
            'The customer is who pays. The actor is who did it on their behalf: a teammate, an API key, or one of their agents.',
          ],
        ],
        [
          'What',
          [
            'The name says what happened, like llm.completion. Meters pick the events they count by name.',
          ],
        ],
        [
          'How much',
          [
            'The metadata holds the numbers, like 3,120 input and 1,240 output tokens, in any shape you like. Meters add them up.',
          ],
        ],
      ],
    },
  ),

  // 04 The credit balance: a vessel with a level
  page(
    'm-credits',
    'The credit balance',
    'The balance as a statement: a grant adds, every metered event takes away at its rate, and the running balance is read off the last line. Chapter 8.',
    960,
    540,
    2,
    () => {
      const { line, CW } = term(52, 150)
      const T = (t: string, w?: number): TermTok => ({ t, tone: 'dim', w })
      const X0 = 52,
        BX = X0 + 49 * CW,
        BW = 56
      return sheet(
        960,
        540,
        'The credit balance',
        <Figure x={40} y={156} w={620} h={300}>
          <g transform="translate(150 0)">
            {line(
              0,
              0,
              [T('', 7), T('EVENT'), T('', 19), T('Δ', 9), T('BALANCE')],
              'h',
            )}
            <LiveBalance X0={X0} BX={BX} BW={BW} />
          </g>
        </Figure>,
      )
    },
    {
      sub: 'A grant fills it and every metered event drains it.',
      notes: [
        [
          'Two kinds of event',
          [
            'Credits are a balance derived from two kinds of event: grants, which add, and usage, which takes away at the meter’s rate.',
          ],
        ],
        [
          'Never stored',
          [
            'The balance is the last line of this statement, recomputed from the events above it.',
          ],
        ],
      ],
    },
  ),

  // 05 Entitlements: a switch panel. One state line from the subscription drives every switch.
  page(
    'm-gates',
    'How entitlements work',
    'A switch panel: the subscription’s state runs along one bus, and every entitlement is a switch on it. Active closes them and canceled opens them. Chapter 9.',
    960,
    540,
    2,
    () => {
      const bx = 76,
        by = 186,
        bw = 80,
        bh = 32
      const bus = bx + bw + 28
      const rows: [string, boolean][] = [
        ['API', true],
        ['AGENTS', true],
        ['EXPORTS', false],
      ]
      const ry = (i: number) => by + 16 + i * 44
      const sw = bus + 30
      return sheet(
        960,
        540,
        'How entitlements work',
        <Figure x={40} y={156} w={620} h={300}>
          <g transform="translate(138 22)">
            <rect
              x={bx}
              y={by}
              width={bw}
              height={bh}
              fill={BG}
              stroke={LINE}
              strokeWidth={HAIR}
            />
            <text
              x={bx + bw / 2}
              y={by + 13}
              fontSize={7.5}
              fill={DIM}
              textAnchor="middle"
              style={MONO}
            >
              SUBSCRIPTION
            </text>
            <text
              x={bx + bw / 2}
              y={by + 24}
              fontSize={7.5}
              fill={LINE}
              textAnchor="middle"
              style={MONO}
            >
              active
            </text>
            <line
              x1={bx + bw}
              x2={bus}
              y1={by + bh / 2}
              y2={by + bh / 2}
              stroke={LINE}
              strokeWidth={HAIR}
            />
            <line
              x1={bus}
              x2={bus}
              y1={by + bh / 2}
              y2={ry(2)}
              stroke={LINE}
              strokeWidth={HAIR}
            />
            {rows.map(([name, on], i) => {
              const y = ry(i)
              return (
                <g key={name}>
                  <circle cx={bus} cy={y} r={1.8} fill={LINE} />
                  <line
                    x1={bus}
                    x2={sw}
                    y1={y}
                    y2={y}
                    stroke={LINE}
                    strokeWidth={HAIR}
                  />
                  <circle
                    cx={sw}
                    cy={y}
                    r={2.2}
                    fill={BG}
                    stroke={LINE}
                    strokeWidth={HAIR}
                  />
                  <circle
                    cx={sw + 28}
                    cy={y}
                    r={2.2}
                    fill={BG}
                    stroke={LINE}
                    strokeWidth={HAIR}
                  />
                  {on ? (
                    <line
                      x1={sw + 2.2}
                      x2={sw + 25.8}
                      y1={y}
                      y2={y}
                      stroke={LINE}
                      strokeWidth={HAIR}
                    />
                  ) : (
                    <line
                      x1={sw + 2.2}
                      x2={sw + 24}
                      y1={y}
                      y2={y - 11}
                      stroke={LINE}
                      strokeWidth={HAIR}
                    />
                  )}
                  <line
                    x1={sw + 30.2}
                    x2={sw + 56}
                    y1={y}
                    y2={y}
                    stroke={on ? LINE : MID}
                    strokeWidth={HAIR}
                  />
                  <rect
                    x={sw + 56}
                    y={y - 9}
                    width={70}
                    height={18}
                    fill={BG}
                    stroke={on ? LINE : MID}
                    strokeWidth={HAIR}
                  />
                  <text
                    x={sw + 64}
                    y={y + 2.5}
                    fontSize={7.5}
                    fill={on ? LINE : DIM}
                    style={MONO}
                  >
                    {name}
                  </text>
                  <text
                    x={sw + 118}
                    y={y + 2.5}
                    fontSize={7.5}
                    fill={on ? LINE : DIM}
                    textAnchor="end"
                    style={MONO}
                  >
                    {on ? 'ON' : 'OFF'}
                  </text>
                </g>
              )
            })}
            <Callout
              at={[sw + 14, ry(0) - 6]}
              to={[sw + 14, ry(0) - 30]}
              route="v"
              dot={false}
            >
              GATE
            </Callout>
          </g>
        </Figure>,
      )
    },
    {
      sub: 'The subscription’s state moves every gate.',
      notes: [
        [
          'The switch',
          [
            'An entitlement is a switch, and the subscription’s state is the line that drives it. When the state changes, every switch on the line moves at once.',
          ],
        ],
        [
          'The states',
          [
            'Active closes them, past due keeps them closed, and canceled opens them.',
          ],
        ],
        ['A history', ['Each move is an event, so access has a history.']],
      ],
    },
  ),

  // 06 Local-first checks: a timeline. A check drops to the state and comes straight back; events step the state up.
  page(
    'm-latency',
    'Local-first checks',
    'A timeline: a check is answered from the state on hand in no time. The stream arrives behind it and steps the state up, so the next check is answered from a newer one. Chapter 4.',
    960,
    540,
    2,
    () => {
      const x0 = 120,
        x1 = 600
      const CHECK = 190,
        STATE = 272,
        STREAM = 334
      const t = (ms: number) => x0 + ((x1 - x0) * ms) / 400
      const events = [120, 240, 380]
      const step = 8
      const stateAt = (ms: number) =>
        STATE - step * events.filter((e) => e <= ms).length
      let path = `M${x0} ${STATE}`
      events.forEach((e) => {
        path += `H${t(e)}V${stateAt(e)}`
      })
      path += `H${x1}`
      // The check reaches down to the state on hand: a quiet dotted guide that stops short of both lanes.
      const check = (ms: number) => {
        const x = t(ms)
        return (
          <g key={ms}>
            <Guide a={[x, CHECK + 7]} b={[x, stateAt(ms) - 5]} />
            <Anchor at={[x, CHECK]} />
          </g>
        )
      }
      return sheet(
        960,
        540,
        'Local-first checks',
        <Figure x={40} y={156} w={620} h={300}>
          {[
            ['CHECK', CHECK],
            ['STATE', STATE - step * 1.5],
            ['STREAM', STREAM],
          ].map(([lane, y]) => (
            <text
              key={lane}
              x={x0 - 12}
              y={Number(y) + 2.5}
              fontSize={8.5}
              fill={DIM}
              textAnchor="end"
              style={MONO}
            >
              {lane}
            </text>
          ))}
          <line
            x1={x0}
            x2={x1}
            y1={CHECK}
            y2={CHECK}
            stroke={MID}
            strokeWidth={HAIR}
          />
          <line
            x1={x0}
            x2={x1}
            y1={STREAM}
            y2={STREAM}
            stroke={MID}
            strokeWidth={HAIR}
          />
          <path d={path} fill="none" stroke={LINE} strokeWidth={HAIR} />
          {events.map((e, i) => (
            <g key={e}>
              <Anchor at={[t(e), STREAM]} />
              <Guide a={[t(e), STREAM - 4]} b={[t(e), stateAt(e) + 4]} />
              <text
                x={t(e) + 5}
                y={stateAt(e) - 4}
                fontSize={8}
                fill={DIM}
                style={MONO}
              >
                v{i + 1}
              </text>
            </g>
          ))}
          <text x={x0 + 14} y={STATE - 4} fontSize={8} fill={DIM} style={MONO}>
            v0
          </text>
          {check(0)}
          {check(400)}
          {[0, 100, 200, 300, 400].map((ms) => (
            <g key={ms}>
              <line
                x1={t(ms)}
                x2={t(ms)}
                y1={STREAM + 30}
                y2={STREAM + 36}
                stroke={MID}
                strokeWidth={HAIR}
              />
              <text
                x={t(ms)}
                y={STREAM + 48}
                fontSize={8}
                fill={DIM}
                textAnchor="middle"
                style={MONO}
              >
                {ms} ms
              </text>
            </g>
          ))}
          <line
            x1={x0}
            x2={x1}
            y1={STREAM + 33}
            y2={STREAM + 33}
            stroke={MID}
            strokeWidth={HAIR}
          />
        </Figure>,
      )
    },
    {
      sub: 'Answered from the state in your own Redis. Polar catches up behind it.',
      notes: [
        [
          'No round trip',
          [
            'A check, "may this customer call the API?", is answered by Outpost from the state it holds: the fold of every event seen so far. It does not wait on Polar.',
          ],
        ],
        [
          'Same reducers',
          [
            'When Outpost connects, Polar sends it the organization\u2019s reducers, so an event is folded locally exactly as Polar folds it, into the same five-minute buckets.',
          ],
        ],
        [
          'First sight',
          [
            'The only round trip is the first check for a customer Outpost has not seen yet: it fetches their usage from Polar once, and every check after that is answered locally.',
          ],
        ],
      ],
    },
  ),

  // 07 The event log: one strip of numbered rows. The past is set, the head is now, at the bottom.
  page(
    'm-ledger',
    'The event log',
    'The event log as a strip: numbered rows from the first event down, the head in ink at the bottom. Chapter 2.',
    960,
    540,
    2,
    () => {
      const x = 96,
        w = 300,
        top = 160,
        rh = 16
      const past = 12
      const rowY = (i: number) => top + i * rh
      const head = rowY(past)
      // The callouts' anchors stand a little clear of the rows' right edge.
      const mark = x + w + 10
      return sheet(
        960,
        540,
        'The event log',
        <Figure x={40} y={156} w={620} h={300}>
          <g transform="translate(138 22)">
            <LiveLedger x={x} w={w} top={top} rh={rh} past={past} />
            <Callout at={[mark, rowY(0)]} to={[mark + 28, rowY(0)]}>
              IMMUTABLE EVENT LOG
            </Callout>
            <Callout at={[mark, head]} to={[mark + 28, head]}>
              HEAD · NOW
            </Callout>
          </g>
        </Figure>,
      )
    },
    {
      sub: 'Append only. Events are added, never changed or removed.',
      notes: [
        [
          'Append only',
          [
            'The event log only grows. A new event is added to it, and nothing already in it is ever edited or deleted.',
          ],
        ],
        [
          'Every number',
          [
            'Every usage number, a meter reading, a credit balance, an invoice line, is computed from the event log, so it can be traced back to the events behind it.',
          ],
        ],
      ],
    },
  ),

  // 08 Customers, agents and actors: nested boxes
  page(
    'm-nesting',
    'Nested identities',
    'A tree of identities: a company at the root, a human team and an agent beneath it, and the people, agents and runs beneath those. Usage is counted at the leaves and summed upward, while access is set higher up and inherited. Chapter 5.',
    960,
    540,
    2,
    () => {
      const cx = 200
      const L0 = 160,
        L1 = 232,
        L2 = 304
      const agents = [cx - 70, cx + 70]
      const actors = (ax: number) => [ax - 40, ax, ax + 40]
      // A human team's people and agent, and the support agent's runs.
      const LEAVES = [
        ['ada', 'lin', 'bot'],
        ['run', 'run', 'run'],
      ]
      const node = (
        x: number,
        y: number,
        label: string,
        tone: 'ink' | 'mid',
        w = 60,
      ) => (
        <g key={`${x}-${y}`}>
          <rect
            x={x - w / 2}
            y={y - 9}
            width={w}
            height={18}
            fill={BG}
            stroke={tone === 'ink' ? LINE : MID}
            strokeWidth={HAIR}
          />
          <text
            x={x}
            y={y + 2.5}
            fontSize={7.5}
            fill={tone === 'ink' ? LINE : DIM}
            textAnchor="middle"
            style={MONO}
          >
            {label}
          </text>
        </g>
      )
      return sheet(
        960,
        540,
        'Nested identities',
        <Figure x={40} y={156} w={620} h={300}>
          <g transform="translate(138 22)">
            <line
              x1={cx}
              x2={cx}
              y1={L0 + 9}
              y2={L1 - 20}
              stroke={MID}
              strokeWidth={HAIR}
            />
            <line
              x1={agents[0]}
              x2={agents[1]}
              y1={L1 - 20}
              y2={L1 - 20}
              stroke={MID}
              strokeWidth={HAIR}
            />
            {agents.map((ax) => (
              <g key={ax}>
                <line
                  x1={ax}
                  x2={ax}
                  y1={L1 - 20}
                  y2={L1 - 9}
                  stroke={MID}
                  strokeWidth={HAIR}
                />
                <line
                  x1={ax}
                  x2={ax}
                  y1={L1 + 9}
                  y2={L2 - 20}
                  stroke={MID}
                  strokeWidth={HAIR}
                />
                <line
                  x1={actors(ax)[0]}
                  x2={actors(ax)[2]}
                  y1={L2 - 20}
                  y2={L2 - 20}
                  stroke={MID}
                  strokeWidth={HAIR}
                />
                {actors(ax).map((tx) => (
                  <line
                    key={tx}
                    x1={tx}
                    x2={tx}
                    y1={L2 - 20}
                    y2={L2 - 9}
                    stroke={MID}
                    strokeWidth={HAIR}
                  />
                ))}
              </g>
            ))}
            {node(cx, L0, 'acme', 'ink', 92)}
            {node(agents[0], L1, 'research', 'mid')}
            {node(agents[1], L1, 'support-bot', 'mid')}
            {agents.flatMap((ax, i) =>
              actors(ax).map((tx, j) =>
                node(
                  tx,
                  L2,
                  LEAVES[i][j],
                  i === 1 && j === 1 ? 'ink' : 'mid',
                  32,
                ),
              ),
            )}
            <line
              x1={cx - 150}
              x2={cx - 150}
              y1={L2}
              y2={L0}
              stroke={DIM}
              strokeWidth={HAIR}
              {...DOTTED}
            />
            <path
              d={`M${cx - 153} ${L0 + 5}l3 -5l3 5`}
              fill="none"
              stroke={DIM}
              strokeWidth={HAIR}
            />
            <text
              transform={`rotate(-90 ${cx - 156} ${(L0 + L2) / 2})`}
              x={cx - 156}
              y={(L0 + L2) / 2}
              fontSize={7.5}
              fill={DIM}
              textAnchor="middle"
              style={MONO}
            >
              USAGE ROLLS UP
            </text>
            <line
              x1={cx + 150}
              x2={cx + 150}
              y1={L0}
              y2={L2}
              stroke={DIM}
              strokeWidth={HAIR}
              {...DOTTED}
            />
            <path
              d={`M${cx + 147} ${L2 - 5}l3 5l3 -5`}
              fill="none"
              stroke={DIM}
              strokeWidth={HAIR}
            />
            <text
              transform={`rotate(90 ${cx + 156} ${(L0 + L2) / 2})`}
              x={cx + 156}
              y={(L0 + L2) / 2}
              fontSize={7.5}
              fill={DIM}
              textAnchor="middle"
              style={MONO}
            >
              ACCESS ROLLS DOWN
            </text>
            <Callout
              at={[actors(agents[1])[1], L2 + 9]}
              to={[actors(agents[1])[1], L2 + 34]}
              route="v"
              dot={false}
            >
              ONE RUN, ITS OWN IDENTITY
            </Callout>
          </g>
        </Figure>,
      )
    },
    {
      sub: 'People and agents, in whatever hierarchy you design.',
      notes: [
        [
          'Human or machine',
          [
            'A person, a team, an agent, a single agent run: each is an identity, and each holds meters, credits and entitlements the same way.',
          ],
        ],
        [
          'Nested',
          [
            'Identities nest in the shape your product needs: a company, its teams, the people and agents in them, and the runs those agents start.',
          ],
        ],
        [
          'Up and down',
          [
            'Every event names the identity that acted. Usage adds up the tree to whoever pays, and entitlements set higher up apply to everything beneath.',
          ],
        ],
      ],
    },
  ),

  // 09 Contents
  page(
    'm-contents',
    'Table of contents',
    'The contents: six chapters, their pages, and where each begins.',
    400,
    566,
    1,
    () => {
      const chapters: [string, [string, string][]][] = [
        ['Preface', [['Core principles', '2']]],
        [
          'Billing as code',
          [
            ['The config', '4'],
            ['Review and apply', '6'],
          ],
        ],
        [
          'Events',
          [
            ['What’s in an event', '10'],
            ['The event log', '12'],
            ['Late events', '14'],
          ],
        ],
        [
          'Meters',
          [
            ['How does a meter work?', '18'],
            ['Local-first checks', '20'],
            ['Rates and tiers', '22'],
            ['Reconciliation', '24'],
          ],
        ],
        [
          'Credits',
          [
            ['The credit balance', '28'],
            ['Grants and expiry', '30'],
            ['Running out', '32'],
          ],
        ],
        [
          'Entitlements',
          [
            ['How entitlements work', '44'],
            ['From checkout to access', '46'],
            ['On a product', '48'],
          ],
        ],
        [
          'Agents',
          [
            ['Nested identities', '52'],
            ['Shared and delegated', '56'],
          ],
        ],
      ]
      const col = (k: number) =>
        k < 5 ? { x: 28, right: 190 } : { x: 212, right: 372 }
      const rows: ReactNode[] = []
      let yy = 172
      chapters.forEach(([name, items], k) => {
        if (k === 5) yy = 172
        const { x, right } = col(k)
        rows.push(
          <g key={name}>
            <text x={x} y={yy} fontSize={16} fill={DIM} style={TITLE}>
              {k === 0 ? '—' : String(k).padStart(2, '0')}
            </text>
            <text
              x={x + 24}
              y={yy}
              fontSize={16}
              fill={NIGHT_INK.ink}
              style={TITLE}
            >
              {name}
            </text>
          </g>,
        )
        yy += 20
        items.forEach(([title, pageNo]) => {
          rows.push(
            <g key={name + title}>
              <text
                x={x + 24}
                y={yy}
                fontSize={10}
                fill={NIGHT_INK.ink}
                style={TEXT}
              >
                {title}
              </text>
              <text
                x={right}
                y={yy}
                fontSize={8.5}
                fill={DIM}
                textAnchor="end"
                style={MONO}
              >
                {pageNo}
              </text>
            </g>,
          )
          yy += 13.5
        })
        yy += 18
      })
      return sheet(400, 566, 'Table of contents', rows)
    },
    { sub: 'A preface, seven chapters and an appendix.' },
  ),
]
