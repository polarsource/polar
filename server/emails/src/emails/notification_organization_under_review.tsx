import { Preview } from '@react-email/components'
import BodyText from '../components/BodyText'
import Footer from '../components/Footer'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'

export function NotificationOrganizationUnderReview({
  organization_name,
}: {
  organization_name: string
}) {
  return (
    <Wrapper>
      <Preview>Your organization {organization_name} is being reviewed</Preview>
      <PolarHeader />
      <BodyText>Hi there,</BodyText>
      <BodyText>
        Sorry, we don't mean to scare you. Organization reviews are completely normal
        and part of our ongoing compliance efforts here at Polar.
      </BodyText>
      <BodyText>
        Currently, your organization "{organization_name}" is being reviewed as part of this automated process.
      </BodyText>
      <BodyText>
        We perform them ahead of the first payout and then automatically after
        certain sales thresholds.
      </BodyText>
      <BodyText>You can read more about our organization reviews here:</BodyText>
      <BodyText>
        https://docs.polar.sh/organization-reviews
      </BodyText>
      <BodyText>
        So no cause to be concerned. Typically, our reviews are completed within
        24-48h.
      </BodyText>
      <BodyText>
        We'll reach out shortly in case we need any further information from you
        for our review.
      </BodyText>
      <Footer />
    </Wrapper>
  )
}

NotificationOrganizationUnderReview.PreviewProps = {
  organization_name: 'My Organization',
}

export default NotificationOrganizationUnderReview