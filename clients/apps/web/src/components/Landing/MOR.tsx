import ArrowOutward from '@mui/icons-material/ArrowOutward'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import { SplitPromo } from './molecules/SplitPromo'

export const MerchantOfRecord = () => {
  return (
    <SplitPromo
      title="Polar as Merchant of Record"
      description="Forget all about billing & taxes. We handle it all for you as the merchant of record."
      bullets={[
        'Sales Tax, VAT, GST, etc.',
        'Withdraw with Stripe Connect',
        'Detailed Transactions Ledger',
      ]}
      image="/assets/landing/transactions.jpg"
      cta1={
        <Link href="/resources/merchant-of-record">
          <Button variant="secondary" className="rounded-full">
            Learn more
            <span className="ml-2">
              <ArrowOutward fontSize="inherit" />
            </span>
          </Button>
        </Link>
      }
    />
  )
}
