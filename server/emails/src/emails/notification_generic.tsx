import Footer from '../components/Footer'
import IntroWithHi from '../components/IntroWithHi'
import PolarHeader from '../components/PolarHeader'
import { default as Wrapper } from '../components/Wrapper'

interface NotificationGenericProps {
  bodyHTML: string
}

export function NotificationGeneric({ bodyHTML }: NotificationGenericProps) {
  return (
    <Wrapper>
      <PolarHeader />
      <IntroWithHi hiMsg="Congratulations!"></IntroWithHi>
      <div dangerouslySetInnerHTML={{ __html: bodyHTML }}></div>
      <Footer />
    </Wrapper>
  )
}

NotificationGeneric.PreviewProps = {
  bodyHTML:
    'malthe+customer_005@polar.sh is now subscribing to <strong>Snowball reprise</strong> for $25.95/month.',
}

export default NotificationGeneric
