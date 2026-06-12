import {
  Button,
  Footer,
  Intro,
  Text,
  WrapperPolar,
} from '../components/foundation'
import type { schemas } from '../types'

export function SupportCaseOrganizationNewMessage({
  email,
  organization_name,
  case_label,
  url,
}: schemas['SupportCaseOrganizationNewMessageProps']) {
  return (
    <WrapperPolar preview={`Update on your ${organization_name} ${case_label}`}>
      <Intro>
        There's an update on your {case_label} for{' '}
        <Text as="span" weight="bold">
          {organization_name}
        </Text>
        .
      </Intro>
      <Button href={url}>View your {case_label}</Button>
      <Footer email={email} />
    </WrapperPolar>
  )
}

SupportCaseOrganizationNewMessage.PreviewProps = {
  email: 'merchant@example.com',
  organization_name: 'Acme Inc.',
  case_label: 'appeal',
  url: 'https://polar.sh/dashboard/acme-inc/finance/account',
}

export default SupportCaseOrganizationNewMessage
