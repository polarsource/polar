import { Preview } from 'react-email'
import { schemas } from '../../types'
import FlatWrapperOrganization from '../WrapperOrganization'

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
    <FlatWrapperOrganization organization={organization}>
      {preview ? <Preview>{preview}</Preview> : null}
      {children}
    </FlatWrapperOrganization>
  )
}

export default WrapperOrganization
