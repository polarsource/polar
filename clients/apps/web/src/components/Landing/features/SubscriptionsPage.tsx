import { Proration } from '../subscriptions/Proration'
import { Cycle, Recovery, Renewals } from '../subscriptions/plates'
import { Head, Lede, Rows, Section, Split } from './Destination'
import { FeatureCTA, FeaturePageLayout } from './FeaturePageLayout'

const DOCS = '/docs/features/subscriptions/introduction'

export const SubscriptionsPage = () => (
  <FeaturePageLayout>
    <Head
      title="Subscriptions, end to end"
      line="Renewals, upgrades and recovery, handled."
      docs={DOCS}
    >
      <Cycle />
    </Head>

    {/* 01: every renewal, one after another */}
    <Section id="lifecycle">
      <Split
        words={
          <>
            <Lede
              title="Check out once, renewed every cycle"
              line="A recurring price on a product is all it takes. Polar advances the period and charges the saved card, without your code in the loop."
            />
            <Rows
              rows={[
                [
                  'Pricing',
                  'Fixed, pay what you want or free, on any cadence.',
                ],
                [
                  'Orders',
                  'Every renewal is an order, with tax and discounts applied.',
                ],
                [
                  'Benefits',
                  'Granted at checkout, and kept in step with the subscription.',
                ],
              ]}
            />
          </>
        }
        plate={
          <div className="mx-auto w-full max-w-[32rem]">
            <Renewals />
          </div>
        }
      />
    </Section>

    {/* 02: one upgrade, three ways to settle it */}
    <Section id="proration">
      <div className="flex flex-col gap-16">
        <Lede
          title="Three ways to settle a plan change"
          line="Set a default for the organization, and override it on any call where a change deserves different handling."
        />
        <Proration />
      </div>
    </Section>

    {/* 03: a renewal that failed, and how it came back */}
    <Section id="recovery">
      <Split
        flip
        words={
          <>
            <Lede
              title="Failed renewals, recovered"
              line="A declined card moves the subscription to past due, not out the door. Polar retries four times over 21 days."
            />
            <Rows
              rows={[
                [
                  'Retries',
                  'After 2, 5, 7 and 7 days. One that pays makes it active again.',
                ],
                [
                  'Reminders',
                  'The customer is emailed at the first failure, with a link to update their card.',
                ],
                [
                  'Grace period',
                  'Keep benefits for 2, 7, 14 or 21 days while it recovers, or revoke them at once.',
                ],
                [
                  'Renewal notices',
                  'Cycles of six months or longer get an email a week before they renew.',
                ],
              ]}
            />
          </>
        }
        plate={<Recovery />}
      />
    </Section>

    {/* 04: what customers can do themselves */}
    <Section id="portal">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5">
          <Lede
            title="Customers manage their own"
            line="Every Polar account comes with a hosted Customer Portal. Link to it, or embed it in your product."
          />
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <Rows
            rows={[
              [
                'Payment methods',
                'Update the card on file, without writing to you.',
              ],
              [
                'Invoices',
                'Every order’s invoice, ready to hand to an accountant.',
              ],
              [
                'Plan changes',
                'Upgrades and downgrades, prorated the way you set.',
              ],
              ['Seats', 'Add and remove seats on seat-based plans.'],
              [
                'Cancel at period end',
                'Access runs to the end of the paid term, and it can be undone until then.',
              ],
              [
                'Revoke immediately',
                'From the dashboard or the API, access ends on the spot.',
              ],
            ]}
          />
        </div>
      </div>
    </Section>

    <FeatureCTA
      title="Connect a recurring product"
      description="Set a recurring price on a product and Polar runs the rest of the lifecycle."
    />
  </FeaturePageLayout>
)
