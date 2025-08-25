import { Preview } from '@react-email/components'
import BodyText from '../components/BodyText'
import Footer from '../components/Footer'
import IntroWithHi from '../components/IntroWithHi'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'

export function NotificationAppealDecision({
  organization_name,
  decision,
}: {
  organization_name: string
  decision: string
}) {
  const isApproved = decision === 'approved'
  const title = isApproved ? 'Appeal Approved!' : 'Appeal Decision'
  const message = isApproved 
    ? `Great news! Your appeal for ${organization_name} has been approved and payment access has been restored.`
    : `We have carefully reviewed your appeal for ${organization_name}. Unfortunately, we are unable to approve your request at this time.`

  return (
    <Wrapper>
      <Preview>Appeal {decision} for {organization_name}</Preview>
      <PolarHeader />
      <IntroWithHi hiMsg={title}>
        {message}
      </IntroWithHi>
      <BodyText>
        {isApproved ? (
          <>
            You can now accept payments through your Polar account. 
            Thank you for your patience throughout this process.
          </>
        ) : (
          <>
            If you have additional information that you believe supports your case, 
            please contact our support team directly.
          </>
        )}
      </BodyText>
      <Footer />
    </Wrapper>
  )
}

NotificationAppealDecision.PreviewProps = {
  organization_name: 'Acme Corp',
  decision: 'approved',
}

export default NotificationAppealDecision