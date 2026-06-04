import { Section } from 'react-email'
import { schemas } from '../../types'
import Divider from './Divider'
import { Text } from './Text'

const FooterCustomer = ({
  organization,
  email,
}: {
  organization: schemas['Organization']
  email: string
}) => (
  <>
    <Divider />
    <Section className="text-center">
      <Text variant="footnote" align="center" noMargin>
        This email was sent to{' '}
        {/* eslint-disable-next-line email-ds/no-raw-text-elements -- footer value uses the dark tone, label stays muted */}
        <a
          href={`mailto:${email}`}
          className="font-medium text-gray-900 no-underline"
        >
          {email}
        </a>
        .
      </Text>
      <Text variant="footnote" align="center">
        Merchant of Record services provided to{' '}
        {/* eslint-disable-next-line email-ds/no-raw-text-elements -- footer value uses the dark tone, label stays muted */}
        <span className="font-medium text-gray-900">{organization.name}</span>{' '}
        by{' '}
        {/* eslint-disable-next-line email-ds/no-raw-text-elements -- footer value uses the dark tone, label stays muted */}
        <span className="font-medium text-gray-900">Polar Software, Inc.</span>
      </Text>
    </Section>
  </>
)

export default FooterCustomer
