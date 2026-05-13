'use client'

import { useProducts } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ArrowRight, CheckIcon, Loader2, PackageIcon } from 'lucide-react'
import Link from 'next/link'
import { StatusBlock } from './StatusBlock'

interface Props {
  organization: schemas['Organization']
}

export const ProductConfigurationSection = ({ organization }: Props) => {
  const { data: productsList, isLoading } = useProducts(organization.id, {
    limit: 1,
  })

  if (isLoading) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        paddingVertical="xl"
      >
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </Box>
    )
  }

  const productCount = productsList?.pagination?.total_count ?? 0
  const hasProducts = productCount > 0

  if (hasProducts) {
    return (
      <StatusBlock
        tone="success"
        icon={CheckIcon}
        title="Product configured"
        description={
          productCount === 1
            ? 'You have 1 product ready to sell.'
            : `You have ${productCount} products ready to sell.`
        }
        action={
          <Link href={`/dashboard/${organization.slug}/products`}>
            <Button variant="secondary">
              Manage products
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        }
      />
    )
  }

  return (
    <StatusBlock
      tone="neutral"
      icon={PackageIcon}
      title="Create your first product"
      description="Add at least one product so customers have something to buy."
      action={
        <Link
          href={`/dashboard/${organization.slug}/products/new?return_to=${encodeURIComponent(`/dashboard/${organization.slug}/finance/account`)}`}
        >
          <Button>
            Create a product
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      }
    />
  )
}
