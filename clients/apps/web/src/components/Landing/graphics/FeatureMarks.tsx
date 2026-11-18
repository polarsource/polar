import { POSTERS } from '@/components/FieldGuide/posters'
import type { ReactNode } from 'react'

/**
 * Feature marks: one small drawing per feature, for the feature carousel, in the field guide's hand: a few hairlines
 * on a 120 square, Snow for the subject, Mist behind it, and dotted guides.
 */

/* ---------- Drawings borrowed from the field guide's contents, where a chapter says the feature best ---------- */

/** A drawing on the field guide's 120 square, cropped a little so it sits at the size of the marks above. */
const poster = (drawing: ReactNode, label: string) => {
  const Poster = () => (
    <svg
      viewBox="4 4 112 112"
      role="img"
      aria-label={label}
      fill="none"
      strokeWidth={1}
      className="h-full w-full [&_*]:[vector-effect:non-scaling-stroke]"
    >
      {drawing}
    </svg>
  )
  return Poster
}

const guide = (name: string, label: string) => poster(POSTERS[name], label)

/** Usage billing is the Meters poster: the stream folded into one reading. */
export const UsageMark = guide(
  'Meters',
  'Many event streams folding into one meter',
)
/** Credits is the field guide's own: a balance drawn down and lifted by a grant. */
export const CreditsMark = guide(
  'Credits',
  'A balance drawn down by usage and lifted by a grant',
)
/** Seats is the Identities poster: an organization, its teams, and their members. */
export const SeatsMark = guide(
  'Identities',
  'An organization with two teams of three members each',
)

/** Benefits is the Entitlements poster: what a purchase unlocks, gated on what was bought. */
export const BenefitsMark = guide(
  'Entitlements',
  'Access gates opening for what a customer has bought',
)

/* ---------- Drawn in the field guide's hand, for the features it has no chapter for ---------- */

/** The field guide's inks: Snow for the subject, Mist behind it, and the faintest for guides. */
const SNOW = '#d8d8d8'
const MIST = '#7b7b7b'
const FOG = '#4a4a4a'
/** The page behind the drawing, for circles that knock out the line they sit on. */
const GROUND = 'var(--color-polar-950)'
const DOTS = { strokeDasharray: '0.1 3', strokeLinecap: 'round' } as const

/**
 * A trial: the free days dotted along the line under a bracket, a switch where it converts, and from there the paid
 * line, solid, with an invoice at each renewal.
 */
const START = 22
const CONVERT = 56

const trial = (
  <>
    <line x1={START} y1={60} x2={CONVERT} y2={60} stroke={MIST} {...DOTS} />
    <path d={`M${START} 50V46H${CONVERT}V50`} stroke={MIST} />
    <line x1={CONVERT} y1={64} x2={CONVERT} y2={80} stroke={FOG} {...DOTS} />
    <line x1={CONVERT} y1={60} x2={98} y2={60} stroke={SNOW} />
    {[72, 85, 98].map((x) => (
      <rect key={x} x={x - 3} y={57} width={6} height={6} fill={SNOW} />
    ))}
    <circle cx={START} cy={60} r={2.5} stroke={MIST} fill={GROUND} />
    <circle cx={CONVERT} cy={60} r={3} stroke={SNOW} fill={GROUND} />
  </>
)

/**
 * Cost insights: revenue in Snow over cost in Mist, and at one point the margin between them read off, dotted, from
 * one line down to the other.
 */
const READ = 68

const cost = (
  <>
    <line x1={20} y1={90} x2={100} y2={90} stroke={FOG} {...DOTS} />
    <path d="M20 74L44 66L68 50L100 38" stroke={SNOW} />
    <path d="M20 84L44 80L68 74L100 68" stroke={MIST} />
    <line x1={READ} y1={54} x2={READ} y2={70} stroke={FOG} {...DOTS} />
    <circle cx={READ} cy={50} r={3} stroke={SNOW} fill={GROUND} />
    <circle cx={READ} cy={74} r={2.5} stroke={MIST} fill={GROUND} />
  </>
)

export const CostMark = poster(
  cost,
  'Revenue over cost, with the margin between them read at one point',
)

/**
 * Subscriptions: one cycle, drawn round with its arrow, and a renewal at each quarter, the one at the top where it
 * starts over in Snow.
 */
const subscription = (
  <>
    <path d="M66.62 36.93A24 24 0 1 1 53.38 36.93" stroke={SNOW} />
    <path d="M48.71 35.15L53.38 36.93L50.36 40.92" stroke={SNOW} />
    {[
      [84, 60],
      [60, 84],
      [36, 60],
    ].map(([x, y]) => (
      <circle
        key={x * 1000 + y}
        cx={x}
        cy={y}
        r={2.5}
        stroke={MIST}
        fill={GROUND}
      />
    ))}
    <circle cx={60} cy={36} r={3} stroke={SNOW} fill={GROUND} />
  </>
)

export const SubscriptionsMark = poster(
  subscription,
  'One subscription cycle with a renewal at each quarter',
)

/**
 * Merchant of record: the world as a wireframe globe, a sale marked in three of its countries, and the one Polar is
 * filing tax for right now drawn solid.
 */
const merchant = (
  <>
    {[45, 75].map((y) => (
      <line
        key={y}
        x1={34.02}
        y1={y}
        x2={85.98}
        y2={y}
        stroke={FOG}
        {...DOTS}
      />
    ))}
    <line x1={60} y1={30} x2={60} y2={90} stroke={FOG} {...DOTS} />
    <line x1={30} y1={60} x2={90} y2={60} stroke={MIST} />
    <ellipse cx={60} cy={60} rx={13} ry={30} stroke={MIST} />
    <circle cx={60} cy={60} r={30} stroke={SNOW} />
    <circle cx={73} cy={60} r={2.5} stroke={MIST} fill={GROUND} />
    <circle cx={48.74} cy={75} r={2.5} stroke={MIST} fill={GROUND} />
    <circle cx={71.26} cy={45} r={2.5} stroke={SNOW} fill={SNOW} />
  </>
)

export const MerchantMark = poster(
  merchant,
  'A wireframe globe with sales marked in three countries, one filled in where tax is being filed',
)

export const TrialsMark = poster(
  trial,
  'A trial period converting to a paid plan with renewals',
)

/**
 * Discounts, as a dimension drawing: the full price measured end to end above, the price paid measured below it and
 * cut short, the part taken off carried on dotted to where the full price ends.
 */
const L = 26
const R = 94
const CUT = 70
const FULL = 46
const PAID = 74

const discount = (
  <>
    <path
      d={`M${L} ${FULL}H${R}M${L} ${FULL - 4}v8M${R} ${FULL - 4}v8`}
      stroke={SNOW}
    />
    <path d={`M${L} ${PAID}H${CUT}M${L} ${PAID - 4}v8`} stroke={SNOW} />
    <line x1={CUT} y1={PAID} x2={R} y2={PAID} stroke={MIST} {...DOTS} />
    <path d={`M${R} ${PAID - 4}v8`} stroke={MIST} />
    {[L, R].map((x) => (
      <line
        key={x}
        x1={x}
        y1={FULL + 6}
        x2={x}
        y2={PAID - 6}
        stroke={FOG}
        {...DOTS}
      />
    ))}
    <line
      x1={CUT}
      y1={FULL + 6}
      x2={CUT}
      y2={PAID - 4}
      stroke={FOG}
      {...DOTS}
    />
    <circle cx={CUT} cy={PAID} r={3} stroke={SNOW} fill={GROUND} />
  </>
)

export const DiscountsMark = poster(
  discount,
  'The full price measured above, and the discounted price measured short below it',
)

/**
 * Finance: a sale coming in, the fee splitting off it in Mist where everyone can see it, and the rest running on to
 * the payout, filled, at the end.
 */
const SPLIT = 50

const finance = (
  <>
    <line x1={22} y1={60} x2={98} y2={60} stroke={SNOW} />
    <path
      d={`M${SPLIT} 60C${SPLIT + 14} 60 ${SPLIT + 10} 82 ${SPLIT + 26} 82H82`}
      stroke={MIST}
    />
    <circle cx={22} cy={60} r={2.5} stroke={SNOW} fill={GROUND} />
    <circle cx={SPLIT} cy={60} r={3} stroke={SNOW} fill={GROUND} />
    <circle cx={82} cy={82} r={2} stroke={MIST} fill={GROUND} />
    <rect x={95} y={57} width={6} height={6} fill={SNOW} />
  </>
)

export const FinanceMark = poster(
  finance,
  'A sale with its fee splitting off, and the rest running on to a payout',
)
