import {
  Button,
  EmailLink,
  Footer,
  Heading,
  List,
  Text,
  WrapperPolar,
} from '../components/foundation'
import InfoBox from '../components/InfoBox'
import type { schemas } from '../types'

const FLAGGED_FILES_DOCS_URL =
  'https://polar.sh/docs/features/benefits/file-downloads#flagged-files'

export function NotificationFileFlaggedMalicious({
  file_name,
  organization_name,
  threat_names,
  benefits_url,
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
        was flagged as malicious by our automated malware scanning. Your
        customers can no longer download it.
      </Text>
      <InfoBox title="Flagged file" variant="info">
        <Text noMargin>{file_name}</Text>
        {threat_names.length > 0 && (
          <Text noMargin>Detected threat: {threat_names.join(', ')}</Text>
        )}
      </InfoBox>
      <Text weight="bold">What to do next</Text>
      <List>
        <List.Item>
          If the file may be infected, rebuild it on a clean machine, upload the
          new version and delete the flagged file.
        </List.Item>
        <List.Item>
          If you believe it is a false positive, contact our support team.
        </List.Item>
      </List>
      <Text>
        Read more in our{' '}
        <EmailLink href={FLAGGED_FILES_DOCS_URL}>documentation</EmailLink>.
      </Text>
      {benefits_url && <Button href={benefits_url}>View benefits</Button>}
      <Footer email={null} />
    </WrapperPolar>
  )
}

NotificationFileFlaggedMalicious.PreviewProps = {
  file_name: 'whitepaper.pdf',
  organization_name: 'Acme Inc.',
  organization_slug: 'acme-inc',
  threat_names: ['EICAR-Test-File (not a virus)'],
  benefits_url: 'https://polar.sh/dashboard/acme-inc/products/benefits',
}

export default NotificationFileFlaggedMalicious
