import { Footer, Heading, Text, WrapperPolar } from '../components/foundation'
import InfoBox from '../components/InfoBox'
import type { schemas } from '../types'

export function NotificationFileFlaggedMalicious({
  file_name,
  organization_name,
}: schemas['MaintainerFileFlaggedMaliciousNotificationPayload']) {
  return (
    <WrapperPolar
      preview={`Security alert: ${file_name} was flagged as malicious`}
    >
      <Heading>Security alert</Heading>
      <Text>
        A file uploaded to{' '}
        <Text as="span" weight="bold">
          {organization_name}
        </Text>{' '}
        was flagged as malicious by our automated malware scanning.
      </Text>
      <InfoBox title="Flagged file" variant="info">
        <Text noMargin>{file_name}</Text>
      </InfoBox>
      <Text>
        If you believe this is a mistake, please get in touch with our support
        team.
      </Text>
      <Footer email={null} />
    </WrapperPolar>
  )
}

NotificationFileFlaggedMalicious.PreviewProps = {
  file_name: 'whitepaper.pdf',
  organization_name: 'Acme Inc.',
}

export default NotificationFileFlaggedMalicious
