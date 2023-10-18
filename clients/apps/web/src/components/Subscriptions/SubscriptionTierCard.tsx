import { CheckOutlined } from '@mui/icons-material'
import { SubscriptionGroup, SubscriptionTier } from '@polar-sh/sdk'
import { Card, CardContent, CardHeader } from 'polarkit/components/ui/card'
import { Separator } from 'polarkit/components/ui/separator'
import { Skeleton } from 'polarkit/components/ui/skeleton'
import { getCentsInDollarString } from 'polarkit/money'
import SubscriptionGroupIcon from './SubscriptionGroupIcon'

interface SubscriptionTierCardProps {
  subscriptionGroup: SubscriptionGroup
  subscriptionTier: Partial<SubscriptionTier>
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

enum BenefitType {
  BADGE,
  AVATAR_README_SM,
  AVATAR_README_MD,
  AVATAR_README_LG,
  LOGO_README_SM,
  LOGO_README_MD,
  LOGO_README_LG,
  CONSULTANCY,
  SUPPORT,
  FEATURE_REQUEST,
  CUSTOM,
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
  subscriptionGroup,
}) => {
  const style = {
    '--var-bg-color': hexToRGBA(subscriptionGroup.color, 0.1),
    '--var-border-color': hexToRGBA(subscriptionGroup.color, 0.15),
    '--var-muted-color': hexToRGBA(subscriptionGroup.color, 0.5),
    '--var-fg-color': subscriptionGroup.color,
  } as React.CSSProperties

  return (
    <Card
      className="flex h-full flex-col gap-y-8 rounded-3xl border-0 bg-[--var-bg-color] bg-gradient-to-tr p-10 shadow-none transition-opacity hover:opacity-50 dark:hover:opacity-80"
      style={style}
    >
      <CardHeader className="grow gap-y-8 p-0">
        <div className="flex justify-between">
          <h3 className="text-lg font-medium">
            {subscriptionTier.name ? (
              subscriptionTier.name
            ) : (
              <Skeleton className="inline-block h-4 w-[150px]" />
            )}
          </h3>
          <SubscriptionGroupIcon
            icon={subscriptionGroup.icon}
            color={subscriptionGroup.color}
          />
        </div>
        <div className="flex flex-col gap-y-8 text-[--var-fg-color]">
          <div className="text-6xl !font-[200]">
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
            <span className="ml-2 text-lg font-normal text-[--var-muted-color]">
              /mo
            </span>
          </div>
          {subscriptionTier.description ? (
            <p className="text-sm leading-relaxed">
              {subscriptionTier.description}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <Skeleton className="inline-block h-2 w-full" />
              <Skeleton className="inline-block h-2 w-full" />
              <Skeleton className="inline-block h-2 w-full" />
            </div>
          )}
        </div>
      </CardHeader>
      <Separator className="bg-[--var-border-color]" />
      <CardContent className="flex shrink flex-col gap-y-1 p-0">
        {mockedBenefits.map((benefit) => (
          <div className="flex flex-row items-center text-[--var-fg-color]">
            <CheckOutlined className="h-4 w-4" fontSize="small" />
            <span className="ml-2 text-sm">{benefit.summary}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default SubscriptionTierCard
