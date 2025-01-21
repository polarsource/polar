import { Console } from '../Console'
import { Section } from '../Section'

export const IndexSection = () => {
  return (
    <Section
      header={{ index: '00', name: 'Index' }}
      title="Payments for developers is a mess, again"
      context={
        <Console
          className="flex aspect-video flex-grow md:max-w-lg"
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
 .. handle International Sales Tax, VAT & GST`}
        />
      }
    >
      <p>
        SaaS with entitlements, usage based billing, meters, overages, spend limits,
        checkout upsales, customer management...
      </p>
      <p>
        Long gone are the days of integrating payments in 7 LOCs.
      </p>
      <p>
        Modern PSPs are like C in programming - stunning low-level abstractions for complete control.
        But developers deserve a more high-level abstraction focused on iteration velocity.
      </p>
      <p>
        It&apos;s time for the next evolution.
      </p>
    </Section>
  )
}
