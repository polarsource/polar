import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'

export const Pricing = () => {
  return (
    <div id="pricing" className="flex w-full flex-col gap-y-12">
      <div className="flex flex-col items-center">
        <span className="dark:text-polar-500 text-lg text-gray-400">
          Early Member Pricing
        </span>
        <h1 className="w-fit max-w-xl pt-8 pb-12 text-center text-2xl text-pretty md:text-4xl">
          4% + 40¢ per transaction
        </h1>
        <Link href="/resources/pricing" target="_blank">
          <Button variant="secondary" className="rounded-full">
            <span>Learn more</span>
            <ArrowOutwardOutlined className="ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
