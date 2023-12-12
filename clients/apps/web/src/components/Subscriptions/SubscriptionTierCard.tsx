'use client'

import { AddOutlined } from '@mui/icons-material'
import { SubscriptionTier } from '@polar-sh/sdk'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms'
import { Separator } from 'polarkit/components/ui/separator'
import { Skeleton } from 'polarkit/components/ui/skeleton'
import { getCentsInDollarString } from 'polarkit/money'
import { MouseEventHandler, useCallback, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import SubscriptionGroupIcon from './SubscriptionGroupIcon'
import { getSubscriptionColorByType, resolveBenefitIcon } from './utils'

interface SubscriptionTierCardProps {
  subscriptionTier: Partial<SubscriptionTier>
  children?: React.ReactNode
  className?: string
  variant?: 'default' | 'small'
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

const SubscriptionTierCard: React.FC<SubscriptionTierCardProps> = ({
  subscriptionTier,
  children,
  className,
  variant = 'default',
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const subscriptionColor = getSubscriptionColorByType(subscriptionTier.type)
  const [shineActive, setShineActive] = useState(false)

  const style = {
    '--var-bg-color': hexToRGBA(subscriptionColor, 0.2),
    '--var-border-color': hexToRGBA(subscriptionColor, 0.2),
    '--var-muted-color': hexToRGBA(subscriptionColor, 0.7),
    '--var-fg-color': subscriptionColor,
    '--var-dark-glow-color': hexToRGBA(subscriptionColor, 0.05),
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

  const benefitsToDisplay = (subscriptionTier.benefits ?? []).slice(0, 3)
  const additionalBenefits = (subscriptionTier.benefits ?? []).slice(3)

  const variantStyles = {
    default: {
      name: 'text-lg',
      card: 'p-8',
      priceLabel: 'text-5xl !font-[200]',
      description: 'text-sm',
      footer: 'mt-4',
    },
    small: {
      name: 'text-md',
      card: 'p-6',
      priceLabel: 'text-4xl !font-[200]',
      description: 'text-sm',
      footer: 'mt-none',
    },
  }

  return (
    <Card
      ref={containerRef}
      className={twMerge(
        'dark:bg-polar-900 dark:border-polar-800 relative flex flex-col gap-y-6 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm',
        variantStyles[variant]['card'],
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
          <h3
            className={twMerge(
              'truncate font-medium',
              variantStyles[variant]['name'],
            )}
          >
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
        <div className="flex flex-col gap-y-8 text-gray-950 dark:text-[--var-dark-fg-color]">
          <div className={variantStyles[variant]['priceLabel']}>
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
            <span className="ml-4 text-xl font-normal text-gray-500">/mo</span>
          </div>
          {subscriptionTier.description ? (
            <p
              className={twMerge(
                variantStyles[variant].description,
                'dark:text-polar-500 line-clamp-4 leading-relaxed text-gray-500',
              )}
            >
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
      {benefitsToDisplay.length > 0 && subscriptionTier.description && (
        <Separator className="dark:bg-polar-700 bg-gray-200" />
      )}
      <CardContent className="flex h-full grow flex-col gap-y-2 p-0">
        {benefitsToDisplay.map((benefit) => (
          <div
            key={benefit.id}
            className="flex flex-row items-start text-gray-950 dark:text-[--var-dark-fg-color]"
          >
            {resolveBenefitIcon(benefit, false)}
            <span className="-mt-[2px] ml-3 text-sm">
              {benefit.description}
            </span>
          </div>
        ))}
        {additionalBenefits.length > 0 && (
          <div className="dark:text-polar-400 mt-2 flex flex-row items-center text-gray-500">
            <AddOutlined className="h-4 w-4" fontSize="small" />
            <span className="ml-2 text-sm">
              {additionalBenefits.length} more{' '}
              {additionalBenefits.length > 1 ? 'benefits' : 'benefit'}
            </span>
          </div>
        )}
      </CardContent>
      {children && (
        <CardFooter
          className={twMerge(
            'flex w-full flex-row p-0',
            variantStyles[variant].footer,
          )}
        >
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
