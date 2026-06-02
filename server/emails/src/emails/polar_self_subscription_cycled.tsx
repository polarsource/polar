import { Footer, WrapperPolar } from '../components/layout'
import { Intro, Text } from '../components/text'
import type { schemas } from '../types'

export function PolarSelfSubscriptionCycled({
  email,
  product_name,
}: schemas['PolarSelfSubscriptionCycledProps']) {
  return (
    <WrapperPolar preview={`Your ${product_name} subscription renewed`}>
      <Intro headline={`${product_name} renewed`}>
        Your{' '}
        <Text as="span" weight="medium">
          {product_name}
        </Text>{' '}
        subscription renewed for another cycle. The latest invoice is attached.
      </Intro>
      <Footer email={email} />
    </WrapperPolar>
  )
}

PolarSelfSubscriptionCycled.PreviewProps = {
  email: 'john@example.com',
  product_name: 'Polar Pro',
} satisfies schemas['PolarSelfSubscriptionCycledProps']

export default PolarSelfSubscriptionCycled
