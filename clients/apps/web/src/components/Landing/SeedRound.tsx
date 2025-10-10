import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import { PolarLogotype } from '../Layout/Public/PolarLogotype'

export const SeedRound = () => {
  return (
    <Link href="/blog/polar-seed-announcement" target="_blank">
      <div className="dark:bg-polar-900 md:rounded-4xl flex w-full flex-col gap-y-12 overflow-hidden rounded-2xl bg-white">
        <div className="flex flex-col items-center gap-y-8 px-8 pt-8 md:px-16 md:pt-16">
          <span className="dark:text-polar-500 text-lg text-gray-400">
            Seed Investment
          </span>
          <h1 className="w-fit max-w-2xl text-pretty text-center text-2xl md:text-4xl md:leading-normal">
            Announcing our $10M Seed Round
          </h1>
          <Button
            fullWidth
            wrapperClassNames="flex flex-row items-center gap-x-2 w-fit"
            variant="secondary"
            className="!w-fit rounded-full"
          >
            <span>Read the announcement</span>
            <ArrowOutwardOutlined fontSize="inherit" />
          </Button>
        </div>
        <div
          className="relative m-2 flex h-96 items-center justify-center rounded-xl md:m-4 md:rounded-3xl"
          style={{
            backgroundImage: 'url(/assets/landing/abstract_07.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <PolarLogotype
            logoVariant="logotype"
            logoClassName="text-white dark:text-white"
            size={280}
          />
        </div>
      </div>
    </Link>
  )
}
