'use client'

import { Client, schemas } from '@polar-sh/client'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { BenefitGrant } from '../Benefit/BenefitGrant'
import { usePortalTranslations } from '@/components/CustomerPortal/PortalLocaleProvider'

export interface CustomerPortalGrantsSimpleProps {
  organization?: schemas['CustomerOrganization']
  benefitGrants: schemas['CustomerBenefitGrant'][]
  api: Client
}

export const CustomerPortalGrantsSimple = ({
  api,
  benefitGrants,
}: CustomerPortalGrantsSimpleProps) => {
  const t = usePortalTranslations()
  return (
    <div className="flex w-full flex-col gap-4">
      <h3 className="text-xl">{t('portal.benefits.title')}</h3>
      <div className="flex flex-col gap-4">
        <List>
          {benefitGrants?.map((benefitGrant) => (
            <ListItem
              key={benefitGrant.id}
              className="py-6 hover:bg-transparent dark:hover:bg-transparent"
            >
              <BenefitGrant api={api} benefitGrant={benefitGrant} />
            </ListItem>
          ))}
        </List>
      </div>
    </div>
  )
}
