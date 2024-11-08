import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import { KeyboardArrowRight } from '@mui/icons-material'
import { Checkout as CheckoutComponent } from '@/components/Checkout/Checkout'
import { ORGANIZATION, CHECKOUT_PREVIEW } from '@/components/Customization/utils'

export const Checkout = () => {
  return (
    <div className="dark:bg-polar-950 hidden md:flex rounded-4xl w-full flex-col overflow-hidden bg-gray-50 dark:md:bg-[radial-gradient(400px_at_top,rgba(20,20,25,1)_0%,rgba(7,7,9,1)_100%)]">
      <div className="flex flex-col items-center gap-y-8 px-8 pt-8 md:px-16 md:pt-16">
        <span className="dark:text-polar-500 text-lg text-gray-400">
          Built for simplicity
        </span>
        <h1 className="w-fit max-w-2xl text-pretty text-center text-2xl md:text-4xl md:leading-normal">
          Powerful Checkouts made simple
        </h1>
        <Link href="/docs/guides/checkout">
          <Button
            fullWidth
            wrapperClassNames="flex flex-row items-center gap-x-1"
            variant="secondary"
          >
            <span>Integrate Checkouts</span>
            <KeyboardArrowRight className="text-lg" fontSize="inherit" />
          </Button>
        </Link>
      </div>
      <div className="relative h-[490px] overflow-hidden">
        <div className="absolute shadow-3xl rounded-4xl top-16 left-8 pointer-events-none right-8 md:left-16 md:right-16 flex flex-col items-center">
          <CheckoutComponent organization={ORGANIZATION} checkout={CHECKOUT_PREVIEW} />
        </div>
      </div>
    </div>
  )
}
