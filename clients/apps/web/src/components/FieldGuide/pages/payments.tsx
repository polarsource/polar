import { MONO } from '../sheet'
import {
  LINE,
  MID,
  DIM,
  BG,
  HAIR,
  DOTTED,
  Anchor,
  Callout,
  Dimension,
  Guide,
} from '../kit'
import { landscape } from './more'

/**
 * Bring your own payment processor, as one charge: Polar works out the amount on the invoice, and the processor you
 * already use takes the payment. Other processors stand stacked behind it, since any of them can take its place.
 */
const Y = 150,
  SH_W = 150,
  SH_H = 96
const INV_X = 60,
  PSP_X = 290
const ROW = (n: number) => Y + 40 + n * 14
const INVOICE: [string, string][] = [
  ['pro plan', '$20.00'],
  ['tokens · 2.5M', '$6.50'],
]
const CHARGE: [string, string][] = [
  ['amount', '$26.50'],
  ['card', '•••• 4242'],
  ['status', 'succeeded'],
]

const text = (
  x: number,
  y: number,
  t: string,
  fill = DIM,
  anchor: 'start' | 'middle' | 'end' = 'middle',
) => (
  <text
    x={x}
    y={y}
    fontSize={7.5}
    fill={fill}
    textAnchor={anchor}
    style={{ ...MONO, letterSpacing: 0 }}
  >
    {t}
  </text>
)

const box = (x: number, stroke = LINE, dotted = false) => (
  <rect
    x={x}
    y={Y}
    width={SH_W}
    height={SH_H}
    fill={BG}
    stroke={stroke}
    strokeWidth={HAIR}
    {...(dotted ? DOTTED : {})}
  />
)

const rule = (x: number, y: number) => (
  <line
    x1={x + 12}
    x2={x + SH_W - 12}
    y1={y}
    y2={y}
    stroke={MID}
    strokeWidth={HAIR}
  />
)

const rows = (x: number, items: [string, string][]) =>
  items.map(([k, v], i) => (
    <g key={k}>
      {text(x + 12, ROW(i), k, DIM, 'start')}
      {text(x + SH_W - 12, ROW(i), v, LINE, 'end')}
    </g>
  ))

const ARROW_Y = Y + SH_H / 2

const figure = (
  <>
    {text(INV_X, Y - 12, 'POLAR · THE AMOUNT', DIM, 'start')}
    {box(INV_X)}
    {text(INV_X + 12, Y + 16, 'INVOICE · acme', LINE, 'start')}
    {rule(INV_X, Y + 24)}
    {rows(INV_X, INVOICE)}
    {rule(INV_X, ROW(1) + 10)}
    {text(INV_X + 12, ROW(2) + 12, 'total', DIM, 'start')}
    {text(INV_X + SH_W - 12, ROW(2) + 12, '$26.50', LINE, 'end')}

    {/* the processors that could take its place, stacked behind it */}
    {[12, 6].map((d) => (
      <g key={d} transform={`translate(${d} ${d})`}>
        {box(PSP_X, MID, true)}
      </g>
    ))}
    {box(PSP_X)}
    {text(PSP_X + 12, Y + 16, 'STRIPE · charge', LINE, 'start')}
    {rule(PSP_X, Y + 24)}
    {rows(PSP_X, CHARGE)}
    {text(PSP_X, Y - 12, 'YOUR PROCESSOR · THE PAYMENT', DIM, 'start')}

    <line
      x1={INV_X + SH_W}
      x2={PSP_X - 4}
      y1={ARROW_Y}
      y2={ARROW_Y}
      stroke={LINE}
      strokeWidth={HAIR}
    />
    <path
      d={`M${PSP_X - 8} ${ARROW_Y - 3}L${PSP_X} ${ARROW_Y}L${PSP_X - 8} ${ARROW_Y + 3}Z`}
      fill={LINE}
    />
    <Anchor at={[INV_X + SH_W, ARROW_Y]} />
    {text((INV_X + SH_W + PSP_X) / 2, ARROW_Y - 8, '$26.50', LINE)}

    <Callout
      at={[PSP_X + 12 + SH_W / 2, Y + SH_H + 12]}
      to={[PSP_X + 12 + SH_W / 2, Y + SH_H + 36]}
      route="v"
      dot={false}
    >
      OR ADYEN, OR YOUR OWN
    </Callout>
  </>
)

/**
 * Polar Billing, as one payment: a customer in Berlin pays €23.80, Polar splits it into the price and the VAT on it,
 * files the VAT in Germany and pays the price out to you. Polar's fee comes off the payout and is left out of the
 * figures, since it depends on the plan.
 */
const PAY_X0 = 80,
  PAY_X1 = 390
const TOTAL = 23.8
const xAt = (amount: number) => PAY_X0 + (amount / TOTAL) * (PAY_X1 - PAY_X0)
const BAR_Y = 168,
  BAR_H = 22,
  OUT_Y = 236
const SPLIT: [number, number, string, string, string][] = [
  [0, 20, '€20.00', 'PAYOUT', 'to your bank'],
  [20, TOTAL, '€3.80', 'VAT · 19%', 'filed in Germany'],
]

const morFigure = (
  <>
    {text(PAY_X0, BAR_Y - 44, 'customer · Berlin', DIM, 'start')}
    {text(PAY_X1, BAR_Y - 44, 'pays €23.80', LINE, 'end')}
    {SPLIT.map(([a, b, inside, out, to]) => {
      const mid = (xAt(a) + xAt(b)) / 2
      return (
        <g key={out}>
          <rect
            x={xAt(a)}
            y={BAR_Y}
            width={xAt(b) - xAt(a)}
            height={BAR_H}
            fill={BG}
            stroke={LINE}
            strokeWidth={HAIR}
          />
          {text(mid, BAR_Y + 14, inside, LINE)}
          <Guide a={[mid, BAR_Y + BAR_H + 4]} b={[mid, OUT_Y - 6]} />
          <Anchor at={[mid, OUT_Y]} />
          {text(mid, OUT_Y + 16, out)}
          {text(mid, OUT_Y + 28, to, LINE)}
        </g>
      )
    })}
    <Dimension
      a={[PAY_X0, BAR_Y - 10]}
      b={[PAY_X1, BAR_Y - 10]}
      text="POLAR · MERCHANT OF RECORD"
      side={-8}
    />
  </>
)

export const polarBilling = landscape(
  'm-mor',
  'Polar Billing',
  'Billing, payments and tax in one, with Polar as your merchant of record.',
  'One payment through Polar as merchant of record: a customer in Berlin pays €23.80, Polar files the €3.80 of VAT in Germany and pays the €20.00 price out to you, less its fee, and handles the invoice, receipt, disputes and fraud screening.',
  morFigure,
  [
    [
      'One integration',
      [
        'Checkout, subscriptions, usage and payments come from the same place, with nothing to wire between a billing system and a payment processor.',
      ],
    ],
    [
      'Merchant of record',
      [
        'Polar is the seller on every transaction, so sales tax and VAT are calculated, collected and filed for you, wherever your customers are.',
      ],
    ],
    [
      'Less to run',
      [
        'Disputes, refunds, fraud screening and receipts are handled for you. You get paid out to your bank account.',
      ],
    ],
  ],
)

export const psp = landscape(
  'm-psp',
  'Bring your own PSP',
  'Polar runs the billing. Payments go through the processor you choose.',
  'One charge: Polar’s invoice for acme, a $20 plan and $6.50 of tokens, totals $26.50, and that amount is charged through Stripe, with Adyen or your own processor stacked behind it as the alternatives.',
  figure,
  [
    [
      'Your processor',
      [
        'Keep the payment processor you already have, Stripe, Adyen and others, along with the contracts and rates that come with it. Polar charges through it.',
      ],
    ],
    [
      'Same billing',
      [
        'Meters, prices, credits and entitlements work the same whichever processor takes the payment. Switching processors does not touch your pricing.',
      ],
    ],
    [
      'You are the merchant',
      [
        'With your own processor, the sale is yours: sales tax, disputes and compliance stay with you, as they do today.',
      ],
    ],
  ],
)
