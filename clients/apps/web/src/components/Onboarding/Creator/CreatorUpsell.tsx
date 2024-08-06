import { CheckOutlined, DonutLargeOutlined } from '@mui/icons-material'
import Link from 'next/link'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { twMerge } from 'tailwind-merge'
import { useUpsellSteps } from './useUpsellSteps'

export const CreatorUpsell = () => {
  const steps = useUpsellSteps()

  return (
    <div className="flex flex-col gap-y-8">
      <div className="flex grid-cols-2 flex-col gap-6 md:grid xl:grid-cols-3">
        <div className="col-span-2 flex flex-col gap-y-4 md:gap-y-6 md:py-6 lg:col-span-1">
          <DonutLargeOutlined
            className="hidden text-blue-500 md:block dark:text-blue-400"
            fontSize="large"
          />
          <h2 className="text-2xl font-bold">Next Up</h2>
          <p className="dark:text-polar-400 text-gray-600 [text-wrap:balance]">
            Here are a few things you can do to reach your next goal on Polar
          </p>
        </div>
        <div className="col-span-2 flex flex-col gap-y-4">
          {steps.map((card, i) => (
            <UpsellStep key={card.title} {...card} index={i + 1} />
          ))}
        </div>
      </div>
    </div>
  )
}

export interface UpsellStepProps {
  title: string
  description: string
  href: string
  newTab?: boolean
  done?: boolean
  index: number
}

export const UpsellStep = ({
  title,
  description,
  href,
  newTab,
  done,
  index,
}: UpsellStepProps) => {
  return (
    <Link
      href={done ? '#' : href}
      className="relative"
      target={newTab ? '_blank' : '_self'}
    >
      <ShadowBox className="dark:hover:bg-polar-800 relative flex h-full flex-row items-center justify-between gap-x-6 transition-colors hover:bg-gray-50">
        <div className="flex flex-row items-center gap-x-6">
          {done ? (
            <div className="flex h-8 w-8 flex-shrink-0 cursor-pointer flex-col items-center justify-center rounded-full bg-blue-500 text-white">
              <CheckOutlined fontSize="inherit" />
            </div>
          ) : (
            <div className="dark:bg-polar-700 flex h-8 w-8 flex-shrink-0 flex-col items-center justify-center rounded-full bg-gray-100 text-sm text-gray-500 dark:text-white">
              {index}
            </div>
          )}
          <div
            className={twMerge('flex flex-col gap-y-1', done && 'opacity-30')}
          >
            <h3 className="font-medium [text-wrap:balance]">{title}</h3>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              {description}
            </p>
          </div>
        </div>
      </ShadowBox>
    </Link>
  )
}
