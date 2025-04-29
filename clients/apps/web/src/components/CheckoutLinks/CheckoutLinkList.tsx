import { CheckoutLinkManagementModal } from '@/components/CheckoutLinks/CheckoutLinkManagementModal'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import ProductSelect from '@/components/Products/ProductSelect'
import Spinner from '@/components/Shared/Spinner'
import { useCheckoutLinks } from '@/hooks/queries'
import { useInViewport } from '@/hooks/utils'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { AddOutlined, ArrowDownward, ArrowUpward } from '@mui/icons-material'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useContext, useEffect, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

export interface CheckoutLinkListProps {
  selectedCheckoutLinkId: string | null
  setSelectedCheckoutLinkId: (id: string) => void
}

export const CheckoutLinkList = ({
  selectedCheckoutLinkId,
  setSelectedCheckoutLinkId,
}: CheckoutLinkListProps) => {
  const { organization } = useContext(OrganizationContext)

  const [sorting, setSorting] = useQueryState(
    'sorting',
    parseAsStringLiteral([
      '-created_at',
      'created_at',
      'label',
      '-label',
    ] as const).withDefault('-created_at'),
  )
  const [productIds, setProductIds] = useQueryState(
    'productId',
    parseAsArrayOf(parseAsString),
  )

  const { data, fetchNextPage, hasNextPage } = useCheckoutLinks(
    organization.id,
    {
      sorting: [sorting],
      product_id: productIds,
    },
  )

  const checkoutLinks = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  )

  const {
    show: showCreateCheckoutLinkModal,
    hide: hideCreateCheckoutLinkModal,
    isShown: isCreateCheckoutLinkModalOpen,
  } = useModal()

  const { ref: loadingRef, inViewport } = useInViewport<HTMLDivElement>()

  useEffect(() => {
    if (inViewport && hasNextPage) {
      fetchNextPage()
    }
  }, [inViewport, hasNextPage, fetchNextPage])

  useEffect(() => {
    if (checkoutLinks.length > 0 && !selectedCheckoutLinkId) {
      setSelectedCheckoutLinkId(checkoutLinks[0].id)
    }
  }, [checkoutLinks, setSelectedCheckoutLinkId, selectedCheckoutLinkId])

  return (
    <div className="dark:divide-polar-800 flex h-full flex-col divide-y divide-gray-200">
      <div className="flex flex-row items-center justify-between gap-6 px-4 py-4">
        <div>Checkout Links</div>
        <div className="flex flex-row items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() =>
              setSorting(
                sorting === '-created_at' ? 'created_at' : '-created_at',
              )
            }
          >
            {sorting === 'created_at' ? (
              <ArrowUpward fontSize="small" />
            ) : (
              <ArrowDownward fontSize="small" />
            )}
          </Button>
          <Button
            size="icon"
            className="h-6 w-6"
            onClick={showCreateCheckoutLinkModal}
          >
            <AddOutlined fontSize="small" />
          </Button>
        </div>
      </div>
      <div className="flex flex-row items-center gap-3 px-2 py-2">
        <ProductSelect
          organization={organization}
          value={productIds ?? []}
          onChange={(productIds) => setProductIds(productIds)}
        />
      </div>
      <div className="dark:divide-polar-800 flex h-full flex-grow flex-col divide-y divide-gray-50 overflow-y-auto">
        {checkoutLinks.map((checkoutLink) => {
          const productLabel =
            checkoutLink.products.length === 1
              ? checkoutLink.products[0].name
              : `${checkoutLink.products.length} Products`

          return (
            <div
              key={checkoutLink.id}
              onClick={() => setSelectedCheckoutLinkId(checkoutLink.id)}
              className={twMerge(
                'dark:hover:bg-polar-800 cursor-pointer hover:bg-gray-100',
                selectedCheckoutLinkId === checkoutLink.id &&
                  'dark:bg-polar-800 bg-gray-100',
              )}
            >
              <div className="flex flex-row items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="w-full truncate text-sm">
                    {checkoutLink.label ?? '—'}
                  </div>
                  <div>
                    <div className="w-full truncate text-sm text-gray-500 dark:text-gray-500">
                      {productLabel}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {hasNextPage && (
          <div
            ref={loadingRef}
            className="flex w-full items-center justify-center py-8"
          >
            <Spinner />
          </div>
        )}
      </div>
      <InlineModal
        isShown={isCreateCheckoutLinkModalOpen}
        hide={hideCreateCheckoutLinkModal}
        modalContent={
          <CheckoutLinkManagementModal
            organization={organization}
            onClose={(checkoutLink) => {
              setSelectedCheckoutLinkId(checkoutLink.id)
              setProductIds([])
              hideCreateCheckoutLinkModal()
            }}
          />
        }
      />
    </div>
  )
}
