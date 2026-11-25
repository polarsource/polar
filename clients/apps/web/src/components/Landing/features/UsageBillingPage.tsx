import GetStartedButton from '@/components/Auth/GetStartedButton'
import { Button, Text } from '@polar-sh/orbit'
import { StaticImage } from '@/components/Image/StaticImage'
import { ReactNode } from 'react'
import { Defined, Printed, Read } from '../usage/plates'
import { Aggregations } from '../usage/Aggregations'
import { MeteringFilm } from '../usage/film/metering-film'
import { FieldGuide } from '../chapters/FieldGuide'
import { FeatureCTA, FeaturePageLayout } from './FeaturePageLayout'

/** The docs live on their own app, so this is a plain link, as the other feature pages have it. */
const DOCS = '/docs/concepts/usage'

const Section = ({
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

/** A short note: a name, and one line about it; numbered notes carry the plate's Ether markers. */
const Note = ({ k, v, n }: { k: string; v: string; n?: number }) => (
  <div className="dark:border-polar-800 flex flex-col gap-0.5 border-t border-gray-200 pt-3">
    <span className="flex items-center gap-2 text-base">
      {n ? (
        <span className="inline-flex size-5 items-center justify-center bg-[#6b79ea] text-xs text-black tabular-nums">
          {n}
        </span>
      ) : null}
      {k}
    </span>
    <Text variant="body" color="muted">
      {v}
    </Text>
  </div>
)

/** The call, line by line; the lines a meter reads carry the plate's Ether markers. */
const EVENT: [string, number?][] = [
  ['POST /v1/events/ingest'],
  [''],
  ['{'],
  ['  "events": [{'],
  ['    "name": "llm.completion",', 1],
  ['    "external_customer_id": "cus_4410",', 2],
  ['    "metadata": {', 3],
  ['      "model": "claude-sonnet",'],
  ['      "tokens": 1840'],
  ['    }'],
  ['  }]'],
  ['}'],
]

const FIELDS: [number, string, string][] = [
  [1, 'name', 'What happened. Meters filter on it.'],
  [2, 'external_customer_id', 'Who it is billed to.'],
  [3, 'metadata', 'Anything to add up: tokens, bytes, seconds.'],
]

const Marker = ({ n }: { n: number }) => (
  <span className="inline-flex size-5 shrink-0 items-center justify-center bg-[#6b79ea] font-sans text-xs text-black tabular-nums">
    {n}
  </span>
)

export const UsageBillingPage = () => {
  return (
    <FeaturePageLayout>
      {/* the head: the title, and the stream coming in */}
      <section className="flex w-full flex-col gap-12 pt-4 pb-16 md:gap-16 md:pt-16 md:pb-32">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col">
            <Text variant="heading-m" as="h1" wrap="balance">
              Usage-based billing on events
            </Text>
            <Text variant="heading-m" as="p" color="muted" wrap="balance">
              Bill on what your customers use.
            </Text>
          </div>
          <div className="flex items-center gap-3">
            <GetStartedButton size="lg" text="Get Started" />
            <a href={DOCS}>
              <Button size="lg" variant="secondary">
                Documentation
              </Button>
            </a>
          </div>
        </div>
        <MeteringFilm className="w-full" />
      </section>

      {/* 01: the call, and what it becomes on the wire */}
      <Section id="events">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col gap-12 lg:col-span-5 lg:justify-between">
            <div className="flex flex-col gap-6">
              <Text variant="heading-m" as="h2" wrap="balance">
                Send one event per thing that happened
              </Text>
              <Text variant="heading-xxs" color="muted" wrap="pretty">
                A name, a customer, and whatever you want to count. Meters do
                the rest.
              </Text>
            </div>

            {/* the call, ruled like a listing, its read lines marked */}
            <div className="flex flex-col gap-8">
              <ol className="dark:border-polar-800 border-y border-gray-200 py-5 font-mono text-sm leading-7">
                {EVENT.map(([line, n], k) => (
                  <li key={k} className="flex items-center gap-4">
                    <span className="dark:text-polar-600 w-5 shrink-0 text-right text-gray-400 tabular-nums select-none">
                      {k + 1}
                    </span>
                    <span className="flex-1 whitespace-pre">{line}</span>
                    {n ? <Marker n={n} /> : null}
                  </li>
                ))}
              </ol>
              <dl className="flex flex-col gap-4">
                {FIELDS.map(([n, k, v]) => (
                  <div key={k} className="flex items-baseline gap-3">
                    <Marker n={n} />
                    <dt className="font-mono text-sm">{k}</dt>
                    <dd className="dark:text-polar-500 text-base text-gray-500">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            {/* the brand flipbook's page 153, the watershed, exported as a still */}
            <StaticImage
              src="/assets/landing/usage/watershed.jpg"
              alt="Four event streams folding into one meter: 52,385 tokens, times $10 per million, billed as one $0.52 invoice line."
              width={1380}
              height={1800}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="h-auto w-full"
            />
          </div>
        </div>
      </Section>

      {/* 02: the meter, with its parts noted either side */}
      <Section id="meters">
        <div className="flex flex-col items-center gap-16">
          <div className="flex flex-col items-center gap-6 text-center">
            <Text variant="heading-m" as="h2" wrap="balance">
              One number per customer, from the whole stream
            </Text>
          </div>
          <div className="grid w-full grid-cols-1 items-center gap-10 md:grid-cols-[1fr_minmax(0,36rem)_1fr]">
            <div className="flex flex-col gap-8 md:order-1">
              <Note
                n={1}
                k="Filter"
                v="Which events count: here, LLM completions."
              />
              <Note
                n={2}
                k="Aggregation"
                v="How they add up: the sum of their tokens."
              />
            </div>
            <div className="md:order-2">
              <Defined />
            </div>
            <div className="flex flex-col gap-8 md:order-3">
              <Note
                k="Per customer"
                v="Every customer gets their own number."
              />
              <Note k="Per period" v="Read at the end of each billing cycle." />
            </div>
          </div>
        </div>
      </Section>

      {/* 03: the same stream, five ways: a list beside one large reading */}
      <Section>
        <div className="flex flex-col gap-16">
          <div className="flex flex-col gap-6">
            <Text variant="heading-m" as="h2" wrap="balance">
              Five ways to read the same stream
            </Text>
            <Text variant="heading-xxs" color="muted" wrap="pretty">
              A meter&apos;s aggregation decides what its number means. The same
              thirty-one events, read five ways.
            </Text>
          </div>
          <Aggregations />
        </div>
      </Section>

      {/* 04: the statement, and what it comes to */}
      <Section id="billing">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="order-2 lg:order-1 lg:col-span-6">
            <Printed />
          </div>
          <div className="order-1 flex flex-col gap-12 lg:order-2 lg:col-span-5 lg:col-start-8 lg:self-center">
            <div className="flex flex-col gap-6">
              <Text variant="heading-m" as="h2" wrap="balance">
                Priced per unit, billed on the next invoice
              </Text>
              <Text variant="heading-xxs" color="muted" wrap="pretty">
                Renewals, proration, tax and discounts work as they do for fixed
                prices.
              </Text>
            </div>
          </div>
        </div>
      </Section>

      {/* 05: the meter, read: its three figures set beside the ledger they come from */}
      <Section>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col gap-12 lg:col-span-5 lg:justify-between">
            <div className="flex flex-col gap-6">
              <Text variant="heading-m" as="h2" wrap="balance">
                Every customer&apos;s balance, as it happens
              </Text>
              <Text variant="heading-xxs" color="muted" wrap="pretty">
                What they have used, what they were granted, and what is left,
                as each event lands.
              </Text>
            </div>
            {/* where the balance comes from, and where it can be read */}
            <dl className="flex flex-col">
              {(
                [
                  [
                    'Credits',
                    'Grant units with the meter credits benefit. What is left can roll over to the next cycle.',
                  ],
                  [
                    'API',
                    'Consumed units, credited units and balance, per customer and meter.',
                  ],
                  [
                    'Customer state',
                    'Every active meter is on the customer state, and its webhook fires when it changes.',
                  ],
                  [
                    'Customer portal',
                    'Customers see their own usage, without you building a page for it.',
                  ],
                ] as const
              ).map(([k, v]) => (
                <div
                  key={k}
                  className="dark:border-polar-800 flex flex-col gap-1 border-t border-gray-200 py-5 last:border-b"
                >
                  <dt className="text-base">{k}</dt>
                  <dd className="dark:text-polar-500 text-base text-gray-500">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <Read />
          </div>
        </div>
      </Section>

      {/* what comes next: the new engine, in early access */}
      <FieldGuide />

      <FeatureCTA
        title="Start metering events"
        description="Set up a meter and ingest your first event with the SDK."
      />
    </FeaturePageLayout>
  )
}
