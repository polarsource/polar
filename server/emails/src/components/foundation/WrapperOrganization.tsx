import { Container, Preview } from 'react-email'
import { schemas } from '../../types'
import OrganizationHeader from '../OrganizationHeader'
import WrapperBase from '../WrapperBase'

interface WrapperOrganizationProps {
  children: React.ReactNode
  organization: schemas['Organization']
  preview?: string
}

const WrapperOrganization = ({
  children,
  organization,
  preview,
}: WrapperOrganizationProps) => {
  return (
    <WrapperBase>
      {preview ? <Preview>{preview}</Preview> : null}
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
