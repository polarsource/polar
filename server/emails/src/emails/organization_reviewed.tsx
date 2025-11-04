import { Preview, Section } from '@react-email/components'
import BodyText from '../components/BodyText'
import Footer from '../components/Footer'
import IntroWithHi from '../components/IntroWithHi'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'
import type { schemas } from '../types'

export function OrganizationReviewed({
  email,
  organization,
}: schemas['OrganizationReviewedProps']) {
  return (
    <Wrapper>
      <Preview>
        Great news! Your organization has been approved and you&apos;re ready to
        start selling
      </Preview>
      <PolarHeader />
      <IntroWithHi>
        Great news! Your organization <strong>{organization.name}</strong> has
        been approved.
      </IntroWithHi>
      <Section>
        <BodyText>
          You&apos;re now all set to start selling on Polar. You can create
          products, set up subscriptions, and start accepting payments from
          customers around the world.
        </BodyText>
        <BodyText>
          <strong>What&apos;s next?</strong>
        </BodyText>
        <BodyText>
          Head to your dashboard to finish setting up your products and
          integrate Polar into your workflow. Then, you can start selling right
          away!
        </BodyText>
        <BodyText>
          If you have any questions as you get started, our support team is here
          to help.
        </BodyText>
      </Section>
      <Footer email={email} />
    </Wrapper>
  )
}

OrganizationReviewed.PreviewProps = {
  email: 'admin@example.com',
  organization: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Acme Inc.',
    slug: 'acme-inc',
    avatar_url: 'https://avatars.githubusercontent.com/u/105373340?s=200&v=4',
  },
}

export default OrganizationReviewed
