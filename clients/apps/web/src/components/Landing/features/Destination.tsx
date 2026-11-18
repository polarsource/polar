import GetStartedButton from '@/components/Auth/GetStartedButton'
import { Button, Text } from '@polar-sh/orbit'
import type { ReactNode } from 'react'

/**
 * The parts the feature destination pages are built from, after the usage billing page: a head with the title and
 * a wide plate under it, then ruled sections, each a heading beside a plate.
 */

/** The marker blue the plates number their parts in. */
export const MARKER = '#6b79ea'

export const Section = ({
  id,
  children,
  className = '',
}: {
  /** An anchor for links from elsewhere; the margin keeps the heading clear of the sticky nav. */
  id?: string
  children: ReactNode
  className?: string
}) => (
  <section
    id={id}
    className={`dark:border-polar-800 w-full scroll-mt-20 border-t border-gray-200 py-16 md:py-32 ${className}`}
  >
    {children}
  </section>
)

/** The page's head: its title and a line under it, the two buttons, and the plate across the column. */
export const Head = ({
  title,
  line,
  docs,
  children,
}: {
  title: string
  line: string
  docs: string
  children: ReactNode
}) => (
  <section className="flex w-full flex-col gap-12 pt-4 pb-16 md:gap-16 md:pt-16 md:pb-32">
    <div className="flex flex-col gap-8">
      <div className="flex flex-col">
        <Text variant="heading-m" as="h1" wrap="balance">
          {title}
        </Text>
        <Text variant="heading-m" as="p" color="muted" wrap="balance">
          {line}
        </Text>
      </div>
      <div className="flex items-center gap-3">
        <GetStartedButton size="lg" text="Get Started" />
        <a href={docs}>
          <Button size="lg" variant="secondary">
            Documentation
          </Button>
        </a>
      </div>
    </div>
    {children}
  </section>
)

/** A section's heading and the line under it. */
export const Lede = ({
  title,
  line,
  center = false,
}: {
  title: string
  line?: string
  center?: boolean
}) => (
  <div
    className={`flex flex-col gap-6 ${center ? 'items-center text-center' : ''}`}
  >
    <Text variant="heading-m" as="h2" wrap="balance">
      {title}
    </Text>
    {line ? (
      <Text variant="heading-xxs" color="muted" wrap="pretty">
        {line}
      </Text>
    ) : null}
  </div>
)

export const Marker = ({ n }: { n: number }) => (
  <span
    className="inline-flex size-5 shrink-0 items-center justify-center font-sans text-xs text-black tabular-nums"
    style={{ background: MARKER }}
  >
    {n}
  </span>
)

/** Names and a line about each, ruled between. */
export const Rows = ({
  rows,
}: {
  rows: readonly (readonly [string, string])[]
}) => (
  <dl className="flex flex-col">
    {rows.map(([k, v]) => (
      <div
        key={k}
        className="dark:border-polar-800 flex flex-col gap-1 border-t border-gray-200 py-5 last:border-b"
      >
        <dt className="text-base">{k}</dt>
        <dd className="dark:text-polar-500 text-base text-gray-500">{v}</dd>
      </div>
    ))}
  </dl>
)

/** The usual split: the words in five columns on one side, the plate in six on the other. */
export const Split = ({
  words,
  plate,
  flip = false,
}: {
  words: ReactNode
  plate: ReactNode
  /** Puts the plate first on wide screens. */
  flip?: boolean
}) => (
  <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
    <div
      className={`flex flex-col gap-12 lg:col-span-5 lg:justify-between ${flip ? 'lg:order-2 lg:col-start-8' : ''}`}
    >
      {words}
    </div>
    <div className={`lg:col-span-6 ${flip ? 'lg:order-1' : 'lg:col-start-7'}`}>
      {plate}
    </div>
  </div>
)
