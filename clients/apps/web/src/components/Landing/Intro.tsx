import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import GetStartedButton from '../Auth/GetStartedButton'
import { SplitPromo } from './molecules/SplitPromo'

export const Intro = () => {
  return (
    <div className="flex flex-col gap-y-12">
      <SplitPromo
        title="Sell with 6 lines of code"
        description="Polar is the simplest way to integrate payments & billing with your stack"
        image="/assets/landing/intro.jpg"
        bullets={[
          'Setup in under a minute',
          'Reliable, secure & fast',
          'Global Merchant of Record',
        ]}
        cta1={
          <GetStartedButton
            className="bg-black font-medium text-white hover:bg-gray-900 dark:bg-white dark:text-black"
            text="Sell with Polar"
            size="default"
          />
        }
        cta2={
          <Link href="https://docs.polar.sh/api-reference">
            <Button variant="ghost">API Reference</Button>
          </Link>
        }
      />
    </div>
  )
}
