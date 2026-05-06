'use client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import RemoveOutlined from '@mui/icons-material/RemoveOutlined'
import Link from 'next/link'
import { useState } from 'react'
import { Midday, StillaAI, Tailwind } from '../Logos'
import { ResourceLayout, ResourceSection } from './ResourceLayout'

const FAQItem = ({
  question,
  answer,
  number,
}: {
  question: string
  answer: string
  number: string
}) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Box
      borderColor="border-primary"
      borderBottomWidth={1}
      className="hover:dark:bg-polar-800 last:border-b-0 hover:bg-gray-50"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex w-full cursor-pointer items-center gap-6 p-4 text-left transition-opacity"
      >
        <Box
          borderColor="border-primary"
          display={{
            base: 'none',
            lg: 'flex',
          }}
          height={44}
          width={44}
          flexShrink={0}
          alignItems="center"
          justifyContent="center"
          borderRadius="full"
          borderWidth={1}
          className="transition-colors"
        >
          <Text as="span" variant="mono" color="muted">
            {number}
          </Text>
        </Box>
        <Box flex={1}>
          <h3 className="text-lg lg:text-xl dark:text-white">{question}</h3>
        </Box>
        <Box flexShrink={0}>
          {isOpen ? (
            <RemoveOutlined className="dark:text-white" />
          ) : (
            <AddOutlined className="dark:text-white" />
          )}
        </Box>
      </button>
      <Box
        className={`overflow-hidden transition-all duration-150 ease-in-out ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <Box
          paddingRight="3xl"
          paddingBottom="2xl"
          paddingLeft={{
            base: 'l',
            lg: '5xl',
          }}
        >
          <p className="dark:text-polar-400 leading-relaxed text-gray-700">
            {answer}
          </p>
        </Box>
      </Box>
    </Box>
  )
}

const logos = [
  {
    href: 'https://tailwindcss.com/',
    logo: <Tailwind size={16} />,
  },
  {
    href: 'https://midday.ai/',
    logo: <Midday size={28} />,
  },
  {
    href: 'https://stilla.ai/',
    logo: <StillaAI size={28} />,
  },
]

export const WhyPolarPage = () => {
  const tocItems = [
    { id: 'introduction', title: 'Introduction' },
    {
      id: 'mor',
      title: 'Merchant of Record',
    },
    { id: 'developer-experience', title: 'Developer Experience' },
    { id: 'pricing', title: 'Pricing' },
    { id: 'why-switch', title: 'Why switch to Polar?' },
    { id: 'who-switches', title: 'Who else is switching?' },
  ]

  return (
    <ResourceLayout
      title="Why Polar is the best way to monetize your software"
      toc={tocItems}
    >
      <ResourceSection id="introduction" title="Introduction">
        <p className="text-lg">Monetizing your software should be easy.</p>
        <p className="dark:text-polar-300 text-gray-500">
          Polar is an open-source billing infrastructure platform designed
          specifically for developers who want to monetize their software
          without the complexity of traditional payment systems.
        </p>
        <blockquote className="dark:border-polar-700 flex flex-col gap-y-4 border border-gray-200 p-4">
          <p>
            The speed at which Polar is executing on the financial
            infrastructure primitives the new world needs is very impressive
          </p>
          <Text as="span" variant="caption" color="muted">
            — Guillermo Rauch, CEO & Founder of Vercel
          </Text>
        </blockquote>
        <Box display="flex" flexDirection="column" gap="s">
          <Link
            href="/resources/comparison/stripe"
            target="_blank"
            className="w-fit border-b border-black pb-0.5 dark:border-white"
          >
            Compare Polar vs. Stripe
            <ArrowOutwardOutlined className="ml-2" fontSize="inherit" />
          </Link>
          <Link
            href="/resources/comparison/paddle"
            target="_blank"
            className="w-fit border-b border-black pb-0.5 dark:border-white"
          >
            Compare Polar vs. Paddle
            <ArrowOutwardOutlined className="ml-2" fontSize="inherit" />
          </Link>
          <Link
            href="/resources/comparison/lemon-squeezy"
            target="_blank"
            className="w-fit border-b border-black pb-0.5 dark:border-white"
          >
            Compare Polar vs. Lemon Squeezy
            <ArrowOutwardOutlined className="ml-2" fontSize="inherit" />
          </Link>
        </Box>
      </ResourceSection>
      <ResourceSection id="mor" title="Merchant of Record">
        <Box display="flex" flexDirection="column" gap="l">
          <h3 className="text-lg">
            Leave billing infrastructure and international tax headaches to us.
          </h3>
          <p className="dark:text-polar-300 text-gray-500">
            We take on the liability of international sales taxes globally for
            you. So you can focus on growing your business instead of accounting
            bills.
          </p>
        </Box>
        <Box display="flex" flexDirection="column" gap="s">
          <Box
            as="ul"
            borderColor="border-primary"
            borderTopWidth={1}
            borderBottomWidth={1}
            className="dark:divide-polar-700 divide-y divide-gray-200 [&>li]:py-2"
          >
            <Box as="li">
              <CheckOutlined className="mr-3" fontSize="inherit" />
              We handle VAT, GST, and sales tax in all jurisdictions
            </Box>
            <Box as="li">
              <CheckOutlined className="mr-3" fontSize="inherit" />
              EU VAT handling - Proper B2B reverse charge and B2C tax collection
            </Box>
            <Box as="li">
              <CheckOutlined className="mr-3" fontSize="inherit" />
              Automatic tax calculation - Real-time tax rates for every
              transaction
            </Box>
          </Box>
        </Box>
      </ResourceSection>
      <ResourceSection id="developer-experience" title="Developer Experience">
        <Box display="flex" flexDirection="column" gap="s">
          <h3>Developer Ergonomics</h3>
          <p className="dark:text-polar-300 text-gray-500">
            We design our APIs & SDKs with developer ergonomics in mind. We put
            the developer experience in the front seat.
          </p>
        </Box>
        <Box display="flex" flexDirection="column" gap="s">
          <h3>Developer Tools</h3>
          <p className="dark:text-polar-300 text-gray-500">
            We build developer tools that make it easy to iterate quickly and
            maintain systems effectively. We&apos;re not just building a billing
            system, we&apos;re building a platform that enables you to build
            your business.
          </p>
        </Box>
        <Box display="flex" flexDirection="column" gap="s">
          <h3>Open Source</h3>
          <p className="dark:text-polar-300 text-gray-500">
            Polar is open source, licensed under the Apache 2.0 license. We
            believe that the best way to build a great developer experience is
            to build it with the community.
          </p>
          <Link
            href="https://github.com/polarsource/polar"
            target="_blank"
            className="w-fit border-b border-black pb-0.5 dark:border-white"
          >
            Follow the development on GitHub
            <ArrowOutwardOutlined className="ml-2" fontSize="inherit" />
          </Link>
        </Box>
      </ResourceSection>
      <ResourceSection id="pricing" title="Pricing">
        <Box
          display="grid"
          gridTemplateColumns={{
            base: 'repeat(1, minmax(0, 1fr))',
            md: 'repeat(2, minmax(0, 1fr))',
          }}
          gap="l"
        >
          <Box display="flex" flexDirection="column" gap="s">
            <h3>Cheapest MoR on the market</h3>
            <p className="dark:text-polar-300 text-gray-500">
              Polar is priced 20% cheaper than other MoR alternatives. 4% and
              40¢ per transaction.
            </p>
          </Box>
          <Box display="flex" flexDirection="column" gap="s">
            <h3>No Hidden Fees</h3>
            <p className="dark:text-polar-300 text-gray-500">
              While payouts may incur fees charged by the payout providers (such
              as Stripe), Polar does not add any extra fees or markup.
            </p>
          </Box>
        </Box>
      </ResourceSection>
      {/* Why Switch */}
      <ResourceSection id="why-switch" title="Why switch to Polar?">
        <Box display="flex" flexDirection="column" gap="s">
          <h3>Integrate with 6 lines of code</h3>
          <p className="dark:text-polar-300 text-gray-500">
            We&apos;ve gone the extra mile to build ergonomic adapters that
            plugs right into the most popular frameworks. If that isn&apos;t
            enough, our versatile SDKs allow you to integrate with Polar in any
            way you want.
          </p>
        </Box>
        <Box display="flex" flexDirection="column" gap="s">
          <h3>Secure, robust & reliable payments</h3>
          <p className="dark:text-polar-300 text-gray-500">
            You can rest assured that your customers will be able to pay you
            securely and reliably. We&apos;ve built a payment system that works
            for you, not against you.
          </p>
        </Box>
        <Box display="flex" flexDirection="column" gap="s">
          <h3>We&apos;re deeply invested in your success</h3>
          <p className="dark:text-polar-300 text-gray-500">
            Polar is built by developers, for developers. We listen to your
            feedback, and we&apos;re always looking for ways to make it easier
            for you to succeed. We care.
          </p>
        </Box>
      </ResourceSection>
      {/* Who Switches */}
      <ResourceSection id="who-switches" title="Who else is switching?">
        <Box display="flex" flexDirection="column" gap="2xl">
          <Box display="flex" flexDirection="column" gap="l">
            <h3 className="text-lg">Trusted by leading SaaS companies</h3>
            <p className="dark:text-polar-300 text-gray-700">
              Companies like{' '}
              <Text as="span" color="default">
                Tailwind Labs
              </Text>
              ,{' '}
              <Text as="span" color="default">
                Midday
              </Text>
              ,{' '}
              <Text as="span" color="default">
                Stilla AI
              </Text>{' '}
              & thousands of other SaaS companies have already made the switch
              to Polar.
            </p>
          </Box>
          <Box
            borderColor="border-primary"
            display="grid"
            gridTemplateColumns="repeat(3, minmax(0, 1fr))"
            alignItems="center"
            borderWidth={1}
            className="dark:divide-polar-700 divide-x divide-gray-200"
          >
            {logos.map(({ logo, href }, index) => (
              <Link
                key={index}
                className="dark:hover:bg-polar-800 flex h-full items-center justify-center p-4 hover:bg-gray-100"
                href={href}
                target="_blank"
              >
                {logo}
              </Link>
            ))}
          </Box>
        </Box>
      </ResourceSection>
      <Box
        borderColor="border-primary"
        display="flex"
        flexDirection="column"
        borderTopWidth={1}
        paddingTop="4xl"
      >
        <FAQItem
          number="01"
          question="Do I still pay Stripe fees if I use Polar?"
          answer="Polar covers Stripe's 2.9% + 30¢ from our 4% + 40¢. Stripe's additional fees, like +1.5% for international cards, are passed through at cost."
        />
        <FAQItem
          number="02"
          question="Is Polar built on Stripe? Why not just use Stripe directly?"
          answer="We use Stripe rails for processing reliability and coverage. Processing ≠ the business layer. Polar is the MoR + billing + entitlements + unit-economics layer you'd otherwise build or buy on top of Stripe."
        />
        <FAQItem
          number="03"
          question="How are payouts handled internationally?"
          answer="All payments are made to Polar as the Merchant of Record. We use Stripe Connect Express to make payouts across more countries than Stripe Payments supports directly."
        />
        <FAQItem
          number="04"
          question="Do you handle EU VAT reverse charge for B2B?"
          answer="Yes, EU B2B reverse charge is handled correctly under our MoR model, ensuring compliance with EU tax regulations."
        />
        <FAQItem
          number="05"
          question="What about lock-in? Can I leave later?"
          answer="We deliberately architect for continuity (Stripe on the inside) and provide import/export plus migration tooling, so you always retain a pragmatic exit path."
        />

        <FAQItem
          number="06"
          question="What happens during account reviews or disputes?"
          answer="We run standard MoR/KYC reviews (typically within a week) and follow card-network norms: disputes cost $15 and gateway fees aren't refunded on refunds."
        />
      </Box>
      {/* Call to Action */}
      <Box
        borderColor="border-primary"
        display="flex"
        flexDirection="column"
        borderTopWidth={1}
        paddingTop="4xl"
      >
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          gap="2xl"
        >
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap="l"
          >
            <h3 className="text-xl">Ready to make the switch?</h3>
            <p className="dark:text-polar-300 text-center text-gray-700 md:w-[440px]">
              Join thousands of teams who have already transformed their payment
              infrastructure with Polar.
            </p>
          </Box>
          <GetStartedButton
            size="lg"
            text="Get Started"
            className="dark:hover:bg-polar-50 rounded-full bg-black font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black"
          />
        </Box>
      </Box>
    </ResourceLayout>
  )
}
