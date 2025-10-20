import { CHECKOUT_PREVIEW } from '@/components/Customization/utils'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import { Suspense, lazy, useEffect, useRef, useState } from 'react'

const CheckoutComponent = lazy(() => import('@/components/Checkout/Checkout'))
const DummyCheckoutContextProvider = lazy(() =>
  import('../Checkout/DummyCheckoutContextProvider').then((module) => ({
    default: module.DummyCheckoutContextProvider,
  })),
)

const useIntersectionObserver = () => {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 },
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [])

  return { ref, isVisible }
}

export const Checkout = () => {
  const { ref, isVisible } = useIntersectionObserver()

  return (
    <div
      ref={ref}
      className="dark:bg-polar-900 hidden w-full flex-col overflow-hidden rounded-4xl bg-white md:flex"
    >
      <div className="flex flex-col items-center gap-y-8 px-8 pt-8 md:px-16 md:pt-16">
        <span className="dark:text-polar-500 text-lg text-gray-400">
          Built for simplicity
        </span>
        <h1 className="w-fit max-w-2xl text-center text-2xl text-pretty md:text-4xl md:leading-normal">
          Powerful Checkouts made simple
        </h1>
        <Link href="https://polar.sh/docs/documentation/features/checkouts/checkout-links">
          <Button
            fullWidth
            wrapperClassNames="flex flex-row items-center gap-x-2"
            variant="secondary"
            className="rounded-full"
          >
            <span>Integrate Checkouts</span>
            <ArrowOutwardOutlined fontSize="inherit" />
          </Button>
        </Link>
      </div>
      <div className="relative h-[490px] overflow-hidden">
        <div className="shadow-3xl pointer-events-none absolute top-16 right-8 left-8 flex flex-col items-center rounded-4xl md:right-16 md:left-16">
          <Suspense
            fallback={
              <div className="dark:bg-polar-700 h-full w-full animate-pulse rounded-lg bg-gray-300" />
            }
          >
            {isVisible && (
              <DummyCheckoutContextProvider checkout={CHECKOUT_PREVIEW}>
                <CheckoutComponent />
              </DummyCheckoutContextProvider>
            )}
          </Suspense>
        </div>
      </div>
    </div>
  )
}
