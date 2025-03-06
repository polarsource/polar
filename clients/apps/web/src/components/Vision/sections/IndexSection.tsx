import { Console } from '../Console'
import { Section } from '../Section'

export const IndexSection = ({ active }: { active: boolean }) => {
  return (
    <Section
      active={active}
      header={{ index: '00', name: 'Polar' }}
      title="Ship faster. Earn more."
      context={
        <Console
          className="flex aspect-video flex-grow self-start md:max-w-lg"
          title="Terminal"
          input="$ cat PAYMENT_INTEGRATION.md"
          output={``}
        />
      }
    >
      <p>We believe the future belongs to developers building businesses.</p>
      <p>
        It&apos;s never been easier to build, ship and scale software thanks to
        modern frameworks, IaaS-, PaaS- and BaaS services to LLMs.
      </p>
      <p>
        Yet, payments &amp; billing has never been more complex. We&apos;re
        obsessed about changing this.
      </p>
      <div>
        <p>
          <strong>We call it Polar.</strong>
        </p>
      </div>
    </Section>
  )
}
