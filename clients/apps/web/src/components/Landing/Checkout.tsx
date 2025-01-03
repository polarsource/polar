import { Checkout as CheckoutComponent } from '@/components/Checkout/Checkout'
import {
  CHECKOUT_PREVIEW,
  ORGANIZATION,
} from '@/components/Customization/utils'
import { KeyboardArrowRight } from '@mui/icons-material'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'

export const Checkout = () => {
  return (
    <div className="dark:bg-polar-900 rounded-4xl hidden w-full flex-col overflow-hidden bg-white md:flex">
      <div className="flex flex-col items-center gap-y-8 px-8 pt-8 md:px-16 md:pt-16">
        <span className="dark:text-polar-500 text-lg text-gray-400">
          Built for simplicity
        </span>
        <h1 className="w-fit max-w-2xl text-pretty text-center text-2xl md:text-4xl md:leading-normal">
          Powerful Checkouts made simple
        </h1>
        <Link href="/docs/checkout">
          <Button
            fullWidth
            wrapperClassNames="flex flex-row items-center gap-x-2"
            variant="ghost"
          >
            <span>Integrate Checkouts</span>
            <KeyboardArrowRight fontSize="inherit" />
          </Button>
        </Link>
      </div>
      <div className="relative h-[490px] overflow-hidden">
        <div className="shadow-3xl rounded-4xl pointer-events-none absolute left-8 right-8 top-16 flex flex-col items-center md:left-16 md:right-16">
          <CheckoutComponent
            organization={ORGANIZATION}
            checkout={CHECKOUT_PREVIEW}
          />
        </div>
      </div>
    </div>
  )
}
