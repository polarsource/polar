import { Link } from '../Link'
import { Section } from '../Section'

export const InvestorsSection = () => {
  return (
    <Section header={{ index: '06', name: 'Investors' }} title="Our Angels">
      <p>
        What used to be a simple way to pay for things has become a complex
        mess.
      </p>
      <p>
        Software as a Service (SaaS) has become the norm, but the underlying
        payment infrastructure has not evolved.
      </p>
      <p>
        This is why we are building Polar 2.0, payment infrastructure for the
        21st century.
      </p>
      <Link href="/pitch/what">Why →</Link>
    </Section>
  )
}
