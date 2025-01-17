import { Link } from '../Link'
import { Section } from '../Section'

export const SevenLOCSection = () => {
  return (
    <Section header={{ index: '02', name: 'Adapters' }} title="7 Lines of Code">
      <p>
        Polar aims to be the simplest way to integrate payments into your
        software. This should be a breeze. That&apos;s why we restrict the code
        you need to a maximum of 7 lines.
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
