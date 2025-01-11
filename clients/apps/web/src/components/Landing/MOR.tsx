import { KeyboardArrowRight } from '@mui/icons-material'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
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
        <Link href="https://docs.polar.sh/documentation/polar-as-merchant-of-record/tax">
          <Button variant="ghost">
            Learn More
            <span className="ml-1">
              <KeyboardArrowRight fontSize="inherit" />
            </span>
          </Button>
        </Link>
      }
    />
  )
}
