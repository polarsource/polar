import { Footer, Intro, Text, WrapperPolar } from '../components/foundation'
import type { schemas } from '../types'

export function EmailUpdateAlreadyRegistered({
  email,
}: schemas['EmailUpdateAlreadyRegisteredProps']) {
  return (
    <WrapperPolar preview="Someone tried to use your email address on Polar">
      <Intro>
        Someone attempted to set the email address of their Polar account to{' '}
        <Text as="span" weight="bold">
          {email}
        </Text>
        . Since this email address is already associated with an account, no
        changes were made.
      </Intro>
      <Text variant="caption">
        If this was you, sign in to your existing Polar account instead. If you
        don&apos;t recognize this activity, you can safely ignore this email.
      </Text>
      <Footer email={email} />
    </WrapperPolar>
  )
}

EmailUpdateAlreadyRegistered.PreviewProps = {
  email: 'john@example.com',
}

export default EmailUpdateAlreadyRegistered
