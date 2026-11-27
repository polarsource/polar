'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronLeft, ChevronRight } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { type ReactNode, useCallback, useEffect, useRef } from 'react'
import { ChapterHeadline } from './Chapter'
import type { GraphicCardProps } from './FeatureCards'
import {
  BenefitsMark,
  CostMark,
  CreditsMark,
  DiscountsMark,
  FinanceMark,
  MerchantMark,
  SeatsMark,
  SubscriptionsMark,
  TrialsMark,
  UsageMark,
} from './graphics/FeatureMarks'

/** Every feature page, in the order the nav lists them. */
const FEATURES: GraphicCardProps[] = [
  {
    title: 'Usage Billing',
    desc: 'Bill on events: tokens, API calls, GPU seconds, anything you can count.',
    href: '/features/usage-billing',
    Graphic: UsageMark,
  },
  {
    title: 'Subscriptions',
    desc: 'Renewals, proration, dunning and customer self-service, all handled.',
    href: '/features/subscriptions',
    Graphic: SubscriptionsMark,
  },
  {
    title: 'Merchant of Record',
    desc: 'Polar is your reseller and handles international sales taxes for you.',
    href: '/features/merchant-of-record',
    Graphic: MerchantMark,
  },
  {
    title: 'Seats',
    desc: 'Assignable seats, claim links and automatic proration.',
    href: '/features/seats',
    Graphic: SeatsMark,
  },
  {
    title: 'Credits',
    desc: 'Prepaid balances that draw down, with metered pricing for the overage.',
    href: '/features/credits',
    Graphic: CreditsMark,
  },
  {
    title: 'Benefits',
    desc: 'Feature flags and entitlements that switch on with a purchase and off when it ends.',
    href: '/docs/features/benefits/introduction',
    Graphic: BenefitsMark,
  },
  {
    title: 'Trials',
    desc: 'Free or paid trials that convert automatically, with reminders and abuse protection.',
    href: '/features/trials',
    Graphic: TrialsMark,
  },
  {
    title: 'Discounts',
    desc: 'Coupons, promo codes and recurring discounts, applied at checkout or by URL.',
    href: '/features/discounts',
    Graphic: DiscountsMark,
  },
  {
    title: 'Cost Insights',
    desc: 'Annotate events with cost to track profit and lifetime value per customer.',
    href: '/features/cost-insights',
    Graphic: CostMark,
  },
  {
    title: 'Finance',
    desc: 'Your balance, a ledger of every transaction, transparent fees and payouts to your bank.',
    href: '/features/finance',
    Graphic: FinanceMark,
  },
]

const ArrowButton = ({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className="dark:text-polar-400 flex size-10 cursor-pointer items-center justify-center rounded-full text-gray-500 transition-colors hover:text-black dark:hover:text-white"
  >
    {children}
  </button>
)

/** One feature as a cell in the strip: the name and a line on top, its graphic underneath. */
const Cell = ({
  title,
  desc,
  href,
  Graphic,
  echo = false,
}: GraphicCardProps & { echo?: boolean }) => (
  <Link
    href={href ?? '#'}
    tabIndex={echo ? -1 : undefined}
    className="dark:border-polar-700 dark:hover:bg-polar-900 flex w-[78vw] shrink-0 snap-start flex-col gap-10 border-r border-gray-200 p-8 hover:bg-gray-50 sm:w-[22rem] xl:w-[25rem]"
  >
    <Box flexDirection="column" rowGap="s">
      <Text variant="heading-xs" as="h3">
        {title}
      </Text>
      <Text variant="heading-xxs" color="muted" as="p" wrap="pretty">
        {desc}
      </Text>
    </Box>
    <div className="mx-auto aspect-square w-full max-w-[16rem]">
      <Graphic />
    </div>
  </Link>
)

/** The strip holds three copies of the features; the middle one is the real one, the others let it wrap. */
const COPIES = 3

/**
 * The features as a strip of ruled cells that scrolls sideways without an end, snapping cell by cell, with arrows to
 * step through it. The strip runs out to both edges of the screen, with a cell lined up on the content column and
 * the features carrying on either side of it.
 */
export const FeatureCarousel = () => {
  const column = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const settle = useRef(0)

  /** Where the content column starts inside the strip, and how wide one copy of the features is. */
  const geometry = useCallback(() => {
    const el = track.current
    const col = column.current
    if (!el || !col) return null
    const cells = el.children
    const first = cells[0] as HTMLElement | undefined
    const middle = cells[FEATURES.length] as HTMLElement | undefined
    if (!first || !middle) return null
    return {
      el,
      inset: col.getBoundingClientRect().left - el.getBoundingClientRect().left,
      start: first.offsetLeft,
      span: middle.offsetLeft - first.offsetLeft,
    }
  }, [])

  /** Once the strip has come to rest in an outer copy, jump by one copy's width into the middle one. It looks the same. */
  const recentre = useCallback(() => {
    const g = geometry()
    if (!g) return
    const at = g.el.scrollLeft + g.inset - g.start
    if (at < g.span * 0.5) g.el.scrollLeft += g.span
    else if (at >= g.span * 1.5) g.el.scrollLeft -= g.span
  }, [geometry])

  useEffect(() => {
    const g = geometry()
    if (!g) return
    // Snapping keeps the content column's inset, and the strip opens on the middle copy's first cell.
    const place = () => {
      const now = geometry()
      if (!now) return
      now.el.style.scrollPaddingLeft = `${now.inset}px`
      // Opens on the middle copy's first cell, Usage Billing, lined up with the column.
      now.el.scrollLeft = now.start + now.span - now.inset
      // The server can't know the column's inset, so the strip comes in hidden and shows once it is in place.
      now.el.style.opacity = '1'
    }
    place()
    // Fonts landing late can still shift the column, so place again once they have, and whenever either resizes.
    let live = true
    void document.fonts.ready.then(() => live && place())
    const observer = new ResizeObserver(place)
    observer.observe(g.el)
    if (column.current) observer.observe(column.current)
    return () => {
      live = false
      observer.disconnect()
    }
  }, [geometry])

  useEffect(() => () => window.clearTimeout(settle.current), [])

  const onScroll = () => {
    window.clearTimeout(settle.current)
    settle.current = window.setTimeout(recentre, 140)
  }

  /** One cell's width, so each step lands on the next snap point. */
  const step = (direction: 1 | -1) => {
    const el = track.current
    const cell = el?.firstElementChild as HTMLElement | null
    if (!el || !cell) return
    el.scrollBy({ left: direction * cell.offsetWidth, behavior: 'smooth' })
  }

  return (
    <Box flexDirection="column" rowGap="3xl" width="100%">
      <div ref={column}>
        <Box justifyContent="between" alignItems="end" columnGap="l">
          <ChapterHeadline
            title="Everything you need to sell"
            subtitle="One platform, from checkout to payout"
          />
          <Box columnGap="xs" display={{ base: 'none', md: 'flex' }}>
            <ArrowButton label="Previous features" onClick={() => step(-1)}>
              <ChevronLeft size={20} />
            </ArrowButton>
            <ArrowButton label="Next features" onClick={() => step(1)}>
              <ChevronRight size={20} />
            </ArrowButton>
          </Box>
        </Box>
      </div>
      <div
        ref={track}
        onScroll={onScroll}
        className="dark:border-polar-700 relative mx-[calc(50%-50vw)] flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain border-y border-gray-200 opacity-0 transition-opacity duration-300 [&::-webkit-scrollbar]:hidden"
      >
        {Array.from({ length: COPIES }, (_, copy) =>
          FEATURES.map((feature) => {
            const echo = copy !== 1
            return (
              <div
                key={`${copy}-${feature.title}`}
                aria-hidden={echo || undefined}
                className="flex shrink-0"
              >
                <Cell {...feature} echo={echo} />
              </div>
            )
          }),
        )}
      </div>
    </Box>
  )
}
