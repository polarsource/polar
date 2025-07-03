import { ArrowOutwardOutlined } from '@mui/icons-material'
import { RawButton } from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'

export const Pricing = () => {
  return (
    <section id="pricing" className="flex w-full flex-col gap-y-12">
      <div className="flex flex-col items-center">
        <span className="dark:text-polar-500 text-lg text-gray-400">
          Early Member Pricing
        </span>
        <h1 className="w-fit max-w-xl text-pretty pb-12 pt-8 text-center text-2xl md:text-4xl">
          4% + 40¢ per transaction
        </h1>
        <RawButton variant="secondary" className="rounded-full" asChild>
          <Link
            href="https://docs.polar.sh/merchant-of-record/fees"
            target="_blank"
          >
            <span>Learn more</span>
            <ArrowOutwardOutlined className="ml-2" />
          </Link>
        </RawButton>
      </div>
    </section>
  )
}
