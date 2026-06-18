import {
  Divider,
  Footer,
  Heading,
  List,
  Text,
  WrapperPolar,
} from '../components/foundation'
import type { schemas } from '../types'

export function ChargebackPreventionRefund({
  email,
  order_number,
  customer_name,
  formatted_amount,
  refund_date,
}: schemas['ChargebackPreventionRefundProps']) {
  const formattedDate = refund_date
    ? new Date(refund_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : refund_date

  return (
    <WrapperPolar
      preview={`We've issued a chargeback prevention refund for order ${order_number}`}
    >
      <Text>Hello,</Text>
      <Text>We have issued a chargeback prevention refund for this order:</Text>
      <Divider />
      <Text noMargin>
        <Text as="span" weight="bold">
          Order:
        </Text>{' '}
        {order_number}
      </Text>
      <Text noMargin>
        <Text as="span" weight="bold">
          Customer:
        </Text>{' '}
        {customer_name}
      </Text>
      <Text noMargin>
        <Text as="span" weight="bold">
          Amount Refunded:
        </Text>{' '}
        {formatted_amount}
      </Text>
      <Text noMargin>
        <Text as="span" weight="bold">
          Date:
        </Text>{' '}
        {formattedDate}
      </Text>
      <Divider />
      <Heading>Why was this refund issued?</Heading>
      <Text>
        Polar receives early-warning alerts from some card issuers and banking
        partners when a cardholder attempts to dispute a transaction. These
        alerts come in before a formal chargeback is filed with the card
        networks.
      </Text>
      <Text>
        Our early warning system indicated a high likelihood that this
        transaction would result in a formal chargeback. To help you avoid
        possible losses and fees, we refunded the payment before a dispute was
        officially filed.
      </Text>
      <Text>
        Although a refund is not ideal, it is often the least expensive option.
        A formal chargeback can lead to:
      </Text>
      <List>
        <List.Item>Loss of the transaction amount</List.Item>
        <List.Item>Chargeback and dispute-related fees</List.Item>
        <List.Item>
          Additional overhead to manage and respond to the dispute
        </List.Item>
        <List.Item>
          Increased dispute ratios that can negatively impact payment processing
          over time
        </List.Item>
      </List>
      <Text>
        By refunding the transaction before a chargeback was filed, we helped
        you avoid these extra costs and issues.
      </Text>
      <Text>
        Polar usually treats completed sales as the merchant's and does not
        issue refunds to customers unless there are special circumstances. We
        only use chargeback-prevention refunds when it is likely to be better
        than letting a formal dispute happen.
      </Text>
      <Text>If you have any questions, just reply to this email.</Text>
      <Footer email={email} />
    </WrapperPolar>
  )
}

ChargebackPreventionRefund.PreviewProps = {
  email: 'merchant@example.com',
  order_number: 'POLAR-2026-00042',
  customer_name: 'Bob Ross',
  amount: 4595,
  currency: 'usd',
  formatted_amount: '$45.95',
  refund_date: '2026-06-16T20:41:00Z',
}

export default ChargebackPreventionRefund
