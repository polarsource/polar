import { Preview } from '@react-email/components'
import BodyText from '../components/BodyText'
import Footer from '../components/Footer'
import IntroWithHi from '../components/IntroWithHi'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'

export function NotificationAppealSubmitted({
  organization_name,
}: {
  organization_name: string
}) {
  return (
    <Wrapper>
      <Preview>Appeal submitted for {organization_name}</Preview>
      <PolarHeader />
      <IntroWithHi hiMsg="Appeal Submitted">
        We have received your appeal for {organization_name} and it is now under review.
      </IntroWithHi>
      <BodyText>
        Our team will carefully review your appeal and get back to you as soon as possible. 
        Thank you for your patience as we work to resolve this matter.
      </BodyText>
      <Footer />
    </Wrapper>
  )
}

NotificationAppealSubmitted.PreviewProps = {
  organization_name: 'Acme Corp',
}

export default NotificationAppealSubmitted