import { Console } from '../Console'
import { Link } from '../Link'
import { Section } from '../Section'

export const OpenSourceSection = ({ active }: { active: boolean }) => {
  return (
    <Section
      active={active}
      header={{ index: '04', name: 'Polar is 100% Open Source' }}
      title="Building the future, together"
      context={
        <Console
          className="md:max-w-lg"
          title="zsh"
          input="$ git clone git@github.com:polarsource/polar.git"
          output="Cloning Polar (Apache 2.0)..."
        />
      }
    >
      <p>
        All the code powering Polar is available on GitHub under the Apache 2.0
        license.
      </p>
      <Link href="https://github.com/polarsource/polar" target="_blank">
        Polar on GitHub →
      </Link>
    </Section>
  )
}
