import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import LegacyRecurringProductPrices from '@/components/Products/LegacyRecurringProductPrices'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import { ProductThumbnail } from '@/components/Products/ProductThumbnail'
import { toast } from '@/components/Toast/use-toast'
import { useUpdateProduct } from '@/hooks/queries/products'
import { markdownOptionsJustText } from '@/utils/markdown'
import { hasLegacyRecurringPrices, isMeteredPrice } from '@/utils/product'
import { MoreVertOutlined } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ListItem } from '@polar-sh/ui/components/atoms/List'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import Markdown from 'markdown-to-jsx'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

interface ProductListItemProps {
  product: schemas['Product'] | schemas['CheckoutProduct']
  organization: schemas['Organization']
}

export const ProductListItem = ({
  product,
  organization,
}: ProductListItemProps) => {
  const router = useRouter()
  const {
    show: showModal,
    hide: hideModal,
    isShown: isConfirmModalShown,
  } = useModal()

  const handleContextMenuCallback = (
    callback: (e: React.MouseEvent) => void,
  ) => {
    return (e: React.MouseEvent) => {
      e.stopPropagation()
      callback(e)
    }
  }

  const updateProduct = useUpdateProduct(organization)

  const onArchiveProduct = useCallback(async () => {
    try {
      await updateProduct.mutate({
        id: product.id,
        body: {
          is_archived: true,
        },
      })

      toast({
        title: 'Product archived',
        description: 'The product has been archived',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred while archiving the product',
      })
    }
  }, [updateProduct, product])

  const isUsageBasedProduct = product.prices.some((price) =>
    isMeteredPrice(price),
  )

  return (
    <ListItem
      className="flex flex-row items-center justify-between gap-x-6"
      onSelect={handleContextMenuCallback(() =>
        router.push(`/dashboard/${organization.slug}/products/${product.id}`),
      )}
    >
      <div className="flex flex-grow flex-row items-center gap-x-4 text-sm">
        <ProductThumbnail product={product} />
        <div className="flex flex-col">
          <span className="truncate">{product.name}</span>
          {product.description && (
            <div
              className={twMerge(
                'prose dark:prose-invert dark:text-polar-500 hidden flex-shrink text-sm leading-normal text-gray-500 md:flex',
                'w-full max-w-sm',
              )}
            >
              <Markdown className="truncate" options={markdownOptionsJustText}>
                {product.description}
              </Markdown>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-row items-center gap-x-4 md:gap-x-6">
        {product.is_archived ? (
          <Tooltip>
            <TooltipTrigger>
              <Status
                className="bg-red-100 text-red-500 dark:bg-red-950"
                status="Archived"
              />
            </TooltipTrigger>
            <TooltipContent align="center" side="left">
              Archived products only prevents new subscribers & purchases
            </TooltipContent>
          </Tooltip>
        ) : (
          <>
            {isUsageBasedProduct && (
              <Pill color="green" className="px-3 py-1 text-xs">
                Metered Pricing
              </Pill>
            )}
            <span className="text-sm leading-snug">
              {hasLegacyRecurringPrices(product) ? (
                <LegacyRecurringProductPrices product={product} />
              ) : (
                <ProductPriceLabel product={product} />
              )}
            </span>
            <Link
              href={`/dashboard/${organization.slug}/products/checkout-links?productId=${product.id}`}
              onClick={(e) => {
                e.stopPropagation()
              }}
            >
              <Button size="sm" variant="secondary">
                Share
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none" asChild>
                <Button
                  className={
                    'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
                  }
                  size="icon"
                  variant="secondary"
                >
                  <MoreVertOutlined fontSize="inherit" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="dark:bg-polar-800 bg-gray-50 shadow-lg"
              >
                <DropdownMenuItem
                  onClick={handleContextMenuCallback(() => {
                    if (typeof navigator !== 'undefined') {
                      navigator.clipboard.writeText(product.id)
                    }
                  })}
                >
                  Copy Product ID
                </DropdownMenuItem>
                <DropdownMenuSeparator className="dark:bg-polar-600 bg-gray-200" />
                <DropdownMenuItem
                  onClick={handleContextMenuCallback(() => {
                    router.push(
                      `/dashboard/${organization.slug}/onboarding/integrate?productId=${product.id}`,
                    )
                  })}
                >
                  Integrate Checkout
                </DropdownMenuItem>
                <DropdownMenuSeparator className="dark:bg-polar-600 bg-gray-200" />
                <DropdownMenuItem
                  onClick={handleContextMenuCallback(showModal)}
                >
                  Archive Product
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
      <ConfirmModal
        isShown={isConfirmModalShown}
        hide={hideModal}
        title="Archive Product"
        description="Are you sure you want to archive this product? This action cannot be undone."
        onConfirm={onArchiveProduct}
        destructive
        destructiveText="Archive"
      />
    </ListItem>
  )
}
