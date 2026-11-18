'use client'

import { useEffect, useState } from 'react'

interface Buyer {
  name: string
  where: string
  what: string
  rate: string
  /** In cents, on a $20.00 price. */
  tax: number
  filed: string
}

/** One $20 product, bought from four places. */
const BUYERS: Buyer[] = [
  {
    name: 'A consumer in Berlin',
    where: 'DE',
    what: 'German VAT at 19%, filed through the EU One Stop Shop.',
    rate: 'VAT 19%',
    tax: 380,
    filed: 'EU OSS · IRELAND',
  },
  {
    name: 'A business in Paris',
    where: 'FR',
    what: 'A valid VAT ID, so no VAT is charged: the business accounts for it under reverse charge.',
    rate: 'REVERSE CHARGE',
    tax: 0,
    filed: 'NONE · B2B',
  },
  {
    name: 'A consumer in London',
    where: 'GB',
    what: 'UK VAT at 20%, filed with HMRC.',
    rate: 'VAT 20%',
    tax: 400,
    filed: 'HMRC · UK',
  },
  {
    name: 'A consumer in New York',
    where: 'US-NY',
    what: 'State and city sales tax, 8.875% together, filed with New York State.',
    rate: 'SALES TAX 8.875%',
    tax: 178,
    filed: 'NEW YORK STATE',
  },
]

const PRICE = 2000
const HOLD = 5000
const money = (c: number) => `$${(c / 100).toFixed(2)}`

/**
 * The same price bought from four places, as a list beside the checkout's sum. It steps through them on a timer,
 * a hairline filling along the current one; picking one shows it and starts the timer again from there.
 */
export function Checkout() {
  const [active, setActive] = useState(0)
  const [run, setRun] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setTimeout(
      () => setActive((k) => (k + 1) % BUYERS.length),
      HOLD,
    )
    return () => window.clearTimeout(t)
  }, [active, run])
  const b = BUYERS[active]
  const total = PRICE + b.tax
  // the bar is set against the dearest total, so the tax reads as its share of it
  const most = PRICE + Math.max(...BUYERS.map((x) => x.tax))
  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
      <style>{`@keyframes mor-hold { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>
      <ol className="flex flex-col lg:col-span-4">
        {BUYERS.map((x, k) => {
          const on = k === active
          return (
            <li key={x.name}>
              <button
                type="button"
                onClick={() => {
                  setActive(k)
                  setRun((n) => n + 1)
                }}
                aria-pressed={on}
                className={`dark:border-polar-800 relative flex w-full flex-col gap-2 border-t border-gray-200 py-5 text-left transition-colors ${on ? '' : 'dark:text-polar-500 text-gray-500 hover:text-current'}`}
              >
                {on ? (
                  <span
                    key={`${active}-${run}`}
                    aria-hidden
                    className="absolute inset-x-0 -top-px h-px origin-left bg-[#6b79ea] motion-reduce:hidden"
                    style={{ animation: `mor-hold ${HOLD}ms linear forwards` }}
                  />
                ) : null}
                <span className="flex items-baseline gap-4">
                  <span className="dark:text-polar-500 w-6 shrink-0 text-sm text-gray-500 tabular-nums">
                    {String(k + 1).padStart(2, '0')}
                  </span>
                  <span className="text-lg">{x.name}</span>
                </span>
                {on ? (
                  <span className="dark:text-polar-400 pl-10 text-base text-gray-600">
                    {x.what}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ol>
      <div className="lg:col-span-8 lg:self-center">
        <figure className="flex flex-col gap-10 rounded-md bg-[#111111] p-8 font-mono text-sm text-[#f3f3f1] tabular-nums md:p-12">
          <div className="flex items-baseline justify-between text-[#a1a19f]">
            <span>{`checkout · ${b.where}`}</span>
            <span>{`${money(total)} TOTAL`}</span>
          </div>
          {/* the total, the price in Snow and the tax on top of it in the marker blue */}
          <div className="flex h-3.5 w-full">
            <div
              className="h-full bg-[#f3f3f1] transition-[width] duration-500"
              style={{ width: `${(PRICE / most) * 100}%` }}
            />
            <div
              className="h-full bg-[#6b79ea] transition-[width] duration-500"
              style={{ width: `${(b.tax / most) * 100}%` }}
            />
          </div>
          <dl className="flex flex-col">
            {(
              [
                ['PRICE', money(PRICE)],
                [b.rate, money(b.tax)],
                ['TOTAL', money(total)],
                ['FILED WITH', b.filed],
              ] as const
            ).map(([k, v], i) => (
              <div
                key={i}
                className="flex items-baseline justify-between border-t border-[#262626] py-3 text-base"
              >
                <dt className={i === 1 ? 'text-[#96a5f0]' : 'text-[#a1a19f]'}>
                  {k}
                </dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </figure>
      </div>
    </div>
  )
}
