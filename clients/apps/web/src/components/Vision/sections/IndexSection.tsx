import { Console } from '../Console'
import { Section } from '../Section'

export const IndexSection = ({ active }: { active: boolean }) => {
  return (
    <Section
      active={active}
      header={{ index: '00', name: 'Index' }}
      title="Payments for developers is a mess, again"
      context={
        <Console
          className="flex aspect-video grow self-start md:max-w-lg"
          title="Terminal"
          input="$ cat PAYMENT_INTEGRATION.md"
          output={`1. Signup
2. Wrangle APIs to map against products/tiers
3. Integrate payment boilerplate
4. Settle for faceless & hosted checkouts
5. Subscribe to countless webhook events
6. Reconcile user state from webhooks
7. Build common entitlements
8. Capture user events and meters separately
9. Develop customer spend limits, upgrade, downgrades.
10. Congratulations. Now...
... handle International Sales Tax, VAT & GST`}
        />
      }
    >
      <p>Turn your software into a business with 4 lines of code.</p>
      <div className="flex flex-row gap-x-8">
        <Link className="flex-1" href="/resources/why">
          Get Started →
        </Link>
        <Link className="flex-1" href="/resources/why">
          Why Polar →
        </Link>
      </div>
      <Features />
    </Section>
  )
}
