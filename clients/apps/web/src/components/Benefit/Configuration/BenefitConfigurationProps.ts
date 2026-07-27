import { schemas } from '@polar-sh/client'

export interface BenefitConfigurationProps {
  benefit: schemas['Benefit']
  organization: schemas['Organization']
}
