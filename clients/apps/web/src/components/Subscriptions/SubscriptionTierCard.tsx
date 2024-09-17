'use client'

import {
  useProductAudience,
  useRecurringBillingLabel,
  useRecurringProductPrice,
} from '@/hooks/products'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DragIndicatorOutlined } from '@mui/icons-material'
import {
  Product,
  SubscriptionRecurringInterval,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import Markdown from 'markdown-to-jsx'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { Separator } from 'polarkit/components/ui/separator'
import { formatCurrencyAndAmount } from 'polarkit/lib/money'
import { useRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { resolveBenefitIcon } from '../Benefit/utils'
import { markdownOpts } from '../Feed/Markdown/markdown'
import SubscriptionGroupIcon from './SubscriptionGroupIcon'

export interface SubscriptionTierCardProps {
  subscriptionTier: Partial<Product> & { type: SubscriptionTierType }
  children?: React.ReactNode
  className?: string
  variant?: 'default' | 'small'
  draggable?: ReturnType<typeof useSortable>
  recurringInterval?: SubscriptionRecurringInterval
}

const SubscriptionTierCard: React.FC<SubscriptionTierCardProps> = ({
  subscriptionTier,
  children,
  className,
  variant = 'default',
  draggable,
  recurringInterval = SubscriptionRecurringInterval.MONTH,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const audience = useProductAudience(subscriptionTier.type)
  const price = useRecurringProductPrice(subscriptionTier, recurringInterval)
  const recurringBillingLabel = useRecurringBillingLabel(
    price ? price.recurring_interval : null,
  )

  const style = {
    ...(draggable
      ? {
          transform: CSS.Transform.toString(draggable.transform),
          transition: draggable.transition,
        }
      : {}),
  } as React.CSSProperties

  const variantStyles = {
    default: {
      name: 'text-lg',
      card: 'p-8 min-h-[400px]',
      priceLabel: 'text-4xl !font-[200]',
      description: 'text-sm',
      footer: 'mt-4',
    },
    small: {
      name: 'text-md',
      card: 'p-6 min-h-[360px]',
      priceLabel: 'text-4xl !font-[200]',
      description: 'text-sm',
      footer: 'mt-none',
    },
  }

  return (
    <Card
      ref={(v) => {
        if (draggable) {
          draggable.setNodeRef(v)
        }

        containerRef.current = v
      }}
      id={subscriptionTier.name}
      className={twMerge(
        'dark:bg-polar-900 rounded-4xl relative flex flex-col gap-y-6 overflow-hidden border-none hover:bg-gray-50',
        draggable?.isDragging && 'opacity-30',
        variantStyles[variant]['card'],
        className,
      )}
      style={style}
    >
      <CardHeader className="grow gap-y-6 p-0">
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-row items-center justify-between">
            <span className="dark:text-polar-500 text-xs text-gray-500">
              {audience}
            </span>
            {draggable && (
              <span
                ref={draggable.setDraggableNodeRef}
                className="cursor-grab"
                {...draggable.attributes}
                {...draggable.listeners}
              >
                <DragIndicatorOutlined
                  className={twMerge('dark:text-polar-600 text-gray-400')}
                  fontSize="small"
                />
              </span>
            )}
          </div>
          <div className="flex justify-between">
            <h3
              className={twMerge(
                'truncate font-medium',
                variantStyles[variant]['name'],
              )}
            >
              {subscriptionTier.name}
            </h3>
            <SubscriptionGroupIcon
              className="h-8! w-8! ml-2 text-2xl"
              type={subscriptionTier.type}
            />
          </div>
        </div>
        <div className="flex flex-col gap-y-8 text-[--var-fg-color] dark:text-[--var-dark-fg-color]">
          <div className={variantStyles[variant]['priceLabel']}>
            {price ? (
              <>
                {price.amount_type === 'fixed' ? (
                  <>
                    {formatCurrencyAndAmount(
                      price.price_amount,
                      price.price_currency,
                      0,
                    )}
                    <span className="dark:text-polar-500 ml-2 text-xl font-normal text-gray-500">
                      {recurringBillingLabel}
                    </span>
                  </>
                ) : (
                  'Pay what you want'
                )}
              </>
            ) : (
              '$0'
            )}
          </div>
          <div
            className={twMerge(
              variantStyles[variant].description,
              'prose dark:prose-invert prose-headings:mt-8 prose-headings:font-semibold prose-headings:text-black prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-h5:text-md dark:prose-headings:text-polar-50 dark:text-polar-300 max-h-64 max-w-4xl overflow-hidden text-gray-800',
            )}
          >
            <Markdown
              options={{
                ...markdownOpts,
                overrides: {
                  ...markdownOpts.overrides,
                  a: (props) => (
                    <a {...props} rel="noopener noreferrer nofollow" />
                  ),
                },
              }}
            >
              {subscriptionTier.description ?? ''}
            </Markdown>
          </div>
        </div>
      </CardHeader>

      {(subscriptionTier.benefits?.length ?? 0) > 0 &&
        subscriptionTier.description && (
          <Separator className="dark:bg-polar-700 bg-gray-200" />
        )}
      <CardContent className="flex h-full grow flex-col gap-y-2 p-0">
        {subscriptionTier.benefits?.map((benefit) => (
          <div
            key={benefit.id}
            className="flex flex-row items-start text-[--var-fg-color] dark:text-[--var-dark-fg-color]"
          >
            <span className="flex shrink-0 flex-row items-center justify-center rounded-full bg-[--var-border-color] text-2xl leading-none dark:bg-[--var-dark-border-color]">
              {resolveBenefitIcon(benefit, 'inherit')}
            </span>
            <span className="ml-3 text-sm leading-normal">
              {benefit.description}
            </span>
          </div>
        ))}
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
