import { KeyboardArrowRight } from '@mui/icons-material'
import { RawButton } from '@polar-sh/ui/components/atoms/Button'
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
        <RawButton variant="ghost" asChild>
          <Link href="https://docs.polar.sh/documentation/polar-as-merchant-of-record/tax">
            Learn more
            <span className="ml-1">
              <KeyboardArrowRight fontSize="inherit" />
            </span>
          </Link>
        </RawButton>
      }
    />
  )
}
