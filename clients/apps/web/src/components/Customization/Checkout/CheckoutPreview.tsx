'use client'

import { Checkout } from '@/components/Checkout/Checkout'
import { StorefrontNav } from '@/components/Organization/StorefrontNav'
import { StorefrontHeader } from '@/components/Profile/StorefrontHeader'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { Product } from '@polar-sh/sdk'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { useContext } from 'react'

const PRODUCT_DESCRIPTION = `# Et Tritonia pectora partus praebentem
## Clipeo mentiris arquato obliqua lacerta
Lorem markdownum bifidosque tenus quod gutture parte genialiter Manto, et potuit: medio mea rogando Hector: bene? Bracchia pectus Acrisioneas adsumus? O Aeaeae flammae, est ait fleverunt illi iamdudum; captatur e. Caede et lues praecipites corrige gessit montis, aspera miserum si facit. Cum milia docta amens nec solito manifesta fitque incognita haec enim, sed resupinus enim.

### Nox flebilis torva
Repetito cum furtum altera
Mare prius gelidumque perde
Gravem colentes impetus reminiscitur invitusque blanditur ipse
Iam maiora
In quoque extulerat tale semper quidque. Fovebat heros quos gaudent et movent agmina fortis.`

const PRODUCT_PREVIEW: Product = {
  id: '123',
  is_recurring: false,
  is_archived: false,
  modified_at: new Date().toDateString(),
  organization_id: '123',
  medias: [
    {
      id: '123',
      created_at: new Date().toDateString(),
      public_url: '/assets/brand/polar_og.jpg',
      is_uploaded: false,
      service: 'product_media',
      mime_type: 'image/png',
      organization_id: '123',
      name: 'blend.png',
      path: '/assets/brand/polar_login.png',
      size: 123,
      size_readable: '123 B',
      storage_version: '1',
      checksum_etag: '123',
      checksum_sha256_base64: '123',
      checksum_sha256_hex: '123',
      version: '1',
      last_modified_at: new Date().toDateString(),
    },
  ],
  prices: [
    {
      id: '123',
      amount_type: 'fixed',
      price_amount: 10000,
      type: 'one_time',
      price_currency: 'usd',
      is_archived: false,
      created_at: new Date().toDateString(),
      modified_at: new Date().toDateString(),
    },
  ],
  name: 'My Saas Pro Tier',
  description: PRODUCT_DESCRIPTION,
  benefits: [
    {
      id: '123',
      description: 'Weekly Newsletter',
      type: 'articles',
      created_at: new Date().toDateString(),
      modified_at: null,
      selectable: false,
      deletable: false,
      organization_id: '123',
    },
  ],
  created_at: new Date().toDateString(),
}

export const CheckoutPreview = () => {
  const { organization: org } = useContext(MaintainerOrganizationContext)

  return (
    <ShadowBox className="dark:bg-polar-950 flex h-full w-full flex-col items-center overflow-y-auto">
      <div className="flex w-full max-w-7xl flex-col items-center gap-y-12">
        <StorefrontHeader organization={org} />
        <StorefrontNav organization={org} />
        <Checkout organization={org} product={PRODUCT_PREVIEW} disabled />
      </div>
    </ShadowBox>
  )
}
