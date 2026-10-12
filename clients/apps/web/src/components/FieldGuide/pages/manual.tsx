import type { ReactNode } from 'react'
import { Sheet, Label, Code, MONO } from '../sheet'
import {
  NIGHT_INK,
  LINE,
  MID,
  DIM,
  BG,
  RULE,
  HAIR,
  DOTTED,
  Guide,
  TITLE,
  TEXT,
  term,
  type TermTok,
  Sections,
  IsoBox,
  Callout,
  Figure,
  PageHead,
  PageFoot,
  Body,
  Grain,
  Anchor,
} from '../kit'
import type { Piece } from './index'

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
): Piece => ({ id, title, kind: 'manual', note, w, h, cols, render })

const sheet = (w: number, h: number, title: string, children: ReactNode) => (
  <Sheet w={w} h={h} surface="night" unsigned title={title}>
    {children}
    <Grain w={w} h={h} id={`grain-${title.replace(/\W/g, '')}`} />
  </Sheet>
)

export const manual: Piece[] = [
  // 01 How does a meter work? Many strands fold into one point; one line leaves it for the reading.
  page(
    'm-meter',
    'How does a meter work?',
    'The fold: every event is a strand, all of them bend to one point, and from that point one line leaves for the reading. Chapter 2 of the manual.',
    960,
    540,
    2,
    () => {
      const x0 = 120,
        x1 = 420,
        fy = 300,
        xm = 350
      const n = 14
      const gauge: [number, number] = [600, fy]
      return sheet(
        960,
        540,
        'How does a meter work?',
        <>
          <PageHead
            crumb="03 · METERS · HOW DOES A METER WORK?"
            w={960}
            pad={40}
            title="How does a meter work?"
            sub="A meter is a fold over the event stream: state = fn(events). Nothing is stored that cannot be recomputed."
          />
          <Figure x={40} y={156} w={620} h={300} dy={26} n="002">
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
            <circle cx={x1} cy={fy} r={4.5} fill={LINE} />
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
            <line
              x1={gauge[0]}
              y1={gauge[1]}
              x2={gauge[0] + Math.cos(-0.9) * 24}
              y2={gauge[1] + Math.sin(-0.9) * 24}
              stroke={LINE}
              strokeWidth={HAIR}
            />
            <circle cx={gauge[0]} cy={gauge[1]} r={2} fill={LINE} />
            <Callout at={[x0, 190]} to={[x0, 160]} route="v">
              EVENT STREAM · ONE STRAND EACH
            </Callout>
            <Callout at={[x1, fy]} to={[x1, 400]} route="v">
              THE FOLD
            </Callout>
            <Callout
              at={[gauge[0], gauge[1] - 30]}
              to={[gauge[0], 190]}
              route="v"
            >
              READING
            </Callout>
          </Figure>
          <Body
            x={700}
            y={176}
            width={220}
            size={10}
            text={[
              'Every event the system sees is written down once, in order, and never changed. A meter does not count; it folds. Given the state so far and the next event, it returns the next state. Read the state and you have the reading. Replay the stream and you have the same reading.',
              'Because the fold is pure, any version of the state can be rebuilt from the events before it. Nothing is stored that cannot be recomputed, so nothing can drift.',
            ]}
          />
          <PageFoot w={960} h={540} pad={40} page="18" />
        </>,
      )
    },
  ),

  // 0a Billing as code: a product file on the left, the objects it produces on the right, one arrow between
  page(
    'm-code',
    'Billing as code',
    'A product is a file. Its events, meters and prices are declared in code, checked in, reviewed, and applied, and the objects on the right are what the file produces. Chapter 1.',
    960,
    540,
    2,
    () => {
      const fx = 44,
        fy = 160,
        fw = 212,
        fh = 330,
        R = fx + fw
      const lines = [
        { t: 'export default defineConfig({' },
        { t: '  events: {' },
        { t: "    'llm.completion': z.object({" },
        { t: '      model: z.string(),' },
        { t: '      tokens: z.int(),' },
        { t: '    }),' },
        { t: '  },' },
        { t: '  meters: ({ meter, events }) => ({' },
        { t: "    tokens: meter('Tokens')" },
        { t: "      .on(events['llm.completion'])" },
        { t: "      .unit('token')" },
        { t: "      .sum('tokens')," },
        { t: '  }),' },
        { t: '  products: ({ product, meter }) => ({' },
        { t: "    pro: product('Pro')" },
        { t: '      .prices(' },
        { t: "        meter('tokens').flat()" },
        { t: '          .amount(perMillion(usd(3))),' },
        { t: '      )' },
        { t: "      .recurring('monthly')," },
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
        'Billing as code',
        <>
          <PageHead
            crumb="01 · BILLING AS CODE · THE CONFIG"
            w={960}
            pad={40}
            title="Billing as code"
            sub="A product is a file: declared, reviewed, applied."
          />
          <Figure x={40} y={156} w={620} h={300} dy={26} n="00a">
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
                y={fy + 18}
                lines={lines}
                ink={NIGHT_INK}
                size={7}
                lh={1.6}
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
                size={6.5}
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
                    <Label x={R + 122} y={y + 4} ink={NIGHT_INK} size={7}>
                      {kind}
                    </Label>
                    <Label
                      x={R + 122}
                      y={y + 16}
                      ink={NIGHT_INK}
                      size={7}
                      dim={false}
                    >
                      {value}
                    </Label>
                  </g>
                )
              })}
              <Callout at={[fx + 24, fy]} to={[fx + 24, fy - 18]} route="v">
                polar.config.ts · IN GIT
              </Callout>
            </g>
          </Figure>
          <Sections
            x={700}
            y={176}
            width={220}
            size={9.5}
            items={[
              [
                'THE FILE',
                [
                  'A product is declared, not configured. Its events, meters and prices live in one typed file, beside the code that emits the events, and the types flow from the event schema to the meter to the price.',
                ],
              ],
              [
                'THE REVIEW',
                [
                  'The file goes through the same pull request as everything else. A price change is a diff; a reviewer reads it; the build type-checks it against the schemas before anyone can apply it.',
                ],
              ],
              [
                'THE APPLY',
                [
                  'The CLI compares the file with what is deployed and writes the difference as events. Polar holds no second copy: the deployed billing is the fold over those events, and the file is its source.',
                ],
              ],
            ]}
          />
          <PageFoot w={960} h={540} pad={40} page="4" />
        </>,
      )
    },
  ),

  // 0b The CLI: a `polar apply` session, set as typography. Gutter markers, bars beside blocks, inverted lines for changes.
  page(
    'm-cli',
    'Review and apply',
    'A transcript of `polar apply`: the plan, the diff, the confirmation, and the events it wrote. The CLI is how a billing definition reaches production. Chapter 1.',
    960,
    540,
    2,
    () => {
      const { line } = term(70, 150, 7, 11.6)
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
        [
          D('Writing   '),
          { t: 'price.updated     pro.tokens' },
          D('    evt_01JA7'),
        ],
        [
          D('Writing   '),
          { t: 'product.created   team' },
          D('          evt_01JA8'),
        ],
        [
          D('Writing   '),
          { t: 'config.applied    prod' },
          D('          evt_01JA9'),
        ],
        [],
        [{ t: '✓ ' }, { t: 'Applied 3 events to prod' }, D('  in 0.41s')],
      ]
      return sheet(
        960,
        540,
        'Review and apply',
        <>
          <PageHead
            crumb="01 · BILLING AS CODE · REVIEW AND APPLY"
            w={960}
            pad={40}
            title="Review and apply"
            sub="The CLI reads the file, shows the plan, asks, and writes the events."
          />
          <Figure x={40} y={156} w={620} h={300} dy={26} n="00b">
            {rows.map((toks, i) =>
              toks.length ? line(i, 0, toks, `r${i}`) : null,
            )}
          </Figure>
          <Body
            x={700}
            y={176}
            width={220}
            size={10}
            text={[
              'The CLI is the only way a definition reaches production. It reads the file, computes the diff against what is deployed, and asks. On yes, it does not update anything in place: it writes the events, and the deployed state is the fold over them, like every other number.',
            ]}
          />
          <PageFoot w={960} h={540} pad={40} page="6" />
        </>,
      )
    },
  ),

  // 00 The principle: the whole idea on one page, the fold as its figure, three claims explained beneath
  page(
    'm-principle',
    'The principle',
    'The whole idea on one page: state is a function of events. The fold as its figure, and the three claims the rest of the book makes good on.',
    960,
    540,
    2,
    () => {
      const x0 = 56,
        x1 = 344,
        fy = 212,
        xm = 268
      const n = 9
      return sheet(
        960,
        540,
        'The principle',
        <>
          <PageHead
            crumb="PREFACE · THE PRINCIPLE"
            w={960}
            pad={40}
            title="The principle"
            sub="Every number is derived from events. Nothing is stored twice."
          />
          <Figure x={40} y={156} w={620} h={300} dy={26} n="000">
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
              <circle cx={x1} cy={fy} r={4.5} fill={LINE} />
              <Callout at={[x0, 164]} to={[x0, 128]} route="v">
                EVENTS · IN ORDER
              </Callout>
              <Callout at={[x1, fy]} to={[x1, 284]} route="v" side="left">
                STATE · ONE VALUE
              </Callout>
              <Label x={x0} y={360} ink={NIGHT_INK} size={7.5}>
                state = fn(events)
              </Label>
            </g>
          </Figure>
          <Sections
            x={700}
            y={176}
            width={220}
            size={9.5}
            items={[
              [
                'THE RULE',
                [
                  'Polar keeps one thing: an ordered record of what happened. Every other number, a meter, a balance, an invoice line, is a fold over that record, computed when asked for and recomputed whenever the record grows.',
                ],
              ],
              [
                '01 · EVERY NUMBER IS DERIVED FROM EVENTS',
                [
                  'No second copy of the truth to go stale. If two numbers disagree, the events settle it.',
                ],
              ],
              [
                '02 · ZERO LATENCY, BY DESIGN',
                [
                  'A check is answered from the state on hand, not a round trip. The stream catches up behind it.',
                ],
              ],
              [
                '03 · BUILT FOR AGENTS, BY DEFAULT',
                [
                  'A customer holds its agents, each agent its actors. Usage rolls up, access rolls down.',
                ],
              ],
            ]}
          />
          <PageFoot w={400} h={566} page="8" />
        </>,
      )
    },
  ),

  // 02 Anatomy of an event: a frame diagram, as a protocol spec draws a packet. Fixed fields first, the open one last.
  page(
    'm-event',
    'Anatomy of an event',
    'An event drawn as a frame, the way a protocol specification draws a packet: a ruler, the fields in order, and the properties at the end. Chapter 1.',
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
      const rows: {
        y: number
        cells: { span: number; name: string; value?: string; open?: boolean }[]
      }[] = [
        { y: top, cells: [{ span: 32, name: 'ID', value: 'evt_01J…' }] },
        {
          y: top + rh,
          cells: [
            { span: 32, name: 'TIMESTAMP', value: '2026-10-01T09:41:00Z' },
          ],
        },
        {
          y: top + rh * 2,
          cells: [
            { span: 16, name: 'CUSTOMER', value: 'acme' },
            { span: 16, name: 'ACTOR', value: 'run_7f2' },
          ],
        },
        {
          y: top + rh * 3,
          cells: [{ span: 32, name: 'NAME', value: 'tokens.out' }],
        },
        {
          y: top + rh * 4,
          cells: [
            {
              span: 32,
              name: 'PROPERTIES',
              value: '{ tokens: 1204, model: "…" }',
              open: true,
            },
          ],
        },
      ]
      return sheet(
        960,
        540,
        'Anatomy of an event',
        <>
          <PageHead
            crumb="02 · EVENTS · ANATOMY OF AN EVENT"
            w={960}
            pad={40}
            title="Anatomy of an event"
            sub="Five fields. The last one holds the measurement."
          />
          <Figure x={40} y={156} w={620} h={300} dy={26} n="001">
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
                  fontSize={6}
                  fill={DIM}
                  textAnchor="middle"
                  style={MONO}
                >
                  {i}
                </text>
              ))}
              {/* the fields */}
              {rows.map((r, ri) => {
                let cx = x
                return r.cells.map((c, ci) => {
                  const cxx = cx
                  cx += c.span * cw
                  const last = ri === rows.length - 1
                  return (
                    <g key={`${ri}-${ci}`}>
                      <rect
                        x={cxx}
                        y={r.y}
                        width={c.span * cw}
                        height={rh}
                        fill={BG}
                        stroke={c.open ? DIM : last ? LINE : MID}
                        strokeWidth={HAIR}
                        {...(c.open ? DOTTED : {})}
                      />
                      <text
                        x={cxx + 8}
                        y={r.y + 11}
                        fontSize={6.5}
                        fill={c.open ? LINE : DIM}
                        style={MONO}
                      >
                        {c.name}
                      </text>
                      <text
                        x={cxx + 8}
                        y={r.y + 22}
                        fontSize={6.5}
                        fill={c.open ? LINE : MID}
                        style={{ ...MONO, letterSpacing: 0 }}
                      >
                        {c.value}
                      </text>
                    </g>
                  )
                })
              })}
              {/* the open field continues */}
              <line
                x1={x}
                x2={x + w}
                y1={top + rh * 5 + 10}
                y2={top + rh * 5 + 10}
                stroke={DIM}
                strokeWidth={HAIR}
                {...DOTTED}
              />
              <Callout
                at={[x + w, top + rh * 1.5]}
                to={[x + w + 24, top + rh * 1.5]}
              >
                ORDER
              </Callout>
              <Callout
                at={[x + w, top + rh * 4.5]}
                to={[x + w + 24, top + rh * 4.5]}
              >
                MEASUREMENT
              </Callout>
              <Callout
                at={[x, top + rh * 5 + 10]}
                to={[x, top + rh * 5 + 32]}
                route="v"
                dot={false}
              >
                ANY SHAPE, ANY LENGTH
              </Callout>
            </g>
          </Figure>
          <Body
            x={700}
            y={176}
            width={220}
            size={10}
            text={[
              'An event is a fact: at this time, this customer, through this actor, did this thing, this much. Its id and timestamp give it a place in the ledger; its properties carry the measurement, in any shape, and they are what the meters fold over.',
            ]}
          />
          <PageFoot w={960} h={540} pad={40} page="10" />
        </>,
      )
    },
  ),

  // 03 Anatomy of an invoice: a schematic sheet with callouts
  page(
    'm-invoice',
    'Anatomy of an invoice',
    'The invoice drawn as a schematic, every part named: the line, the rate, the credits, the sum, and where it all came from. Chapter 4.',
    400,
    566,
    1,
    () => {
      const x = 56,
        y = 140,
        w = 170,
        h = 240,
        R = x + w
      const rows = [0, 1, 2].map((i) => y + 46 + i * 28)
      return sheet(
        400,
        566,
        'Anatomy of an invoice',
        <>
          <PageHead
            crumb="05 · INVOICES · ANATOMY OF AN INVOICE"
            w={400}
            title="Anatomy of an invoice"
            sub="Usage in, invoice out. Every line is a sum over events."
          />
          <Figure x={28} y={132} w={344} h={300} dy={28} n="004">
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={BG}
              stroke={MID}
              strokeWidth={HAIR}
            />
            <rect x={x + 12} y={y + 12} width={44} height={8} fill={DIM} />
            <rect x={x + w - 48} y={y + 12} width={36} height={6} fill={DIM} />
            {rows.map((ry, i) => (
              <g key={i}>
                <line
                  x1={x + 12}
                  x2={x + w - 12}
                  y1={ry + 14}
                  y2={ry + 14}
                  stroke={RULE}
                  strokeWidth={HAIR}
                />
                <rect x={x + 12} y={ry - 2} width={46} height={5} fill={DIM} />
                <rect x={x + 74} y={ry - 2} width={36} height={5} fill={DIM} />
                <rect
                  x={x + w - 40}
                  y={ry - 2}
                  width={28}
                  height={5}
                  fill={DIM}
                />
              </g>
            ))}
            <rect
              x={x + w - 40}
              y={y + 128}
              width={28}
              height={5}
              fill={LINE}
            />
            <line
              x1={x + 12}
              x2={x + w - 12}
              y1={y + 150}
              y2={y + 150}
              stroke={LINE}
              strokeWidth={1.2}
            />
            <rect
              x={x + w - 70}
              y={y + 162}
              width={58}
              height={14}
              fill={BG}
              stroke={LINE}
              strokeWidth={HAIR}
            />
            <rect x={x + 12} y={y + 212} width={96} height={4} fill={DIM} />
            <Callout at={[x + 34, y + 16]} to={[x + 34, y - 18]} route="v">
              ISSUER · THE LOCKUP
            </Callout>
            <Callout at={[R, y + 15]} to={[R + 28, y + 15]}>
              NUMBER · 00042
            </Callout>
            <Callout at={[R, rows[0]]} to={[R + 28, rows[0]]}>
              LINE ITEM · A METER
            </Callout>
            <Callout at={[R, rows[1]]} to={[R + 28, rows[1]]}>
              QUANTITY × RATE
            </Callout>
            <Callout at={[R, y + 130]} to={[R + 28, y + 130]}>
              CREDITS APPLIED
            </Callout>
            <Callout at={[R, y + 169]} to={[R + 28, y + 169]}>
              TOTAL · USD
            </Callout>
            <Callout at={[R, y + 214]} to={[R + 28, y + 214]}>
              DERIVED FROM EVENTS
            </Callout>
          </Figure>
          <Body
            x={28}
            y={462}
            text={[
              'An invoice is not typed; it is computed. Each line is a meter read at the end of the period, multiplied by its rate. Credits come off before the sum. The footer names the events it was derived from, so any line can be traced back to the facts.',
            ]}
          />
          <PageFoot w={400} h={566} page="36" />
        </>,
      )
    },
  ),

  // 04 The credit balance: a vessel with a level
  page(
    'm-credits',
    'The credit balance',
    'The balance as a statement: a grant adds, every metered event takes away at its rate, and the running balance is read off the last line. Chapter 3.',
    960,
    540,
    2,
    () => {
      const { line, gutter, bar, dot, CW, LH } = term(52, 150)
      const T = (t: string, w?: number): TermTok => ({ t, tone: 'dim', w })
      const rows: [string, string, string, number, boolean?][] = [
        ['10-01', 'credit.granted', '+10,000', 10000],
        ['10-03', 'tokens.out  1,204 × 1', '-1,204', 8796],
        ['10-07', 'tokens.out    820 × 1', '-820', 7976],
        ['10-09', 'tokens.out    412 × 1', '-412', 7564],
        ['10-12', 'tokens.out    314 × 1', '-314', 7250, true],
      ]
      const X0 = 52,
        BX = X0 + 49 * CW,
        BW = 56
      return sheet(
        960,
        540,
        'The credit balance',
        <>
          <PageHead
            crumb="04 · CREDITS · THE CREDIT BALANCE"
            w={960}
            pad={40}
            title="The credit balance"
            sub="A grant fills it; every metered event drains it."
          />
          <Figure x={40} y={156} w={620} h={300} dy={26} n="003">
            <g transform="translate(150 0)">
              {line(
                0,
                0,
                [T('', 7), T('EVENT'), T('', 19), T('Δ', 9), T('BALANCE')],
                'h',
              )}
              {rows.map(([d, ev, delta, bal, last], i) => {
                const r = 2 + i * 2
                const y = 150 + r * LH
                return (
                  <g key={d}>
                    {i === 0 ? gutter(r) : null}
                    {line(
                      r,
                      0,
                      [
                        T(d, 7),
                        { t: ev, w: 24 },
                        { t: delta, w: 9, tone: i === 0 ? 'ink' : 'dim' },
                        {
                          t: bal.toLocaleString('en-US'),
                          tone: last ? 'inv' : 'ink',
                          w: 7,
                        },
                      ],
                      `r${i}`,
                    )}
                    <rect
                      x={BX}
                      y={y - 5}
                      width={(BW * bal) / 10000}
                      height={3}
                      fill={last ? LINE : MID}
                    />
                  </g>
                )
              })}
              {bar(4, 10, -2)}
              {dot(13, 24)}
              {dot(13, 27)}
              {line(
                15,
                0,
                [
                  T('10-31', 7),
                  { t: 'period.closed', w: 24, tone: 'dim' },
                  T('', 9),
                  { t: '7,250', tone: 'dim', w: 7 },
                  T('  carried'),
                ],
                'c',
              )}
            </g>
          </Figure>
          <Body
            x={700}
            y={176}
            width={220}
            size={10}
            text={[
              'Credits are a balance derived from two kinds of event: grants, which add, and usage, which takes away at the meter\u2019s rate. The balance is never stored; it is the last line of this statement, recomputed from the events above it.',
            ]}
          />
          <PageFoot w={960} h={540} pad={40} page="28" />
        </>,
      )
    },
  ),

  // 05 Entitlements: a switch panel. One state line from the subscription drives every switch.
  page(
    'm-gates',
    'How entitlements work',
    'A switch panel: the subscription’s state runs along one bus, and every entitlement is a switch on it. Active closes them; canceled opens them. Chapter 5.',
    400,
    566,
    1,
    () => {
      const bx = 92,
        by = 186,
        bw = 64,
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
        400,
        566,
        'How entitlements work',
        <>
          <PageHead
            crumb="06 · ENTITLEMENTS · HOW ENTITLEMENTS WORK"
            w={400}
            title="How entitlements work"
            sub="One state, every gate."
          />
          <Figure x={28} y={132} w={344} h={300} dy={28} n="005">
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
              fontSize={6.5}
              fill={DIM}
              textAnchor="middle"
              style={MONO}
            >
              SUBSCRIPTION
            </text>
            <text
              x={bx + bw / 2}
              y={by + 24}
              fontSize={6.5}
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
                    fontSize={6.5}
                    fill={on ? LINE : DIM}
                    style={MONO}
                  >
                    {name}
                  </text>
                  <text
                    x={sw + 118}
                    y={y + 2.5}
                    fontSize={6.5}
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
              at={[bus, ry(2) + 22]}
              to={[bus, ry(2) + 44]}
              route="v"
              dot={false}
            >
              ONE STATE LINE
            </Callout>
            <Callout
              at={[sw + 14, ry(0) - 4]}
              to={[sw + 14, ry(0) - 30]}
              route="v"
              dot={false}
            >
              GATE
            </Callout>
          </Figure>
          <Body
            x={28}
            y={462}
            text={[
              'An entitlement is a switch, and the subscription’s state is the line that drives it. When the state changes, every switch on the line moves at once. Active closes them; past due keeps them closed; canceled opens them. Each move is an event, so access has a history.',
            ]}
          />
          <PageFoot w={400} h={566} page="44" />
        </>,
      )
    },
  ),

  // 06 Local-first checks: a timeline. A check drops to the state and comes straight back; events step the state up.
  page(
    'm-latency',
    'Local-first checks',
    'A timeline: a check is answered from the state on hand in no time; the stream arrives behind it and steps the state up, so the next check is answered from a newer one. Chapter 2.',
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
      const check = (ms: number) => {
        const x = t(ms),
          y1 = stateAt(ms)
        return (
          <g key={ms}>
            <line
              x1={x}
              x2={x}
              y1={CHECK}
              y2={y1}
              stroke={LINE}
              strokeWidth={HAIR}
            />
            <path
              d={`M${x - 3} ${y1 - 5}l3 5l3 -5`}
              fill="none"
              stroke={LINE}
              strokeWidth={HAIR}
            />
            <path
              d={`M${x - 3} ${CHECK + 5}l3 -5l3 5`}
              fill="none"
              stroke={LINE}
              strokeWidth={HAIR}
            />
            <circle cx={x} cy={CHECK} r={2.4} fill={LINE} />
          </g>
        )
      }
      return sheet(
        960,
        540,
        'Local-first checks',
        <>
          <PageHead
            crumb="03 · METERS · LOCAL-FIRST CHECKS"
            w={960}
            pad={40}
            title="Local-first checks"
            sub="Answered from the state on hand, in no time. The stream catches up behind it."
          />
          <Figure x={40} y={156} w={620} h={300} dy={26} n="006">
            {[
              ['CHECK', CHECK],
              ['STATE', STATE - step * 1.5],
              ['STREAM', STREAM],
            ].map(([lane, y]) => (
              <text
                key={lane}
                x={x0 - 12}
                y={Number(y) + 2.5}
                fontSize={7.5}
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
                  fontSize={7}
                  fill={DIM}
                  style={MONO}
                >
                  v{i + 1}
                </text>
              </g>
            ))}
            <text
              x={x0 + 14}
              y={STATE - 4}
              fontSize={7}
              fill={DIM}
              style={MONO}
            >
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
                  fontSize={7}
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
            <Callout at={[t(0), CHECK]} to={[t(0), CHECK - 32]} route="v">
              CHECK · ANSWERED FROM v0 · 0 ms
            </Callout>
            <Callout
              at={[t(400), CHECK]}
              to={[t(400), CHECK - 32]}
              route="v"
              side="left"
            >
              CHECK · ANSWERED FROM v3 · 0 ms
            </Callout>
            <Callout
              at={[t(240), STREAM]}
              to={[t(240), STREAM + 18]}
              route="v"
              dot={false}
            >
              EVENTS ARRIVE · EACH ONE FOLDED IN
            </Callout>
          </Figure>
          <Body
            x={700}
            y={176}
            width={220}
            size={10}
            text={[
              'A check, "may this customer call the API?", never waits for the network. It is answered from the state already on hand, which is the fold of every event seen so far. That takes no time at all.',
              'The stream keeps arriving. Each new event is folded in as it lands, so the next check is answered from a newer state. Latency moves out of the request and into the stream, where it is cheap.',
            ]}
          />
          <PageFoot w={960} h={540} pad={40} page="20" />
        </>,
      )
    },
  ),

  // 07 The ledger: one strip of numbered rows. The past is set, the head is now, the lines below are still empty.
  page(
    'm-ledger',
    'The ledger',
    'The ledger as a strip: numbered rows from the first event down, the head in ink, and empty ruled lines beneath it for what comes next. Chapter 1.',
    400,
    566,
    1,
    () => {
      const x = 96,
        w = 160,
        top = 160,
        rh = 16
      const past = 9,
        future = 4
      const rowY = (i: number) => top + i * rh
      const head = rowY(past)
      return sheet(
        400,
        566,
        'The ledger',
        <>
          <PageHead
            crumb="02 · EVENTS · THE LEDGER"
            w={400}
            title="The ledger"
            sub="Append only. Every event in order, none of them ever changed."
          />
          <Figure x={28} y={132} w={344} h={300} dy={28} n="001b">
            {Array.from({ length: past }, (_, i) => (
              <g key={i}>
                <text
                  x={x - 8}
                  y={rowY(i) + 3}
                  fontSize={6.5}
                  fill={DIM}
                  textAnchor="end"
                  style={MONO}
                >
                  {String(i + 1).padStart(4, '0')}
                </text>
                <rect
                  x={x}
                  y={rowY(i) - 2}
                  width={22 + (i % 3) * 10}
                  height={4}
                  fill={MID}
                />
                <rect
                  x={x + w - 44}
                  y={rowY(i) - 2}
                  width={34}
                  height={4}
                  fill={MID}
                />
                <line
                  x1={x}
                  x2={x + w}
                  y1={rowY(i) + 8}
                  y2={rowY(i) + 8}
                  stroke={RULE}
                  strokeWidth={HAIR}
                />
              </g>
            ))}
            <text
              x={x - 8}
              y={head + 3}
              fontSize={6.5}
              fill={LINE}
              textAnchor="end"
              style={MONO}
            >
              {String(past + 1).padStart(4, '0')}
            </text>
            <rect x={x} y={head - 2} width={42} height={4} fill={LINE} />
            <rect
              x={x + w - 44}
              y={head - 2}
              width={34}
              height={4}
              fill={LINE}
            />
            <line
              x1={x}
              x2={x + w}
              y1={head + 8}
              y2={head + 8}
              stroke={LINE}
              strokeWidth={HAIR}
            />
            {Array.from({ length: future }, (_, i) => (
              <line
                key={i}
                x1={x}
                x2={x + w}
                y1={rowY(past + 1 + i) + 8}
                y2={rowY(past + 1 + i) + 8}
                stroke={RULE}
                strokeWidth={HAIR}
                {...DOTTED}
              />
            ))}
            <Callout at={[x + w, rowY(0)]} to={[x + w + 28, rowY(0)]}>
              FIRST EVENT
            </Callout>
            <Callout at={[x + w, rowY(4)]} to={[x + w + 28, rowY(4)]}>
              SET · NEVER CHANGED
            </Callout>
            <Callout at={[x + w, head]} to={[x + w + 28, head]}>
              HEAD · NOW
            </Callout>
            <Callout
              at={[x + w, rowY(past + 2) + 8]}
              to={[x + w + 28, rowY(past + 2) + 8]}
              dot={false}
            >
              APPENDED HERE
            </Callout>
          </Figure>
          <Body
            x={28}
            y={462}
            text={[
              'The ledger only grows. New events are written at the head, in the order they happened, and every row above the head is set. Any number in Polar is a position on this strip: run the fold down to that row and you have it.',
            ]}
          />
          <PageFoot w={400} h={566} page="12" />
        </>,
      )
    },
  ),

  // 08 Customers, agents and actors: nested boxes
  page(
    'm-nesting',
    'Customers, agents, actors',
    'A tree: the customer at the root, its agents beneath, the actors beneath those. Usage is counted at the leaves and summed upward; access is set at the root and inherited. Chapter 6.',
    400,
    566,
    1,
    () => {
      const cx = 200
      const L0 = 160,
        L1 = 232,
        L2 = 304
      const agents = [cx - 70, cx + 70]
      const actors = (ax: number) => [ax - 30, ax, ax + 30]
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
            fontSize={6.5}
            fill={tone === 'ink' ? LINE : DIM}
            textAnchor="middle"
            style={MONO}
          >
            {label}
          </text>
        </g>
      )
      return sheet(
        400,
        566,
        'Customers, agents, actors',
        <>
          <PageHead
            crumb="07 · AGENTS · CUSTOMERS, AGENTS, ACTORS"
            w={400}
            title="Customers, agents, actors"
            sub="Usage rolls up; access rolls down."
          />
          <Figure x={28} y={132} w={344} h={300} dy={28} n="008">
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
            {node(cx, L0, 'CUSTOMER · acme', 'ink', 92)}
            {node(agents[0], L1, 'AGENT', 'mid')}
            {node(agents[1], L1, 'AGENT', 'mid')}
            {agents.flatMap((ax, i) =>
              actors(ax).map((tx, j) =>
                node(tx, L2, 'actor', i === 0 && j === 1 ? 'ink' : 'mid', 26),
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
              fontSize={6.5}
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
              fontSize={6.5}
              fill={DIM}
              textAnchor="middle"
              style={MONO}
            >
              ACCESS ROLLS DOWN
            </text>
            <Callout
              at={[actors(agents[0])[1], L2 + 9]}
              to={[actors(agents[0])[1], L2 + 34]}
              route="v"
              dot={false}
            >
              A RUN, A SESSION, A KEY
            </Callout>
          </Figure>
          <Body
            x={28}
            y={462}
            text={[
              'A customer holds its agents, and each agent its actors: a run, a session, a key. Every event names its actor, so usage is counted at the leaves and summed upward, while entitlements are set at the root and inherited all the way down.',
            ]}
          />
          <PageFoot w={400} h={566} page="52" />
        </>,
      )
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
        ['Preface', [['The principle', '2']]],
        [
          'Billing as code',
          [
            ['The config', '4'],
            ['Review and apply', '6'],
            ['Environments', '8'],
          ],
        ],
        [
          'Events',
          [
            ['Anatomy of an event', '10'],
            ['The ledger', '12'],
            ['Ingestion and ordering', '14'],
            ['Replay', '16'],
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
            ['Crossing zero', '32'],
          ],
        ],
        [
          'Invoices',
          [
            ['Anatomy of an invoice', '36'],
            ['Usage in, invoice out', '38'],
            ['Proration', '40'],
          ],
        ],
        [
          'Entitlements',
          [
            ['How entitlements work', '44'],
            ['From checkout to access', '46'],
            ['Benefits', '48'],
          ],
        ],
        [
          'Agents',
          [
            ['Customers, agents, actors', '52'],
            ['Keys and sessions', '54'],
            ['Just ask', '56'],
          ],
        ],
        [
          'Appendix',
          [
            ['The event catalogue', '60'],
            ['The API, one call', '64'],
            ['Glossary', '68'],
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
            <text x={x} y={yy} fontSize={14} fill={DIM} style={TITLE}>
              {k === 0 ? '—' : String(k).padStart(2, '0')}
            </text>
            <text
              x={x + 24}
              y={yy}
              fontSize={14}
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
                fontSize={8.5}
                fill={NIGHT_INK.ink}
                style={TEXT}
              >
                {title}
              </text>
              <text
                x={right}
                y={yy}
                fontSize={7.5}
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
      return sheet(
        400,
        566,
        'Table of contents',
        <>
          <PageHead
            crumb="CONTENTS"
            title="Contents"
            sub="A preface, seven chapters and an appendix."
          />
          {rows}
          <PageFoot w={400} h={566} page="1" />
        </>,
      )
    },
  ),

  // 10 From checkout to access: a flow
  page(
    'm-flow',
    'From checkout to access',
    'The checkout form, drawn as a schematic: what it shows, what it asks for, and the event each part of it writes. Pay once and four facts land on the ledger. Chapter 5.',
    400,
    566,
    1,
    () => {
      const x = 60,
        y = 118,
        w = 176,
        h = 236,
        R = x + w
      const field = (
        fy: number,
        label: string,
        value: string,
        tone: 'mid' | 'ink' = 'mid',
      ) => (
        <g key={label}>
          <text x={x + 14} y={fy - 4} fontSize={5.5} fill={DIM} style={MONO}>
            {label}
          </text>
          <rect
            x={x + 14}
            y={fy}
            width={w - 28}
            height={16}
            fill={BG}
            stroke={tone === 'ink' ? LINE : MID}
            strokeWidth={HAIR}
          />
          <text
            x={x + 20}
            y={fy + 10.5}
            fontSize={6}
            fill={tone === 'ink' ? LINE : DIM}
            style={{ ...MONO, letterSpacing: 0 }}
          >
            {value}
          </text>
        </g>
      )
      return sheet(
        400,
        566,
        'From checkout to access',
        <>
          <PageHead
            crumb="06 · ENTITLEMENTS · FROM CHECKOUT TO ACCESS"
            w={400}
            title="From checkout to access"
            sub="One form. Four events. Then the gates open."
          />
          <Figure x={28} y={132} w={344} h={300} dy={28} n="007">
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={BG}
              stroke={MID}
              strokeWidth={HAIR}
            />
            <rect x={x + 14} y={y + 12} width={28} height={6} fill={DIM} />
            <text x={x + 14} y={y + 38} fontSize={9} fill={LINE} style={TITLE}>
              Pro
            </text>
            <text
              x={R - 14}
              y={y + 38}
              fontSize={7}
              fill={LINE}
              textAnchor="end"
              style={MONO}
            >
              $ 20 / mo
            </text>
            <line
              x1={x + 14}
              x2={R - 14}
              y1={y + 48}
              y2={y + 48}
              stroke={RULE}
              strokeWidth={HAIR}
            />
            {field(y + 70, 'EMAIL', 'ada@acme.com')}
            {field(y + 108, 'CARD', '•••• •••• •••• 4242')}
            {field(y + 146, 'COUNTRY', 'SE')}
            <rect
              x={x + 14}
              y={y + 184}
              width={w - 28}
              height={20}
              fill={LINE}
            />
            <text
              x={x + w / 2}
              y={y + 197}
              fontSize={7}
              fill={BG}
              textAnchor="middle"
              style={MONO}
            >
              PAY $ 20
            </text>
            <text
              x={x + w / 2}
              y={y + 222}
              fontSize={5.5}
              fill={DIM}
              textAnchor="middle"
              style={MONO}
            >
              SECURED BY POLAR
            </text>
            <Callout at={[R, y + 15]} to={[R + 28, y + 15]}>
              checkout.created
            </Callout>
            <Callout at={[R, y + 35]} to={[R + 28, y + 35]}>
              PRODUCT · pro
            </Callout>
            <Callout at={[R, y + 78]} to={[R + 28, y + 78]}>
              CUSTOMER · acme
            </Callout>
            <Callout at={[R, y + 194]} to={[R + 28, y + 194]}>
              order.paid
            </Callout>
            <line
              x1={R + 14}
              x2={R + 14}
              y1={y + 194}
              y2={y + 254}
              stroke={DIM}
              strokeWidth={HAIR}
              {...DOTTED}
            />
            {[
              'subscription.active',
              'benefit.granted',
              'entitlement.granted',
            ].map((ev, i) => (
              <g key={ev}>
                <line
                  x1={R + 14}
                  x2={R + 28}
                  y1={y + 214 + i * 20}
                  y2={y + 214 + i * 20}
                  stroke={DIM}
                  strokeWidth={HAIR}
                />
                <text
                  x={R + 33}
                  y={y + 216.5 + i * 20}
                  fontSize={7.5}
                  fill={DIM}
                  style={MONO}
                >
                  {ev}
                </text>
              </g>
            ))}
          </Figure>
          <Body
            x={28}
            y={462}
            text={[
              'The form is the only thing the customer sees. Opening it writes an event; paying writes another, and three more follow without anyone typing: the subscription, its benefits, and the entitlements that open the gates. Each is a fold over the one before, and each can be traced.',
            ]}
          />
          <PageFoot w={400} h={566} page="46" />
        </>,
      )
    },
  ),
]
