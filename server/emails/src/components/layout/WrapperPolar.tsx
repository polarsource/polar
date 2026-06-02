import { Preview } from 'react-email'
import FlatWrapperPolar from '../WrapperPolar'

interface WrapperPolarProps {
  children: React.ReactNode
  preview?: string
}

const WrapperPolar = ({ children, preview }: WrapperPolarProps) => {
  return (
    <FlatWrapperPolar>
      {preview ? <Preview>{preview}</Preview> : null}
      {children}
    </FlatWrapperPolar>
  )
}

export default WrapperPolar
