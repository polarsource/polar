import { Container } from '@react-email/components'
import { schemas } from '../types'
import OrganizationHeader from './OrganizationHeader'
import WrapperBase from './WrapperBase'

const WrapperOrganization = ({
  children,
  organization,
}: {
  children: React.ReactNode
  organization: schemas['Organization']
}) => {
  return (
    <WrapperBase>
      <Container className="px-[20px] pt-[20px] pb-[10px]">
        <OrganizationHeader organization={organization} />
      </Container>
      <Container className="px-[20px] pt-[10px] pb-[20px]">
        {children}
      </Container>
    </WrapperBase>
  )
}

export default WrapperOrganization
