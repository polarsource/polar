/**
 * Money is an exact integer count of **micro-cents** (µ¢).
 *
 *   1 cent   = 1_000_000 µ¢
 *   1 dollar = 100_000_000 µ¢
 *
 * Why micro-cents: usage prices are often tiny fractions of a cent
 * (e.g. $0.0000002 / token). Six decimal places below a cent keeps
 * per-unit math exact with zero floating-point error. We only round to
 * whole cents once, explicitly, at invoice finalization.
 *
 * THE ONE RULE: a `number` must never represent a monetary value.
 * The brand makes the compiler enforce it.
 */
export type Money = bigint & { readonly __brand: "Money" };

export const MICROS_PER_CENT = 1_000_000n;
export const MICROS_PER_DOLLAR = 100n * MICROS_PER_CENT;

const m = (n: bigint): Money => n as Money;

/** Construct from whole dollars. `dollars(5)` → $5.00 */
export const dollars = (n: bigint | number): Money => m(BigInt(n) * MICROS_PER_DOLLAR);
/** Construct from whole cents. `cents(500)` → $5.00 */
export const cents = (n: bigint | number): Money => m(BigInt(n) * MICROS_PER_CENT);
/** Construct from raw micro-cents — the base unit. `micros(200n)` → $0.000002 */
export const micros = (n: bigint | number): Money => m(BigInt(n));

export const zero: Money = m(0n);

export const add = (a: Money, b: Money): Money => m(a + b);
export const mul = (a: Money, q: bigint): Money => m(a * q);

/**
 * Round to whole cents, half-up, deterministically. Returns the integer
 * count of cents. This is the *only* place rounding happens.
 */
export const toCents = (a: Money): bigint => {
  const half = MICROS_PER_CENT / 2n;
  return a >= 0n
    ? (a + half) / MICROS_PER_CENT
    : -((-a + half) / MICROS_PER_CENT);
};

/** Human-readable, for display/debug only — never feed this back into math. */
export const format = (a: Money, currency = "USD"): string => {
  const totalCents = toCents(a);
  const sign = totalCents < 0n ? "-" : "";
  const abs = totalCents < 0n ? -totalCents : totalCents;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${sign}${currency} ${whole}.${frac}`;
};
