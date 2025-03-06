import { Console } from '../Console'
import { Section } from '../Section'

export const CustomerSection = ({ active }: { active: boolean }) => {
  return (
    <Section
      active={active}
      header={{ index: '00', name: 'Customers > Users' }}
      title="No more reconciliation. Just added power."
      context={
        <Console
          className="flex aspect-video flex-grow self-start md:max-w-lg"
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
      <p>
        Billing is a critical part of your customer relationship, but only a
        part of it - it&apos;s the outcome vs. input.
      </p>
      <p></p>
      <p>It&apos;s time for the next evolution.</p>
    </Section>
  )
}
