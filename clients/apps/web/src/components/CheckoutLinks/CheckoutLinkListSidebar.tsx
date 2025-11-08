'use client'

import { CheckoutLinkManagementModal } from '@/components/CheckoutLinks/CheckoutLinkManagementModal'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import ProductSelect from '@/components/Products/ProductSelect'
import Spinner from '@/components/Shared/Spinner'
import { toast } from '@/components/Toast/use-toast'
import { useCheckoutLinks } from '@/hooks/queries'
import { useInViewport } from '@/hooks/utils'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useEffect, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

export const CheckoutLinkListSidebar = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [productIds, setProductIds] = useQueryState(
    'productId',
    parseAsArrayOf(parseAsString),
  )

  const [sorting, setSorting] = useQueryState(
    'sorting',
    parseAsStringLiteral([
      '-created_at',
      'created_at',
      'label',
      '-label',
    ] as const).withDefault('-created_at'),
  )

  const [createCheckoutLinkQuerystring, setCreateCheckoutLinkQuerystring] =
    useQueryState('create_checkout_link', parseAsBoolean.withDefault(false))

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
    isShown: isCreateCheckoutLinkModalShown,
    show: showCreateCheckoutLinkModal,
    hide: hideCreateCheckoutLinkModal,
  } = useModal()

  const { ref: loadingRef, inViewport } = useInViewport<HTMLDivElement>()

  useEffect(() => {
    if (inViewport && hasNextPage) {
      fetchNextPage()
    }
  }, [inViewport, hasNextPage, fetchNextPage])

  useEffect(() => {
    if (createCheckoutLinkQuerystring) {
      showCreateCheckoutLinkModal()
      setCreateCheckoutLinkQuerystring(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createCheckoutLinkQuerystring, setCreateCheckoutLinkQuerystring])

  const selectedCheckoutLinkId = useMemo(() => {
    const parts = pathname.split('/')
    const checkoutLinksIndex = parts.indexOf('checkout-links')
    if (checkoutLinksIndex !== -1 && parts[checkoutLinksIndex + 1]) {
      return parts[checkoutLinksIndex + 1]
    }
    return null
  }, [pathname])

  return (
    <>
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
        <div className="dark:divide-polar-800 flex h-full grow flex-col divide-y divide-gray-50 overflow-y-auto">
          {checkoutLinks.map((checkoutLink) => {
            const productLabel =
              checkoutLink.products.length === 1
                ? checkoutLink.products[0].name
                : `${checkoutLink.products.length} Products`

            const queryString = searchParams.toString()
            const checkoutLinkHref = `/dashboard/${organization.slug}/products/checkout-links/${checkoutLink.id}${queryString ? `?${queryString}` : ''}`

            return (
              <Link
                key={checkoutLink.id}
                href={checkoutLinkHref}
                className={twMerge(
                  'dark:hover:bg-polar-800 cursor-pointer hover:bg-gray-100',
                  selectedCheckoutLinkId === checkoutLink.id &&
                    'dark:bg-polar-800 bg-gray-100',
                )}
              >
                <div className="flex flex-row items-center gap-3 px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="w-full truncate text-sm">
                      {checkoutLink.label ?? 'Untitled'}
                    </div>
                    <div>
                      <div className="dark:text-polar-500 w-full truncate text-sm text-gray-500">
                        {productLabel}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()

                      if (typeof navigator !== 'undefined') {
                        navigator.clipboard.writeText(checkoutLink.url)

                        toast({
                          title: 'Checkout Link Copied',
                          description: `Checkout Link was copied to clipboard`,
                        })
                      }
                    }}
                  >
                    <LinkOutlined fontSize="small" />
                  </Button>
                </div>
              </Link>
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
      </div>
      <InlineModal
        isShown={isCreateCheckoutLinkModalShown}
        hide={hideCreateCheckoutLinkModal}
        modalContent={
          <CheckoutLinkManagementModal
            organization={organization}
            productIds={productIds ?? []}
            onClose={(checkoutLink) => {
              setProductIds([])
              hideCreateCheckoutLinkModal()
              router.push(
                `/dashboard/${organization.slug}/products/checkout-links/${checkoutLink.id}`,
              )
            }}
          />
        }
      />
    </>
  )
}
