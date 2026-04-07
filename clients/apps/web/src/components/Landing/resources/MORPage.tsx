import GetStartedButton from '@/components/Auth/GetStartedButton'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { ResourceLayout, ResourceSection } from './ResourceLayout'

const Benefit = ({
  children,
  positive = true,
}: React.PropsWithChildren<{ positive?: boolean }>) => {
  return (
    <li
      className={twMerge(
        'flex flex-row items-start gap-x-2',
        positive ? '' : 'dark:text-polar-500 text-gray-400',
      )}
    >
      {positive ? (
        <CheckOutlined className="mt-1 mr-2" fontSize="inherit" />
      ) : (
        <CloseOutlined className="mt-1 mr-2" fontSize="inherit" />
      )}
      <span>{children}</span>
    </li>
  )
}

export const MORPage = () => {
  const tocItems = [
    { id: 'introduction', title: 'Introduction' },
    {
      id: 'mor',
      title: 'PSP vs. MoR',
    },
    { id: 'sales-tax', title: 'International Sales Tax' },
  ]

  return (
    <ResourceLayout title="Polar as a Merchant of Record" toc={tocItems}>
      <ResourceSection id="introduction" title="Introduction">
        <p className="text-lg">What is a Merchant of Record?</p>
        <p className="dark:text-polar-300 text-gray-500">
          We take on the liability of international sales taxes globally for
          you. So you can focus on growing your business vs. accounting bills.
          Leave billing infrastructure and international sales tax headaches to
          us.
        </p>
      </ResourceSection>

      <ResourceSection id="mor" title="PSP vs. MoR" className="gap-y-8">
        <div className="flex flex-col gap-y-6">
          <div className="flex flex-col gap-4">
            <h3 className="text-lg">Payment Service Provider (PSPs)</h3>
            <p className="dark:text-polar-300 text-gray-500">
              Stripe and other Payment Service Providers (PSPs) offer an
              accessible and convenient abstraction to faciliate transactions on
              top of underlying credit card networks & banks.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <ul className="dark:border-polar-700 dark:divide-polar-700 divide-y divide-gray-200 border-y border-gray-200 [&>li]:py-2">
              <Benefit>
                Powerful, flexibile & low-level APIs to facilitate transactions
              </Benefit>
              <Benefit>
                Can be used to power all business- and pricing models under the
                sun.
              </Benefit>
              <Benefit positive={false}>
                You are responsible for all liabilities associated with
                transactions, e.g international taxes
              </Benefit>
              <Benefit positive={false}>
                Low-level APIs require more development even for common use
                cases
              </Benefit>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-y-6">
          <div className="flex flex-col gap-4">
            <h3 className="text-lg">Merchant of Record</h3>
            <p className="dark:text-polar-300 text-gray-500">
              Merchants of Record offer yet another layer of convenient
              abstraction to facilitate digital orders on top of the underlying
              PSPs and transactions.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <ul className="dark:border-polar-700 dark:divide-polar-700 divide-y divide-gray-200 border-y border-gray-200 [&>li]:py-2">
              <Benefit>
                Powerful, Higher-level Dashboard, APIs & SDKs to better
                facilitate digital products, services & orders beyond the
                underlying transactions
              </Benefit>
              <Benefit>
                Can be used to power all business- and pricing models under the
                sun.
              </Benefit>
              <Benefit positive={false}>
                Less flexibility & control in terms of advanced business- and
                pricing models.
              </Benefit>
              <Benefit positive={false}>Higher fees per payment</Benefit>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-y-6">
          <div className="flex flex-col gap-4">
            <h3 className="text-lg">Go with a PSP if...</h3>
          </div>
          <div className="flex flex-col gap-2">
            <ul className="dark:border-polar-700 dark:divide-polar-700 divide-y divide-gray-200 border-y border-gray-200 [&>li]:py-2">
              <Benefit>
                You&apos;re comfortable & prefer absolute control with low-level
                APIs.
              </Benefit>
              <Benefit>
                You&apos;re looking for the lowest fees possible.
              </Benefit>
              <Benefit>
                You want to register & file for international taxes yourself.
              </Benefit>
            </ul>
          </div>

          <div className="flex flex-col gap-y-6">
            <div className="flex flex-col gap-4">
              <h3 className="text-lg">Go with Polar if...</h3>
            </div>
            <div className="flex flex-col gap-2">
              <ul className="dark:border-polar-700 dark:divide-polar-700 divide-y divide-gray-200 border-y border-gray-200 [&>li]:py-2">
                <Benefit>
                  You want product-, customer-, order- and subscription
                  management via an intuitive and easy dashboard
                </Benefit>
                <Benefit>
                  You want to offer file downloads, license keys, Discord-
                  and/or private GitHub repository invites with ease - with more
                  built-in automations to come.
                </Benefit>
                <Benefit>
                  You prefer a more high-level API optimized for making
                  monetization easier.
                </Benefit>
                <Benefit>
                  You want us to handle international taxes for you
                </Benefit>
              </ul>
            </div>
          </div>
        </div>
      </ResourceSection>

      <ResourceSection
        id="sales-tax"
        title="International Sales Tax"
        className="gap-y-8"
      >
        <div className="flex flex-col gap-2">
          <p className="dark:text-polar-300 text-gray-500">
            Most countries, states and jurisdictions globally impose sales taxes
            on digital goods and services (VAT, GST, US Sales Tax etc).
            Regardless of whether the merchant (seller) is a resident there or
            not - they&apos;re doing business there.
          </p>
          <p className="dark:text-polar-300 text-gray-500">
            For example, a $10/month subscription should cost $12.5/month for a
            Swedish (25% VAT) consumer, but $10/month for a Swedish business
            with VAT registration (reverse charge).
          </p>
          <p className="dark:text-polar-300 text-gray-500">
            Merchants are responsible for capturing & remitting sales taxes to
            the local tax authorities. What does that mean in our example?
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h3>Capturing</h3>
          <p className="dark:text-polar-300 text-gray-500">
            Charging the Swedish consumer $12.5/month and saving $2.5/month for
            the Swedish tax authorities. Stripe Tax is an excellent service to
            automate this and the one Polar uses today.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h3>Remitting</h3>
          <p className="dark:text-polar-300 text-gray-500">
            Filing & paying the captured sales taxes with the tax authorities on
            time. Stripe Tax does not do this, i.e the merchant is liable to
            register, file and pay taxes to local tax authorities.
          </p>
        </div>

        <div className="dark:border-polar-700 flex flex-col gap-2 border-t border-gray-200 pt-4">
          <p className="dark:text-polar-300 text-gray-500">
            Many jurisdictions, however, don&apos;t require this until you reach
            a certain threshold in terms of sales volume. But others require
            registration even before the first sale - or after a very low
            threshold. In addition to having different rates and rules on which
            goods are taxable and whether they&apos;re deductable or not for
            business customers.
          </p>

          <p className="dark:text-polar-300 text-gray-500">
            For example, United Kingdom and EU countries require upfront
            registration for international companies, but Texas (United States)
            does not until you&apos;ve sold for more than $500,000.
          </p>

          <p className="dark:text-polar-300 text-gray-500">
            In short: It&apos;s complex and hard. Even large and well-known
            businesses don&apos;t do it perfectly. Arguably, it&apos;s almost
            impossible and at least highly impracticle and expensive to comply
            perfectly upfront. Many companies even delay compliance as a
            calculated risk, i.e focus on validating & growing their business
            with the risk of paying back taxes + penalities later.
          </p>
        </div>

        <div className="flex flex-col gap-y-6">
          <div className="flex flex-col gap-4">
            <h3 className="text-lg">PSP</h3>
          </div>
          <div className="flex flex-col gap-2">
            <ul className="dark:border-polar-700 dark:divide-polar-700 divide-y divide-gray-200 border-y border-gray-200 [&>li]:py-2">
              <Benefit>
                Your volume alone is what counts towards international
                thresholds vs. the MoR platform, i.e customers might not need to
                pay sales taxes with you, but would via a MoR.
              </Benefit>
              <Benefit>
                You can deduct inbound VAT against purchases your business does
                with VAT
              </Benefit>
              <Benefit positive={false}>
                You&apos;re liable for capturing & remitting international sales
                taxes
              </Benefit>
              <Benefit positive={false}>
                Stripe Tax is great to monitor & automate capturing, but
                registration and remittance is up to you.
              </Benefit>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-y-6">
          <div className="flex flex-col gap-4">
            <h3 className="text-lg">Merchant of Record</h3>
          </div>
          <div className="flex flex-col gap-2">
            <ul className="dark:border-polar-700 dark:divide-polar-700 divide-y divide-gray-200 border-y border-gray-200 [&>li]:py-2">
              <Benefit>
                We are liable for all of the above as your reseller.
              </Benefit>
              <Benefit>
                Offer EU VAT for B2B sales (expected and desired within EU for
                businesses) without having to register, capture and remit it
                yourself.
              </Benefit>
              <Benefit positive={false}>
                Sales taxes would be added for more customers vs. with you
                selling directly.
              </Benefit>
              <Benefit positive={false}>
                You cannot leverage inbound VAT towards VAT expense deductions
                yourself.
              </Benefit>
            </ul>
          </div>
        </div>
      </ResourceSection>

      {/* Call to Action */}
      <div className="dark:border-polar-700 flex flex-col border-t border-gray-200 pt-16">
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-4">
            <h3 className="text-xl">Ready to make the switch?</h3>
            <p className="dark:text-polar-300 text-center text-gray-700 md:w-[440px]">
              Join thousands of teams who have already transformed their payment
              infrastructure with Polar.
            </p>
          </div>
          <GetStartedButton
            size="lg"
            text="Get Started"
            className="dark:hover:bg-polar-50 rounded-full bg-black font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black"
          />
        </div>
      </div>
    </ResourceLayout>
  )
}
