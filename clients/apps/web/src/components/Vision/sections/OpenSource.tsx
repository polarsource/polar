import { Console } from '../Console'
import { Link } from '../Link'
import { Section } from '../Section'

export const OpenSourceSection = () => {
  return (
    <Section
      header={{ index: '04', name: 'Open Source' }}
      title="Building in public"
      context={
        <Console
          className="flex aspect-video max-w-lg flex-grow"
          input="$ polar-init"
          output="Initializing seed round..."
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
