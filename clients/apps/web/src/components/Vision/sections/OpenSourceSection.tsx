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
          title="zsh"
          input="~/ % git clone git@github.com:polarsource/polar.git"
          output="Cloning Polar..."
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
      <Link href="https://github.com/polarsource/polar" target="_blank">
        Polar on GitHub →
      </Link>
    </Section>
  )
}
