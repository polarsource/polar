'use client'

import { CheckOutlined } from '@mui/icons-material'
import { SubscriptionTier } from '@polar-sh/sdk'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/card'
import { Separator } from 'polarkit/components/ui/separator'
import { Skeleton } from 'polarkit/components/ui/skeleton'
import { getCentsInDollarString } from 'polarkit/money'
import { MouseEventHandler, useCallback, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import SubscriptionGroupIcon from './SubscriptionGroupIcon'
import { getSubscriptionColorByType } from './utils'

interface SubscriptionTierCardProps {
  subscriptionTier: Partial<SubscriptionTier>
  children?: React.ReactNode
  className?: string
}

const hexToRGBA = (hex: string, opacity: number): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(
        result[3],
        16,
      )}, ${opacity})`
    : ''
}

const mockedBenefits = [
  {
    id: '123',
    summary: 'Badge on Profile',
  },
  {
    id: '456',
    summary: 'Small Logo in README',
  },
  {
    id: '789',
    summary: 'Discord Support Channel',
  },
]

const SubscriptionTierCard: React.FC<SubscriptionTierCardProps> = ({
  subscriptionTier,
  children,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const subscriptionColor = getSubscriptionColorByType(subscriptionTier.type)
  const [shineActive, setShineActive] = useState(false)

  const style = {
    '--var-bg-color': hexToRGBA(subscriptionColor, 0.2),
    '--var-border-color': hexToRGBA(subscriptionColor, 0.3),
    '--var-muted-color': hexToRGBA(subscriptionColor, 0.7),
    '--var-fg-color': subscriptionColor,
    '--var-dark-glow-color': hexToRGBA(subscriptionColor, 0.07),
    '--var-dark-border-color': hexToRGBA(subscriptionColor, 0.15),
    '--var-dark-muted-color': hexToRGBA(subscriptionColor, 0.5),
    '--var-dark-fg-color': subscriptionColor,
  } as React.CSSProperties

  const onMouseMove: MouseEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if (containerRef.current) {
        const { x, y } = containerRef.current.getBoundingClientRect()
        containerRef.current.style.setProperty('--x', String(e.clientX - x))
        containerRef.current.style.setProperty('--y', String(e.clientY - y))
      }
    },
    [containerRef],
  )

  const onMouseEnter = useCallback(() => {
    setShineActive(true)
  }, [setShineActive])

  const onMouseLeave = useCallback(() => {
    setShineActive(false)
  }, [setShineActive])

  return (
    <Card
      ref={containerRef}
      className={twMerge(
        'dark:bg-polar-900 dark:border-polar-700 relative flex min-w-[280px] max-w-[320px] flex-col gap-y-4 overflow-hidden rounded-3xl border border-transparent bg-[--var-bg-color] p-8 dark:shadow-none',
        className,
      )}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
    >
      <Shine active={shineActive} />
      <CardHeader className="grow gap-y-6 p-0">
        <div className="flex justify-between">
          <h3 className="truncate text-lg font-medium">
            {subscriptionTier.name ? (
              subscriptionTier.name
            ) : (
              <Skeleton className="inline-block h-4 w-[150px] bg-[var(--var-muted-color)] dark:bg-[var(--var-dark-muted-color)]" />
            )}
          </h3>
          <SubscriptionGroupIcon
            className="h-8! w-8! ml-2 text-2xl"
            type={subscriptionTier.type}
          />
        </div>
        <div className="flex flex-col gap-y-8 text-[--var-fg-color] dark:text-[--var-dark-fg-color]">
          <div className="text-5xl !font-[200]">
            {
              <>
                $
                {getCentsInDollarString(
                  subscriptionTier.price_amount ?? 0,
                  false,
                  true,
                )}
              </>
            }
            <span className="ml-4 text-xl font-normal text-[--var-muted-color]">
              /mo
            </span>
          </div>
          {subscriptionTier.description ? (
            <p className="text-sm leading-relaxed text-[--var-muted-color] dark:text-[--var-dark-muted-color]">
              {subscriptionTier.description}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <Skeleton className="inline-block h-2 w-full bg-[var(--var-muted-color)] dark:bg-[var(--var-dark-muted-color)]" />
              <Skeleton className="inline-block h-2 w-full bg-[var(--var-muted-color)] dark:bg-[var(--var-dark-muted-color)]" />
              <Skeleton className="inline-block h-2 w-full bg-[var(--var-muted-color)] dark:bg-[var(--var-dark-muted-color)]" />
            </div>
          )}
        </div>
      </CardHeader>
      <Separator className="bg-[--var-border-color] dark:bg-[--var-dark-border-color]" />
      <CardContent className="flex shrink flex-col gap-y-1 p-0">
        {mockedBenefits.map((benefit) => (
          <div
            key={benefit.id}
            className="flex flex-row items-center text-[--var-fg-color] dark:text-[--var-dark-fg-color]"
          >
            <CheckOutlined className="h-4 w-4" fontSize="small" />
            <span className="ml-2 text-sm">{benefit.summary}</span>
          </div>
        ))}
      </CardContent>
      {children && (
        <CardFooter className="mt-4 flex w-full flex-row p-0">
          {children}
        </CardFooter>
      )}
    </Card>
  )
}

export default SubscriptionTierCard

const Shine = ({ active = false }: { active: boolean }) => {
  return (
    <div
      style={{
        content: '',
        top: `calc(var(--y, 0) * 1px - 400px)`,
        left: `calc(var(--x, 0) * 1px - 400px)`,
        background: `radial-gradient(var(--var-dark-glow-color), #ffffff00 70%)`,
      }}
      className={twMerge(
        'pointer-events-none absolute h-[800px] w-[800px] opacity-0 transition-opacity duration-300',
        active && 'dark:opacity-100',
      )}
    />
  )
}
