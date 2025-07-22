import { Link, Preview } from '@react-email/components'
import BodyText from '../components/BodyText'
import Footer from '../components/Footer'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'

export function NotificationAccountUnderReview({
  account_type,
}: {
  account_type: string
}) {
  return (
    <Wrapper>
      <Preview>Your Polar account is being reviewed</Preview>
      <PolarHeader />
      <BodyText>Hi there,</BodyText>
      <BodyText>
        Sorry, we don't mean to scare you. Account reviews are completely normal
        and part of our ongoing compliance efforts here at Polar.
      </BodyText>
      <BodyText>
        Currently, your {account_type} account and organizations connected to it
        is being reviewed as part of this automated process.
      </BodyText>
      <BodyText>
        We perform them ahead of the first payout and then automatically after
        certain sales thresholds.
      </BodyText>
      <BodyText>You can read more about our account reviews here:</BodyText>
      <Link href="https://dub.sh/polar-review">
        https://dub.sh/polar-review
      </Link>
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

NotificationAccountUnderReview.PreviewProps = {
  account_type: 'Stripe Connect Express',
}

export default NotificationAccountUnderReview
