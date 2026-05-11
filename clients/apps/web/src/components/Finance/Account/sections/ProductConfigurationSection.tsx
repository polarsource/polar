'use client'

import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ArrowRight, PackageIcon } from 'lucide-react'
import Link from 'next/link'
import { StatusBlock } from './StatusBlock'

interface Props {
  organization: schemas['Organization']
}

export const ProductConfigurationSection = ({ organization }: Props) => {
  return (
    <StatusBlock
      tone="neutral"
      icon={PackageIcon}
      title="Set up your products"
      description="Reviewers need to see what you're selling. Create at least one product to continue."
      action={
        <Link href={`/dashboard/${organization.slug}/products/new`}>
          <Button>
            Create product
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      }
    />
  )
}
