import { Preview } from '@react-email/components'
import Footer from '../components/Footer'
import IntroWithHi from '../components/IntroWithHi'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'

export function NotificationNewSale({
  customer_name,
  formatted_price_amount,
  product_name,
}: {
  customer_name: string
  formatted_price_amount: string
  product_name: string
}) {
  return (
    <Wrapper>
      <Preview>New {product_name} sale</Preview>
      <PolarHeader />
      <IntroWithHi hiMsg="Congratulations!">
        {customer_name} purchased <strong>{product_name}</strong> for{' '}
        {formatted_price_amount}.
      </IntroWithHi>
      <Footer />
    </Wrapper>
  )
}

NotificationNewSale.PreviewProps = {
  customer_name: 'John Doe',
  formatted_price_amount: '$45.95',
  product_name: 'Ultimate Magento webshop template',
}

export default NotificationNewSale
