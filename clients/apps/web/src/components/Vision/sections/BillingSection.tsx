import { Grid } from '../Grid'
import { Section } from '../Section'

export const BillingSection = ({ active }: { active: boolean }) => {
  return (
    <Section
      active={active}
      header={{ index: '02', name: 'Seamless Billing' }}
      title="Complex billing made easy"
      context={
        <Grid
          className="relative z-10 hidden grid-cols-2 text-xs md:grid md:grid-cols-4"
          items={[
            <span key="a" className="flex items-center justify-center">
              Usage Based Billing
            </span>,
            <span key="b" className="flex items-center justify-center">
              Subscription Billing
            </span>,
            <span key="c" className="flex items-center justify-center">
              Purchase Based Billing
            </span>,
            <span key="d" className="flex items-center justify-center">
              Pay What You Want
            </span>,
          ]}
        />
      }
    >
      <p>
        Understandable fear and complexity around overages, credits and spend
        limits is holding the ecosystem back from experimenting &amp; innovating
        on pricing.
      </p>
      <p>
        We&apos;re hell-bent at removing all those headaches and concerns for
        developers and their customers. Both from a technical and business
        perspective.
      </p>
      <p>New times deserve new pricing.</p>
      <strong>Focus ahead:</strong>
      <ul>
        <li>
          <p>- Unlimited events and meters per product</p>
        </li>
        <li>
          <p>- Middleware and adapters to automate metering</p>
        </li>
        <li>
          <p>- Real-time dashboard of events, costs and revenue/customer</p>
        </li>
        <li>
          <p>- @shadcn-like components for customer forecast &amp; controls</p>
        </li>
      </ul>
    </Section>
  )
}
