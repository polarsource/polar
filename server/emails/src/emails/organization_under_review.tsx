import { Preview, Section } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import Footer from '../components/Footer'
import IntroWithHi from '../components/IntroWithHi'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'
import type { schemas } from '../types'

export function OrganizationUnderReview({
  email,
  organization,
}: schemas['OrganizationUnderReviewProps']) {
  return (
    <Wrapper>
      <Preview>
        Your organization is under review - a standard part of our onboarding
        process
      </Preview>
      <PolarHeader />
      <IntroWithHi>
        Your organization <strong>{organization.name}</strong> is currently
        under review as part of our standard onboarding process.
      </IntroWithHi>
      <Section>
        <BodyText>
          This is a completely normal step that all organizations go through
          when joining Polar. As a Merchant of Record, we need to ensure
          compliance with our acceptable use policies and verify account
          information.
        </BodyText>
        <BodyText>
          <strong>What happens next?</strong>
        </BodyText>
        <BodyText>
          We&apos;ll review your account and may reach out if we need any
          additional information. Reviews are typically completed within 3
          business days, though they can take up to 7 days depending on
          complexity and timing.
        </BodyText>
        <BodyText>
          During this review period, you can continue setting up your products
          and integrate Polar. We&apos;ll notify you as soon as the review is
          complete.
        </BodyText>
        <BodyText>
          <Button href="https://polar.sh/docs/merchant-of-record/account-reviews">
            Read more about our review process
          </Button>
        </BodyText>
        <BodyText>
          If you have any questions in the meantime, feel free to reach out to
          our support team.
        </BodyText>
      </Section>
      <Footer email={email} />
    </Wrapper>
  )
}

OrganizationUnderReview.PreviewProps = {
  email: 'admin@example.com',
  organization: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Acme Inc.',
    slug: 'acme-inc',
    avatar_url: 'https://avatars.githubusercontent.com/u/105373340?s=200&v=4',
  },
}

export default OrganizationUnderReview
