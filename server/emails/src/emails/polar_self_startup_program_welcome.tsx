import { Preview, Section } from 'react-email'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import Footer from '../components/Footer'
import Intro from '../components/Intro'
import WrapperPolar from '../components/WrapperPolar'
import type { schemas } from '../types'

export function PolarSelfStartupProgramWelcome({
  email,
  organization_name,
  billing_url,
}: schemas['PolarSelfStartupProgramWelcomeProps']) {
  return (
    <WrapperPolar>
      <Preview>
        {organization_name} is in the Polar Startup Program. 12 months free on
        Scale.
      </Preview>
      <Intro headline="Welcome to the Polar Startup Program">
        We&apos;re excited to have <strong>{organization_name}</strong> join the
        next generation of startups building with Polar. You get the Scale plan{' '}
        <strong>free for 12 months</strong>.
      </Intro>
      <BodyText>
        To claim it, head to your billing settings and switch to the Scale plan.
        The 100% discount is already attached to your account and will apply
        automatically at checkout, no code needed.
      </BodyText>
      <Section className="my-12">
        <Button href={billing_url}>Go to billing</Button>
      </Section>
      <BodyText>
        The discount applies for 12 months from the day you upgrade, then your
        plan rolls over to the standard Scale pricing. You can manage or cancel
        anytime from the same billing page.
      </BodyText>
      <Footer email={email} />
    </WrapperPolar>
  )
}

PolarSelfStartupProgramWelcome.PreviewProps = {
  email: 'founder@acme.ai',
  organization_name: 'Acme AI',
  billing_url: 'https://polar.sh/dashboard/acme/settings/billing/change-plan',
} satisfies schemas['PolarSelfStartupProgramWelcomeProps']

export default PolarSelfStartupProgramWelcome
