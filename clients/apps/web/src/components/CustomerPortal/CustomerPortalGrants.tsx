import { Client, schemas } from '@polar-sh/client'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { useThemePreset } from '@polar-sh/ui/hooks/theming'
import { BenefitGrant } from '../Benefit/BenefitGrant'

export interface CustomerPortalGrantsProps {
  organization: schemas['Organization']
  benefitGrants: schemas['CustomerBenefitGrant'][]
  api: Client
}

export const CustomerPortalGrants = ({
  api,
  organization,
  benefitGrants,
}: CustomerPortalGrantsProps) => {
  const themingPreset = useThemePreset(
    organization.slug === 'midday' ? 'midday' : 'polar',
  )

  return (
    <div className="flex w-full flex-col gap-4">
      <h3 className="text-xl">Benefit Grants</h3>
      <div className="flex flex-col gap-4">
        <List className={themingPreset.polar.list}>
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
