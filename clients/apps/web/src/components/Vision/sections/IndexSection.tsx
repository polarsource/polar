import { Console } from '../Console'
import { Link } from '../Link'
import { Section } from '../Section'

export const IndexSection = () => {
  return (
    <Section
      header={{ index: '00', name: 'Index' }}
      title="Integrating payments is a mess"
      context={
        <Console
          className="flex aspect-video max-w-lg flex-grow"
          title="Terminal"
          input="> i want to sell my saas online, how to?"
          output={`1. Create a Stripe Account
2. Setup a Product
3. Watch this youtube video -> dub.sh/integrate-stripe
4. Figure out which of the 258 event types you need
5. Reconcile webhooks with your Database
6. Keep track of state of payment intent
7. Don't forget to report Sales Tax, VAT & GST`}
        />
      }
    >
      <p>
        What used to be a simple way to pay for things has become a complex
        mess.
      </p>
      <p>
        Software as a Service (SaaS) has become the norm, but the underlying
        payment infrastructure has not evolved.
      </p>
      <Link href="/pitch/what">What we are building →</Link>
    </Section>
  )
}
