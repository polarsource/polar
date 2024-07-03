import revalidate from '@/app/actions'
import SubscriptionGroupIcon from '@/components/Subscriptions/SubscriptionGroupIcon'
import { useUpdateProduct } from '@/hooks/queries'
import { AddOutlined, CloseOutlined } from '@mui/icons-material'
import { Organization, Product, SubscriptionTierType } from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import { useCallback, useMemo } from 'react'

export interface HighlightedTiersModalProps {
  subscriptionTiers: Product[]
  organization: Organization
  hideModal: () => void
}

export const HighlightedTiersModal = ({
  subscriptionTiers,
  organization,
  hideModal,
}: HighlightedTiersModalProps) => {
  const updateProductMutation = useUpdateProduct()

  const selectSubscriptionTier = useCallback(
    async (id: string) => {
      await updateProductMutation.mutateAsync({
        id,
        body: {
          is_highlighted: true,
        },
      })

      await revalidate(`products:${organization.id}`)
    },
    [updateProductMutation, organization],
  )

  const individualTiers = useMemo(
    () =>
      subscriptionTiers.filter(
        ({ type }) => type === SubscriptionTierType.INDIVIDUAL,
      ),
    [subscriptionTiers],
  )
  const businessTiers = useMemo(
    () =>
      subscriptionTiers.filter(
        ({ type }) => type === SubscriptionTierType.BUSINESS,
      ),
    [subscriptionTiers],
  )

  const highlightedTiers = useMemo(() => {
    const individual = individualTiers.find(
      ({ is_highlighted }) => is_highlighted,
    )
    const business = businessTiers.find(({ is_highlighted }) => is_highlighted)

    return { individual, business }
  }, [individualTiers, businessTiers])

  return (
    <div className="relative flex flex-col gap-y-8 p-10">
      <div className="absolute right-6 top-6">
        <Button
          className="focus-visible:ring-0"
          onClick={hideModal}
          size="icon"
          variant="ghost"
        >
          <CloseOutlined
            className="dark:text-polar-200 text-gray-700"
            fontSize="small"
          />
        </Button>
      </div>
      <div className="flex flex-col gap-y-2">
        <h3>Highlighted Subscription Tiers</h3>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Select subscription tiers that you want to highlight on the profile.
        </p>
      </div>
      <div className="flex w-full flex-col gap-y-8">
        <div className="flex max-h-[420px] w-full flex-col gap-y-6 overflow-y-auto">
          <div className="flex flex-col gap-y-2">
            <Select
              onValueChange={selectSubscriptionTier}
              defaultValue={highlightedTiers.individual?.id}
            >
              <div className="flex flex-row items-center justify-between">
                <span className="text-sm font-medium">Individual</span>
              </div>

              <SelectTrigger>
                <SelectValue placeholder="Select a Tier" />
              </SelectTrigger>
              <SelectContent>
                {individualTiers.map((tier) => (
                  <SelectItem key={tier.id} value={tier.id}>
                    <div className="flex items-center gap-2">
                      <SubscriptionGroupIcon
                        type={tier.type as SubscriptionTierType}
                      />
                      {tier.name}
                    </div>
                  </SelectItem>
                ))}

                <Link
                  className="flex flex-row items-center gap-2 px-7 py-2 text-sm text-blue-500 dark:text-blue-400"
                  href={`/maintainer/${organization.name}/products/overview`}
                >
                  <AddOutlined fontSize="small" />
                  <span>Create New</span>
                </Link>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-y-2">
            <Select
              onValueChange={selectSubscriptionTier}
              defaultValue={highlightedTiers.business?.id}
            >
              <div className="flex flex-row items-center justify-between">
                <span className="text-sm font-medium">Business</span>
              </div>
              <SelectTrigger>
                <SelectValue placeholder="Select a Tier" />
              </SelectTrigger>
              <SelectContent>
                {businessTiers.map((tier) => (
                  <SelectItem key={tier.id} value={tier.id}>
                    <div className="flex items-center gap-2">
                      <SubscriptionGroupIcon
                        type={tier.type as SubscriptionTierType}
                      />
                      {tier.name}
                    </div>
                  </SelectItem>
                ))}
                <Link
                  className="flex flex-row items-center gap-2 px-7 py-2 text-sm text-blue-500 dark:text-blue-400"
                  href={`/maintainer/${organization.name}/products/overview`}
                >
                  <AddOutlined fontSize="small" />
                  <span>Create New</span>
                </Link>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-8 flex flex-col">
            <Link href={`/maintainer/${organization.name}/products/overview`}>
              <Button size="sm">Manage Tiers</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
