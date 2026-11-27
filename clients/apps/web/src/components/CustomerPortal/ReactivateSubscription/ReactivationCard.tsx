import { type BoxProps } from '@polar-sh/orbit/Box'
import { PortalCard } from '../PortalPrimitives'

export const ReactivationCard = ({ children, ...props }: BoxProps) => (
  <PortalCard
    padding={{ base: 'xl', md: '2xl' }}
    borderColor="border-secondary"
    boxShadow="s"
    {...props}
  >
    {children}
  </PortalCard>
)
