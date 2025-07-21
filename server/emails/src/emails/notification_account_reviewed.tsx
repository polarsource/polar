import { Preview } from '@react-email/components'
import BodyText from '../components/BodyText'
import Footer from '../components/Footer'
import IntroWithHi from '../components/IntroWithHi'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'

export function NotificationAccountReviewed() {
  return (
    <Wrapper>
      <Preview>Polar account review complete</Preview>
      <PolarHeader />
      <IntroWithHi hiMsg="Congratulations!">
        We are pleased to inform you that the review of your Polar account has
        been successfully completed.
      </IntroWithHi>
      <BodyText>
        We appreciate your patience throughout this process and are excited to
        grow together!
      </BodyText>
      <Footer />
    </Wrapper>
  )
}

NotificationAccountReviewed.PreviewProps = {}

export default NotificationAccountReviewed
